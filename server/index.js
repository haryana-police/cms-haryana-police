import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import Tesseract from 'tesseract.js';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import db from './db.js';
import FormData from 'form-data';
import nodeFetch from 'node-fetch';
import analysisRouter from './routes/analysis.js';
 

// ─── Override DNS to use Google DNS (8.8.8.8) — bypasses ISP DNS blocks ──────
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);


const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
// pdf-parse exports differently depending on version - handle both
const pdfParse = typeof pdfParseModule === 'function'
  ? pdfParseModule
  : (pdfParseModule.default || pdfParseModule);

// ─── Server-side PDF → Image using pdfjs-dist + canvas ───────────────────────
// NOTE: Disabled on Windows — native canvas crashes process during PDF render.
// Frontend browser canvas handles OCR for scanned PDFs instead.
let pdfjsLib = null;
let NodeCanvasFactory = null;
console.log('ℹ️  Server-side PDF canvas rendering disabled (Windows compatibility). Frontend canvas OCR active.');

dotenv.config();

// ─── Multer Config: Accept up to 10 files ───────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,   // 20MB per file
    fieldSize: 100 * 1024 * 1024  // 100MB for fields (base64 canvas)
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/') || allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

const app = express();
const PORT = 5000;
const JWT_SECRET = 'local-dev-secret-haryana-police-123';

// ─── Ensure uploads/ directory exists ────────────────────────────────────────
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/kb-files', express.static(path.join(process.cwd(), 'user_knowledge_base')));
app.use('/cases', express.static(path.join(process.cwd(), 'cases')));

// ─── Auth Middleware ──────────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ─── Login ────────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM profiles WHERE username = ?').get(username);
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  const { password: _, ...userData } = user;
  res.json({ token, user: userData });
});

// ── Get Current User ───────────────────────────────────────────────────────────
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, ...userData } = user;
  res.json(userData);
});

<<<<<<< HEAD
// ─── Groq API Helper ─────────────────────────────────────────────────────────
async function callGroqAPI(messages, jsonMode = false, model = "llama-3.3-70b-versatile") {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not found in .env");

  const body = { model, messages };
  if (jsonMode) body.response_format = { type: "json_object" };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Groq API Error:", err);
    throw new Error("Failed to fetch from AI");
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Groq Whisper Audio Transcription Helper ─────────────────────────────────
async function callGroqWhisper(filePath) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not found in .env");

  const formData = new FormData();
  formData.append("file", fs.createReadStream(filePath));
  formData.append("model", "whisper-large-v3");

  const response = await nodeFetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      ...formData.getHeaders()
    },
    body: formData
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Groq Whisper API Error:", err);
    throw new Error("Failed to transcribe audio");
  }
  const data = await response.json();
  return data.text;
}

// ─── OCR Helper: Extract text from image file ─────────────────────────────────
async function extractTextFromImage(filePath, lang = 'eng+hin') {
  try {
    const { data: { text, confidence } } = await Tesseract.recognize(filePath, lang, {
      tessedit_char_whitelist: '',
      preserve_interword_spaces: '1',
    });
    return { text: text.trim(), confidence };
  } catch (e) {
    console.error('OCR Error:', e.message);
    return { text: '', confidence: 0 };
  }
}

