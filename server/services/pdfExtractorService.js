import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParseRaw = require('pdf-parse');
const mammothRaw = require('mammoth');

const pdfParse = typeof pdfParseRaw === 'function' ? pdfParseRaw : (pdfParseRaw.default || pdfParseRaw);
const mammoth = typeof mammothRaw === 'function' ? mammothRaw : (mammothRaw.default || mammothRaw);

export const pdfExtractorService = {

  extractText: async (filePath) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      let fullText = '';
      
      console.log(`Extracting text from: ${filePath} (ext: ${ext})`);

      if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        if (typeof pdfParse !== 'function') {
           throw new Error('PDF parsing library not properly initialized.');
        }
        const data = await pdfParse(dataBuffer);
        fullText = data.text;

        // Scanned PDF detection: 
        const alphabeticChars = fullText.replace(/[^a-zA-Z]/g, '');
        if (fullText.trim().length < 50 || alphabeticChars.length < 20) {
          const error = new Error('Scanned PDF detected. Text extraction could not be completed. Please upload a text-based PDF/DOCX or enable OCR.');
          error.code = 'SCANNED_PDF';
          throw error;
        }
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        fullText = result.value;

      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      if (!fullText || fullText.trim().length === 0) {
        throw new Error('No text content found in the uploaded document.');
      }
      
      // Basic section extraction / Regex parser
      const extractSection = (keyword, text) => {
        // More robust section keywords
        const sectionBreak = '(?:Grounds|Prayer|Verification|Deponent|Annexure|Dated|Signed|Signature|Place|Affidavit|Brief Facts|LIST OF DATES|SYNOPSIS|$)';
        const regex = new RegExp(`(?:${keyword}\\s*:?\\s*)([\\s\\S]*?)(?=${sectionBreak})`, "i");
        const match = text.match(regex);
        return match ? match[1].trim() : ''; 
      };

      const prayer = extractSection('Prayer', fullText) || 
                     extractSection('It is, therefore, prayed', fullText) || 
                     extractSection('PRAYER:', fullText);
                     
      const grounds = extractSection('Grounds', fullText) || 
                      extractSection('LEGAL GROUNDS', fullText);
                      
      const allegations = extractSection('Brief Facts', fullText) || 
                          extractSection('FACTS OF THE CASE', fullText) ||
                          extractSection('That the petitioner', fullText);

      return {
        fullText,
        prayer: prayer || 'Prayer section not automatically found.',
        grounds: grounds || 'Grounds section not automatically found.',
        allegations: allegations || 'Allegations section not automatically found.'
      };
    } catch (e) {
      console.error('Document Extraction Error:', e);
      throw e;
    }
  }
};


