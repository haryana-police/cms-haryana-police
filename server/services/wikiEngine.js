/**
 * Wiki Engine — AI-Powered (Karpathy LLM Wiki Pattern)
 *
 * Architecture (3 layers):
 *   1. Raw sources   → case_documents table (immutable originals)
 *   2. The Wiki      → case_wiki_pages (AI-maintained markdown per case)
 *   3. Structured DB → case_persons, cdr_records, bank_transactions, case_leads, case_contradictions
 *
 * AI Provider strategy:
 *   - Gemini 1.5 Flash → Heavy extraction (document analysis, contradiction detection)
 *   - Groq LLaMA 3.3  → Fast queries and lead generation
 */

import 'dotenv/config';
import db from '../db.js';
import {
  classifyDocument,
  extractEntitiesAI,
  answerQueryAI,
  generateLeadsAI,
  detectContradictionsAI,
} from './aiEngine.js';
import { parseCSV, detectBankStatementSchema, detectCDRSchema } from './fileParser.js';

// ── Wiki page helpers ─────────────────────────────────────────────────────────
function getWikiPage(caseId, slug) {
  return db.prepare('SELECT * FROM case_wiki_pages WHERE case_id = ? AND page_slug = ?').get(caseId, slug);
}

function upsertWikiPage(caseId, slug, contentMd) {
  const now = new Date().toISOString();
  const existing = getWikiPage(caseId, slug);
  if (existing) {
    db.prepare('UPDATE case_wiki_pages SET content_md = ?, updated_at = ? WHERE case_id = ? AND page_slug = ?')
      .run(contentMd, now, caseId, slug);
  } else {
    db.prepare('INSERT INTO case_wiki_pages (case_id, page_slug, content_md, updated_at) VALUES (?, ?, ?, ?)')
      .run(caseId, slug, contentMd, now);
  }
}

function appendToLog(caseId, entry) {
  const existing = getWikiPage(caseId, 'log');
  const date = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  const logLine = `\n## [${date}] ${entry}\n`;
  const newContent = (existing?.content_md || '# Case Log\n') + logLine;
  upsertWikiPage(caseId, 'log', newContent);
}

// ── Entity persistence helpers ────────────────────────────────────────────────
function persistPersons(caseId, persons) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO case_persons (id, case_id, name, role, phone, address, age)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const inserted = [];
  persons.forEach(p => {
    const id = `per-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const role = ['accused', 'victim', 'witness', 'officer'].includes(p.role) ? p.role : 'witness';
    try {
      const result = insert.run(id, caseId, p.name, role, p.phone || null, p.address || null, p.age || null);
      if (result.changes > 0) inserted.push(p);
    } catch {}
  });
  return inserted;
}

function persistBankTransactions(caseId, records, csvHeaders) {
  const schema = detectBankStatementSchema(csvHeaders);
  if (!schema.isBank) return 0;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO bank_transactions (id, case_id, date, description, debit, credit, balance, ref_no, account_no)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  records.forEach((row, i) => {
    const id = `btxn-${Date.now()}-${i}`;
    const parseAmount = (val) => {
      if (!val) return null;
      return parseFloat(String(val).replace(/[,₹Rs. ]/g, '')) || null;
    };

    try {
      insert.run(
        id, caseId,
        row[schema.dateCol] || null,
        row[schema.descCol] || '',
        parseAmount(row[schema.debitCol]),
        parseAmount(row[schema.creditCol]),
        parseAmount(row[schema.balanceCol]),
        row[schema.refCol] || null,
        null
      );
      count++;
    } catch {}
  });
  return count;
}

function persistCDRRecords(caseId, records, csvHeaders) {
  const schema = detectCDRSchema(csvHeaders);
  if (!schema.isCDR) return 0;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO cdr_records (id, case_id, caller, receiver, duration_sec, call_time, tower_id, tower_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  records.forEach((row, i) => {
    const id = `cdr-u-${Date.now()}-${i}`;
    try {
      insert.run(
        id, caseId,
        row[schema.callerCol] || '',
        row[schema.receiverCol] || '',
        parseInt(row[schema.durationCol]) || 0,
        row[schema.dateCol] || new Date().toISOString(),
        null,
        null
      );
      count++;
    } catch {}
  });
  return count;
}

// ── Wiki page content builders ────────────────────────────────────────────────
function buildEntitiesPage(caseId, newEntities) {
  const existing = getWikiPage(caseId, 'entities');
  const prevContent = existing?.content_md || `# Entities — Case ${caseId}\n\n`;

  const now = new Date().toLocaleDateString('en-IN');
  let section = `\n---\n## From ${newEntities.docType} · ${now}\n`;

  if (newEntities.persons?.length) {
    section += '\n### Persons\n';
    section += newEntities.persons.map(p =>
      `- **${p.name}** (${p.role?.toUpperCase() || 'UNKNOWN'})${p.phone ? ` — Phone: \`${p.phone}\`` : ''}${p.address ? ` — ${p.address}` : ''}${p.context ? ` — *${p.context}*` : ''}`
    ).join('\n') + '\n';
  }

  if (newEntities.phones?.length) {
    section += '\n### Phone Numbers\n';
    section += newEntities.phones.map(ph =>
      `- \`${ph.number || ph.value}\` — ${ph.owner || 'Unknown'} (${ph.role || 'UNKNOWN'})`
    ).join('\n') + '\n';
  }

  if (newEntities.bank_accounts?.length) {
    section += '\n### Bank Accounts\n';
    section += newEntities.bank_accounts.map(a =>
      `- A/C \`${a.account_no}\` — ${a.bank || 'Unknown Bank'} — ${a.holder || 'Unknown'}`
    ).join('\n') + '\n';
  }

  if (newEntities.key_findings?.length) {
    section += '\n### Key Findings\n';
    section += newEntities.key_findings.map(f => `- ⚠️ ${f}`).join('\n') + '\n';
  }

  upsertWikiPage(caseId, 'entities', prevContent + section);
}

