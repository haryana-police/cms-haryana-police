import path from 'path';
import { hcReplyService } from '../services/hcReplyService.js';
import { integrationService } from '../services/integrationService.js';
import { pdfExtractorService } from '../services/pdfExtractorService.js';
import { draftGeneratorService } from '../services/draftGeneratorService.js';
import { documentExportService } from '../services/documentExportService.js';
import db from '../db.js';


export const hcReplyController = {
  getAll: (req, res) => {
    try {
      const replies = hcReplyService.getAllReplies();
      res.json({ success: true, data: replies });
    } catch (e) {
      console.error('Error in getAll:', e);
      res.status(500).json({ success: false, error: 'Failed to fetch replies' });
    }
  },

  getById: (req, res) => {
    try {
      console.log('Fetching reply with ID:', req.params.id);
      const reply = hcReplyService.getReplyById(req.params.id);
      if (!reply) {
        return res.status(404).json({ success: false, error: 'Reply not found' });
      }
      res.json({ success: true, data: reply });
    } catch (e) {
      console.error('Error in getById:', e);
      res.status(500).json({ success: false, error: 'Internal server error while loading reply details' });
    }
  },

  create: (req, res) => {
    try {
      const { reply_type, court_name, petition_no } = req.body;
      if (!reply_type || !court_name || !petition_no) {
         return res.status(400).json({ success: false, error: 'reply_type, court_name, and petition_no are required' });
      }
      
      const result = hcReplyService.createReply(req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      console.error('Error in create:', e);
      res.status(500).json({ success: false, error: 'Failed to create reply' });
    }
  },

  updateStatus: (req, res) => {
    try {
      const { status, comment } = req.body;
      if (!status) return res.status(400).json({ success: false, error: 'status is required' });
      
      hcReplyService.updateReplyStatus(req.params.id, status, comment, req.user);
      res.json({ success: true });
    } catch (e) {
      console.error('Error in updateStatus:', e);
      res.status(500).json({ success: false, error: 'Failed to update status' });
    }
  },

  autoFetchFacts: (req, res) => {
    try {
       const firData = integrationService.getFirDetails(req.query.fir_no);
       if (!firData) {
          return res.status(404).json({ success: false, error: 'FIR not found' });
       }
       res.json({ success: true, data: firData });
    } catch (e) {
       res.status(500).json({ success: false, error: 'Failed to fetch integration data' });
    }
  },

  getFacts: (req, res) => {
    try {
      const facts = hcReplyService.getFacts(req.params.id);
      res.json({ success: true, data: facts });
    } catch (e) {
      console.error('Error in getFacts controller:', e);
      res.status(500).json({ success: false, error: 'Failed to fetch facts' });
    }
  },

  saveFacts: (req, res) => {
    try {
       hcReplyService.saveFacts(req.params.id, req.body);
       res.json({ success: true });
    } catch (e) {
       console.error('Error in saveFacts:', e);
       res.status(500).json({ success: false, error: 'Failed to save facts' });
    }
  },

  getTemplates: (req, res) => {
    try {
      const templates = hcReplyService.getTemplates(req.query.type);
      res.json({ success: true, data: templates });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Failed to fetch templates' });
    }
  },

  createTemplate: (req, res) => {
    try {
      const result = hcReplyService.createTemplate(req.body);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'Failed to create template' });
    }
  },

  updateTemplate: (req, res) => {
    try {
      const result = hcReplyService.updateTemplate(req.params.id, req.body);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Failed to update template' });
    }
  },

  saveDraft: (req, res) => {
    try {
       const { draft_content } = req.body;
       hcReplyService.saveDraftContent(req.params.id, draft_content, req.user);
       res.json({ success: true });
    } catch (e) {
       console.error('Error in saveDraft:', e);
       res.status(500).json({ success: false, error: 'Failed to save draft' });
    }
  },

  uploadPetition: async (req, res) => {
    let filePath = null;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      
      filePath = req.file.path;
      console.log(`Processing petition upload: ${req.file.originalname} (${req.file.mimetype})`);

      // Basic validation
      const allowedExts = ['.pdf', '.docx'];
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!allowedExts.includes(ext)) {
        return res.status(400).json({ success: false, error: `Unsupported file type: ${ext}. Please upload a PDF or DOCX file.` });
      }

      const extractParams = await pdfExtractorService.extractText(filePath);
      
      const stmt = db.prepare(`
        UPDATE hc_petitions 
        SET file_name = ?, file_path = ?, extracted_text = ?, extracted_prayer = ?, extracted_grounds = ?, extracted_allegations = ?, extraction_status = 'completed'
        WHERE id = (SELECT petition_id FROM hc_replies WHERE id = ?)
      `);
      stmt.run(req.file.originalname, filePath, extractParams.fullText, extractParams.prayer, extractParams.grounds, extractParams.allegations, req.params.id);

      res.json({ success: true, data: extractParams });
    } catch (e) {
      console.error('Error in uploadPetition:', e);
      
      // Map safe error messages for client
      let errorMessage = 'Petition extraction failed';
      if (e.code === 'SCANNED_PDF') {
        errorMessage = e.message;
      } else if (e.message && e.message.includes('corrupt')) {
        errorMessage = 'The uploaded file appears to be corrupted.';
      } else if (e.message) {
        errorMessage = e.message;
      }

      res.status(500).json({ success: false, error: errorMessage });
    } finally {
      // Cleanup: Only remove if you don't intend to keep it in uploads/
      // But based on current logic, file_path points to it, so we probably want to keep it.
      // If we wanted to clean up on error:
      // if (errorMessage !== 'Petition extraction failed' && filePath && fs.existsSync(filePath)) { fs.unlinkSync(filePath); }
    }
  },


  generateRebuttal: (req, res) => {
    try {
      const { petitionText, paraNumber } = req.body;
      if (!petitionText) return res.status(400).json({ error: 'Petition text is required' });
      
      const rebuttal = draftGeneratorService.generateParaRebuttal(petitionText, paraNumber);
      res.json({ success: true, rebuttal });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to generate rebuttal' });
    }
  },

  generateDraftPart: (req, res) => {
    try {
      const { documentType } = req.params;
      const facts = db.prepare('SELECT * FROM hc_reply_facts WHERE reply_id = ?').get(req.params.id) || {};
      const petitionDetails = db.prepare('SELECT hc_petitions.* FROM hc_replies JOIN hc_petitions ON hc_replies.petition_id = hc_petitions.id WHERE hc_replies.id = ?').get(req.params.id) || {};
      
      Object.assign(facts, petitionDetails);

      // Fetch annexures
      const annexures = db.prepare('SELECT file_name as title FROM hc_reply_attachments WHERE reply_id = ?').all(req.params.id);
      facts.annexures = annexures;

      if (documentType === 'covering_letter') {
        const letter = draftGeneratorService.generateCoveringLetter(facts);
        return res.json({ draft: letter });
      }

      if (documentType === 'status_report') {
        const report = draftGeneratorService.generateMainReply(facts);
        return res.json({ draft: report });
      }

      if (documentType === 'annexure_list') {
        const list = draftGeneratorService.generateAnnexureList(facts);
        return res.json({ draft: list });
      }

      if (documentType === 'full_reply') {
        const full = draftGeneratorService.generateFullHCReply(facts);
        return res.json({ draft: full });
      }

      // Find template fallback
      const template = db.prepare('SELECT content FROM hc_reply_templates WHERE reply_type = ?').get(documentType);
      
      if (!template) {
         return res.status(404).json({ error: 'Template not found' });
      }

      const generated = draftGeneratorService.generateDraft(template.content, facts);
      res.json({ draft: generated });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to generate draft' });
    }
  },


  exportDocument: async (req, res) => {
    try {
      const { format, content } = req.body; // HTML content
      if (format === 'pdf') {
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', 'attachment; filename=HC_Reply.pdf');
         await documentExportService.exportToPdf(content, res);
      } else if (format === 'docx') {
         await documentExportService.exportToDocx(content, res);
      } else {
         res.status(400).json({ error: 'Invalid format' });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Export failed' });
    }
  }
};
