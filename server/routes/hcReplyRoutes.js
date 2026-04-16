import express from 'express';
import multer from 'multer';
import path from 'path';
import { hcReplyController } from '../controllers/hcReplyController.js';


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.docx') {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf and .docx files are allowed'), false);
    }
  }
});

const router = express.Router();


router.get('/', hcReplyController.getAll);
router.post('/', hcReplyController.create);
router.get('/templates', hcReplyController.getTemplates);
router.post('/templates', hcReplyController.createTemplate);
router.put('/templates/:id', hcReplyController.updateTemplate);
router.get('/integration/auto-fetch', hcReplyController.autoFetchFacts);

router.get('/:id', hcReplyController.getById);
router.get('/:id/facts', hcReplyController.getFacts);
router.put('/:id/status', hcReplyController.updateStatus);
router.put('/:id/facts', hcReplyController.saveFacts);
router.put('/:id/draft', hcReplyController.saveDraft);
router.post('/:id/upload-petition', upload.single('petitionCode'), hcReplyController.uploadPetition);
router.get('/:id/generate/:documentType', hcReplyController.generateDraftPart);
router.post('/:id/generate-rebuttal', hcReplyController.generateRebuttal);
router.post('/:id/export', hcReplyController.exportDocument);


export default router;