function buildIndexPage(caseId) {
  const pages = db.prepare('SELECT page_slug FROM case_wiki_pages WHERE case_id = ?').all(caseId);
  const pageList = pages.map(p => p.page_slug);

  const index = `# Investigation Wiki — Case ${caseId}

| Module | Description |
|---|---|
${pageList.includes('entities') ? '| [entities](entities) | Persons, phones, accounts extracted from all documents |' : ''}
${pageList.includes('timeline') ? '| [timeline](timeline) | Chronological events from all ingested documents |' : ''}
${pageList.includes('leads') ? '| [leads](leads) | AI-generated investigative leads |' : ''}
${pageList.includes('contradictions') ? '| [contradictions](contradictions) | Cross-document inconsistencies detected |' : ''}
${pageList.includes('log') ? '| [log](log) | Complete operation audit trail |' : ''}
`;
  upsertWikiPage(caseId, 'index', index);
}

// ── Core: Ingest Document ──────────────────────────────────────────────────────
export async function ingestDocument(caseId, docType, content, structuredData) {
  // 1. Classify document
  let classification = { doc_type: docType, language: 'english', confidence: 0.8 };
  try {
    classification = await classifyDocument(content);
    if (classification.doc_type === 'Other' && docType !== 'Other') {
      classification.doc_type = docType;
    }
  } catch {}

  // 2. AI entity extraction (Gemini)
  let entities = { persons: [], phones: [], events: [], key_findings: [], method: 'none' };
  try {
    entities = await extractEntitiesAI(content, classification.doc_type, caseId);
    entities.docType = classification.doc_type;
  } catch (e) {
    console.error('Entity extraction error:', e.message);
  }

  // 3. Handle structured CSV data (bank/CDR)
  let bankCount = 0, cdrCount = 0;
  if (structuredData?.records && structuredData?.headers) {
    bankCount = persistBankTransactions(caseId, structuredData.records, structuredData.headers);
    if (bankCount === 0) {
      cdrCount = persistCDRRecords(caseId, structuredData.records, structuredData.headers);
    }
  }

  // 4. Persist extracted persons to case_persons
  const newPersons = persistPersons(caseId, entities.persons || []);

  // 5. Update wiki pages
  buildEntitiesPage(caseId, entities);

  // Update timeline wiki
  if (entities.events?.length) {
    const existing = getWikiPage(caseId, 'timeline');
    const prevTimeline = existing?.content_md || `# Case Timeline\n\n`;
    const section = `\n## Events from ${classification.doc_type}\n` +
      entities.events.map(e => `- **${e.date}** — ${e.description}${e.location ? ` *(${e.location})*` : ''}`).join('\n') + '\n';
    upsertWikiPage(caseId, 'timeline', prevTimeline + section);
  }

  // 6. Run contradiction detection (Gemini)
  let contradictions = [];
  try {
    const docs = db.prepare('SELECT doc_type, content_text FROM case_documents WHERE case_id = ? ORDER BY uploaded_at DESC LIMIT 6').all(caseId);
    if (docs.length >= 1) {
      const result = await detectContradictionsAI([{ doc_type: classification.doc_type, content_text: content }, ...docs]);
      if (result.contradictions?.length) {
        contradictions = result.contradictions;
        // Persist to DB
        const insert = db.prepare(`
          INSERT INTO case_contradictions (id, case_id, title, severity, category, description, document_a, document_b, recommended_action)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        contradictions.forEach(c => {
          const id = `cont-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
          try { insert.run(id, caseId, c.title, c.severity, c.category, c.description, c.document_a, c.document_b, c.recommended_action); } catch {}
        });

        const existing = getWikiPage(caseId, 'contradictions');
        const prevContr = existing?.content_md || '# Contradictions & Inconsistencies\n\n';
        const section = '\n## Detected on ' + new Date().toLocaleDateString('en-IN') + '\n' +
          contradictions.map(c => `- ⚠️ **${c.title}** [${c.severity?.toUpperCase()}]\n  ${c.description}\n  > *Recommended:* ${c.recommended_action || '—'}`).join('\n\n') + '\n';
        upsertWikiPage(caseId, 'contradictions', prevContr + section);
      }
    }
  } catch (e) {
    console.error('Contradiction detection error:', e.message);
  }

  // 7. Generate leads (Groq)
  try {
    const wikiContent = db.prepare('SELECT page_slug, content_md FROM case_wiki_pages WHERE case_id = ?').all(caseId)
      .map(p => `## ${p.page_slug}\n${p.content_md}`).join('\n\n');
    const leadsResult = await generateLeadsAI(wikiContent);
    if (leadsResult.leads?.length) {
      const insert = db.prepare(`
        INSERT INTO case_leads (id, case_id, title, description, priority, confidence, category, sources, action, legal_basis)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      leadsResult.leads.forEach(l => {
        const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        try {
          insert.run(id, caseId, l.title, l.description, l.priority, l.confidence,
            l.category, JSON.stringify(l.sources || []), l.action, l.legal_basis || null);
        } catch {}
      });

      const existingLeads = getWikiPage(caseId, 'leads');
      const prevLeads = existingLeads?.content_md || '# Investigative Leads\n\n';
      const section = '\n## AI Generated — ' + new Date().toLocaleDateString('en-IN') + '\n' +
        leadsResult.leads.map(l => `- [ ] **[${l.priority?.toUpperCase()}]** ${l.title}\n  ${l.description}`).join('\n') + '\n';
      upsertWikiPage(caseId, 'leads', prevLeads + section);
    }
  } catch (e) {
    console.error('Lead generation error:', e.message);
  }

  // 8. Store raw document
  try {
    db.prepare('INSERT INTO case_documents (id, case_id, doc_type, content_text, uploaded_at) VALUES (?, ?, ?, ?, ?)')
      .run(`doc-${Date.now()}`, caseId, classification.doc_type, content.substring(0, 50000), new Date().toISOString());
  } catch {}

  // 9. Update index and log
  buildIndexPage(caseId);
  appendToLog(caseId, `ingest | ${classification.doc_type} | ${newPersons.length} persons, ${entities.events?.length || 0} events, ${contradictions.length} contradictions, ${bankCount || cdrCount} records | method: ${entities.method || 'unknown'}`);

  return {
    entities,
    newPersons,
    contradictions,
    bankTransactions: bankCount,
    cdrRecords: cdrCount,
    classification,
  };
}

// ── Core: Query Wiki (Groq for speed) ─────────────────────────────────────────
export async function queryWiki(caseId, question) {
  const pages = db.prepare('SELECT page_slug, content_md FROM case_wiki_pages WHERE case_id = ? AND page_slug NOT LIKE "query_%"').all(caseId);

  const wikiMap = {};
  pages.forEach(p => { wikiMap[p.page_slug] = p.content_md; });
  const wikiContext = pages.map(p => `### ${p.page_slug}\n${p.content_md}`).join('\n\n');

  // Route to relevant pages
  const q = question.toLowerCase();
  let sourcedFrom = [];
  if (q.includes('suspect') || q.includes('accused') || q.includes('person')) sourcedFrom = ['entities'];
  else if (q.includes('contradict') || q.includes('inconsist')) sourcedFrom = ['contradictions'];
  else if (q.includes('lead') || q.includes('next step') || q.includes('investigate')) sourcedFrom = ['leads', 'entities'];
  else if (q.includes('timeline') || q.includes('when') || q.includes('sequence')) sourcedFrom = ['timeline'];
  else if (q.includes('financial') || q.includes('bank') || q.includes('money') || q.includes('account')) sourcedFrom = ['entities', 'leads'];
  else sourcedFrom = ['index', 'entities', 'leads'];

  // AI answer via Groq
  const aiResult = await answerQueryAI(question, wikiContext, caseId);

  // File answer back to wiki (Karpathy pattern)
  const answerSlug = `query_${Date.now()}`;
  upsertWikiPage(caseId, answerSlug, `# Query Result\n**Q:** ${question}\n\n**A:** ${aiResult.answer}\n`);
  appendToLog(caseId, `query | "${question}" | pages: ${sourcedFrom.join(', ')} | method: ${aiResult.method}`);

  return {
    answer: aiResult.answer,
    sourcedFrom,
    wikiPagesConsulted: sourcedFrom.length,
    totalWikiPages: pages.length,
    method: aiResult.method,
  };
}

// ── Core: Lint Wiki ────────────────────────────────────────────────────────────
export function lintWiki(caseId) {
  const pages = db.prepare('SELECT page_slug FROM case_wiki_pages WHERE case_id = ?').all(caseId).map(p => p.page_slug);
  const required = ['entities', 'timeline', 'leads', 'contradictions', 'index', 'log'];
  const missing = required.filter(r => !pages.includes(r));
  const suggestions = [];

  if (missing.includes('entities')) suggestions.push('No entities extracted. Upload an FIR or witness statement to begin.');
  if (missing.includes('leads')) suggestions.push('No leads generated. Ingest at least one primary document.');
  if (missing.includes('contradictions')) suggestions.push('Contradiction detection needs 2+ documents.');
  if (!missing.includes('entities') && missing.includes('leads')) suggestions.push('Re-ingest documents to trigger lead generation.');

  return { totalPages: pages.length, missingPages: missing, suggestions };
}

// ── Core: Generate Leads on Demand ────────────────────────────────────────────
export async function refreshLeads(caseId) {
  const wikiContent = db.prepare('SELECT page_slug, content_md FROM case_wiki_pages WHERE case_id = ? AND page_slug NOT LIKE "query_%"')
    .all(caseId).map(p => `## ${p.page_slug}\n${p.content_md}`).join('\n\n');

  // Also include structured data summary
  const bankSummary = db.prepare('SELECT COUNT(*) as c, SUM(debit) as total_debit, SUM(credit) as total_credit FROM bank_transactions WHERE case_id = ?').get(caseId);
  const cdrSummary = db.prepare('SELECT COUNT(*) as c FROM cdr_records WHERE case_id = ?').get(caseId);

  const fullContext = `${wikiContent}\n\nBank Transactions: ${bankSummary?.c || 0} records, Total Debit: ₹${bankSummary?.total_debit || 0}, Total Credit: ₹${bankSummary?.total_credit || 0}\nCDR Records: ${cdrSummary?.c || 0}`;

  return generateLeadsAI(fullContext);
}