// ─── OCR Helper: Extract text from base64 image (for scanned PDFs) ───────────
async function extractTextFromBase64(base64Data) {
  const tmpPath = `uploads/tmp_${Date.now()}.png`;
  try {
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(tmpPath, Buffer.from(base64Content, 'base64'));
    const result = await extractTextFromImage(tmpPath);
    return result;
  } catch (e) {
    console.error('Base64 OCR Error:', e);
    return { text: '', confidence: 0 };
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

// ─── Process a single uploaded file and return extracted text ─────────────────
async function processFile(file, imageFallback = null) {
  const { path: filePath, mimetype, originalname } = file;
  let extractedText = '';
  let method = 'unknown';
  let confidence = 0;

  try {
    if (mimetype === 'application/pdf') {
      console.log(`📄 Processing PDF: "${originalname}"`);

      // ── Strategy 1: Direct text extraction (works for digital PDFs) ──────
      let pdfTextDirect = '';
      try {
        const dataBuffer = fs.readFileSync(filePath);
        console.log(`   pdf-parse type: ${typeof pdfParse}`);
        const pdfData = await pdfParse(dataBuffer, { max: 0 }); // max:0 = all pages
        pdfTextDirect = (pdfData.text || '').trim();
        console.log(`   Strategy 1 (pdf-parse): ${pdfTextDirect.length} chars extracted`);
      } catch (pdfErr) {
        console.error(`   Strategy 1 FAILED: ${pdfErr.message}`);
      }

      if (pdfTextDirect.length > 30) {
        // Good digital PDF — text extracted directly
        extractedText = pdfTextDirect;
        method = 'pdf-text';
        confidence = 100;
        console.log(`   ✅ Digital PDF text extracted: ${extractedText.length} chars`);
      } else {
        // ── Strategy 2: Canvas image OCR (works for scanned/image PDFs) ────
        console.log(`   Strategy 1 insufficient (${pdfTextDirect.length} chars). Trying OCR...`);
        if (imageFallback) {
          const result = await extractTextFromBase64(imageFallback);
          if (result.text && result.text.trim().length > 10) {
            extractedText = result.text.trim();
            confidence = result.confidence;
            method = 'pdf-ocr-canvas';
            console.log(`   ✅ Canvas OCR extracted: ${extractedText.length} chars (conf: ${confidence}%)`);
          } else {
            extractedText = pdfTextDirect || '[PDF scanned - OCR returned empty result. Upload as JPG for better results.]';
            method = 'pdf-ocr-empty';
            console.log(`   ⚠️  OCR returned empty. Using fallback message.`);
          }
        } else if (pdfjsLib && NodeCanvasFactory) {
          // ── Strategy 3: Server-side PDF canvas mapping (for scanned PDFs when frontend fails) ────
          console.log(`   Strategy 3 (Server OCR): Frontend fallback missing. Running server-side PDF-to-image OCR...`);
          try {
            const dataBuffer = fs.readFileSync(filePath);
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(dataBuffer) }).promise;
            const maxPages = Math.min(pdf.numPages, 3);
            const { createCanvas } = require('canvas');
            const canvases = [];

            for (let i = 1; i <= maxPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 2.0 });
              const canvasAndCtx = NodeCanvasFactory.create(viewport.width, viewport.height);
              await page.render({
                canvasContext: canvasAndCtx.context,
                viewport: viewport,
                canvasFactory: NodeCanvasFactory
              }).promise;
              canvases.push(canvasAndCtx.canvas);
            }

            // Stitch canvases
            const totalHeight = canvases.reduce((sum, c) => sum + c.height, 0);
            const maxWidth = Math.max(...canvases.map(c => c.width));
            const stitched = createCanvas(maxWidth, totalHeight);
            const stitchedCtx = stitched.getContext('2d');
            let yOffset = 0;
            for (const c of canvases) {
              stitchedCtx.drawImage(c, 0, yOffset);
              yOffset += c.height;
            }

            const tmpPath = `uploads/tmp_serverpdf_${Date.now()}.png`;
            fs.writeFileSync(tmpPath, stitched.toBuffer('image/png'));
            const result = await extractTextFromImage(tmpPath);
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

            if (result.text && result.text.trim().length > 10) {
              extractedText = result.text.trim();
              confidence = result.confidence;
              method = 'pdf-ocr-server';
              console.log(`   ✅ Server Canvas OCR: ${extractedText.length} chars (conf: ${confidence}%)`);
            } else {
              throw new Error("Server OCR returned empty text");
            }
          } catch (serverOcrErr) {
            console.log(`   ⚠️ Server side OCR failed: ${serverOcrErr.message}. Falling back...`);
            if (pdfTextDirect.length > 0) {
              extractedText = pdfTextDirect;
              method = 'pdf-text-partial';
              confidence = 50;
              console.log(`   ⚠️  Using partial PDF text: ${extractedText.length} chars`);
            } else {
              extractedText = '[Scanned PDF detected. No canvas fallback provided. Please re-upload as a JPG image for OCR analysis.]';
              method = 'pdf-no-fallback';
              console.log(`   ❌ No fallback and no text. PDF is purely scanned.`);
            }
          }
        } else {
          // ── Strategy 4: Fallback to partial text ────────────
          if (pdfTextDirect.length > 0) {
            extractedText = pdfTextDirect;
            method = 'pdf-text-partial';
            confidence = 50;
            console.log(`   ⚠️  Using partial PDF text: ${extractedText.length} chars`);
          } else {
            extractedText = '[Scanned PDF detected. No canvas fallback provided. Please re-upload as a JPG image for OCR analysis.]';
            method = 'pdf-no-fallback';
            console.log(`   ❌ No fallback and no text. PDF is purely scanned.`);
          }
        }
      }

    } else if (mimetype.startsWith('image/')) {
      // ── Images: JPG, PNG, Handwritten docs, Photos ───────────────────────
      console.log(`🖼️  Running OCR on image: "${originalname}"`);
      const result = await extractTextFromImage(filePath);
      extractedText = result.text;
      confidence = result.confidence;
      method = 'image-ocr';
      console.log(`   ✅ Image OCR: ${extractedText.length} chars (conf: ${confidence}%)`);
    } else if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) {
      // ── Audio/Video Transcription ───────────────────────
      console.log(`🎤 Running transcription on audio: "${originalname}"`);
      const text = await callGroqWhisper(filePath);
      extractedText = text;
      confidence = 100;
      method = 'audio-transcription';
      console.log(`   ✅ Audio Transcription: ${extractedText.length} chars`);
    }
  } catch (e) {
    console.error(`❌ Error processing file "${originalname}":`, e.message);
    console.error(e.stack);
    extractedText = `[Error reading file: ${e.message}]`;
    method = 'error';
  } finally {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }
  }

  return {
    filename: originalname,
    extractedText,
    method,
    confidence: Math.round(confidence)
  };
}

// ─── BNS Conversion Reference Table (used inside prompt) ─────────────────────
const BNS_REFERENCE = `
MANDATORY BNS CONVERSION TABLE (Use ONLY these - NEVER use IPC numbers in "code" field):
| Old IPC | New BNS | Crime |
|---------|---------|-------|
| IPC 302 | BNS 101 | Murder |
| IPC 304 | BNS 105 | Culpable Homicide not amounting to murder |
| IPC 304A | BNS 106 | Causing death by negligence |
| IPC 307 | BNS 109 | Attempt to murder |
| IPC 308 | BNS 110 | Attempt to commit culpable homicide |
| IPC 319/320 | BNS 114/115 | Hurt / Grievous Hurt |
| IPC 323 | BNS 115(2) | Voluntarily causing hurt |
| IPC 324 | BNS 117 | Hurt by dangerous weapon |
| IPC 325 | BNS 116 | Voluntarily causing grievous hurt |
| IPC 326 | BNS 118 | Grievous hurt by dangerous weapon |
| IPC 354 | BNS 74 | Assault on woman with intent to outrage modesty |
| IPC 354A | BNS 75 | Sexual harassment |
| IPC 354B | BNS 76 | Assault to disrobe woman |
| IPC 354C | BNS 77 | Voyeurism |
| IPC 354D | BNS 78 | Stalking |
| IPC 363 | BNS 137 | Kidnapping |
| IPC 365 | BNS 140 | Kidnapping to cause wrongful confinement |
| IPC 366 | BNS 141 | Kidnapping/abducting woman to compel marriage |
| IPC 375/376 | BNS 63/64 | Rape |
| IPC 376A | BNS 66 | Rape causing death or persistent vegetative state |
| IPC 376D | BNS 70 | Gang Rape |
| IPC 377 | BNS 100 | Unnatural offences |
| IPC 379 | BNS 303 | Theft |
| IPC 380 | BNS 305 | Theft in dwelling house |
| IPC 381 | BNS 306 | Theft by clerk/servant |
| IPC 382 | BNS 304 | Theft after preparation for hurt |
| IPC 383/384 | BNS 308 | Extortion |
| IPC 390/392 | BNS 309 | Robbery |
| IPC 395 | BNS 310 | Dacoity |
| IPC 396 | BNS 311 | Dacoity with murder |
| IPC 405/406 | BNS 316 | Criminal Breach of Trust |
| IPC 415/420 | BNS 318 | Cheating / Fraud |
| IPC 425/427 | BNS 324 | Mischief |
| IPC 441/448 | BNS 329 | House trespass |
| IPC 498A | BNS 85 | Cruelty by husband or relatives |
| IPC 499/500 | BNS 356 | Defamation |
| IPC 503/506 | BNS 351 | Criminal intimidation |
| IPC 509 | BNS 79 | Word/gesture to insult woman |

BNSS (New CrPC) KEY SECTIONS:
| Old CrPC | New BNSS | Purpose |
|----------|----------|---------|
| CrPC 154 | BNSS 173 | FIR Registration |
| CrPC 161 | BNSS 180 | Witness Statement by Police |
| CrPC 164 | BNSS 183 | Statement before Magistrate |
| CrPC 167 | BNSS 187 | Remand |
| CrPC 173 | BNSS 193 | Police Report / Charge Sheet |
| CrPC 41 | BNSS 35 | Arrest without warrant |
| CrPC 46 | BNSS 43 | Arrest procedure |
`;

