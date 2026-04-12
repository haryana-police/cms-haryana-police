import db from './db.js';
import natural from 'natural';
import LanguageDetect from 'languagedetect';

const lngDetector = new LanguageDetect();
const phonetic = new natural.SoundEx();

// Simple dictionary for internal translation/query augmentation (demo purposes)
const translationDict = {
  'chori': 'theft',
  'choree': 'theft',
  'theft': 'चोरी',
  'assault': 'हमला',
  'hamla': 'assault',
  'accident': 'दुर्घटना',
  'fraud': 'धोखाधड़ी',
  'dhokhadhadi': 'fraud',
  'gurgaon': 'Gurugram',
  'delhi': 'Delhi',
  'gaadi': 'vehicle',
  'naam': 'name',
  'number': 'number',
  'mobile': 'contact_number'
};

/**
 * Detect language of the input query
 */
export const detectLanguage = (text) => {
  if (/[\u0900-\u097F]/.test(text)) return 'hindi';
  const detections = lngDetector.detect(text, 1);
  if (detections.length > 0) {
    return detections[0][0]; 
  }
  return 'english';
};

/**
 * Parse natural language queries (Chat-based search)
 */
export const parseNLQuery = (query) => {
  const filters = {};
  const lowerQuery = query.toLowerCase();

  // Extract location (e.g., "in Gurgaon")
  const locMatch = lowerQuery.match(/in\s+([a-zA-Z0-9]+)/);
  if (locMatch) filters.location = locMatch[1];

  // Extract type
  if (lowerQuery.includes('theft') || lowerQuery.includes('chori')) filters.type = 'Theft';
  if (lowerQuery.includes('assault') || lowerQuery.includes('hamla')) filters.type = 'Assault';
  if (lowerQuery.includes('fraud') || lowerQuery.includes('dhokhadhadi')) filters.type = 'Fraud';
  if (lowerQuery.includes('murder') || lowerQuery.includes('hatya')) filters.type = 'Murder';

  // Extract timeframe (simplified)
  if (lowerQuery.includes('last week') || lowerQuery.includes('pichle hafte')) {
    filters.dateAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lowerQuery.includes('last month') || lowerQuery.includes('pichle mahine')) {
    filters.dateAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  return filters;
};

import { generateEmbedding, cosineSimilarity } from './embeddingService.js';

// ... (existing imports and detectors remains same)

/**
 * Perform Smart Hybrid Search
 */
export const smartSearch = async (query, manualFilters = {}) => {
  let searchResults = [];
  
  // 1. Language Detection & Normalization
  const detectedLng = detectLanguage(query);
  
  // 2. Combine manual filters and NL parsed filters
  const nlFilters = parseNLQuery(query);
  const filters = { ...nlFilters, ...manualFilters };

  // 3. EXACT FIR MATCH (Fast Path)
  let exactMatches = [];
  try {
    const cleanQuery = query.trim().toUpperCase();
    if (cleanQuery.startsWith('FIR-')) {
      const exactCase = db.prepare('SELECT * FROM cases WHERE fir_number = ?').get(cleanQuery);
      if (exactCase) exactMatches.push({ ...exactCase, score: 2.0, match_type: 'exact' });
    }
  } catch(err) {}

  // 4. SEMANTIC VECTOR SEARCH (Internal AI Model)
  let semanticMatches = [];
  try {
    const queryVector = await generateEmbedding(query);
    const allEmbeddings = db.prepare('SELECT * FROM case_embeddings').all();
    
    const cases = db.prepare('SELECT * FROM cases').all();
    const caseMap = new Map(cases.map(c => [c.id, c]));

    semanticMatches = allEmbeddings.map(emb => {
      const similarity = cosineSimilarity(queryVector, JSON.parse(emb.vector));
      return {
        ...caseMap.get(emb.case_id),
        score: similarity,
        match_type: 'semantic'
      };
    }).filter(m => m.score > 0.4); // Threshold for semantic relevance
  } catch (err) {
    console.error('Semantic Search Error:', err);
  }

  // 4. KEYWORD SEARCH (FTS5)
  const ftsQuery = query.split(/\s+/)
    .filter(w => w.length > 1)
    .map(w => w.replace(/[^\w\s\u0900-\u097F]/gi, '') + '*')
    .join(' OR ');
  
  let keywordResults = [];
  if (ftsQuery) {
    let sql = `
      SELECT cases.*, bm25(cases_fts) as rank
      FROM cases
      JOIN cases_fts ON cases_fts.fir_number = cases.fir_number
      WHERE cases_fts MATCH ?
    `;
    const params = [ftsQuery];
    try {
      keywordResults = db.prepare(sql).all(...params).map(r => ({ ...r, score: 0.8, match_type: 'keyword' }));
    } catch (err) {}
  }

  // 5. PHONETIC MATCHING (Fallback for names)
  const queryWords = query.split(/\s+/).map(w => w.toLowerCase());
  const phoneticMatches = [];
  const allCases = db.prepare('SELECT * FROM cases').all();
  
  allCases.forEach(c => {
    const nameFields = [c.complainant_name, c.accused_name, c.victim_name];
    nameFields.forEach(field => {
      if (!field) return;
      const fieldWords = field.toLowerCase().split(/\s+/);
      queryWords.forEach(qw => {
        const safeQw = qw.replace(/[^a-z]/gi, '');
        if (safeQw.length < 3) return;
        fieldWords.forEach(fw => {
          const safeFw = fw.replace(/[^a-z]/gi, '');
          if (safeFw.length < 3) return;
          try {
            if (phonetic.process(safeQw) === phonetic.process(safeFw)) {
              phoneticMatches.push({ ...c, score: 0.7, match_type: 'phonetic' });
            }
          } catch(err) {}
        });
      });
    });
  });

  // 7. HYBRID COMBINATION & RANKING
  const combinedMap = new Map();

  [...exactMatches, ...semanticMatches, ...keywordResults, ...phoneticMatches].forEach(m => {
    // Apply structured filters during combination
    if (filters.type && m.incident_type.toLowerCase() !== filters.type.toLowerCase()) return;
    if (filters.location && !m.location.toLowerCase().includes(filters.location) && !m.district.toLowerCase().includes(filters.location)) return;
    if (filters.dateAfter && new Date(m.incident_date) < new Date(filters.dateAfter)) return;

    if (combinedMap.has(m.id)) {
      const existing = combinedMap.get(m.id);
      // Boost score if multiple match types hit
      existing.score = Math.max(existing.score, m.score) + 0.1;
      if (!existing.all_match_types) existing.all_match_types = [existing.match_type];
      if (!existing.all_match_types.includes(m.match_type)) existing.all_match_types.push(m.match_type);
    } else {
      m.all_match_types = [m.match_type];
      combinedMap.set(m.id, m);
    }
  });

  const finalResults = Array.from(combinedMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  return finalResults;
};


/**
 * Get auto-suggestions for typing/voice
 */
export const getSuggestions = (partial) => {
  if (!partial || partial.length < 2) return [];
  
  const sql = `
    SELECT DISTINCT val FROM (
      SELECT fir_number as val FROM cases WHERE fir_number LIKE ?
      UNION
      SELECT complainant_name as val FROM cases WHERE complainant_name LIKE ?
      UNION
      SELECT location as val FROM cases WHERE location LIKE ?
      UNION
      SELECT incident_type as val FROM cases WHERE incident_type LIKE ?
      UNION
      SELECT contact_number as val FROM cases WHERE contact_number LIKE ?
    ) LIMIT 8
  `;
  const pattern = `%${partial}%`;
  return db.prepare(sql).all(pattern, pattern, pattern, pattern, pattern).map(r => r.val);
};
