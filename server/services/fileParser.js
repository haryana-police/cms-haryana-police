/**
 * File Parser Service
 * Handles real binary file ingestion: PDF, DOCX, TXT, CSV
 * Returns extracted text + metadata
 */

import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

// ── PDF Parser ─────────────────────────────────────────────────────────────────
export async function parsePDF(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      pages: data.numpages,
      info: data.info,
      success: true,
    };
  } catch (e) {
    console.error('PDF parse error:', e.message);
    return { text: '', pages: 0, success: false, error: e.message };
  }
}

// ── DOCX Parser ────────────────────────────────────────────────────────────────
export async function parseDOCX(buffer) {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
      warnings: result.messages,
      success: true,
    };
  } catch (e) {
    console.error('DOCX parse error:', e.message);
    return { text: '', success: false, error: e.message };
  }
}

// ── CSV Parser ─────────────────────────────────────────────────────────────────
export async function parseCSV(text) {
  try {
    const { parse } = require('csv-parse/sync');
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });

    // Convert to readable text for AI processing
    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    const textLines = records.slice(0, 200).map(row =>
      headers.map(h => `${h}: ${row[h]}`).join(', ')
    );

    return {
      text: `CSV Data (${records.length} rows, ${headers.length} columns)\nColumns: ${headers.join(', ')}\n\nData:\n${textLines.join('\n')}`,
      records,
      headers,
      rowCount: records.length,
      success: true,
    };
  } catch (e) {
    console.error('CSV parse error:', e.message);
    return { text: text, records: [], success: false, error: e.message };
  }
}

// ── Bank Statement CSV Detector ────────────────────────────────────────────────
export function detectBankStatementSchema(headers) {
  const headerStr = headers.join(' ').toLowerCase();
  return {
    isBank: headerStr.includes('debit') || headerStr.includes('credit') || 
            headerStr.includes('balance') || headerStr.includes('transaction'),
    dateCol: headers.find(h => /date|time/i.test(h)),
    descCol: headers.find(h => /desc|narration|particular|remark/i.test(h)),
    debitCol: headers.find(h => /debit|withdrawal|dr/i.test(h)),
    creditCol: headers.find(h => /credit|deposit|cr/i.test(h)),
    balanceCol: headers.find(h => /balance|bal/i.test(h)),
    refCol: headers.find(h => /ref|txn|transaction|chq/i.test(h)),
  };
}

// ── CDR CSV Detector ───────────────────────────────────────────────────────────
export function detectCDRSchema(headers) {
  const headerStr = headers.join(' ').toLowerCase();
  return {
    isCDR: headerStr.includes('caller') || headerStr.includes('dialed') || 
           headerStr.includes('duration') || headerStr.includes('imei') || headerStr.includes('tower'),
    callerCol: headers.find(h => /caller|calling|from|a_party/i.test(h)),
    receiverCol: headers.find(h => /called|receiver|to|b_party|dialed/i.test(h)),
    durationCol: headers.find(h => /duration|seconds|mins/i.test(h)),
    dateCol: headers.find(h => /date|time|datetime/i.test(h)),
    towerCol: headers.find(h => /tower|cell|bts|location/i.test(h)),
  };
}

// ── Master File Parser ─────────────────────────────────────────────────────────
export async function parseFile(buffer, originalName, mimeType) {
  const ext = path.extname(originalName).toLowerCase();

  // PDF
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    const result = await parsePDF(buffer);
    return { ...result, fileType: 'pdf', originalName };
  }

  // DOCX / DOC
  if (ext === '.docx' || ext === '.doc' || 
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await parseDOCX(buffer);
    return { ...result, fileType: 'docx', originalName };
  }

  // CSV
  if (ext === '.csv' || mimeType === 'text/csv') {
    const text = buffer.toString('utf-8');
    const result = await parseCSV(text);
    return { ...result, fileType: 'csv', originalName };
  }

  // Plain text (TXT, MD, etc.)
  if (ext === '.txt' || ext === '.md' || mimeType?.startsWith('text/')) {
    const text = buffer.toString('utf-8');
    return { text, fileType: 'txt', success: true, originalName };
  }

  // Unknown — try as text
  try {
    const text = buffer.toString('utf-8');
    if (text && text.length > 10) {
      return { text, fileType: 'unknown', success: true, originalName };
    }
  } catch {}

  return {
    text: '',
    fileType: 'unsupported',
    success: false,
    error: `Unsupported file type: ${ext}`,
    originalName,
  };
}