// ─── AI Prompt for Deep Analysis ──────────────────────────────────────────────
const ANALYSIS_SYSTEM_PROMPT = `You are an expert AI Legal Advisor for Haryana Police, India. 

=========================================================
⚠️ ABSOLUTE MANDATORY RULE - READ CAREFULLY:
=========================================================
India passed 3 new laws effective from July 1, 2024:
1. BNS = Bharatiya Nyaya Sanhita (REPLACES IPC completely)
2. BNSS = Bharatiya Nagarik Suraksha Sanhita (REPLACES CrPC completely)
3. BSA = Bharatiya Sakshya Adhiniyam (REPLACES Indian Evidence Act)

YOU MUST:
✅ Use BNS section numbers in the "code" field (e.g., "BNS 85", "BNS 303", "BNS 64")
✅ Put the old IPC number ONLY in "old_code" field as reference
✅ BNS sections are DIFFERENT numbers than IPC - use the mapping table below

YOU MUST NEVER:
❌ DO NOT write "IPC 498A" in the "code" field - write "BNS 85" instead
❌ DO NOT write "IPC 302" in the "code" field - write "BNS 101" instead  
❌ DO NOT write "IPC 420" in the "code" field - write "BNS 318" instead
❌ DO NOT suggest any IPC, CrPC, or IEA sections as primary recommendations
=========================================================

${BNS_REFERENCE}

Your task: Analyze the complaint/document and return EXACTLY this JSON structure:

{
  "case_summary": "2-3 sentence crisp summary of what happened",
  "crime_type": "Primary crime category",
  "severity": "HIGH | MEDIUM | LOW",
  "sections": [
    {
      "code": "BNS 85",
      "old_code": "IPC 498A",
      "title": "Cruelty by Husband or Relatives",
      "description": "Whoever, being the husband or relative of husband of a woman, subjects such woman to cruelty shall be punished...",
      "relevance": "Primary",
      "punishment": "Imprisonment up to 3 years + Fine"
    }
  ],
  "sop": [
    {
      "step": 1,
      "action": "Register FIR immediately under BNSS Section 173 - this is a cognizable offence",
      "time_limit": "Within 24 hours",
      "authority": "SHO",
      "priority": "CRITICAL"
    }
  ],
  "sc_judgments": [
    {
      "case_name": "Lalita Kumari vs Govt. of UP (2014)",
      "court": "Supreme Court",
      "year": "2014",
      "citation": "AIR 2014 SC 187",
      "guideline": "FIR must be registered immediately on receipt of cognizable offense",
      "holding": "The Constitution Bench unanimously held that registration of FIR is mandatory under Section 154 CrPC (now BNSS 173) if the information discloses commission of a cognizable offence.",
      "key_points": [
        "FIR cannot be refused on any pretext for cognizable offences",
        "Preliminary inquiry can only be done in cases like matrimonial disputes, commercial cases, medical negligence, corruption - not in serious crimes",
        "Officer refusing to register FIR is liable under departmental action and contempt of court",
        "Victim can approach SP or Magistrate if SHO refuses"
      ],
      "io_duty": "Mandatory - Register FIR immediately. No preliminary inquiry for cognizable offences. Non-compliance invites disciplinary action.",
      "relevance": "Mandatory FIR registration"
    }
  ],
  "hc_judgments": [
    {
      "case_name": "Relevant HC case name",
      "court": "Punjab & Haryana High Court",
      "year": "2020",
      "citation": "Citation if available",
      "guideline": "Specific guideline for this crime type",
      "holding": "Full holding of the HC judgment - what was decided and on what basis",
      "key_points": [
        "First important point from the judgment",
        "Second important point",
        "Third important point for IO"
      ],
      "io_duty": "Specific duty cast on the IO by this HC judgment",
      "relevance": "How IO should apply this"
    }
  ],
  "special_laws": [
    {
      "act_name": "Protection of Women from Domestic Violence Act 2005",
      "sections": ["3", "12", "23"],
      "action": "File for protection order. Inform victim of rights. Report to DV Magistrate.",
      "priority": "HIGH"
    }
  ],
  "deadlines": [
    {
      "task": "Register FIR",
      "days": 0,
      "hours": 24,
      "legal_basis": "BNSS Sec 173",
      "authority": "SHO",
      "priority": "CRITICAL"
    },
    {
      "task": "File Charge Sheet",
      "days": 60,
      "hours": null,
      "legal_basis": "BNSS Sec 193",
      "authority": "IO",
      "priority": "HIGH"
    }
  ],
  "evidence_checklist": [
    "Seize mobile phone - extract call records, WhatsApp messages",
    "Photograph all visible injuries on victim",
    "Record witness statements under BNSS Sec 180"
  ],
  "io_warnings": [
    "MANDATORY: Do not refuse FIR - Lalita Kumari SC judgment applies",
    "MANDATORY: Arrest must follow D.K. Basu SC guidelines"
  ]
}

FINAL STRICT RULES:
1. Return ONLY valid JSON. Absolutely NO extra text, no markdown, no explanation.
2. "code" field MUST start with "BNS " not "IPC " - use the conversion table above.
3. Include 4-6 BNS sections minimum, covering all applicable offences.
4. If unreadable text: {"error": "Cannot read document clearly. Upload a clearer image or type complaint text."}
5. IMPORTANT FOR SOP & JUDGEMENTS: If you find relevant Standard Operating Procedures (SOPs), Special Laws, or Judgements in the "CUSTOM KNOWLEDGE BASE" section below, you MUST use them directly instead of creating generic ones. Extract their details thoroughly.
5b. MANDATORY SOP RULE: If "OFFICIAL HARYANA POLICE SOP" documents are present in your context, you MUST extract the exact procedural steps from those Regulations (not generic steps). Each SOP step must cite the source Regulation (e.g., "As per Regulation 14/2024, Step 3...").
6. Deadlines MUST reference BNSS sections (not CrPC).
7. Evidence checklist must be crime-specific and actionable.`;


