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
import https from 'https';
import db from './db.js';
import FormData from 'form-data';
import nodeFetch from 'node-fetch';

// ─── Override DNS to use Google DNS (8.8.8.8) — bypasses ISP DNS blocks ──────
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// ─── Custom HTTPS Agent: Direct IP bypass for ENOTFOUND errors ───────────────
// api.groq.com resolves to these IPs (via 8.8.8.8 DNS — verified)
// We connect directly to IP + set Host header → completely bypasses DNS
const GROQ_IPS = ['172.64.149.20', '104.18.38.236'];
let groqIpIndex = 0;

const groqAgent = new https.Agent({
  family: 4,
  keepAlive: true,
  servername: 'api.groq.com'  // SNI for TLS handshake
});

// Helper: build Groq URL using direct IP
const getGroqUrl = (path) => {
  const ip = GROQ_IPS[groqIpIndex % GROQ_IPS.length];
  groqIpIndex++;
  return `https://${ip}${path}`;
};



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

dotenv.config({ path: path.join(process.cwd(), '.env') });

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

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, ...userData } = user;
  res.json(userData);
});

// ─── Groq API Helper ─────────────────────────────────────────────────────────
async function callGroqAPI(messages, jsonMode = false, model = "llama-3.1-8b-instant") {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not found in .env");

  const body = { model, messages };
  if (jsonMode) body.response_format = { type: "json_object" };

  // Use direct IP to bypass DNS resolution failure
  const url = getGroqUrl('/openai/v1/chat/completions');
  console.log(`🌐 Groq API call → ${url}`);

  const response = await nodeFetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Host": "api.groq.com"   // Required for TLS SNI + routing
    },
    body: JSON.stringify(body),
    agent: groqAgent
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Groq API Error:", err);
    throw new Error(`Failed to fetch from AI: ${response.status} - ${err}`);
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

  // Use direct IP to bypass DNS resolution failure
  const url = getGroqUrl('/openai/v1/audio/transcriptions');

  const response = await nodeFetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Host": "api.groq.com",  // Required for TLS SNI + routing
      ...formData.getHeaders()
    },
    body: formData,
    agent: groqAgent
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
MANDATORY IPC TO BNS MAPPING (Use ONLY these BNS numbers - NEVER use IPC numbers in "code" field):
302->BNS 101, 304->BNS 105, 304A->BNS 106, 307->BNS 109, 308->BNS 110, 319->BNS 114, 320->BNS 115, 323->BNS 115(2), 324->BNS 117, 325->BNS 116, 326->BNS 118, 327->BNS 122, 341->BNS 126, 342->BNS 127, 354->BNS 74, 354A->BNS 75, 354B->BNS 76, 354C->BNS 77, 354D->BNS 78, 363->BNS 137, 364->BNS 139, 365->BNS 140, 366->BNS 141, 375/376->BNS 63/64, 376A->BNS 66, 376AB->BNS 65, 376D->BNS 70, 376DA->BNS 71, 377->BNS 100, 378/379->BNS 303, 380->BNS 305, 381->BNS 306, 382->BNS 304, 383/384->BNS 308, 390/392->BNS 309, 395->BNS 310, 396->BNS 311, 405/406/409->BNS 316, 415/420->BNS 318, 425/426/427->BNS 324, 428/429->BNS 325, 441/448->BNS 329, 447->BNS 333, 452->BNS 330, 494/495->BNS 82, 496->BNS 83, 497->BNS 84, 498A->BNS 85, 499/500->BNS 356, 503/506->BNS 351, 504->BNS 352, 509->BNS 79, 34->BNS 3(5), 120B->BNS 61, 107->BNS 45, 109->BNS 48.

BNSS (New CrPC) KEY SECTIONS:
CrPC 154 -> BNSS 173 (FIR Registration)
CrPC 161 -> BNSS 180 (Witness Statement)
CrPC 164 -> BNSS 183 (Statement before Magistrate)
CrPC 167 -> BNSS 187 (Remand)
CrPC 173 -> BNSS 193 (Charge Sheet)
CrPC 41 -> BNSS 35 (Arrest)
`;

const SPECIAL_LAWS_REFERENCE = `
AVAILABLE SPECIAL LAWS IN KNOWLEDGE BASE:
- IT Act 2000
- NDPS Act 1985
- POCSO Act 2012
- Domestic Violence Act 2005 (PWDVA)
- SC/ST (Prevention of Atrocities) Act
- Dowry Prohibition Act 1961
- Arms Act 1959
- Motor Vehicle Act 1988
- Prevention of Money Laundering Act 2002
- Haryana Police Act 2007
- Haryana Gauvansh Sanrakshan Act 2015
- Immoral Traffic Prevention Act 1956
- Juvenile Justice Act 2015
- UAPA 1967
- Prevention of Corruption Act 1988
- Essential Commodities Act 1955
- Haryana Excise Act 1914
- Benami Transactions Act 1988
- National Security Act 1980
- Child Marriage Prohibition Act 2006
- Public Gambling Act 1867

YOU MUST NOT SUGGEST ANY SPECIAL LAW THAT IS NOT IN THIS LIST. If a crime does not fall under these, DO NOT hallucinate a special law. Leave the special_laws array empty [].
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

