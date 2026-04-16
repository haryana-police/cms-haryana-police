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
  const detectedLng = query ? detectLanguage(query) : 'english';
  
  // 2. Combine manual filters and NL parsed filters
  const nlFilters = query ? parseNLQuery(query) : {};
  const filters = { ...nlFilters, ...manualFilters };

  // 3. Handle Empty Query case (Fetch from DB with filters directly)
  if (!query || query.trim() === '') {
    let sql = 'SELECT * FROM cases WHERE 1=1';
    const params = [];

    if (filters.district) {
      sql += ' AND (LOWER(district) = ? OR LOWER(location) LIKE ?)';
      params.push(filters.district.toLowerCase(), `%${filters.district.toLowerCase()}%`);
    }
    if (filters.caseType) {
      sql += ' AND LOWER(incident_type) LIKE ?';
      params.push(`%${filters.caseType.toLowerCase().trim()}%`);
    }
    if (filters.dateAfter) {
      // Normalize date to YYYY-MM-DD for stable SQLite string comparison
      const normalizedDate = filters.dateAfter.split('T')[0];
      sql += ' AND incident_date >= ?';
      params.push(normalizedDate);
    }

    sql += ' ORDER BY incident_date DESC LIMIT 100';

    try {
      const filteredCases = db.prepare(sql).all(...params);
      searchResults = filteredCases.map(c => ({
        ...c,
        score: 0.5,
        match_type: 'base'
      }));
    } catch (err) {
      console.error('SQL Filter Error:', err);
      searchResults = [];
    }
  } else {
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
      
      // OPTIMIZATION: Filter embeddings by district/type *before* calculation
      let embSql = `
        SELECT ce.*, c.incident_type, c.district, c.location, c.fir_number, c.complainant_name, c.accused_name, c.victim_name, c.description, c.status, c.incident_date, c.id as case_id
        FROM case_embeddings ce
        JOIN cases c ON ce.case_id = c.id
        WHERE 1=1
      `;
      const embParams = [];
      if (filters.district) {
        embSql += ' AND (LOWER(c.district) = ? OR LOWER(c.location) LIKE ?)';
        embParams.push(filters.district.toLowerCase(), `%${filters.district.toLowerCase()}%`);
      }
      if (filters.caseType) {
        embSql += ' AND LOWER(c.incident_type) LIKE ?';
        embParams.push(`%${filters.caseType.toLowerCase().trim()}%`);
      }

      const candidateEmbeddings = db.prepare(embSql).all(...embParams);
      
      semanticMatches = candidateEmbeddings.map(emb => {
        const similarity = cosineSimilarity(queryVector, JSON.parse(emb.vector));
        return {
          ...emb, // Contains all case data from the JOIN
          id: emb.case_id,
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
      
      // OPTIMIZATION: Add dropdown filters to Keyword Search
      if (filters.district) {
        sql += ' AND (LOWER(cases.district) = ? OR LOWER(cases.location) LIKE ?)';
        params.push(filters.district.toLowerCase(), `%${filters.district.toLowerCase()}%`);
      }
      if (filters.caseType) {
        sql += ' AND LOWER(cases.incident_type) LIKE ?';
        params.push(`%${filters.caseType.toLowerCase().trim()}%`);
      }

      try {
        keywordResults = db.prepare(sql).all(...params).map(r => ({ ...r, score: 0.8, match_type: 'keyword' }));
      } catch (err) {}
    }

    // 5. PHONETIC MATCHING (Fallback for names)
    const queryWords = query.split(/\s+/).map(w => w.toLowerCase());
    const phoneticMatches = [];
    
    // OPTIMIZATION: Filter cases before phonetic processing
    let phonSql = 'SELECT * FROM cases WHERE 1=1';
    const phonParams = [];
    if (filters.district) {
      phonSql += ' AND (LOWER(district) = ? OR LOWER(location) LIKE ?)';
      phonParams.push(filters.district.toLowerCase(), `%${filters.district.toLowerCase()}%`);
    }
    if (filters.caseType) {
      phonSql += ' AND LOWER(incident_type) LIKE ?';
      phonParams.push(`%${filters.caseType.toLowerCase().trim()}%`);
    }

    const allCasesForPhonetic = db.prepare(phonSql).all(...phonParams);
    
    allCasesForPhonetic.forEach(c => {
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

    searchResults = [...exactMatches, ...semanticMatches, ...keywordResults, ...phoneticMatches];
  }

  // 7. HYBRID COMBINATION & RANKING
  const combinedMap = new Map();

  searchResults.forEach(m => {
    // 8. FINAL FILTERING ENFORCEMENT
    // Apply structured filters safely, allowing any match that closely resembles the filter.
    // SQL has already safely filtered the results most of the time.
    if (filters.caseType && m.incident_type) {
      const matchType = filters.caseType.toLowerCase().trim();
      const caseTypeVal = m.incident_type.toLowerCase().trim();
      if (!caseTypeVal.includes(matchType) && !matchType.includes(caseTypeVal)) return;
    }
    if (filters.district) {
      const searchLoc = filters.district.toLowerCase().trim();
      const mLoc = (m.location || '').toLowerCase();
      const mDist = (m.district || '').toLowerCase();
      
      // Try to be forgiving: if either contains the other, let it pass.
      const locMatch = mLoc.includes(searchLoc) || searchLoc.includes(mDist);
      const distMatch = mDist.includes(searchLoc) || searchLoc.includes(mDist);
      
      if (!locMatch && !distMatch) return;
    }
    if (filters.dateAfter && m.incident_date) {
      const filterDate = filters.dateAfter.split('T')[0];
      const caseDate = m.incident_date.split(' ')[0]; // Handle cases with timestamps
      if (caseDate < filterDate) return;
    }

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
    .sort((a, b) => {
      // Primary sort by score
      if (Math.abs(b.score - a.score) > 0.05) return b.score - a.score;
      // Secondary sort by date
      return new Date(b.incident_date) - new Date(a.incident_date);
    })
    .slice(0, 50);

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