// ─── Recursive File Reader Helper ─────────────────────────────────────────
const getAllFiles = (dirPath, arrayOfFiles) => {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function (file) {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });
  return arrayOfFiles;
};

// ─── SOP → Crime Type Mapping Table ───────────────────────────────────────
const SOP_CRIME_MAP = [
  {
    keywords: ['rape', 'sexual assault', 'bns 63', 'bns 64', 'bns 66', 'bns 70', 'bns 65', 'bns 71', 'pocso', 'gang rape', 'sexual offence'],
    file: 'sop/Regulation No. 14 of 2024.GUIDLINE FOR EXPEDITIOUS  & FAIR INVESTIGATION OF RAPE CASES.pdf',
    label: 'Rape/Sexual Offence Investigation SOP (Regulation 14/2024)'
  },
  {
    keywords: ['cruelty', 'domestic violence', 'bns 85', '498a', 'marriage', 'dowry', 'husband', 'wife', 'matrimonial'],
    file: 'sop/Regulation No. 15 of 2024.CRUELTY IN MARRIAGE_.pdf',
    label: 'Cruelty in Marriage SOP (Regulation 15/2024)'
  },
  {
    keywords: ['economic', 'fraud', 'cheating', 'bns 318', 'financial', 'money laundering', 'embezzlement', 'bank fraud', 'cyber fraud', 'scam'],
    file: 'sop/Regulation No. 20 of 2024.INVESTIGATION INTO ECONOMIC OFFENCES_.pdf',
    label: 'Economic Offences Investigation SOP (Regulation 20/2024)'
  },
  {
    keywords: ['missing', 'kidnapping', 'bns 137', 'abduction', 'missing person', 'gumshuda', 'child missing'],
    file: 'sop/SOP MISSING PERSON.pdf',
    label: 'Missing Person SOP'
  },
  {
    keywords: ['cyber slavery', 'human trafficking', 'cyber crime', 'it act', 'online fraud', 'digital crime', 'trafficking'],
    file: 'sop/cyber slavery SOP.pdf',
    label: 'Cyber Slavery & Human Trafficking SOP'
  },
  {
    keywords: ['murder', 'dacoity', 'heinous', 'bns 101', 'bns 310', 'bns 311', 'forensic', 'fsl', 'homicide'],
    file: 'sop/Regulation No. 3.VISIT BY FORENSIC TEAM IN HENIOUS CRIME CASES.pdf',
    label: 'Forensic Team Visit SOP for Heinous Crimes (Regulation 3)'
  },
  {
    keywords: ['arrest', 'bnss 35', '41a', 'crpc 41', 'arnesh kumar', 'warrant', 'giraftari'],
    file: 'sop/Regulation No. 4.PROCEDURE U_S 41 & 41A  CRPC.pdf',
    label: 'Arrest Procedure SOP (Regulation 4 / BNSS 35)'
  },
  {
    keywords: ['remand', 'bnss 187', 'bnss 153', 'custody', 'judicial remand', 'police custody'],
    file: 'sop/Regulation No. 12 of 2024.BNSS GUIDELINE SECTION 35,187,153,157.pdf',
    label: 'Remand & Custody SOP (Regulation 12/2024)'
  }
];

// ─── Load Relevant SOPs based on detected crime context ───────────────────
const getRelevantSOPs = async (crimeContext = '') => {
  const kbPath = path.join(process.cwd(), 'user_knowledge_base');
  let sopContent = '';
  const lowerContext = crimeContext.toLowerCase();

  for (const sop of SOP_CRIME_MAP) {
    const isRelevant = sop.keywords.some(kw => lowerContext.includes(kw));
    if (isRelevant) {
      const filePath = path.join(kbPath, sop.file);
      if (fs.existsSync(filePath)) {
        try {
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(dataBuffer);
          sopContent += `\n\n=== OFFICIAL HARYANA POLICE SOP: ${sop.label} ===\n${pdfData.text}\n${'='.repeat(60)}\n`;
          console.log(`✅ SOP Loaded for AI: ${sop.label}`);
        } catch (e) {
          console.error(`❌ Error loading SOP [${sop.label}]:`, e.message);
        }
      }
    }
  }
  return sopContent;
};

