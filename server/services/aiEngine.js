/**
 * AI Engine — Dual LLM Strategy
 *
 * Gemini 1.5 Flash  → Heavy document analysis (long context, bilingual, entity extraction)
 * Groq LLaMA 3.3 70B → Real-time interactive queries (sub-second, conversational)
 *
 * Both fall back gracefully to an enhanced rule-based engine if keys are unavailable.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import 'dotenv/config';

// ── Initialise clients ────────────────────────────────────────────────────────
let geminiModel = null;
let groqClient = null;

try {
  if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('✅ Gemini 1.5 Flash initialized (document analysis)');
  }
} catch (e) {
  console.warn('⚠️  Gemini init failed, using rule-based fallback:', e.message);
}

try {
  if (process.env.GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log('✅ Groq LLaMA 3.3 70B initialized (real-time queries)');
  }
} catch (e) {
  console.warn('⚠️  Groq init failed, using rule-based fallback:', e.message);
}

// ── Gemini helper ─────────────────────────────────────────────────────────────
async function geminiGenerate(prompt) {
  if (!geminiModel) throw new Error('Gemini not initialized');
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}

// ── Groq helper ───────────────────────────────────────────────────────────────
async function groqGenerate(systemPrompt, userPrompt, maxTokens = 1024) {
  if (!groqClient) throw new Error('Groq not initialized');
  const completion = await groqClient.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
  return completion.choices[0]?.message?.content || '';
}

// ── Enhanced rule-based fallback ──────────────────────────────────────────────
function ruleBasedExtract(text, docType) {
  const persons = [];
  const events = [];
  const phones = [];
  const locations = [];
  const amounts = [];

  // Phone numbers (Indian format)
  const phoneMatches = [...new Set(text.match(/\b[6-9]\d{9}\b/g) || [])];
  phoneMatches.forEach(ph => phones.push({ value: ph, type: 'Phone', confidence: 0.9 }));

  // Names (two+ capitalized words)
  const nameRegex = /\b([A-Z][a-z]{1,20}(?:\s[A-Z][a-z]{1,20}){1,3})\b/g;
  const nameMatches = [...new Set(text.match(nameRegex) || [])].slice(0, 12);
  nameMatches.forEach(name => {
    if (!['Police Station', 'First Information', 'High Court', 'District Court'].includes(name)) {
      persons.push({ name, role: inferRole(name, text), confidence: 0.7 });
    }
  });

  // Dates and events
  const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;
  const dateMatches = text.match(dateRegex) || [];
  dateMatches.slice(0, 8).forEach((d, i) => {
    const context = text.substring(Math.max(0, text.indexOf(d) - 60), text.indexOf(d) + 80);
    events.push({ date: d, description: context.trim().replace(/\s+/g, ' '), confidence: 0.8 });
  });

  // Amounts (Indian currency)
  const amountRegex = /(?:Rs\.?|₹)\s*([\d,]+(?:\.\d{2})?)|(\d+(?:,\d{2,3})+(?:\.\d{2})?)\s*(?:rupees?|lakh|crore)/gi;
  const amountMatches = [...text.matchAll(amountRegex)];
  amountMatches.forEach(m => amounts.push({ value: m[1] || m[2], raw: m[0] }));

  // Locations (common Indian location patterns)
  const locationRegex = /\b(?:Sector|Village|PS|Police Station|District|State)\s+[\w\s]+\b/gi;
  const locationMatches = [...new Set(text.match(locationRegex) || [])].slice(0, 6);
  locationMatches.forEach(l => locations.push({ name: l.trim() }));

  // Account numbers
  const accountRegex = /\b\d{9,18}\b/g;
  const accounts = [...new Set(text.match(accountRegex) || [])].slice(0, 5);

  // IMEI numbers
  const imeiRegex = /\bIMEI[:\s]+(\d{15})\b/gi;
  const imeis = [...text.matchAll(imeiRegex)].map(m => m[1]);

  return {
    persons,
    phones,
    events,
    locations,
    amounts,
    accounts,
    imeis,
    docType,
    language: detectLanguage(text),
    confidence: 0.7,
    method: 'rule-based',
  };
}

function inferRole(name, text) {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(name.toLowerCase());
  if (idx === -1) return 'unknown';
  const ctx = lower.substring(Math.max(0, idx - 50), idx + 100);
  if (ctx.includes('accused') || ctx.includes('arrested') || ctx.includes('आरोपी')) return 'accused';
  if (ctx.includes('victim') || ctx.includes('complainant') || ctx.includes('पीड़ित')) return 'victim';
  if (ctx.includes('witness') || ctx.includes('गवाह')) return 'witness';
  if (ctx.includes('officer') || ctx.includes('inspector') || ctx.includes('si ') || ctx.includes('sho')) return 'officer';
  return 'person';
}

function detectLanguage(text) {
  const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  const total = text.length;
  if (hindiChars / total > 0.3) return 'hindi';
  if (hindiChars / total > 0.05) return 'mixed';
  return 'english';
}

// ── Export: Classify Document ─────────────────────────────────────────────────
export async function classifyDocument(text) {
  const prompt = `You are a police document classifier for Indian law enforcement. Classify this document into ONE of these types:
FIR, Complaint, Witness Statement, Accused Statement, CDR Report, Bank Statement, Forensic Report, Arrest Memo, Seizure Memo, Court Order, OSINT Report, IPDR Report, Case Diary, Other.

Also detect the language: english, hindi, or mixed.
Also give a brief summary (1 sentence) of what the document contains.

Respond ONLY as JSON: {"doc_type": "...", "language": "...", "summary": "...", "confidence": 0.0-1.0}

Document (first 800 chars):
${text.substring(0, 800)}`;

  try {
    const raw = await geminiGenerate(prompt);
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    return json ? JSON.parse(json) : { doc_type: 'Other', language: detectLanguage(text), confidence: 0.5 };
  } catch {
    // Rule-based fallback
    const lower = text.toLowerCase();
    let doc_type = 'Other';
    if (lower.includes('first information report') || lower.includes('प्राथमिकी')) doc_type = 'FIR';
    else if (lower.includes('complaint') || lower.includes('शिकायत')) doc_type = 'Complaint';
    else if (lower.includes('statement') || lower.includes('बयान')) doc_type = 'Witness Statement';
    else if (lower.includes('call detail') || lower.includes('cdr')) doc_type = 'CDR Report';
    else if (lower.includes('bank') || lower.includes('transaction') || lower.includes('debit') || lower.includes('credit')) doc_type = 'Bank Statement';
    else if (lower.includes('forensic') || lower.includes('fsl')) doc_type = 'Forensic Report';
    else if (lower.includes('arrest') || lower.includes('गिरफ्तारी')) doc_type = 'Arrest Memo';
    return { doc_type, language: detectLanguage(text), confidence: 0.6, summary: 'Document classified by rule-based system.' };
  }
}

// ── Export: Extract Entities (Gemini for long docs) ───────────────────────────
export async function extractEntitiesAI(text, docType, caseId) {
  const truncatedText = text.substring(0, 6000); // Gemini's long context, but keep reasonable

  const prompt = `You are an expert forensic analyst for the Haryana Police. Extract all investigative entities from this ${docType} document.

Extract and return ONLY valid JSON with this exact structure:
{
  "persons": [{"name": "...", "role": "accused|victim|witness|officer|unknown", "phone": "...", "address": "...", "age": null, "confidence": 0.8, "context": "brief context"}],
  "phones": [{"number": "...", "owner": "...", "role": "accused|victim|unknown", "confidence": 0.9}],
  "events": [{"date": "...", "description": "...", "location": "...", "category": "arrest|statement|evidence|registration|raid|other", "confidence": 0.8}],
  "locations": [{"name": "...", "type": "crime_scene|residence|workplace|police_station|court|other"}],
  "bank_accounts": [{"account_no": "...", "bank": "...", "holder": "...", "amount": null}],
  "ip_addresses": [{"ip": "...", "context": "..."}],
  "imei_numbers": [{"imei": "...", "owner": "..."}],
  "key_findings": ["critical finding 1", "critical finding 2"],
  "language": "english|hindi|mixed",
  "doc_summary": "one sentence summary"
}

Support Hindi and English text. For Hindi names/terms, transliterate to English.
Document:
${truncatedText}`;

  try {
    const raw = await geminiGenerate(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      parsed.method = 'gemini';
      return parsed;
    }
  } catch (e) {
    console.error('Gemini extraction failed, using rule-based:', e.message);
  }

  // Fallback
  const ruleResult = ruleBasedExtract(text, docType);
  return {
    persons: ruleResult.persons,
    phones: ruleResult.phones,
    events: ruleResult.events,
    locations: ruleResult.locations,
    bank_accounts: [],
    ip_addresses: [],
    imei_numbers: ruleResult.imeis.map(i => ({ imei: i, owner: 'Unknown' })),
    key_findings: [`${ruleResult.persons.length} persons identified`, `${ruleResult.phones.length} phone numbers detected`],
    language: ruleResult.language,
    doc_summary: `${docType} document processed via rule-based extraction.`,
    method: 'rule-based',
  };
}

// ── Export: Answer NL Query (Groq for speed) ──────────────────────────────────
export async function answerQueryAI(question, wikiContext, caseId) {
  const systemPrompt = `You are an AI investigative assistant for the Haryana Police. You help Investigating Officers analyze criminal case data.

RULES:
- Base answers ONLY on the provided case wiki context
- Clearly distinguish between FACTS (from documents) and AI ANALYSIS (your reasoning)
- Cite which wiki page/document each fact comes from
- Flag any gaps or unexplored leads
- Be concise but thorough
- Format response with clear sections
- NEVER make accusations; present evidence objectively
- End every answer with "⚠️ Advisory: This is AI analysis only. Final decisions rest with the Investigating Officer."`;

  const userPrompt = `Case Wiki Context:
---
${wikiContext.substring(0, 3000)}
---

Investigating Officer's Question: ${question}

Provide a structured investigative analysis in 200-300 words.`;

  try {
    const answer = await groqGenerate(systemPrompt, userPrompt, 600);
    return { answer, method: 'groq', confidence: 0.85 };
  } catch (e) {
    console.error('Groq query failed:', e.message);
    // Fallback: rule-based routing
    return { answer: buildRuleBasedAnswer(question, wikiContext), method: 'rule-based', confidence: 0.65 };
  }
}

// ── Export: Generate Investigative Leads (Groq) ────────────────────────────────
export async function generateLeadsAI(caseContext) {
  const systemPrompt = `You are a senior forensic analyst for the Indian Police. Generate actionable investigative leads based on the case data provided.
  
Format response as JSON array ONLY:
[
  {
    "title": "Lead title (short)",
    "description": "What to investigate and why",
    "priority": "high|medium|low",
    "confidence": 0.0-1.0,
    "category": "financial|digital|physical|witness|telecom|other",
    "sources": ["source document 1", "source 2"],
    "action": "Specific action to take",
    "legal_basis": "Relevant IPC/BNS/CrPC section if applicable"
  }
]
Generate 5-8 specific, actionable leads. Focus on unexplored angles.`;

  const userPrompt = `Case Data:
${caseContext.substring(0, 4000)}

Generate investigative leads JSON array:`;

  try {
    const raw = await groqGenerate(systemPrompt, userPrompt, 1500);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) return { leads: JSON.parse(jsonMatch[0]), method: 'groq' };
  } catch (e) {
    console.error('Groq lead generation failed:', e.message);
  }

  return { leads: buildRuleBasedLeads(caseContext), method: 'rule-based' };
}

// ── Export: Detect Contradictions (Gemini for cross-doc analysis) ─────────────
export async function detectContradictionsAI(documents) {
  if (!documents || documents.length < 2) return { contradictions: [], method: 'na' };

  const docSummaries = documents.slice(0, 6).map((d, i) =>
    `Document ${i + 1} [${d.doc_type}]:\n${d.content_text?.substring(0, 800) || '(no text)'}`
  ).join('\n\n---\n\n');

  const prompt = `You are an expert forensic investigator specializing in cross-document analysis for Indian law enforcement.

Analyze these case documents and identify ALL contradictions, inconsistencies, and discrepancies between them.

Return ONLY JSON:
{
  "contradictions": [
    {
      "title": "Short title of contradiction",
      "severity": "critical|moderate|minor",
      "category": "location|timeline|identity|financial|statement|other",
      "description": "Detailed explanation of the contradiction",
      "document_a": "Which document claims what",
      "document_b": "Which document contradicts it",
      "significance": "Why this matters for the investigation",
      "recommended_action": "What the IO should do to resolve this"
    }
  ]
}

Documents to analyze:
${docSummaries}`;

  try {
    const raw = await geminiGenerate(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return { ...JSON.parse(jsonMatch[0]), method: 'gemini' };
  } catch (e) {
    console.error('Gemini contradiction detection failed:', e.message);
  }

  return { contradictions: buildRuleBasedContradictions(documents), method: 'rule-based' };
}

// ── Fallback helpers ──────────────────────────────────────────────────────────
function buildRuleBasedAnswer(question, context) {
  const q = question.toLowerCase();
  const lines = context.split('\n').filter(l => l.trim());

  if (q.includes('suspect') || q.includes('accused')) {
    const relevant = lines.filter(l => l.match(/accused|suspect|arrested/i)).slice(0, 5);
    return relevant.length
      ? `**Persons of Interest:**\n${relevant.join('\n')}\n\n⚠️ Advisory: This is AI analysis only. Final decisions rest with the Investigating Officer.`
      : 'No suspect information found in current case documents. Ingest FIR or arrest memo.\n\n⚠️ Advisory: AI analysis only.';
  }
  if (q.includes('financial') || q.includes('bank') || q.includes('money')) {
    const relevant = lines.filter(l => l.match(/bank|account|money|₹|transfer|lakh/i)).slice(0, 5);
    return relevant.length
      ? `**Financial Trail:**\n${relevant.join('\n')}\n\n⚠️ Advisory: AI analysis only.`
      : 'No financial records found. Upload bank statements.\n\n⚠️ Advisory: AI analysis only.';
  }
  if (q.includes('lead') || q.includes('next')) {
    const relevant = lines.filter(l => l.match(/\[ \]|\- \[/)).slice(0, 5);
    return relevant.length
      ? `**Active Leads:**\n${relevant.join('\n')}\n\n⚠️ Advisory: AI analysis only.`
      : 'No leads tracked. Ingest more documents to generate leads.\n\n⚠️ Advisory: AI analysis only.';
  }

  const relevant = lines.filter(l => l.length > 20 && !l.startsWith('#')).slice(0, 6);
  return `Based on case wiki (${lines.length} entries):\n\n${relevant.join('\n')}\n\n⚠️ Advisory: This is AI analysis only. Final decisions rest with the Investigating Officer.`;
}

function buildRuleBasedLeads(context) {
  const leads = [];
  const lower = context.toLowerCase();

  if (lower.match(/\d{10}/)) {
    leads.push({
      title: 'Unidentified Phone Numbers Require CDR',
      description: 'Phone numbers found in case documents have not been fully traced.',
      priority: 'high', confidence: 0.8, category: 'telecom',
      sources: ['Case documents'], action: 'Request CDR/IPDR from TSP for all unidentified numbers.',
      legal_basis: 'CrPC Section 91'
    });
  }
  if (lower.includes('bank') || lower.includes('₹') || lower.includes('transfer')) {
    leads.push({
      title: 'Financial Trail Needs Complete Mapping',
      description: 'Financial transactions identified — full money trail not yet mapped.',
      priority: 'high', confidence: 0.85, category: 'financial',
      sources: ['Bank statement', 'Case documents'], action: 'Obtain bank statements for all identified accounts under CrPC 91.',
      legal_basis: 'CrPC Section 91, PMLA Section 17'
    });
  }
  if (lower.includes('accused') || lower.includes('arrested')) {
    leads.push({
      title: 'Check Prior Criminal Record of Accused',
      description: 'Accused identified — prior criminal history not yet verified.',
      priority: 'medium', confidence: 0.75, category: 'other',
      sources: ['FIR/Complaint'], action: 'Run CCTNS check for all accused persons.',
      legal_basis: 'CrPC Section 54'
    });
  }
  leads.push({
    title: 'CCTV Footage Analysis Required',
    description: 'Physical crime scene investigation may benefit from surveillance footage.',
    priority: 'medium', confidence: 0.6, category: 'physical',
    sources: ['Case location data'], action: 'Identify and retrieve CCTV footage from crime scene and surrounding areas.',
    legal_basis: 'CrPC Section 91'
  });

  return leads;
}

function buildRuleBasedContradictions(documents) {
  const contradictions = [];
  const allText = documents.map(d => d.content_text || '').join(' ');

  // Check phone contradictions
  const phones = [...new Set(allText.match(/\b[6-9]\d{9}\b/g) || [])];
  if (phones.length > 1 && documents.length > 1) {
    contradictions.push({
      title: 'Multiple Statements Reference Same Phone Differently',
      severity: 'moderate',
      category: 'identity',
      description: `Phone numbers ${phones.slice(0, 2).join(', ')} appear across multiple documents with potentially different attributions.`,
      document_a: documents[0]?.doc_type || 'Document 1',
      document_b: documents[1]?.doc_type || 'Document 2',
      significance: 'Could indicate false identity or phone sharing among accused.',
      recommended_action: 'Cross-reference CDR with named persons; verify phone ownership via TSP records.'
    });
  }

  return contradictions;
}