${SPECIAL_LAWS_REFERENCE}

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
      "punishment": "Imprisonment up to 3 years + Fine",
      "page_number": "Page 45",
      "file_url": "laws/BNS ACT 2023.pdf"
    }
  ],
  "sop": [
    {
      "step": 1,
      "action": "Register FIR immediately under BNSS Section 173 - this is a cognizable offence",
      "time_limit": "Within 24 hours",
      "authority": "SHO",
      "priority": "CRITICAL",
      "page_number": "Page 2",
      "file_url": "sop/Regulation No. 14 of 2024.GUIDLINE FOR EXPEDITIOUS  & FAIR INVESTIGATION OF RAPE CASES.pdf"
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
      "relevance": "Mandatory FIR registration",
      "page_number": "Page 12",
      "file_url": "judgements/Landmark Supreme Court Directives.pdf"
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
      "relevance": "How IO should apply this",
      "page_number": "Page 5",
      "file_url": "judgements/relevant_hc_judgment.pdf"
    }
  ],
  "special_laws": [
    {
      "act_name": "Protection of Women from Domestic Violence Act 2005",
      "sections": ["3", "12", "23"],
      "action": "File for protection order. Inform victim of rights. Report to DV Magistrate.",
      "priority": "HIGH",
      "page_number": "Page 3",
      "file_url": "laws/special_law.pdf"
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
3. ONLY include BNS sections that strictly apply to the facts. DO NOT suggest sections for human offenses (like homicide or human hurt) if the crime is against an animal. If no BNS sections apply, leave the sections array empty.
4. If unreadable text: {"error": "Cannot read document clearly. Upload a clearer image or type complaint text."}
5. ABSOLUTE STRICT GROUNDING RULE: For "sections", "sop", "sc_judgments", "hc_judgments", and "special_laws", YOU MUST ONLY SUGGEST items that are EXPLICITLY FOUND in the "=== CUSTOM KNOWLEDGE BASE ===" provided below. 
5b. DO NOT USE YOUR PRE-TRAINED KNOWLEDGE to invent or suggest sections, SOPs, or judgments that are not in the provided knowledge base. If there is no relevant SOP or judgment in the knowledge base, LEAVE THE ARRAY EMPTY ([]). DO NOT hallucinate.
5c. For page_number: ONLY provide the EXACT "[Page X]" if it is explicitly present in the provided context block where you found the information. If you cannot find the "[Page X]" tag for that exact information, you MUST return an empty string "" for page_number. DO NOT GUESS OR HALLUCINATE PAGE NUMBERS.
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


// ─── Law Library Metadata: All files with their category, url, label ──────────
const LAW_LIBRARY_META = {
  laws: [
    { file: 'laws/BNS ACT 2023.pdf', label: 'BNS (Bharatiya Nyaya Sanhita) 2023', keywords: ['bns', 'bharatiya nyaya', 'murder', 'theft', 'rape', 'assault', 'cheating', 'fraud', 'ipc', 'criminal', 'offense', 'punishment'] },
    { file: 'laws/BNSS ACT 2023.pdf', label: 'BNSS (Bharatiya Nagarik Suraksha Sanhita) 2023', keywords: ['bnss', 'crpc', 'fir', 'arrest', 'remand', 'trial', 'bail', 'procedure', 'investigation', 'charge sheet', 'magistrate'] },
    { file: 'laws/BSA 2023.pdf', label: 'BSA (Bharatiya Sakshya Adhiniyam) 2023', keywords: ['bsa', 'evidence', 'witness', 'confession', 'sakshya', 'proof', 'digital evidence'] },
  ],
  specialLaws: [
    { file: 'special laws/IT ACT 2000.pdf', label: 'IT Act 2000', keywords: ['cyber', 'it act', 'hacking', 'digital', 'computer', 'online fraud', 'cybercrime', 'internet', 'data'] },
    { file: 'special laws/NDPS_Act_and_Rules_1985-(updated_2025).pdf', label: 'NDPS Act 1985 (Updated 2025)', keywords: ['ndps', 'drugs', 'narcotic', 'psychotropic', 'narcotics', 'drug trafficking', 'nasha'] },
    { file: 'special laws/pocso act 2012.pdf', label: 'POCSO Act 2012', keywords: ['pocso', 'child', 'minor', 'sexual abuse', 'children', 'juvenile'] },
    { file: 'special laws/Domestic violence act.pdf', label: 'Domestic Violence Act 2005', keywords: ['domestic violence', 'pwdva', 'dv act', 'protection order', 'matrimonial', 'wife'] },
    { file: 'special laws/sc & st act.pdf', label: 'SC/ST (Prevention of Atrocities) Act', keywords: ['sc st', 'atrocity', 'dalit', 'scheduled caste', 'scheduled tribe', 'atrocities'] },
    { file: 'special laws/dowry prohibition act 1961.pdf', label: 'Dowry Prohibition Act 1961', keywords: ['dowry', 'dahej', 'dowry prohibition', 'dowry demand'] },
    { file: 'special laws/arms act 1959.pdf', label: 'Arms Act 1959', keywords: ['arms', 'weapon', 'gun', 'firearm', 'pistol', 'rifle', 'hathiyar'] },
    { file: 'special laws/motor vehicle act 1988.pdf', label: 'Motor Vehicle Act 1988', keywords: ['motor vehicle', 'accident', 'rash driving', 'drunk driving', 'traffic', 'vehicle'] },
    { file: 'special laws/THE PROTECTION OF CHILDREN FROM SEXUAL OFFENCES ACT, 2012.pdf', label: 'POCSO Act 2012 (Full)', keywords: ['pocso', 'child protection', 'sexual offence', 'minor'] },
    { file: 'special laws/prevention of money laundering act 2002.pdf', label: 'Prevention of Money Laundering Act 2002', keywords: ['money laundering', 'pmla', 'hawala', 'benami', 'financial crime'] },
    { file: 'special laws/THE HARYANA POLICE ACT, 2007.pdf', label: 'Haryana Police Act 2007', keywords: ['haryana police', 'police act', 'police duty', 'police conduct'] },
    { file: 'special laws/THE HARYANA GAUVANSH SANRAKSHAN AND GAUSAMVARDHAN ACT, 2015.pdf', label: 'Haryana Gauvansh Sanrakshan Act 2015', keywords: ['cow', 'gauvansh', 'cattle', 'slaughter', 'gau'] },
    { file: 'special laws/THE IMMORAL TRAFFIC (PREVENTION) ACT, 1956.pdf', label: 'Immoral Traffic Prevention Act 1956', keywords: ['immoral traffic', 'trafficking', 'prostitution', 'itpa'] },
    { file: 'special laws/THE JUVENILE JUSTICE (CARE AND PROTECTION OF CHILDREN) ACT, 2015.pdf', label: 'Juvenile Justice Act 2015', keywords: ['juvenile', 'child in conflict', 'borstal', 'jjb', 'child care'] },
    { file: 'special laws/THE UNLAWFUL ACTIVITIES (PREVENTION) ACT, 1967.pdf', label: 'UAPA 1967', keywords: ['uapa', 'terrorism', 'unlawful', 'terrorist', 'extremist'] },
    { file: 'special laws/The Prevention of Corruption Act, 1988.pdf', label: 'Prevention of Corruption Act 1988', keywords: ['corruption', 'bribery', 'bribe', 'dishonest', 'pc act', 'trap case'] },
    { file: 'special laws/essential_commodities_act_1955.pdf', label: 'Essential Commodities Act 1955', keywords: ['essential commodities', 'hoarding', 'black market', 'commodity'] },
    { file: 'special laws/haryana_excise_act,_1914_(1_of_1914).pdf', label: 'Haryana Excise Act 1914', keywords: ['excise', 'liquor', 'alcohol', 'sharab', 'illicit liquor', 'bootlegging'] },
    { file: 'special laws/Benami Property Transactions Act, 1988.pdf', label: 'Benami Transactions Act 1988', keywords: ['benami', 'property', 'black money', 'benami property'] },
    { file: 'special laws/THE NATIONAL SECURITY ACT, 1980.pdf', label: 'National Security Act 1980', keywords: ['nsa', 'national security', 'detention', 'preventive detention'] },
    { file: 'special laws/the_prohibition_of_child_marriage_act,_2006.pdf', label: 'Child Marriage Prohibition Act 2006', keywords: ['child marriage', 'bal vivah', 'minor marriage'] },
    { file: 'special laws/THE PUBLIC GAMBLING ACT, 1867.pdf', label: 'Public Gambling Act 1867', keywords: ['gambling', 'jua', 'betting', 'casino', 'gaming'] },
  ],
  sops: [
    { file: 'sop/Regulation No. 14 of 2024.GUIDLINE FOR EXPEDITIOUS  & FAIR INVESTIGATION OF RAPE CASES.pdf', label: 'SOP: Rape Investigation (Regulation 14/2024)', keywords: ['rape case', 'rape investigation', 'sexual assault investigation', 'bns 63', 'bns 64', 'bns 70', 'gang rape', 'rape sop', 'regulation 14'] },
    { file: 'sop/Regulation No. 15 of 2024.CRUELTY IN MARRIAGE_.pdf', label: 'SOP: Cruelty in Marriage (Regulation 15/2024)', keywords: ['cruelty in marriage', 'domestic violence case', 'bns 85', 'matrimonial case', 'dowry harassment', '498a sop', 'regulation 15'] },
    { file: 'sop/Regulation No. 20 of 2024.INVESTIGATION INTO ECONOMIC OFFENCES_.pdf', label: 'SOP: Economic Offences (Regulation 20/2024)', keywords: ['economic offence', 'fraud investigation', 'bns 318', 'financial crime', 'cyber fraud sop', 'regulation 20'] },
    { file: 'sop/SOP MISSING PERSON.pdf', label: 'SOP: Missing Person', keywords: ['missing person', 'missing child', 'gumshuda person', 'child missing', 'abduction sop', 'kidnapping sop'] },
    { file: 'sop/cyber slavery SOP.pdf', label: 'SOP: Cyber Slavery & Human Trafficking', keywords: ['cyber slavery', 'human trafficking', 'cyber crime sop', 'online fraud sop', 'digital crime sop', 'trafficking sop'] },
    { file: 'sop/Regulation No. 3.VISIT BY FORENSIC TEAM IN HENIOUS CRIME CASES.pdf', label: 'SOP: Forensic Team Visit - Heinous Crimes (Regulation 3)', keywords: ['forensic team', 'heinous crime', 'fsl visit', 'murder investigation sop', 'bns 101 sop', 'regulation 3'] },
    { file: 'sop/Regulation No. 4.PROCEDURE U_S 41 & 41A  CRPC.pdf', label: 'SOP: Arrest Procedure BNSS 35 (Regulation 4)', keywords: ['arrest procedure', 'bnss 35 sop', 'section 41a', 'arrest guideline', 'giraftari sop', 'regulation 4'] },
    { file: 'sop/Regulation No. 12 of 2024.BNSS GUIDELINE SECTION 35,187,153,157.pdf', label: 'SOP: Remand & Custody (Regulation 12/2024)', keywords: ['remand procedure', 'bnss 187', 'judicial custody', 'police custody sop', 'regulation 12', 'remand guideline'] },
  ],
  judgements: [
    { file: 'judgements/Arnesh Kumar vs State of Bihar.pdf', label: 'Arnesh Kumar vs State of Bihar', keywords: ['arrest', 'bnss 35', '41a', 'crpc 41', 'bns 85', '498a', 'arnesh kumar', 'arrest guideline'] },
    { file: 'judgements/Landmark Supreme Court Directives & national human right commission guidelines.pdf', label: 'Landmark SC Directives & NHRC Guidelines', keywords: ['nhrc', 'human rights', 'police', 'guidelines', 'landmark', 'supreme court'] },
    { file: 'judgements/Maneka_Gandhi_vs_Union_Of_India_on_25_January_1978 (1).pdf', label: 'Maneka Gandhi vs Union of India (1978)', keywords: ['personal liberty', 'article 21', 'fundamental rights', 'passport', 'maneka gandhi'] },
    { file: 'judgements/Nandini_Satpathy_vs_Dani_P_L_And_Anr_on_7_April_1978 (1).pdf', label: 'Nandini Satpathy vs Dani (1978)', keywords: ['self incrimination', 'article 20(3)', 'interrogation', 'custodial interrogation', 'right to silence'] },
    { file: 'judgements/Selvi_Ors_vs_State_Of_Karnataka_Anr_on_5_May_2010 (1).pdf', label: 'Selvi vs State of Karnataka (2010)', keywords: ['narco analysis', 'brain mapping', 'polygraph', 'lie detector', 'compelled testimony', 'selvi'] },
    { file: 'judgements/Bhagwat_Singh_vs_Commissioner_Of_Police_And_Anr_on_25_April_1985 (1).pdf', label: 'Bhagwat Singh vs Commissioner of Police (1985)', keywords: ['arrest memo', 'grounds of arrest', 'detention', 'police custody', 'bhagwat singh'] },
    { file: 'judgements/Zahira_Habibullah_Sheikh_Anr_vs_State_Of_Gujarat_Ors_on_8_March_2006 (1).pdf', label: 'Zahira Sheikh vs State of Gujarat (Best Bakery) (2006)', keywords: ['best bakery', 'witness protection', 'hostile witness', 'fair investigation', 'zahira'] },
    { file: 'judgements/Priyanka_Srivastava_Anr_vs_State_Of_U_P_Ors_on_19_March_2015 (1).pdf', label: 'Priyanka Srivastava vs State of UP (2015)', keywords: ['fake complaint', 'false case', 'misuse', 'section 156(3)', 'bnss', 'affidavit', 'magistrate'] },
    { file: 'judgements/People\'S_Union_For_Civil_Liberties_And_vs_State_Of_Maharashtra_Ors_on_23_September_2014 (1).pdf', label: 'PUCL vs State of Maharashtra (2014)', keywords: ['encounter', 'fake encounter', 'extrajudicial killing', 'pucl', 'human rights'] },
    { file: 'judgements/Arjun_Panditrao_Khotkar_vs_Kailash_Kushanrao_Gorantyal_on_14_July_2020 (1) (1).pdf', label: 'Arjun Panditrao Khotkar vs Kailash Gorantyal (2020)', keywords: ['electronic evidence', 'digital evidence', 'certificate', 'section 65b', 'bsa', 'whatsapp', 'video'] },
    { file: 'judgements/2026 Supreme Court Guidelines on Digital Devices.pdf', label: '2026 SC Guidelines on Digital Devices', keywords: ['digital device', 'mobile phone', 'seizure', 'electronic', '2026', 'digital forensic', 'phone seizure'] },
    { file: 'judgements/Naresh_Kumar_Garg_vs_The_State_Of_Haryana_on_23_February_2026 (1).pdf', label: 'Naresh Kumar Garg vs State of Haryana (2026)', keywords: ['haryana', '2026', 'high court', 'phc', 'punjab haryana'] },
    { file: 'judgements/lalit kumar vs govt of u.p.pdf', label: 'Lalit Kumar vs Govt of UP', keywords: ['lalit kumar', 'up', 'investigation', 'uttar pradesh'] },
  ]
};

// ─── PDF Paged Extractor Helper ───────────────────────────────────────────
const extractPdfWithPages = async (dataBuffer, maxChars = 4000) => {
  let pageTexts = [];
  try {
    await pdfParse(dataBuffer, {
      pagerender: function(pageData) {
        return pageData.getTextContent().then(function(textContent) {
          let pageText = textContent.items.map(i => i.str).join(' ');
          pageTexts.push(pageText);
          return pageText;
        });
      }
    });
    if (pageTexts.length > 0) {
      return pageTexts.map((pt, i) => `[Page ${i + 1}]:\n${pt}`).join('\n\n').substring(0, maxChars);
    }
  } catch (e) {
    console.error("Error in pagerender:", e.message);
  }
  // Fallback
  try {
    const pdfData = await pdfParse(dataBuffer);
    return (pdfData.text || '').substring(0, maxChars);
  } catch (e) {
    return '';
  }
};

// ─── Smart Library Context Extractor ───────────────────────────────────────
const getRelevantLibraryContext = async (crimeContext = '') => {
  const kbPath = path.join(process.cwd(), 'user_knowledge_base');
  const lowerContext = crimeContext.toLowerCase();
  
  const relevantFiles = [];
  const allCategories = [
    ...LAW_LIBRARY_META.laws.map(f => ({ ...f, category: 'laws' })),
    ...LAW_LIBRARY_META.specialLaws.map(f => ({ ...f, category: 'special_laws' })),
    ...LAW_LIBRARY_META.sops.map(f => ({ ...f, category: 'sop' })),
    ...LAW_LIBRARY_META.judgements.map(f => ({ ...f, category: 'judgements' })),
  ];

  for (const item of allCategories) {
    const matchScore = item.keywords.filter(kw => lowerContext.includes(kw)).length;
    if (matchScore > 0) {
      relevantFiles.push({ ...item, matchScore });
    }
  }

  // Sort by matchScore descending
  relevantFiles.sort((a, b) => b.matchScore - a.matchScore);

  // Take top 2 from each category to ensure diversity (Laws, SOPs, Judgements)
  const topFiles = [];
  ['laws', 'special_laws', 'sop', 'judgements'].forEach(cat => {
    const catFiles = relevantFiles.filter(f => f.category === cat);
    if (catFiles.length > 0) {
      topFiles.push(...catFiles.slice(0, 2));
    }
  });

  let combinedContext = '';
  for (const item of topFiles) {
    const filePath = path.join(kbPath, item.file);
    if (!fs.existsSync(filePath)) continue;
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const text = await extractPdfWithPages(dataBuffer, 4000);
      combinedContext += `\n\n=== SOURCE TYPE: ${item.category.toUpperCase()} | FILE: ${item.label} (URL: ${item.file}) ===\n${text}\n${'='.repeat(60)}\n`;
    } catch (e) { }
  }
  return combinedContext;
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
          const text = await extractPdfWithPages(dataBuffer, 4000);
          sopContent += `\n\n=== OFFICIAL HARYANA POLICE SOP: ${sop.label} ===\n${text}\n${'='.repeat(60)}\n`;
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
            const text = await extractPdfWithPages(dataBuffer, 4000);
            kbContent += `\n--- CUSTOM USER KNOWLEDGE FROM PDF: ${file} ---\n${text}\n----------------------------------------\n`;
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

// ─── List Knowledge Base Files ────────────────────────────────────────────────
app.get('/api/kb', authenticateToken, (req, res) => {
  try {
    const kbPath = path.join(process.cwd(), 'user_knowledge_base');
    if (!fs.existsSync(kbPath)) return res.json({ files: [] });
    
    const allFilesOnDisk = getAllFiles(kbPath).filter(f => f.toLowerCase().endsWith('.pdf'));
    const files = allFilesOnDisk.map(absolutePath => {
      const relPath = path.relative(kbPath, absolutePath).replace(/\\/g, '/');
      const filename = path.basename(relPath);
      
      let category = 'special laws';
      if (relPath.startsWith('laws/')) category = 'laws';
      else if (relPath.startsWith('sop/')) category = 'sop';
      else if (relPath.startsWith('judgements/')) category = 'judgements';
      
      return {
        name: filename,
        category: category,
        url: relPath
      };
    });
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 1. Smart Multi-File Analysis Endpoint ────────────────────────────────────
app.post('/api/ai/analyze-complaint', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const caseType = req.body.caseType;
    const caseName = req.body.caseName;
    
    let cacheFile = null;
    if (caseType && caseName) {
      const dirPath = path.join(process.cwd(), 'cases', caseType);
      if (fs.existsSync(dirPath)) {
        cacheFile = path.join(dirPath, `${caseName}.cache.json`);
        if (fs.existsSync(cacheFile)) {
          console.log(`[Cache Hit] Serving cached analysis for ${caseName}`);
          const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          return res.json(cachedData);
        }
      }
    }

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

    // ─── Load Knowledge: Comprehensive Library Match ──────────────────────
    const libraryContext = await getRelevantLibraryContext(combinedText);
    const knowledgeInjection = libraryContext
      ? `\n\n=== CUSTOM KNOWLEDGE BASE (USE ONLY THESE SOURCES) ===\n${libraryContext}\n`
      : '\n\n=== CUSTOM KNOWLEDGE BASE ===\n[No specific matches found in library. Return empty arrays for SOP and Judgements.]\n';

    const finalSystemPrompt = ANALYSIS_SYSTEM_PROMPT + knowledgeInjection;
      // + (customKnowledge ? `\n\n=== CUSTOM KNOWLEDGE BASE ===\n${customKnowledge}\n=============================\n` : '');

    if (libraryContext) console.log('✅ Custom Library Context injected into AI prompt');
    else console.log('ℹ️ No specific library match found - returning empty recommendations');

    const aiResponse = await callGroqAPI([
      { role: "system", content: finalSystemPrompt },
      { role: "user", content: userMessage }
    ], true, "llama-3.1-8b-instant");

    const parsedJson = JSON.parse(aiResponse);

    if (parsedJson.error) {
      return res.status(400).json({ error: parsedJson.error });
    }

    // ─── Post-Process: Inject Law Library Links for BNS Sections ─────────────
    // Since the full BNS PDF is too large for the context window, the AI often leaves page_number blank.
    if (parsedJson.sections && Array.isArray(parsedJson.sections)) {
      parsedJson.sections.forEach(sec => {
        const code = sec.code ? sec.code.toUpperCase() : '';
        if (code.startsWith('BNS ')) {
          sec.file_url = 'laws/BNS ACT 2023.pdf';
          
          // Basic page number mapping for common BNS sections
          const numMatch = code.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0]);
            if (!sec.page_number) {
              if (num >= 63 && num <= 71) sec.page_number = "Page 5"; // Sexual offences
              else if (num >= 74 && num <= 85) sec.page_number = "Page 6"; // Women / Cruelty
              else if (num >= 100 && num <= 113) sec.page_number = "Page 6"; // Murder / Homicide
              else if (num >= 114 && num <= 125) sec.page_number = "Page 7"; // Hurt
              else if (num >= 137 && num <= 141) sec.page_number = "Page 8"; // Kidnapping
              else if (num >= 303 && num <= 306) sec.page_number = "Page 13"; // Theft
              else if (num >= 308 && num <= 311) sec.page_number = "Page 14"; // Extortion/Robbery
              else if (num >= 316 && num <= 318) sec.page_number = "Page 15"; // Fraud
              else sec.page_number = "Page 2"; // Default fallback to index/start
            }
          }
        } else if (code.startsWith('BNSS ')) {
          sec.file_url = 'laws/BNSS ACT 2023.pdf';
          if (!sec.page_number) sec.page_number = "Page 10"; // General BNSS fallback
        }
      });
    }

    // ─── Post-Process: Inject Law Library Links for Special Laws ─────────────
    if (parsedJson.special_laws && Array.isArray(parsedJson.special_laws)) {
      parsedJson.special_laws.forEach(sl => {
        const actNameLower = (sl.act_name || '').toLowerCase();
        
        if (actNameLower.includes('pocso') || actNameLower.includes('children from sexual offences')) {
          sl.file_url = 'special laws/THE PROTECTION OF CHILDREN FROM SEXUAL OFFENCES ACT, 2012.pdf';
          if (!sl.page_number) sl.page_number = "Page 10";
        } else if (actNameLower.includes('ndps') || actNameLower.includes('narcotic')) {
          sl.file_url = 'special laws/NDPS_Act_and_Rules_1985-(updated_2025).pdf';
          if (!sl.page_number) sl.page_number = "Page 15";
        } else if (actNameLower.includes('it act') || actNameLower.includes('information technology')) {
          sl.file_url = 'special laws/IT ACT 2000.pdf';
          if (!sl.page_number) sl.page_number = "Page 25";
        } else if (actNameLower.includes('sc/st') || actNameLower.includes('atrocities') || actNameLower.includes('scheduled caste')) {
          sl.file_url = 'special laws/sc & st act.pdf';
          if (!sl.page_number) sl.page_number = "Page 4";
        } else if (actNameLower.includes('domestic violence') || actNameLower.includes('pwdva')) {
          sl.file_url = 'special laws/Domestic violence act.pdf';
          if (!sl.page_number) sl.page_number = "Page 6";
        } else if (actNameLower.includes('arms act')) {
          sl.file_url = 'special laws/arms act 1959.pdf';
          if (!sl.page_number) sl.page_number = "Page 10";
        } else if (actNameLower.includes('motor vehicle')) {
          sl.file_url = 'special laws/motor vehicle act 1988.pdf';
          if (!sl.page_number) sl.page_number = "Page 80";
        } else if (actNameLower.includes('dowry')) {
          sl.file_url = 'special laws/dowry prohibition act 1961.pdf';
          if (!sl.page_number) sl.page_number = "Page 2";
        } else if (actNameLower.includes('money laundering')) {
          sl.file_url = 'special laws/prevention of money laundering act 2002.pdf';
          if (!sl.page_number) sl.page_number = "Page 5";
        } else if (actNameLower.includes('corruption')) {
          sl.file_url = 'special laws/The Prevention of Corruption Act, 1988.pdf';
          if (!sl.page_number) sl.page_number = "Page 4";
        } else {
          // Dynamic fallback for any other special law
          const match = LAW_LIBRARY_META.specialLaws.find(meta => 
            meta.keywords.some(kw => actNameLower.includes(kw))
          );
          if (match) {
            sl.file_url = match.file;
            if (!sl.page_number) sl.page_number = "Page 1";
          }
        }
      });
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
      '428': 'BNS 325', '429': 'BNS 325',
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
    const structuredData = {
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
    };

    if (cacheFile) {
      try {
        fs.writeFileSync(cacheFile, JSON.stringify(structuredData, null, 2));
        console.log(`[Cache Saved] Saved analysis to ${cacheFile}`);
      } catch (e) {
        console.error('Error saving cache file:', e.message);
      }
    }

    res.json(structuredData);

  } catch (error) {
    console.error("Analysis Error:", error);
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
        content: `You are Dost, a highly bilingual Legal Assistant.
        
*** CRITICAL RULE: LANGUAGE MATCHING ***
You MUST analyze the user's text and reply in the EXACT same language.
- User uses English -> Reply in pure English.
- User uses Hinglish (Roman Hindi) -> Reply in Hinglish.
- User uses Devanagari Hindi -> Reply in Devanagari Hindi.
This rule is your top priority.

=== LAWS (effective July 1, 2024) ===
BNS replaces IPC. BNSS replaces CrPC. BSA replaces Indian Evidence Act.
Use BNS/BNSS/BSA section numbers. (e.g. BNS 101 for old IPC 302)

Key BNS: Murder=BNS 101, Culpable Homicide=BNS 105, Attempt to Murder=BNS 109, Rape=BNS 63/64, Theft=BNS 303, Robbery=BNS 309, Fraud=BNS 318, Cruelty=BNS 85, Kidnapping=BNS 137.
Key BNSS: FIR=BNSS 173, Witness Statement=BNSS 180, Remand=BNSS 187, Charge Sheet=BNSS 193, Arrest=BNSS 35.

=== BEHAVIOR ===
- Be concise.
- Cite BNS/BNSS/BSA section numbers.
- Knowledgeable about POCSO, SC/ST Act, IT Act, PWDVA.`
      }
    ];
    // Sanitize history: ensure it alternates properly and ends with 'assistant'
    if (history && history.length > 0) {
      let sanitizedHistory = [];
      let expectedRole = 'user';
      for (const msg of history) {
        if (msg.role === expectedRole) {
          sanitizedHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
        }
      }
      // If it ends with 'user', drop the last message so the next pushed message is valid
      if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
        sanitizedHistory.pop();
      }
      messages.push(...sanitizedHistory);
    }
    
    // Enforce language constraint by appending a strong reminder to the current message
    const enforcedMessage = `[User Message]: ${currentMessage}\n\n[System]: Reply to the user's message. You MUST reply in the EXACT SAME LANGUAGE the user used. If they asked in English, reply in English. If they asked in Hindi, reply in Hindi.`;
    messages.push({ role: "user", content: enforcedMessage });
    
    const reply = await callGroqAPI(messages, false);
    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to chat with AI' });
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

CRITICAL RULE: You MUST provide the explanation ENTIRELY in ENGLISH. Do NOT use Hindi.

For the given section, provide:
1. **Official Title** of the section
2. **Full Definition** (exact legal language)
3. **Punishment** (exact as per law)
4. **Key Case Laws** (1-2 landmark judgments)
5. **IO's Duty** (what the Investigating Officer must do)
Use clean markdown formatting. Be comprehensive but concise.`
      },
      { role: "user", content: `Explain: ${sectionCode} (in English only)` }
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
    ], true, 'llama-3.1-8b-instant');

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

    const answer = await callGroqAPI(messages, false, "llama-3.1-8b-instant");
    res.json({ answer });
  } catch (error) {
    console.error("AI KB Search Error:", error);
    res.status(500).json({ error: 'Failed to search knowledge base' });
  }
});



// ─── 6c. Law Library Smart AI Search (NotebookLM Style) ───────────────────────
app.post('/api/ai/law-library-search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    const kbPath = path.join(process.cwd(), 'user_knowledge_base');
    const lowerQuery = query.toLowerCase();

    // ── Step 1: Scan entire folder dynamically ──
    const allFilesOnDisk = getAllFiles(kbPath).filter(f => f.toLowerCase().endsWith('.pdf'));
    
    // Convert hardcoded meta into a flat map for easy lookup
    const metaMap = new Map();
    [
      ...LAW_LIBRARY_META.laws.map(f => ({ ...f, category: 'laws' })),
      ...LAW_LIBRARY_META.specialLaws.map(f => ({ ...f, category: 'special laws' })),
      ...LAW_LIBRARY_META.judgements.map(f => ({ ...f, category: 'judgements' })),
      ...LAW_LIBRARY_META.sops.map(f => ({ ...f, category: 'sop' }))
    ].forEach(item => {
      // normalize path separators
      const normPath = item.file.replace(/\\/g, '/');
      metaMap.set(normPath, item);
    });

    const relevantFiles = [];
    
    for (const absolutePath of allFilesOnDisk) {
      // Get relative path like "special laws/factory_act.pdf"
      const relPath = path.relative(kbPath, absolutePath).replace(/\\/g, '/');
      const filename = path.basename(relPath).toLowerCase();
      
      let itemMeta = metaMap.get(relPath);
      
      // If file not in hardcoded META, dynamically generate it
      if (!itemMeta) {
        // Create keywords by splitting filename
        const generatedKeywords = filename.replace('.pdf', '').split(/[\s_,-]+/).filter(k => k.length > 2);
        
        let category = 'general';
        if (relPath.startsWith('laws/')) category = 'laws';
        else if (relPath.startsWith('sop/')) category = 'sop';
        else if (relPath.startsWith('judgements/')) category = 'judgements';
        else if (relPath.startsWith('special laws/')) category = 'special laws';

        itemMeta = {
          file: relPath,
          label: filename.replace('.pdf', '').toUpperCase(),
          category: category,
          keywords: generatedKeywords
        };
      }

      // Check match score based on words in the query vs keywords/filename
      let matchScore = 0;
      
      // 1. Direct keyword matches
      const kwMatches = itemMeta.keywords.filter(kw => lowerQuery.includes(kw)).length;
      matchScore += kwMatches;
      
      // 2. Direct filename substring match (e.g. if query is "factory" and filename is "factory_act")
      const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 3);
      for (const word of queryWords) {
        if (filename.includes(word)) matchScore += 2; // Extra weight for filename match
      }

      if (matchScore > 0) {
        // SOPs need higher strictness (score >= 2) to prevent false positives
        if (itemMeta.category === 'sop' && matchScore < 2) continue;
        
        relevantFiles.push({ ...itemMeta, matchScore });
      }
    }

    // Sort by relevance score. Laws first (higher priority), then SOPs only if strongly relevant.
    relevantFiles.sort((a, b) => {
      // SOPs always go after laws/judgements at equal score
      if (a.category === 'sop' && b.category !== 'sop') return 1;
      if (a.category !== 'sop' && b.category === 'sop') return -1;
      return b.matchScore - a.matchScore;
    });
    const topFiles = relevantFiles.slice(0, 5);

    // ── Step 2: Extract text from relevant PDFs ────────────────────────────────
    let combinedContext = '';
    const sourceFiles = [];

    for (const item of topFiles) {
      const filePath = path.join(kbPath, item.file);
      if (!fs.existsSync(filePath)) continue;
      try {
        const dataBuffer = fs.readFileSync(filePath);

        // ── Page-by-page extraction to find exact page number ──
        let bestMatchPage = 1;
        let allText = '';
        const lowerKw = item.keywords.filter(kw => lowerQuery.includes(kw));
        const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2 || /^\d+[a-z]?$/.test(w));
        const numbers = lowerQuery.match(/\b\d+[a-z]?\b/g) || [];

        let pageTexts = [];
        await pdfParse(dataBuffer, {
          pagerender: function(pageData) {
            return pageData.getTextContent().then(function(textContent) {
              let pageText = textContent.items.map(item => item.str).join(' ');
              pageTexts.push(pageText);
              return pageText;
            });
          }
        });

          if (pageTexts.length > 0) {
          let bestScore = -1;
          let bestIdx = 0;
          pageTexts.forEach((pt, idx) => {
            const lower = pt.toLowerCase();
            let score = 0;
            // Full query exact match
            if (lower.includes(lowerQuery)) score += 100;
            
            // Keyword matches (diminished returns to prevent index pages from winning)
            lowerKw.forEach(kw => { if (lower.includes(kw)) score += 5; });
            queryWords.forEach(qw => {
              // Ignore very generic words for scoring
              if (['act', 'the', 'law', 'and', 'for', 'rule'].includes(qw)) return;
              const count = (lower.match(new RegExp('\\b' + qw + '\\b', 'g')) || []).length;
              score += count > 5 ? 10 : count * 2; // Cap keyword score
            });
            
            // Massive boost for numbers to find the actual section
            numbers.forEach(num => {
              // Match "section 54", "sec 54", "sec. 54", "धारा 54"
              const secRegex = new RegExp(`(?:section|sec\\.?|धारा)\\s*${num}\\b`, 'gi');
              score += (lower.match(secRegex) || []).length * 500;
              // Match "54." or "54" as an isolated word
              const isolatedNumRegex = new RegExp(`\\b${num}\\b`, 'g');
              const isolatedCount = (lower.match(isolatedNumRegex) || []).length;
              score += isolatedCount * 50; 
            });
            
            if (score > bestScore) { bestScore = score; bestIdx = idx; }
          });
          
          bestMatchPage = bestIdx + 1;
          // Extract exactly the best page and slightly pad it, avoiding truncation of the actual best page
          const startIdx = Math.max(0, bestIdx - 1);
          const endIdx = Math.min(pageTexts.length - 1, bestIdx + 1);
          const selectedPages = [];
          for (let i = startIdx; i <= endIdx; i++) {
            selectedPages.push(`[Page ${i + 1}]:\n${pageTexts[i]}`);
          }
          allText = selectedPages.join('\n\n').substring(0, 12000);
        } else {
          const pdfData = await pdfParse(dataBuffer);
          allText = (pdfData.text || '').substring(0, 12000);
        }

        if (combinedContext.length + allText.length > 20000) {
          allText = allText.substring(0, Math.max(0, 20000 - combinedContext.length));
        }

        combinedContext += `\n\n=== SOURCE: ${item.label} (File: ${item.file}, Best Page: ${bestMatchPage}) ===\n${allText}\n${'='.repeat(60)}\n`;
        sourceFiles.push({
          label: item.label,
          file: item.file,
          category: item.category,
          url: `/kb-files/${item.file}`,
          matchScore: item.matchScore,
          page: bestMatchPage
        });
        console.log(`✅ Law Library: Loaded "${item.label}" — best match on page ${bestMatchPage}`);
      } catch (e) {
        console.error(`Error loading ${item.file}:`, e.message);
      }
    }

    // ── Step 3: If no keyword match, use broad search across key files ─────────
    if (sourceFiles.length === 0) {
      const fallbackFiles = [
        ...LAW_LIBRARY_META.laws.map(f => ({ ...f, category: 'laws', keywords: [] })),
        ...LAW_LIBRARY_META.sops.slice(0, 2).map(f => ({ ...f, category: 'sop', keywords: [] }))
      ];
      for (const item of fallbackFiles.slice(0, 3)) {
        const filePath = path.join(kbPath, item.file);
        if (!fs.existsSync(filePath)) continue;
        try {
          const dataBuffer = fs.readFileSync(filePath);
          let bestMatchPage = 1;
          let allText = '';
          const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2 || /^\d+[a-z]?$/.test(w));
          const numbers = lowerQuery.match(/\b\d+[a-z]?\b/g) || [];

          let pageTexts = [];
          await pdfParse(dataBuffer, {
            pagerender: function(pageData) {
              return pageData.getTextContent().then(function(textContent) {
                let pageText = textContent.items.map(i => i.str).join(' ');
                pageTexts.push(pageText);
                return pageText;
              });
            }
          });

          if (pageTexts.length > 0) {
            let bestScore = -1;
            let bestIdx = 0;
            pageTexts.forEach((pt, idx) => {
              const lower = pt.toLowerCase();
              let score = 0;
              if (lower.includes(lowerQuery)) score += 100;
              queryWords.forEach(qw => {
                if (['act', 'the', 'law', 'and', 'for', 'rule'].includes(qw)) return;
                const count = (lower.match(new RegExp('\\b' + qw + '\\b', 'g')) || []).length;
                score += count > 5 ? 10 : count * 2;
              });
              numbers.forEach(num => {
                const secRegex = new RegExp(`(?:section|sec\\.?|धारा)\\s*${num}\\b`, 'gi');
                score += (lower.match(secRegex) || []).length * 500;
                const isolatedNumRegex = new RegExp(`\\b${num}\\b`, 'g');
                const isolatedCount = (lower.match(isolatedNumRegex) || []).length;
                score += isolatedCount * 50; 
              });
              if (score > bestScore) { bestScore = score; bestIdx = idx; }
            });
            bestMatchPage = bestIdx + 1;
            const startIdx = Math.max(0, bestIdx - 1);
            const endIdx = Math.min(pageTexts.length - 1, bestIdx + 1);
            const selectedPages = [];
            for (let i = startIdx; i <= endIdx; i++) selectedPages.push(`[Page ${i + 1}]:\n${pageTexts[i]}`);
            allText = selectedPages.join('\n\n').substring(0, 12000);
          } else {
            const pdfData = await pdfParse(dataBuffer);
            allText = (pdfData.text || '').substring(0, 12000);
          }

          if (combinedContext.length + allText.length > 20000) {
            allText = allText.substring(0, Math.max(0, 20000 - combinedContext.length));
          }

          combinedContext += `\n\n=== SOURCE: ${item.label} (File: ${item.file}, Best Page: ${bestMatchPage}) ===\n${allText}\n${'='.repeat(60)}\n`;
          sourceFiles.push({ label: item.label, file: item.file, category: item.category, url: `/kb-files/${item.file}`, matchScore: 0, page: bestMatchPage });
        } catch (e) { }
      }
    }

    // ── Step 4: Ask AI to answer using ONLY these sources ─────────────────────
    const systemPrompt = `You are an expert Indian Police Legal AI Assistant. You have access to the following law library documents from Haryana Police Knowledge Base. 

*** CRITICAL STRICT RULE ***
You MUST answer the user's query using ONLY the content from the provided SOURCE documents below. 
DO NOT use your pre-trained knowledge. If the answer cannot be found in the SOURCE documents, you MUST reply: "The answer is not available in the provided Law Library PDFs."
Do not guess. Do not hallucinate.

When mentioning legal sections or guidelines found in the sources, always state:
- The exact section number or regulation
- The exact name of the act or SOP document
- The EXACT PAGE NUMBER where you found it (look for markers like "[Page X]" or "Best Page" in the source headers)
- The FULL PROVISION TEXT exactly as written in the source document

Format your answer in clear sections with:
**Sources Used:** (list which documents and EXACT Page Numbers you referenced)
**Relevant Details Found:** (quote exactly what was found in the sources)
**Summary:** (brief practical answer for police officer based ONLY on the sources)

LANGUAGE: Answer in English.

${combinedContext}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ];

    let answer = await callGroqAPI(messages, false, 'qwen/qwen3-32b');
    
    // Strip <think> blocks if generated by qwen models
    answer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    res.json({
      answer,
      sources: sourceFiles,
      totalSources: sourceFiles.length
    });

  } catch (error) {
    console.error('Law Library Search Error:', error);
    res.status(500).json({ error: error.message || error.toString() });
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
});