// ─── Load User Knowledge Base ──────────────────────────────────────────
const getUserKnowledge = async () => {
  const kbPath = path.join(process.cwd(), 'user_knowledge_base');
  let kbContent = '';
  try {
    if (fs.existsSync(kbPath)) {
      const allFiles = getAllFiles(kbPath);
      for (const filePath of allFiles) {
        const file = path.basename(filePath);
        if (file.endsWith('.txt') || file.endsWith('.json') || file.endsWith('.md')) {
          const content = fs.readFileSync(filePath, 'utf-8');
          kbContent += `\n--- CUSTOM USER KNOWLEDGE FROM: ${file} ---\n${content}\n----------------------------------------\n`;
        } else if (file.toLowerCase().endsWith('.pdf')) {
          try {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            kbContent += `\n--- CUSTOM USER KNOWLEDGE FROM PDF: ${file} ---\n${pdfData.text}\n----------------------------------------\n`;
          } catch (pdfErr) {
            console.error(`Error parsing PDF ${file}:`, pdfErr);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading user_knowledge_base:', err);
  }
  return kbContent;
};

// ─── List Saved Cases ───────────────────────────────────────────────────────────
app.get('/api/cases/list', authenticateToken, (req, res) => {
  try {
    const listFiles = (dir) => {
      const dirPath = path.join(process.cwd(), 'cases', dir);
      if (!fs.existsSync(dirPath)) return [];
      return fs.readdirSync(dirPath).filter(f => f.endsWith('.pdf') || f.endsWith('.txt'));
    };
    res.json({
      complaints: listFiles('complaints'),
      firs: listFiles('firs')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 1. Smart Multi-File Analysis Endpoint ────────────────────────────────────
app.post('/api/ai/analyze-complaint', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    let allExtractedTexts = [];
    let fileResults = [];

    // Process manually entered text
    if (req.body.text && req.body.text.trim()) {
      allExtractedTexts.push(`[Manual Input]:\n${req.body.text.trim()}`);
    }

    // Handle imageFallbacks (JSON array of base64 strings for scanned PDFs)
    let imageFallbacks = {};
    try {
      if (req.body.imageFallbacks) {
        imageFallbacks = JSON.parse(req.body.imageFallbacks);
      }
    } catch (e) {
      console.log('No image fallbacks provided');
    }

    // Process existing server file natively
    if (req.body.existing_file) {
      const filePath = path.join(process.cwd(), req.body.existing_file);
      if (fs.existsSync(filePath)) {
        console.log(`Processing existing case file: ${filePath}`);
        // Create mock file object that processFile expects
        const mockFile = {
          path: filePath,
          mimetype: filePath.endsWith('.pdf') ? 'application/pdf' : 'text/plain',
          originalname: path.basename(filePath)
        };
        const result = await processFile(mockFile, null);
        fileResults.push(result);
        if (result.extractedText && result.extractedText.length > 10) {
          allExtractedTexts.push(`[System Case - ${result.filename}]:\n${result.extractedText}`);
        }
      } else {
        console.warn(`Requested existing file not found: ${filePath}`);
      }
    }

    // Process uploaded files
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} file(s)...`);

      const fileProcessingPromises = req.files.map((file, idx) => {
        const fallback = imageFallbacks[idx] || imageFallbacks[file.originalname] || null;
        return processFile(file, fallback);
      });

      fileResults = await Promise.all(fileProcessingPromises);

      fileResults.forEach((result, idx) => {
        console.log(`File ${idx + 1}: "${result.filename}" | Method: ${result.method} | Confidence: ${result.confidence}%`);
        if (result.extractedText && result.extractedText.length > 10) {
          allExtractedTexts.push(`[Document ${idx + 1} - ${result.filename}]:\n${result.extractedText}`);
        }
      });
    }

    if (allExtractedTexts.length === 0) {
      return res.status(400).json({ error: 'No readable content found. Please upload a clearer image or type the complaint text.' });
    }

    // ─── Cap combined text to avoid token overflow ─────────────────────────────
    const MAX_COMPLAINT_CHARS = 3000;
    let combinedText = allExtractedTexts.join('\n\n---\n\n');
    if (combinedText.length > MAX_COMPLAINT_CHARS) {
      console.log(`⚠️  Complaint text too long (${combinedText.length} chars), capping at ${MAX_COMPLAINT_CHARS}...`);
      combinedText = combinedText.substring(0, MAX_COMPLAINT_CHARS) + '\n[...text truncated for analysis...]';
    }
    console.log("COMBINED TEXT FOR AI:\n", combinedText.substring(0, 300) + '...');

    const userMessage = `
REMINDER: You MUST use BNS section numbers (NOT IPC). 
EXAMPLE: For theft use "BNS 303" NOT "IPC 379". For cruelty to wife use "BNS 85" NOT "IPC 498A". For murder use "BNS 101" NOT "IPC 302".
The "code" field must ALWAYS start with "BNS " prefix.

Now analyze this complaint/document and return JSON:

${combinedText}
`.trim();

    // ─── Load Knowledge: Crime-specific SOPs + General KB ────────────────
    // const customKnowledge = await getUserKnowledge();          // ← DISABLED: Loading all PDFs exceeds context limits
    const relevantSOP = await getRelevantSOPs(combinedText);  // ← Smart SOP by crime type

    const sopInjection = relevantSOP
      ? `\n\n=== HARYANA POLICE OFFICIAL SOPs (MANDATORY - USE THESE STEPS DIRECTLY) ===\n${relevantSOP}\n`
      : '';

    const finalSystemPrompt = ANALYSIS_SYSTEM_PROMPT
      + sopInjection;
      // + (customKnowledge ? `\n\n=== CUSTOM KNOWLEDGE BASE ===\n${customKnowledge}\n=============================\n` : '');

    if (relevantSOP) console.log('✅ Crime-specific SOP injected into AI prompt');
    else console.log('ℹ️  No specific SOP matched - using general knowledge');

    const aiResponse = await callGroqAPI([
      { role: "system", content: finalSystemPrompt },
      { role: "user", content: userMessage }
    ], true, "llama-3.3-70b-versatile");

    const parsedJson = JSON.parse(aiResponse);

    if (parsedJson.error) {
      return res.status(400).json({ error: parsedJson.error });
    }

    // ─── Failsafe: Auto-correct any IPC sections AI returned by mistake ──────
    const IPC_TO_BNS_MAP = {
      '302': 'BNS 101', '304': 'BNS 105', '304A': 'BNS 106', '307': 'BNS 109',
      '308': 'BNS 110', '319': 'BNS 114', '320': 'BNS 115', '323': 'BNS 115(2)',
      '324': 'BNS 117', '325': 'BNS 116', '326': 'BNS 118', '327': 'BNS 122',
      '341': 'BNS 126', '342': 'BNS 127', '354': 'BNS 74', '354A': 'BNS 75',
      '354B': 'BNS 76', '354C': 'BNS 77', '354D': 'BNS 78', '363': 'BNS 137',
      '364': 'BNS 139', '365': 'BNS 140', '366': 'BNS 141', '375': 'BNS 63',
      '376': 'BNS 64', '376A': 'BNS 66', '376AB': 'BNS 65', '376D': 'BNS 70',
      '376DA': 'BNS 71', '377': 'BNS 100', '378': 'BNS 303', '379': 'BNS 303',
      '380': 'BNS 305', '381': 'BNS 306', '382': 'BNS 304', '383': 'BNS 308',
      '384': 'BNS 308', '385': 'BNS 308', '386': 'BNS 308', '390': 'BNS 309',
      '392': 'BNS 309', '394': 'BNS 309', '395': 'BNS 310', '396': 'BNS 311',
      '405': 'BNS 316', '406': 'BNS 316', '409': 'BNS 316', '415': 'BNS 318',
      '416': 'BNS 318', '417': 'BNS 318', '418': 'BNS 318', '419': 'BNS 318',
      '420': 'BNS 318', '425': 'BNS 324', '426': 'BNS 324', '427': 'BNS 324',
      '441': 'BNS 329', '447': 'BNS 333', '448': 'BNS 329', '452': 'BNS 330',
      '494': 'BNS 82', '495': 'BNS 82', '496': 'BNS 83', '497': 'BNS 84',
      '498A': 'BNS 85', '499': 'BNS 356', '500': 'BNS 356', '503': 'BNS 351',
      '504': 'BNS 352', '506': 'BNS 351', '509': 'BNS 79', '34': 'BNS 3(5)',
      '120B': 'BNS 61', '107': 'BNS 45', '109': 'BNS 48',
    };

    if (parsedJson.sections && Array.isArray(parsedJson.sections)) {
      parsedJson.sections = parsedJson.sections.map(sec => {
        const codeStr = String(sec.code || '');
        // Check if AI returned IPC XXX or just a number without BNS prefix
        const ipcMatch = codeStr.match(/^(?:IPC\s*)?(\d+[A-Z]?)$/i);
        if (ipcMatch) {
          const ipcNum = ipcMatch[1].toUpperCase();
          const correctBNS = IPC_TO_BNS_MAP[ipcNum];
          if (correctBNS) {
            console.log(`⚠️  Auto-corrected: "${codeStr}" → "${correctBNS}"`);
            return {
              ...sec,
              old_code: sec.old_code || `IPC ${ipcNum}`,
              code: correctBNS
            };
          }
        }
        // If code doesn't start with BNS/BNSS/BSA/POCSO etc., prefix it
        if (!codeStr.match(/^(BNS|BNSS|BSA|POCSO|ITA|SC.ST|DV)/i) && codeStr.match(/^\d/)) {
          const ipcNum = codeStr.replace(/^IPC\s*/i, '').trim().toUpperCase();
          const correctBNS = IPC_TO_BNS_MAP[ipcNum];
          if (correctBNS) {
            console.log(`⚠️  Auto-corrected numeric: "${codeStr}" → "${correctBNS}"`);
            return { ...sec, old_code: sec.old_code || `IPC ${ipcNum}`, code: correctBNS };
          }
        }
        return sec;
      });
    }

    // Attach file processing metadata and send
    res.json({
      ...parsedJson,
      _meta: {
        filesProcessed: fileResults.length,
        fileResults: fileResults.map(f => ({
          filename: f.filename,
          method: f.method,
          confidence: f.confidence,
          textLength: f.extractedText.length
        })),
        analysisDate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Analysis Error:", error);
    fs.writeFileSync('debug.log', error.stack || error.toString());
    res.status(500).json({ error: error.message || 'Failed to analyze complaint' });
  }
});


// ─── 2. Chat Assistant ────────────────────────────────────────────────────────
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  try {
    const { history, currentMessage } = req.body;
    const messages = [
      {
        role: "system",
        content: `You are Dost - AI Police Investigation Assistant for Haryana Police. 
You are expert in Indian criminal law post July 2024:
- Use BNS (not IPC), BNSS (not CrPC), BSA (not IEA)
- Also knowledgeable about POCSO, SC/ST Act, IT Act, Protection of Women from DV Act, etc.
- Speak in Hindi, English, or Hinglish as the user prefers.
- Be concise, practical, and officer-friendly.
- Always cite specific section numbers.
- For arrest procedures, always mention D.K. Basu guidelines.
- For FIR, always mention Lalita Kumari judgment.`
      }
    ];
    if (history && history.length > 0) messages.push(...history);
    messages.push({ role: "user", content: currentMessage });
    const reply = await callGroqAPI(messages, false);
    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to chat with AI' });
  }
});

// ─── 3. Law Detail Lookup ─────────────────────────────────────────────────────
app.post('/api/ai/law-detail', authenticateToken, async (req, res) => {
  try {
    const { sectionCode } = req.body;
    if (!sectionCode) return res.status(400).json({ error: 'Section code required' });

    const messages = [
      {
        role: "system",
        content: `You are an authoritative Indian Legal Encyclopedia specializing in BNS, BNSS, BSA, and Special Laws (POCSO, SC/ST Act, IT Act 2000, etc.).
For the given section, provide:
1. **Official Title** of the section
2. **Full Definition** (exact legal language)
3. **Punishment** (exact as per law)
4. **Key Case Laws** (1-2 landmark judgments)
5. **IO's Duty** (what the Investigating Officer must do)
Use clean markdown formatting. Be comprehensive but concise.`
      },
      { role: "user", content: `Explain: ${sectionCode}` }
    ];

    const reply = await callGroqAPI(messages, false);
    res.json({ detail: reply });
  } catch (error) {
    console.error("Law Detail Error:", error);
    res.status(500).json({ error: 'Failed to fetch law details' });
  }
});

// ─── 3b. Law Detail in Hindi ──────────────────────────────────────────────────
app.post('/api/ai/law-detail-hindi', authenticateToken, async (req, res) => {
  try {
    const { sectionCode, englishText } = req.body;
    if (!sectionCode) return res.status(400).json({ error: 'Section code required' });

    // If we have existing English text, translate it; otherwise, generate Hindi directly
    const messages = englishText
      ? [
        {
          role: 'system',
          content: `You are an expert legal Hindi translator for Indian Police officers.
Translate the following legal reference to clear, simple Hindi.
RULES:
- Keep section codes EXACTLY as-is (BNS 85, BNSS 173, etc.)
- Keep English case names (e.g., "D.K. Basu vs State") as-is
- Use: धारा, सज़ा, एफआईआर, गिरफ्तारी, जांच अधिकारी, न्यायालय etc.
- Use clean markdown (same structure as input)
- Be clear and practical for a police officer`
        },
        { role: 'user', content: `Translate to Hindi:\n\n${englishText}` }
      ]
      : [
        {
          role: 'system',
          content: `You are an expert Indian Legal Encyclopedia in Hindi for Police officers.
For the given section, provide in HINDI:
1. **आधिकारिक शीर्षक** (Official Title)
2. **पूरी परिभाषा** (Full Definition in simple Hindi)
3. **सज़ा** (Punishment)
4. **मुख्य केस लॉ** (1-2 key judgments - case names in English)
5. **जांच अधिकारी का कर्तव्य** (IO's duty)
Keep section codes as-is. Use clean markdown.`
        },
        { role: 'user', content: `हिंदी में समझाएं: ${sectionCode}` }
      ];

    const reply = await callGroqAPI(messages, false);
    res.json({ detail: reply });
  } catch (error) {
    console.error("Law Detail Hindi Error:", error);
    res.status(500).json({ error: 'Failed to fetch Hindi law details' });
  }
});

// ─── 4. HC Judgment Search ────────────────────────────────────────────────────
app.post('/api/ai/hc-judgment', authenticateToken, async (req, res) => {
  try {
    const { query, crimeType } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    const messages = [
      {
        role: "system",
        content: `You are a High Court judgment database for Punjab & Haryana High Court and other Indian High Courts. 
Provide 3-5 relevant HC judgments for the given crime type/legal query.
Return JSON: {"judgments": [{"case_name": "...", "court": "Punjab & Haryana HC", "year": "...", "citation": "...", "guideline": "...", "io_impact": "What IO must do"}]}`
      },
      { role: "user", content: `Find HC judgments for: ${query} (Crime type: ${crimeType || 'General'})` }
    ];

    const reply = await callGroqAPI(messages, true);
    res.json(JSON.parse(reply));
  } catch (error) {
    console.error("HC Judgment Error:", error);
    res.status(500).json({ error: 'Failed to fetch HC judgments' });
  }
});

// ─── 5. Generate Analysis Report (Text Summary) ──────────────────────────────
app.post('/api/ai/generate-report', authenticateToken, async (req, res) => {
  try {
    const { analysisData, officerName, stationName } = req.body;
    if (!analysisData) return res.status(400).json({ error: 'Analysis data required' });

    const messages = [
      {
        role: "system",
        content: `You are a senior legal document writer for Haryana Police. Generate a formal, professional case analysis report in Hindi-English bilingual format. Include all sections, deadlines, and SOPs in a structured, printable format.`
      },
      {
        role: "user",
        content: `Generate a formal Case Analysis Report for:
Officer: ${officerName || 'IO'}
Station: ${stationName || 'Police Station'}
Analysis Data: ${JSON.stringify(analysisData, null, 2)}`
      }
    ];

    const report = await callGroqAPI(messages, false);
    res.json({ report });
  } catch (error) {
    console.error("Report Error:", error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─── 6. Hindi Translation Endpoint ───────────────────────────────────────────
app.post('/api/ai/translate-hindi', authenticateToken, async (req, res) => {
  try {
    const { analysisData } = req.body;
    if (!analysisData) return res.status(400).json({ error: 'Analysis data required' });

    const HINDI_TRANSLATE_PROMPT = `You are an expert Hindi translator for Indian Police. 
Translate the given JSON analysis from English to Hindi.

STRICT RULES:
1. Return ONLY valid JSON - no extra text, no markdown
2. Keep ALL legal codes EXACTLY as-is (BNS 85, BNSS 173, etc.) - DO NOT translate codes
3. Keep case_name of judgments in English (they are court record names)
4. Translate: title, description, action, guideline, relevance, task, punishment, case_summary, crime_type, io_warnings, evidence_checklist, sop actions
5. Use simple, clear Hindi that a police officer can understand
6. For legal terms: use Hindi equivalents e.g. "सज़ा", "धारा", "एफआईआर", "गिरफ्तारी", "जांच"`;

    const userMsg = `Translate this police case analysis to Hindi. Keep all BNS/BNSS codes as-is:
${JSON.stringify(analysisData, null, 2)}`;

    const reply = await callGroqAPI([
      { role: 'system', content: HINDI_TRANSLATE_PROMPT },
      { role: 'user', content: userMsg }
    ], true, 'llama-3.3-70b-versatile');

    const translated = JSON.parse(reply);
    res.json({ translated });
  } catch (error) {
    console.error('Hindi Translation Error:', error);
    res.status(500).json({ error: 'Failed to translate to Hindi' });
  }
});

// ─── 6b. Search User Knowledge Base ──────────────────────────────────────────
app.post('/api/ai/search-kb', authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    const customKnowledge = await getUserKnowledge();
    if (!customKnowledge) {
      return res.json({ answer: 'Knowledge base is currently empty. Please add documents to the folder first.' });
    }

    const messages = [
      {
        role: "system",
        content: `You are an AI assistant for the Law Library. The user wants to search for information. 
You MUST answer the user's query using ONLY the custom documents provided below.
If the information is not present in the documents, say "Sorry, I could not find information regarding this in your uploaded documents."

=== CUSTOM DOCUMENTS START ===
${customKnowledge}
=== CUSTOM DOCUMENTS END ===

Answer in a clear, concise format.`
      },
      { role: "user", content: query }
    ];

    const answer = await callGroqAPI(messages, false, "llama-3.3-70b-versatile");
    res.json({ answer });
  } catch (error) {
    console.error("AI KB Search Error:", error);
    res.status(500).json({ error: 'Failed to search knowledge base' });
  }
});

// ─── 7. Serve User Knowledge Base for Law Library ────────────────────────────
app.get('/api/kb', authenticateToken, async (req, res) => {
  try {
    const kbPath = path.join(process.cwd(), 'user_knowledge_base');
    let kbFiles = [];

    if (fs.existsSync(kbPath)) {
      const allFiles = getAllFiles(kbPath);
      for (const filePath of allFiles) {
        let content = "File content not supported for direct preview.";
        const ext = path.extname(filePath).toLowerCase();
        const relativePath = path.relative(kbPath, filePath);
        const name = path.basename(filePath);

        try {
          if (ext === '.json') {
            content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          } else if (ext === '.md' || ext === '.txt') {
            content = fs.readFileSync(filePath, 'utf-8');
          } else if (ext === '.pdf') {
            content = "PDF File. Content is parsed during AI analysis.";
          }
        } catch (e) {
          content = "Error reading file";
        }

        // Use path.dirname to safely get full category structure independent of OS
        const categoryPath = path.dirname(relativePath);
        // Normalize the category, handle root folder case
        const category = categoryPath === '.' ? 'General' : categoryPath.replace(/\\/g, '/');

        kbFiles.push({
          path: relativePath,
          category: category,
          name: name,
          ext: ext,
          content: content
        });
      }
    }

    res.json({ files: kbFiles });
  } catch (error) {
    console.error("KB Fetch Error:", error);
    res.status(500).json({ error: 'Failed to fetch knowledge base' });
  }
});

// ─── 8. SOP for Case — Return matched SOPs from folder with full detail ───────
app.post('/api/sop/for-case', authenticateToken, async (req, res) => {
  try {
    const { crimeContext, crimeType } = req.body;
    const searchText = `${crimeContext || ''} ${crimeType || ''}`.toLowerCase();
    const kbPath = path.join(process.cwd(), 'user_knowledge_base');
    const matchedSOPs = [];

    for (const sop of SOP_CRIME_MAP) {
      const isRelevant = sop.keywords.some(kw => searchText.includes(kw));
      if (!isRelevant) continue;

      const filePath = path.join(kbPath, sop.file);
      if (!fs.existsSync(filePath)) continue;

      try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        const rawText = pdfData.text || '';

        // Extract meaningful paragraphs (skip blank/header lines)
        const paragraphs = rawText
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 40)   // real sentences only
          .slice(0, 80);                 // cap at 80 lines for UI

        matchedSOPs.push({
          label: sop.label,
          file: sop.file,
          fileName: path.basename(sop.file),
          fileUrl: `/kb-files/${sop.file}`,
          keywords: sop.keywords.filter(kw => searchText.includes(kw)),
          totalPages: pdfData.numpages,
          paragraphs,
          fullText: rawText.substring(0, 15000) // first 15k chars for AI context
        });

        console.log(`✅ SOP matched & parsed: ${sop.label} (${paragraphs.length} paragraphs)`);
      } catch (parseErr) {
        console.error(`❌ SOP parse error [${sop.label}]:`, parseErr.message);
        matchedSOPs.push({
          label: sop.label,
          file: sop.file,
          fileName: path.basename(sop.file),
          fileUrl: `/kb-files/${sop.file}`,
          keywords: sop.keywords.filter(kw => searchText.includes(kw)),
          totalPages: 0,
          paragraphs: [],
          error: 'Could not parse PDF content'
        });
      }
    }

    res.json({ sops: matchedSOPs, count: matchedSOPs.length });
  } catch (error) {
    console.error('SOP for Case Error:', error);
    res.status(500).json({ error: 'Failed to fetch SOP data' });
  }
});

// Global Error Handler (Prevents HTML response on 500 errors like MulterError)
app.use((err, req, res, next) => {
  console.error("Global Error Caught:", err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  }
  res.status(500).json({ error: err.message || 'An unexpected server error occurred' });
});

app.listen(PORT, () => {
  console.log(`✅ Backend API running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory ready`);
=======
// ── Analysis Router (protected) ────────────────────────────────────────────────
app.use('/api/analysis', authenticateToken, analysisRouter);

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  gemini: !!process.env.GEMINI_API_KEY,
  groq: !!process.env.GROQ_API_KEY,
  timestamp: new Date().toISOString()
}));

app.listen(PORT, () => {
  console.log(`✅ Backend API running on http://localhost:${PORT}`);
  console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Connected' : '⚠️  Not configured'}`);
  console.log(`   Groq LLM:  ${process.env.GROQ_API_KEY ? '✅ Connected' : '⚠️  Not configured'}`);
>>>>>>> origin/main
});
