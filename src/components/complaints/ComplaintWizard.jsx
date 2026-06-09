import React, { useState } from 'react';
import { Card, Steps, Button, Typography, Space, Row, Col, Upload, message, Form, Input, Select, DatePicker, TimePicker, Divider, Result, Radio, Modal } from 'antd';
import { FilePdfOutlined, AudioOutlined, InboxOutlined, RobotOutlined, CheckCircleOutlined, PaperClipOutlined, DownloadOutlined, MinusCircleOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Document, Packer, Paragraph as DocxParagraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';

// Use a highly reliable unpkg CDN for the worker to avoid Vite build/MIME bugs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;
const { TextArea } = Input;
const { Option } = Select;

export default function ComplaintWizard({ onBack, profile }) {
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const saved = localStorage.getItem('complaint_currentStep');
      const step = saved !== null ? parseInt(saved, 10) : 0;
      // Clamp to valid range 0-2 (step 3 was removed — document generation is now in Enquiry)
      return (step >= 0 && step <= 2) ? step : 0;
    } catch { return 0; }
  });
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('complaint_mode') || null; } catch { return null; } }); // 'pdf' or 'voice'
  const [isProcessing, setIsProcessing] = useState(false);
  const [form] = Form.useForm();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(() => {
    try {
      const saved = localStorage.getItem('complaint_extractedData');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [complaintData, setComplaintData] = useState(() => {
    try {
      const saved = localStorage.getItem('complaint_data');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [selectedTemplate, setSelectedTemplate] = useState(() => { try { return localStorage.getItem('complaint_template') || null; } catch { return null; } });
  const [documentText, setDocumentText] = useState(() => { try { return localStorage.getItem('complaint_docText') || ''; } catch { return ''; } });
  const [duplicateModalData, setDuplicateModalData] = useState(null); // { duplicate, values, existing }

  React.useEffect(() => { localStorage.setItem('complaint_currentStep', currentStep); }, [currentStep]);
  // Safety: if currentStep is ever invalid (e.g. stale cache from old version), reset to 0
  React.useEffect(() => { if (currentStep < 0 || currentStep > 2) setCurrentStep(0); }, [currentStep]);

  React.useEffect(() => { if (mode) localStorage.setItem('complaint_mode', mode); else localStorage.removeItem('complaint_mode'); }, [mode]);
  React.useEffect(() => { if (extractedData) localStorage.setItem('complaint_extractedData', JSON.stringify(extractedData)); else localStorage.removeItem('complaint_extractedData'); }, [extractedData]);
  React.useEffect(() => { if (complaintData) localStorage.setItem('complaint_data', JSON.stringify(complaintData)); else localStorage.removeItem('complaint_data'); }, [complaintData]);
  React.useEffect(() => { if (selectedTemplate) localStorage.setItem('complaint_template', selectedTemplate); else localStorage.removeItem('complaint_template'); }, [selectedTemplate]);
  React.useEffect(() => { localStorage.setItem('complaint_docText', documentText); }, [documentText]);

  // Safe auto-fill execution when Form successfully mounts in Step 2
  React.useEffect(() => {
    if (currentStep === 2) {
      const justExtracted = sessionStorage.getItem('just_extracted') === 'true';
      const savedForm = localStorage.getItem('complaint_formData');
      if (savedForm && !justExtracted) {
        try {
          const parsed = JSON.parse(savedForm);
          if (parsed.dateOfIncident) parsed.dateOfIncident = dayjs(parsed.dateOfIncident);
          if (parsed.timeOfIncident) parsed.timeOfIncident = dayjs(parsed.timeOfIncident);
          if (parsed.dateOfComplaint) parsed.dateOfComplaint = dayjs(parsed.dateOfComplaint);
          form.setFieldsValue(parsed);
        } catch { localStorage.removeItem('complaint_formData'); }
      } else if (extractedData) {
        const normalized = { ...extractedData };
        if (normalized.dateOfIncident && typeof normalized.dateOfIncident === 'string') {
          normalized.dateOfIncident = dayjs(normalized.dateOfIncident);
        }
        if (normalized.timeOfIncident && typeof normalized.timeOfIncident === 'string') {
          normalized.timeOfIncident = dayjs(normalized.timeOfIncident);
        }
        if (normalized.dateOfComplaint && typeof normalized.dateOfComplaint === 'string') {
          normalized.dateOfComplaint = dayjs(normalized.dateOfComplaint);
        }
        form.setFieldsValue(normalized);
        sessionStorage.removeItem('just_extracted');
      }
    }
  }, [currentStep, extractedData, form]);

  const onValuesChange = (_, allValues) => {
    localStorage.setItem('complaint_formData', JSON.stringify(allValues));
  };

  const getHighlightClass = (fieldName) => {
    if (extractedData && extractedData[fieldName] !== undefined && extractedData[fieldName] !== null && extractedData[fieldName] !== '') {
      return 'auto-extracted-field';
    }
    return '';
  };
  
  // Voice Upload State using same uploadedFile
  
  // Supporting Documents State
  const [hasSupportingDoc, setHasSupportingDoc] = useState(() => { try { return localStorage.getItem('complaint_hasDoc') || 'no'; } catch { return 'no'; } });
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [isSameAddress, setIsSameAddress] = useState(() => { try { return localStorage.getItem('complaint_sameAddr') || 'yes'; } catch { return 'yes'; } });

  React.useEffect(() => { localStorage.setItem('complaint_hasDoc', hasSupportingDoc); }, [hasSupportingDoc]);
  React.useEffect(() => { localStorage.setItem('complaint_sameAddr', isSameAddress); }, [isSameAddress]);


  // Extract Text from PDF locally
  const extractTextFromPDF = async (file) => {
    // Standard file reader as fallback for compatibility
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
    const typedarray = new Uint8Array(arrayBuffer);
    
    // Load the document using the standard approach
    const loadingTask = pdfjsLib.getDocument({ data: typedarray });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    // Loop through each page
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' \n';
    }
    
    return fullText;
  };

  // Convert PDF to Image Base64 array for Vision OCR Fallback
  const convertPdfToImages = async (file) => {
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
    const typedarray = new Uint8Array(arrayBuffer);
    
    const loadingTask = pdfjsLib.getDocument({ data: typedarray });
    const pdf = await loadingTask.promise;
    const images = [];
    
    // Read up to 3 pages maximum to prevent API payload limits
    const numPagesToRead = Math.min(pdf.numPages, 3);
    for (let i = 1; i <= numPagesToRead; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); // Hi-Res
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        images.push(canvas.toDataURL('image/jpeg', 0.8));
    }
    
    return images;
  };

  // Real AI extraction using Groq
  const handleAIProcess = async () => {
    // Validate: if user said they have supporting docs but uploaded none, block
    if (hasSupportingDoc === 'yes' && supportingDocs.length === 0) {
      message.error('Please upload at least one supporting document before proceeding.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      message.error('You must be logged in to perform AI extraction.');
      return;
    }

    let textToProcess = '';
    let visionImages = null;

    if (mode === 'pdf') {
      if (!uploadedFile) {
        message.error('Please upload a PDF file first.');
        return;
      }
      try {
        message.loading({ content: 'Extracting text from PDF...', key: 'ai-process', className: 'dark-loading-message' });
        textToProcess = await extractTextFromPDF(uploadedFile);
        
        // Only use vision (image) fallback if text extraction yields too little content
        // (e.g. Kruti Dev / scanned PDFs with no embedded text)
        if (!textToProcess || textToProcess.replace(/\s/g, '').length < 50) {
          message.loading({ content: 'Text extraction failed, switching to Vision AI...', key: 'ai-process', className: 'dark-loading-message' });
          visionImages = await convertPdfToImages(uploadedFile);
        }
      } catch (err) {
        console.error("PDF Parsing Error:", err);
        message.error({ content: `Failed to read PDF file: ${err.message}`, key: 'ai-process' });
        setIsProcessing(false);
        return;
      }
    } else if (mode === 'voice') {
      if (!uploadedFile) {
        message.error('Please upload an audio file first.');
        return;
      }
      try {
        message.loading({ content: 'Transcribing Audio...', key: 'ai-process', className: 'dark-loading-message' });
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('model', 'whisper-large-v3');

        const audioResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints/transcribe`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!audioResponse.ok) {
          if (audioResponse.status === 401 || audioResponse.status === 403) {
            throw new Error('Your session has expired or is unauthorized. Please log out and log in again.');
          }
          const errText = await audioResponse.text();
          throw new Error(errText || `Server returned status ${audioResponse.status}`);
        }

        const audioData = await audioResponse.json();
        if (audioData.error) throw new Error(typeof audioData.error === 'string' ? audioData.error : (audioData.error.message || 'Groq Audio Error'));

        textToProcess = audioData.text;
        
        if (!textToProcess || textToProcess.trim().length < 10) {
          message.error('Audio transcription was too short or empty. Please upload clear audio.');
          setIsProcessing(false);
          return;
        }
      } catch (err) {
        console.error("Audio Parsing Error:", err);
        message.error({ content: `Failed to read Audio file: ${err.message}`, key: 'ai-process' });
        setIsProcessing(false);
        return;
      }
    }

    setIsProcessing(true);

    try {
      message.loading({ content: 'Extracting...', key: 'ai-process', className: 'dark-loading-message' });

      const schemaDefinition = `
        {
          "firstName": "string",
          "lastName": "string",
          "mobileNumber": "string",
          "natureOfComplaint": "ACS(H)" | "ADGP(HR&Lit)" | "ADGP L&O" | "Anonymous/Informer/Tip/Source Report" | "AWBI" | "CBI" | "Chief Secretary (H)" | "CID (H)" | "Citizen Service Centre" | "Citizen/General Public" | "CM Office" | "Cognizance by Police" | "Court" | "CPs" | "CVO (P) Haryana" | "DC Office" | "DCPs" | "DGP Office" | "Haryana Gau Seva Ayog" | "Haryana Human Right Commission" | "Haryana Minority Commission" | "Haryana SC/ST Commission" | "Haryana SCPCR" | "Haryana Women Commission" | "HSEnB" | "HSNCB (H)" | "IB" | "IGP L&O" | "LOKAYUKTA (H)" | "MEA (GOI)" | "MHA (GOI)" | "Ministers-Speaker(Center/State)" | "MP/MLA" | "National Human Rights Commission" | "National Minority Commission" | "National SC/ST Commission" | "National Women Commission" | "NCPCR" | "NCSK" | "NIA" | "Office of Army and Paramilitary" | "Other Govt. Offices" | "Other State DGP" | "Police Control Room" | "President Office" | "Prime Minister Office" | "PRISON (H)" | "Range Office - ADGP/IGP" | "Samadhan Parakoshth" | "SCB (H)" | "SP Office" | "SP/L&O" | "SP/WS" | "SPCA" | "Suo-Moto (Newspaper/Social Media/Internet etc)" | "SV & ACB (H)" | "Other Police Stations" | "Others",
          "typeOfAccused": "Against Army and Paramilitary Force" | "Against Foreigner's" | "Against Organization / Department" | "Against Police Officer" | "Against Private Person" | "Against Public Servant (Civil)" | "Against Unknown Persons" | "",
          "gender": "Male" | "Female" | "Transgender",
          "houseNumber": "string",
          "streetName": "string",
          "colonyArea": "string",
          "villageTown": "string",
          "tehsilBlock": "string",
          "country": "string",
          "state": "string",
          "district": "string",
          "policeStation": "string",
          "pinCode": "string",
          "permHouseNumber": "string",
          "permStreetName": "string",
          "permColonyArea": "string",
          "permVillageTown": "string",
          "permTehsilBlock": "string",
          "permCountry": "string",
          "permState": "string",
          "permDistrict": "string",
          "permPoliceStation": "string",
          "permPinCode": "string",
          "nationality": "string",
          "idType": "Aadhar Card" | "Any Other" | "Arms License" | "Driving License" | "Income Tax (PAN Card)" | "Passport" | "Ration Card" | "Visa" | "Voter Card" | "",
          "idNumber": "string",
          "accusedList": [
            {
              "name": "string",
              "address": "string"
            }
          ],
          "classOfIncident": "Cyber Crimes (other than financial fraud)" | "Cyber Financial Fraud" | "Other IPC/BNS Crimes" | "Other LSL Crimes" | "Miscellaneous" | "Crimes Against SC/ST" | "Crime Against Children" | "Matrimonial Dispute" | "Illegal Immigration" | "Job Related Fraud" | "Property/Land Dispute" | "Other Economic Offence" | "Noise Pollution" | "Runaway Couple" | "Security Threat" | "Deserter/Absent (Army/Paramilitary)" | "Death during Police Action" | "Death in Judicial Custody" | "Death in Police Custody" | "Corruption/Demand of Bribe" | "Human Rights Violation" | "Crime Against Women",
          "placeOfIncident": "string",
          "dateOfIncident": "ISO 8601 date string like '2023-10-25' or ''",
          "timeOfIncident": "24-hour time string like '14:30:00' or ''",
          "dateOfComplaint": "ISO 8601 string or null",
          "typeOfComplaint": "Fresh Complaint" | "Repeat (Same Matter)" | "Legal Notice" | "Source Report",
          "typeOfComplainant": "Anonymous" | "Court" | "Govt Official (other than police department)" | "Govt Official (Police department)" | "Private Person" | "Suo-Moto",
          "complaintPurpose": "Enquiry" | "FIR Registration",
          "isFirRegistered": "Yes" | "No" | "Unknown",
          "modeOfReceipt": "By Email" | "By Official Dak" | "By Registered Post/Courier" | "By Simple Post" | "By SMS" | "By Speed Post" | "CM Window" | "In-Person/By Hand" | "Suo-Moto(Newspaper/Social Media/Internet etc)" | "Telephone/Mobile call" | "Wireless" | "",
          "descriptionOfComplaint": "string"
        }`;

      const prompt = `You are a DATA EXTRACTION ENGINE for Haryana Police complaints. Your ONLY job is to READ and COPY data from the document. You are NOT a writer, NOT a summarizer, NOT an analyst.

=== ABSOLUTE RULE #1 — NO HALLUCINATION ===
NEVER write anything that is not LITERALLY present in the document.
- If a field's information is missing from the document → leave it as "" (empty string).
- Do NOT guess. Do NOT infer. Do NOT fill blanks with "likely" or "probably" values.
- Do NOT repeat information from one field to fill another.
- Every single character you output must have a direct, verifiable source in the input text.
- Violation of this rule is a critical failure.

=== ABSOLUTE RULE #2 — SAME INPUT = SAME OUTPUT ===
You are extracting facts, not creating content. If you run this extraction 10 times on the same document, the output must be IDENTICAL every time. If your output varies between runs, you are hallucinating.

=== EXTRACTION RULES ===
[1] LANGUAGE
- Translate ALL Hindi content to English.
- Transliterate Hindi names/places into Roman script. Example: "रामकुमार" → "Ramkumar", "हिसार" → "Hisar".
- Translate faithfully — do NOT add, remove, or paraphrase any word.

[2] COMPLAINANT NAME AND GENDER
- firstName = ONLY the complainant's first/given name as written.
- lastName = ONLY a hereditary caste/family surname (like Sharma, Singh, Yadav, Gupta, Verma, Jat, etc.).
- STRICT RULE: The following are RELATION words, NOT surnames. If any of these appear after the complainant's name, set lastName = "" (empty string):
  Patni, Patnee, पत्नी (= wife of)
  Putra, पुत्र (= son of)
  Putri, Beti, पुत्री, बेटी (= daughter of)
  Pita, पिता (= father of)
  Mata, माता (= mother of)
  Bahu, बहू (= daughter-in-law of)
  S/O, W/O, D/O, C/O (= son/wife/daughter/care of)
- EXAMPLES — follow these exactly:
  "Sunita Patni Ram Kumar" → firstName="Sunita", lastName="" – Patni is a relation word, Ram Kumar is the husband
  "Rekha W/O Rajesh Kumar" → firstName="Rekha", lastName=""
  "Priya Beti Suresh" → firstName="Priya", lastName=""
  "Amit Sharma" → firstName="Amit", lastName="Sharma" – Sharma is a valid caste surname
- If name is only one word: firstName = that word, lastName = ""
- Extract ONLY the COMPLAINANT's name. Never the accused, witness, or officer.
- Gender: if Patni/W/O/Wife of/female relation word present → gender = "Female" strictly.

[3] MOBILE NUMBER
- Extract the complainant's 10-digit mobile number. Strip +91 or leading 0 if present.
- If not present: return empty string "".

[4] ACCUSED LIST — THIS IS THE MOST CRITICAL SECTION
- Scan the ENTIRE document from start to finish. Do NOT stop after the first accused. Extract EVERY SINGLE person the complaint is filed against.
- accusedList: An array of ALL accused persons. Each object must have 'name' and 'address'.

ACCUSED NAME RULES — NO HALLUCINATION ALLOWED:
- Write the accused's name EXACTLY as it appears in the document. Do NOT add, invent, or modify anything.
- "urf" / "उर्फ" / "alias" rule: ONLY include "urf" or alias in the name if the word "urf" or "alias" is LITERALLY written in the document right next to that person's name.
  * Document says "Kapinder" (no urf anywhere near this name) → write exactly: "Kapinder" — do NOT add "urf Kapinder" or anything else
  * Document says "Virender urf Billa Kabba" → write exactly: "Virender urf Billa Kabba"
  * NEVER invent or add "urf [something]" if "urf" is not literally in the document for that person.
- S/O / W/O rule: ONLY append "S/O FatherName" or "W/O HusbandName" if the father's or husband's name of that specific accused is EXPLICITLY written in the document.
  * Father name IS explicitly in document → write: "Kapinder S/O Inder" (example)
  * Father name is NOT in document → write just: "Kapinder" — do NOT add S/O or any guess
  * NEVER invent a father's name.
- DO NOT skip any accused even if mentioned only once.
- DO NOT list the complainant or the investigating officer (IO) as an accused.
- If accused identity is completely unknown: write "Unknown".

ACCUSED ADDRESS RULES:
- Write the accused's address exactly as mentioned in the document. If not mentioned, write "Unknown".

TYPE OF ACCUSED (typeOfAccused) — Use EXACT enum value:
- Determine who the complaint is filed AGAINST. Choose the single best matching value:
  * "Against Private Person"        → complaint against a common citizen (most common case)
  * "Against Police Officer"        → accused is a police constable, SI, SHO, DSP, SP, etc.
  * "Against Public Servant (Civil)"→ accused is a govt. employee (teacher, clerk, SDM, patwari, etc.)
  * "Against Army and Paramilitary Force" → accused is an army/CRPF/BSF/CISF member
  * "Against Organization / Department"  → accused is a company, NGO, institution, or department
  * "Against Foreigner's"           → accused is a foreign national
  * "Against Unknown Persons"       → accused identity is completely unknown
- If no accused or unclear, return "".


[5] DATES AND TIME
- dateOfIncident: Date the actual crime/incident occurred. Format YYYY-MM-DD. If unclear or missing return empty string "".
- timeOfIncident: Time of incident in 24-hour format "HH:MM:00". If not mentioned return "".
- dateOfComplaint: Date complaint was written or submitted. Format YYYY-MM-DD. Default to today's date if missing.
- NEVER invent or guess dates. Extract only what is explicitly written in the document.

[6] ID PROOF
- idType: Detect government IDs: Aadhar Card, Voter Card, PAN Card, Driving License, Passport, Ration Card, Arms License, Visa. Match to exact schema enum value.
- idNumber: Extract the actual ID number. Return empty string if not found.

[6a] NATIONALITY
- nationality: Extract the complainant's nationality if explicitly mentioned (e.g. "Indian", "Nepali", "Bangladeshi").
- If not mentioned in the document, default to "Indian" (since this is a Haryana Police complaint system).


[7] INCIDENT DETAILS
- classOfIncident: Categorize from schema enum. Examples: land grab → "Property/Land Dispute", UPI fraud → "Cyber Financial Fraud", wife beating/marital abuse → "Crime Against Women", bribe demand → "Corruption/Demand of Bribe", assault/fighting → "Other IPC/BNS Crimes".
- placeOfIncident: The specific location where the incident happened. Never leave empty, use "Unknown" if truly missing.

[8] COMPLAINT TYPE AND PURPOSE — Use EXACT enum values only
- typeOfComplaint:
  "Fresh Complaint" = brand new first-time complaint
  "Repeat (Same Matter)" = re-filed on the same incident
  "Legal Notice" = legally accompanied notice
  "Source Report" = from informant or intelligence tip
- complaintPurpose:
  "Enquiry" = investigation request, fact-finding, NCR, preventive action, lost/found, verification
  "FIR Registration" = explicit demand for FIR or clear cognizable offence
- typeOfComplainant:
  "Private Person" = common citizen, victim, witness, family member
  "Govt Official (Police department)" = police officer, SHO, constable, DSP
  "Govt Official (other than police department)" = other government employee
  "Court" = court-directed complaint
  "Anonymous" = identity hidden or unknown
  "Suo-Moto" = police registration on their own initiative
- isFirRegistered: "Yes" if FIR already exists, "No" if not yet, "Unknown" if unclear

[9] SOURCE OF COMPLAINT (natureOfComplaint)
- Identify the origin/channel of the complaint. Match to closest enum value.
- Examples: direct citizen walk-in → "Citizen/General Public", CM office letter → "CM Office", court order → "Court", police themselves → "Cognizance by Police", anonymous tip → "Anonymous/Informer/Tip/Source Report", SP office referral → "SP Office".

[10] MODE OF RECEIPT (modeOfReceipt)
- Determine HOW this complaint was physically received. Match to the closest enum value:
  * "In-Person/By Hand" → complainant came in person / handed over at police station
  * "By Email" → sent via email
  * "By SMS" → received via SMS/text message
  * "Telephone/Mobile call" → received over phone
  * "By Speed Post" → India Post speed post
  * "By Registered Post/Courier" → registered post or courier
  * "By Simple Post" → ordinary post
  * "By Official Dak" → official government dak/dispatch
  * "CM Window" → Chief Minister complaint window/portal
  * "Wireless" → police wireless
  * "Suo-Moto(Newspaper/Social Media/Internet etc)" → police noticed via news/social media
- If unclear or not mentioned, default to "In-Person/By Hand".

[11] DESCRIPTION OF COMPLAINT — ENGLISH TRANSLATION RULE (MOST IMPORTANT)
YOUR TASK: Extract the main body of the complaint and translate it accurately to English.

EXACT RULES:
- Find the main body of the complaint (the narrative section where the complainant describes what happened).
- TRANSLATE IT TO ENGLISH — regardless of whether the original is in Hindi, Punjabi, Urdu, or any other language.
- Keep the translation faithful and accurate — do not add, remove, or alter any facts.
- Do NOT summarize. Include all details mentioned in the original complaint body.
- Every time you process the same PDF, the translation must convey the same meaning consistently.

[12] ADDRESS ANALYSIS (CRITICAL)
- The complainant may have a Present/Current Address and a separate Permanent Address.
- If both are mentioned and are DIFFERENT, extract the Present Address into the regular fields (houseNumber, villageTown, district, state, etc.) AND extract the Permanent Address into the 'perm' prefixed fields (permHouseNumber, permVillageTown, etc.).
- If only one address is mentioned, or if "Present Address is same as Permanent Address" → extract only to regular fields. Leave ALL 'perm' fields as empty strings "".

=== OUTPUT RULES ===
- Output ONLY raw JSON. No markdown, no backtick fences, no preamble, no explanation text.
- ALL enum fields must use EXACTLY the values from the schema — no abbreviations, no translations.
- ALL keys must be present in the output. Use empty string "" for unknown string fields. Use null for unknown date fields.
- For accusedList: if no accused is found, return an empty array [].

Schema:
${schemaDefinition}

Extracted Text from document (may be garbled for scanned or Hindi-font PDFs, cross-reference with images if provided):
${textToProcess}
      `;

      // Limit vision images to max 2 pages to prevent oversized payloads
      const limitedImages = visionImages ? visionImages.slice(0, 2) : null;

      const requestPayload = {
        model: limitedImages ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile",
        messages: [
          { 
            role: "user", 
            content: limitedImages ? [
              { type: "text", text: prompt },
              ...limitedImages.map(imgBase64 => ({ type: "image_url", image_url: { url: imgBase64 } }))
            ] : prompt 
          }
        ],
        temperature: 0,
      };

      if (!limitedImages) {
        requestPayload.response_format = { type: "json_object" };
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints/extract`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Your session has expired or is unauthorized. Please log out and log in again.');
        }
        const errText = await response.text();
        throw new Error(errText || `Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(typeof data.error === 'string' ? data.error : (data.error.message || 'Groq API Error'));
      
      const responseText = data.choices[0].message.content;
      // Guarantee JSON safety if Vision model adds markdown wrappers
      let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsedData = JSON.parse(cleanJson);

      // ─── POST-PROCESSING: Hard-coded lastName sanitization ───────────────
      // Model ke return karne ke baad GUARANTEED fix — prompt pe depend nahi
      // Agar lastName mein koi bhi relation word hai to use "" kar do
      const RELATION_WORDS = [
        'patni','patnee','wife','putra','putri','beti','beta','pita','mata',
        'bahu','bhai','behan','devi','kumari',
        's/o','w/o','d/o','c/o','son of','wife of','daughter of','husband of',
        'पत्नी','पुत्र','पुत्री','बेटी','पिता','माता','बहू','भाई'
      ];
      if (parsedData.lastName) {
        const lastNameLower = parsedData.lastName.trim().toLowerCase();
        const isRelationWord = RELATION_WORDS.some(word => lastNameLower === word || lastNameLower.startsWith(word + ' ') || lastNameLower.endsWith(' ' + word));
        if (isRelationWord) {
          parsedData.lastName = '';
        }
      }
      // ─────────────────────────────────────────────────────────────────────
      
      const hasPermAddress = Boolean(
        (parsedData.permVillageTown && parsedData.permVillageTown !== "") ||
        (parsedData.permDistrict && parsedData.permDistrict !== "") ||
        (parsedData.permState && parsedData.permState !== "") ||
        (parsedData.permHouseNumber && parsedData.permHouseNumber !== "") ||
        (parsedData.permStreetName && parsedData.permStreetName !== "") ||
        (parsedData.permColonyArea && parsedData.permColonyArea !== "") ||
        (parsedData.permPinCode && parsedData.permPinCode !== "")
      );
      setIsSameAddress(hasPermAddress ? 'no' : 'yes');
      
      // Format dates correctly for DayJS safely
      const validDateString = (str) => str && str !== "null" && str.trim() !== "";
      
      if (validDateString(parsedData.dateOfIncident)) {
        parsedData.dateOfIncident = dayjs(parsedData.dateOfIncident);
      } else {
        parsedData.dateOfIncident = null;
      }

      if (validDateString(parsedData.timeOfIncident)) {
        if (parsedData.timeOfIncident.toLowerCase().includes('not mentioned') || parsedData.timeOfIncident.toLowerCase().includes('unknown')) {
          parsedData.timeOfIncident = null;
        } else {
          try {
            const timeStr = parsedData.timeOfIncident.length <= 5 ? parsedData.timeOfIncident + ':00' : parsedData.timeOfIncident;
            parsedData.timeOfIncident = dayjs(`2000-01-01T${timeStr}`);
          } catch(e) {
            parsedData.timeOfIncident = null;
          }
        }
      } else {
        parsedData.timeOfIncident = null;
      }
      
      if (validDateString(parsedData.dateOfComplaint)) {
        parsedData.dateOfComplaint = dayjs(parsedData.dateOfComplaint);
      } else {
        parsedData.dateOfComplaint = null;
      }

      sessionStorage.setItem('just_extracted', 'true');
      localStorage.removeItem('complaint_formData');
      setExtractedData(parsedData); // Save to state to trigger useEffect auto-fill
      form.setFieldsValue(parsedData); // Set directly in form store
      message.destroy('ai-process');
      setCurrentStep(2);
    } catch (error) {
      console.error('AI Processing Error:', error);
      message.error({ content: `AI Extraction Failed: ${error.message}`, key: 'ai-process' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Old toggleRecording logic removed

  // Helper: compute why two complaints are duplicates
  const getDuplicateReasons = (c, values) => {
    const reasons = [];
    const mobile1 = (c.mobileNumber || '').replace(/\D/g, '');
    const mobile2 = (values.mobileNumber || '').replace(/\D/g, '');
    if (mobile1.length >= 10 && mobile1 === mobile2) reasons.push({ label: 'Mobile Number', value: c.mobileNumber, severity: 'high' });

    const name1 = ((c.firstName || '') + ' ' + (c.lastName || '')).trim().toLowerCase();
    const name2 = ((values.firstName || '') + ' ' + (values.lastName || '')).trim().toLowerCase();
    if (name1 && name2 && name1 === name2) reasons.push({ label: 'Complainant Name', value: `${c.firstName || ''} ${c.lastName || ''}`.trim(), severity: 'high' });

    const date1 = c.dateOfIncident ? String(c.dateOfIncident).slice(0, 10) : '';
    const date2 = values.dateOfIncident ? String(values.dateOfIncident).slice(0, 10) : '';
    if (date1 && date2 && date1 === date2) reasons.push({ label: 'Incident Date', value: date1, severity: 'medium' });

    const place1 = (c.placeOfIncident || '').trim().toLowerCase();
    const place2 = (values.placeOfIncident || '').trim().toLowerCase();
    if (place1.length > 2 && place2.length > 2 && place1 === place2) reasons.push({ label: 'Place of Incident', value: c.placeOfIncident, severity: 'medium' });

    const accused1 = (c.accusedList || []).map(a => (a.name || '').toLowerCase().trim()).filter(n => n && n !== 'unknown');
    const accused2 = (values.accusedList || []).map(a => (a.name || '').toLowerCase().trim()).filter(n => n && n !== 'unknown');
    const matchedAccused = accused1.filter(a => accused2.includes(a));
    if (matchedAccused.length > 0) reasons.push({ label: 'Accused Name', value: matchedAccused.join(', '), severity: 'medium' });

    if ((c.classOfIncident || '') === (values.classOfIncident || '') && c.classOfIncident) {
      reasons.push({ label: 'Incident Class', value: c.classOfIncident, severity: 'low' });
    }
    return reasons;
  };

  const onFinish = async (values) => {
    let existing = [];
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        existing = await res.json();
      }
    } catch (e) {
      console.error("Error fetching complaints for duplicate check:", e);
    }

    // STRICT duplicate detection — find all matching complaints
    const duplicates = existing.filter(c => {
      // Rule 1: Same mobile number → always a duplicate (strongest signal)
      const mobile1 = (c.mobileNumber || '').replace(/\D/g, '');
      const mobile2 = (values.mobileNumber || '').replace(/\D/g, '');
      if (mobile1.length >= 10 && mobile1 === mobile2) return true;

      // Rule 2: Scoring for other fields (classOfIncident is no longer mandatory)
      let score = 0;
      const name1 = ((c.firstName || '') + ' ' + (c.lastName || '')).trim().toLowerCase();
      const name2 = ((values.firstName || '') + ' ' + (values.lastName || '')).trim().toLowerCase();
      if (name1 && name2 && name1 === name2) score += 3;

      const date1 = c.dateOfIncident ? String(c.dateOfIncident).slice(0, 10) : '';
      const date2 = values.dateOfIncident ? String(values.dateOfIncident).slice(0, 10) : '';
      if (date1 && date2 && date1 === date2) score += 2;

      const place1 = (c.placeOfIncident || '').trim().toLowerCase();
      const place2 = (values.placeOfIncident || '').trim().toLowerCase();
      if (place1.length > 2 && place2.length > 2 && place1 === place2) score += 2;

      const accused1 = (c.accusedList || []).map(a => (a.name || '').toLowerCase().trim()).filter(n => n && n !== 'unknown');
      const accused2 = (values.accusedList || []).map(a => (a.name || '').toLowerCase().trim()).filter(n => n && n !== 'unknown');
      if (accused1.length > 0 && accused1.some(a => accused2.includes(a))) score += 2;

      if ((c.classOfIncident || '') === (values.classOfIncident || '') && c.classOfIncident) score += 1;

      return score >= 4;
    });

    if (duplicates.length > 0) {
      setDuplicateModalData({ duplicates, values, existing });
      return;
    }

    proceedRegistration(values, existing);
  };

  const proceedRegistration = async (values, existing) => {
    // Generate a unique complaint ID
    const complaintId = 'C' + Math.floor(10000 + Math.random() * 90000);
    const now = new Date();

    // Build the complaint record to save
    const complaintRecord = {
      ...values,
      id: complaintId,
      registeredAt: now.toISOString(),
      dateRegistered: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Registered',
      ioStatus: 'Pending',
      appliedTemplate: null,
      policeStation: profile?.station_id || values.policeStation || 'SAMALKHA',
      originalStation: profile?.station_id || values.policeStation || 'SAMALKHA',
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(complaintRecord)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to register complaint');
      }

      message.success({ content: `Complaint ${complaintId} registered successfully!`, duration: 3 });

      // Defer navigation: let React finish the form render cycle first, THEN navigate home
      setTimeout(() => {
        if (onBack) onBack(); // onBack clears wizard localStorage + sessionStorage + goes home
      }, 100);
    } catch (err) {
      console.error(err);
      message.error(`Registration failed: ${err.message}`);
    }
  };


  const generateTemplateText = (templateType, data) => {
    const d = data || {};
    const dateToday = dayjs().format('DD-MM-YYYY');

    // Extracting comprehensive variables
    const compName = `${d.firstName || ''} ${d.lastName || ''}`.trim() || '[Complainant Name]';
    const compPhone = d.mobileNumber || '[Complainant Mobile]';
    const compAddress = [d.houseNumber, d.streetName, d.colonyArea, d.villageTown, d.district, d.state, d.pinCode].filter(Boolean).join(', ') || '[Complainant Address]';
    
    const accusedBlockNotice = d.accusedList && d.accusedList.length > 0
      ? d.accusedList.map((acc, index) => `${d.accusedList.length > 1 ? `Accused ${index + 1}:\n` : ''}Name: ${acc.name || 'Unknown'}\nAddress: ${acc.address || 'Unknown'}`).join('\n\n')
      : 'Name: [Accused Name]\nAddress: [Accused Address]';
      
    const accusedBlockInline = d.accusedList && d.accusedList.length > 0
      ? d.accusedList.map((acc, index) => `${d.accusedList.length > 1 ? `${index + 1}. ` : ''}${acc.name || 'Unknown'} (R/o ${acc.address || 'Unknown'})`).join('\n')
      : '[Accused Name], R/o [Accused Address]';
    
    const incidentClass = d.classOfIncident || '[Class of Incident]';
    const placeOfIncident = d.placeOfIncident || '[Place of Incident]';
    const dateOfInc = d.dateOfIncident ? dayjs(d.dateOfIncident).format('DD-MM-YYYY') : '[Date of Incident]';
    const timeOfInc = d.timeOfIncident ? dayjs(d.timeOfIncident).format('hh:mm A') : '[Time of Incident]';
    
    const actDescription = d.descriptionOfComplaint || '[Description of Complaint]';

    switch (templateType) {
      case 'notice':
        return `NOTICE FOR APPEARANCE\n\nNotice Number: _______\nDate: ${dateToday}\n\nTo,\n${accusedBlockNotice}\n\nSubject: Notice for appearance regarding complaint filed by ${compName}.\n\nWHEREAS, a complaint has been registered against you at this Police Station by ${compName} (R/o ${compAddress}).\n\nBRIEF FACT OF COMPLAINT:\nThe complainant alleges that an incident of "${incidentClass}" occurred at ${placeOfIncident} on ${dateOfInc} around ${timeOfInc}. \n\nTherefore, in exercise of the powers conferred upon me, you are hereby directed to appear before the undersigned at the Police Station on __-__-____ at __:__ AM/PM for the purpose of further enquiry and to present your side of the facts along with relevant documents/evidence, if any.\n\nPlease note that failure to comply with the terms of this notice may render you liable for action under relevant provisions of law.\n\n\nSignature of Investigating Officer\nName: _______________\nDesignation: _______________\nPolice Station: _______________`;
        
      case 'email':
        return `Subject: Status Update on Complaint Registration - ${incidentClass}\n\nDear Sir/Madam,\n\nThis is to officially inform you that we are in receipt of your complaint regarding the incident of "${incidentClass}".\n\nCOMPLAINT DETAILS:\n- Complainant Name: ${compName}\n- Complainant Contact: ${compPhone}\n- Accused Details:\n${accusedBlockInline}\n- Alleged Incident Place: ${placeOfIncident}\n- Date of Occurrence: ${dateOfInc}\n\nWe have documented your submission and the matter is currently under preliminary enquiry. Our Investigating Officer will be reaching out to you shortly for any further clarifications or statements required as per the procedure.\n\nFor any interim query, you may contact the Helpdesk at the undersigned Police Station.\n\nSincerely,\n\nStation House Officer (SHO)\n[Police Station Name]\nDate: ${dateToday}`;

      case 'enquiry_rajinama':
        return `ENQUIRY REPORT - MUTUAL SETTLEMENT (RAJINAMA)\n\nDate: ${dateToday}\n\n1. REFERENCE COMPLAINT\nComplainant: ${compName}, R/o ${compAddress}, Ph: ${compPhone}\nAccused Details:\n${accusedBlockInline}\nNature of Incident: ${incidentClass}\nDate & Place of Occurrence: ${dateOfInc} at ${placeOfIncident}\n\n2. BRIEF ALLEGATIONS\nAs per the contents of the complaint, the complainant alleged that: \n"${actDescription}"\n\n3. PROCEEDINGS & FINDINGS\nDuring the course of the preliminary enquiry, both the complainant and the accused were summoned to the Police Station. After comprehensive discussions and in the presence of respectable persons from society, both parties have amicably resolved their differences.\n\nThe complainant (${compName}) has furnished a written statement stating that the matter has been resolved mutually without any coercion, threat, or undue influence. The complainant does not wish to pursue any further legal or police action regarding this matter.\n\n4. CONCLUSION & RECOMMENDATION\nSince the parties have arrived at a mutual compromise (Rajinama) and the complainant is no longer desirous of pursuing the case, no cognizable offence requiring police intervention survives.\n\nAccordingly, it is recommended to consign this complaint to the records (File / Filed without FIR).\n\n\nSubmitted by:\n[IO Signature]\nName/Rank: _______________`;

      case 'enquiry_civil_land':
        return `ENQUIRY REPORT - PROCEEDING OF CIVIL NATURE (LAND DISPUTE)\n\nDate: ${dateToday}\n\n1. REFERENCE COMPLAINT\nComplainant: ${compName}, R/o ${compAddress}, Ph: ${compPhone}\nAccused Details:\n${accusedBlockInline}\nSubject/Category: Land Dispute (${incidentClass})\nDate & Place of Incident: ${dateOfInc} at ${placeOfIncident}\n\n2. BRIEF OF COMPLAINT\nBriefly, the complainant states that: \n"${actDescription}"\n\n3. ENQUIRY CONDUCTED & FACTUAL POSITION\nAn extensive preliminary enquiry was conducted by the undersigned. The relevant land ownership records, revenue mutation documents, and possession status of the disputed property were examined. Statements of both parties and boundary witnesses were duly recorded.\n\nThe scrutiny of the revenue records and statements reveals that the dispute between the parties is purely civil in nature, pertaining to the demarcation of boundaries, title clearance, or possession of land. No criminal intent (mens rea) or cognizable offence is made out under the current laws.\n\n4. CONCLUSION & RECOMMENDATION\nIn light of legal precedents and guidelines, police intervention is not warranted in property disputes of a civil nature.\n\nThe complainant has been properly briefed and advised to approach the appropriate Revenue Court / Civil Authority for boundary demarcation or partition of the land.\n\nTherefore, it is recommended to file this complaint.\n\n\nSubmitted by:\n[IO Signature]\nName/Rank: _______________`;

      case 'enquiry_civil_finance':
        return `ENQUIRY REPORT - PROCEEDING OF CIVIL NATURE (FINANCIAL DISPUTE)\n\nDate: ${dateToday}\n\n1. REFERENCE COMPLAINT\nComplainant: ${compName}, R/o ${compAddress}, Ph: ${compPhone}\nAccused Details:\n${accusedBlockInline}\nSubject/Category: Financial Dispute (${incidentClass})\nDate & Place of Incident: ${dateOfInc} at ${placeOfIncident}\n\n2. BRIEF OF COMPLAINT\nBriefly, the complainant states that: \n"${actDescription}"\n\n3. ENQUIRY CONDUCTED & FACTUAL POSITION\nAn extensive preliminary enquiry was conducted by the undersigned. The financial ledgers, bank transactions, promissory notes, and business agreements between the parties were examined.\n\nThe scrutiny of the financial transactions and agreements reveals that the dispute arises from a commercial contract, non-payment of dues, or monetary settlement issues. The dispute is fundamentally a breach of contract and falls within the contours of a Civil Dispute, lacking any criminal breach of trust or cheating elements at this stage.\n\n4. CONCLUSION & RECOMMENDATION\nIn accordance with judicial guidelines, civil disputes arising out of monetary transactions should not be given a criminal color.\n\nThe complainant has been advised to approach the competent Civil Court / Arbitrator for recovery of dues.\n\nTherefore, it is recommended to file this complaint.\n\n\nSubmitted by:\n[IO Signature]\nName/Rank: _______________`;

      case 'enquiry_transfer':
        return `ENQUIRY REPORT - TRANSFER OF COMPLAINT TO OTHER POLICE STATION\n\nDate: ${dateToday}\n\n1. REFERENCE COMPLAINT\nComplainant: ${compName}, R/o ${compAddress}, Ph: ${compPhone}\nAccused Details:\n${accusedBlockInline}\nSubject/Category: Transfer Request (${incidentClass})\nDate & Place of Incident: ${dateOfInc} at ${placeOfIncident}\n\n2. BRIEF OF COMPLAINT\nBriefly, the complainant states that: \n"${actDescription}"\n\n3. ENQUIRY CONDUCTED & JURISDICTIONAL FINDINGS\nA preliminary enquiry was conducted. Factual verification of the place of occurrence of the alleged incident was carried out.\n\nThe spot verification and facts gathered reveal that the entire occurrence took place within the territorial jurisdiction of Police Station ____________, District ____________. No part of the cause of action or incident occurred within the territorial jurisdiction of this Police Station.\n\n4. CONCLUSION & RECOMMENDATION\nIn view of territorial jurisdiction regulations, this Police Station cannot register or investigate this matter. It is legally appropriate to transfer this complaint along with all relevant documents to the concerned Police Station.\n\nTherefore, it is recommended to transfer this complaint to Police Station ____________, District ____________ for further legal proceedings under BNSS.\n\n\nSubmitted by:\n[IO Signature]\nName/Rank: _______________`;

      case 'enquiry_ncr':
        return `NON-COGNIZABLE REPORT (NCR) / ENQUIRY REPORT\n\nDate: ${dateToday}\n\n1. COMPLAINANT DETAILS\nName: ${compName}\nAddress: ${compAddress}\nContact: ${compPhone}\n\n2. ACCUSED DETAILS\n${accusedBlockNotice}\n\n3. INCIDENT DETAILS\nCategory: ${incidentClass}\nDate & Time: ${dateOfInc} | ${timeOfInc}\nPlace of Occurrence: ${placeOfIncident}\n\n4. FACTS OF THE COMPLAINT\nThe complainant has reported that: \n"${actDescription}"\n\n5. IO'S OPINION & ACTION TAKEN\nUpon careful perusal of the complaint and preliminary enquiry, it is concluded that the allegations raised by the complainant disclose the commission of a strictly Non-Cognizable Offence. \n\nAccordingly, the substance of the information has been duly entered into the Daily Diary Document (Rapt/DDR). The police cannot investigate a non-cognizable case without the order of a Magistrate having power to try such cases.\n\nThe complainant, ${compName}, has been properly informed and legally advised to approach the Honourable Magistrate under the relevant sections of the BNSS for further judicial remedy.\n\n\nPrepared by:\n[IO Signature]\nName/Rank: _______________`;

      case 'enquiry_fir':
        return `ENQUIRY REPORT - FIR REGISTRATION RECOMMENDED\n\nDate: ${dateToday}\n\n1. REFERENCE\nSource of Complaint: Received from ${compName} (Ph: ${compPhone})\nComplainant Address: ${compAddress}\nAlleged Accused Details:\n${accusedBlockInline}\n\n2. INCIDENT PARTICULARS\nClassification: ${incidentClass}\nTime, Date & Place: ${timeOfInc} on ${dateOfInc} at ${placeOfIncident}\n\n3. GIST OF ALLEGATIONS\n"${actDescription}"\n\n4. ENQUIRY OBSERVATIONS\nDuring the preliminary enquiry, physical and documentary constraints were gathered. Based on the facts presented and the sequence of events outlined in the complaint, prime-facie, a cognizable offence is conclusively made out against the accused person(s).\n\n5. RECOMMENDATION\nSince the allegations disclose explicit commission of a Cognizable Offence, it is legally imperative to initiate investigation. Consequently, it is strongly recommended that a First Information Report (FIR) be registered without any delay under the relevant sections of BNS / Minor Acts.\n\nAfter registration of the FIR, the investigation file may kindly be handed over to the Investigating Officer for due procedures of law.\n\n\nSubmitted by:\n[IO Signature]\nName/Rank: _______________\n\nForwarded to SHO for approval / FIR Registration.`;

      default:
        return '';
    }
  };

  const handleTemplateSelect = (value) => {
    setSelectedTemplate(value);
    const generatedText = generateTemplateText(value, complaintData);
    setDocumentText(generatedText);
  };

  const handleFinalSubmit = () => {
    setIsProcessing(true);
    setTimeout(() => {
      console.log('Final Submission:', { ...complaintData, generatedDocument: documentText, documentTemplate: selectedTemplate });
      setIsProcessing(false);
      setIsSubmitted(true);
    }, 1000); 
  };

  const handleDownloadDocx = () => {
    if (!documentText) {
      message.error("No document text to download.");
      return;
    }

    const lines = documentText.split('\n');

    // Build docx paragraphs: first non-empty line = bold title, rest = normal
    let isFirstLine = true;
    const docxParagraphs = lines.map((line, index) => {
      const isEmpty = line.trim() === '';

      if (isEmpty) {
        // Blank paragraph for empty lines
        return new DocxParagraph({ children: [new TextRun('')] });
      }

      // Bold the very first content line (document title)
      if (isFirstLine) {
        isFirstLine = false;
        return new DocxParagraph({
          children: [
            new TextRun({ text: line, bold: true, size: 28, font: 'Arial' })
          ],
          spacing: { after: 200 }
        });
      }

      return new DocxParagraph({
        children: [new TextRun({ text: line, font: 'Arial', size: 22 })],
        spacing: { after: 80 }
      });
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: docxParagraphs
      }]
    });

    Packer.toBlob(doc).then(blob => {
      // Use a descriptive file name based on the selected template
      const templateNames = {
        notice: 'Notice',
        email: 'Email_Update',
        enquiry_rajinama: 'Enquiry_Rajinama',
        enquiry_civil_land: 'Enquiry_Civil_Land',
        enquiry_civil_finance: 'Enquiry_Civil_Finance',
        enquiry_ncr: 'Enquiry_NCR',
        enquiry_fir: 'Enquiry_FIR',
        enquiry_transfer: 'Enquiry_Transfer_PS',
      };
      const fileName = `Complaint_${templateNames[selectedTemplate] || 'Document'}.docx`;
      saveAs(blob, fileName);
      message.success(`Downloaded: ${fileName}`);
    }).catch(err => {
      console.error('DOCX Generation Error:', err);
      message.error('Failed to generate DOCX file.');
    });
  };

  const renderDocumentGeneration = () => (
    <div style={{ padding: '20px 0' }}>
      <Title level={3}>Document Generation</Title>

      {/* AI Auto-fill Banner for Non-Cognizable Offence */}
      {complaintData?.complaintPurpose === 'Non-Cognizable Report (NCR)' && (
        <div style={{
          background: 'linear-gradient(135deg, #ff6b35 0%, #f7c59f 100%)',
          borderRadius: '10px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(255,107,53,0.3)'
        }}>
          <span style={{ fontSize: '24px' }}>🤖</span>
          <div>
            <strong style={{ color: '#fff', fontSize: '15px', display: 'block' }}>
              AI Detected: Non-Cognizable Offence (NCR)
            </strong>
            <span style={{ color: '#fff3ee', fontSize: '13px' }}>
              The AI has automatically selected and filled the <b>NCR Enquiry Report</b> template based on the complaint analysis. You may edit the document below or choose a different template.
            </span>
          </div>
        </div>
      )}

      <Row gutter={24} style={{ marginTop: '10px' }}>
        <Col span={8}>
          <Card title={<span style={{ color: '#ffffff' }}>Select Template</span>} headStyle={{ backgroundColor: '#1890ff', borderBottom: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Button 
                type={selectedTemplate === 'notice' ? 'primary' : 'default'} 
                block 
                onClick={() => handleTemplateSelect('notice')}
              >
                Notice
              </Button>
              <Button 
                type={selectedTemplate === 'email' ? 'primary' : 'default'} 
                block 
                onClick={() => handleTemplateSelect('email')}
              >
                Email Update
              </Button>
              <Divider style={{ margin: '12px 0' }}>Enquiry Reports</Divider>
              <Button 
                type={selectedTemplate === 'enquiry_rajinama' ? 'primary' : 'dashed'} 
                block 
                onClick={() => handleTemplateSelect('enquiry_rajinama')}
              >
                Rajinama (Mutual Settlement)
              </Button>
              <Button 
                type={selectedTemplate === 'enquiry_civil_land' ? 'primary' : 'dashed'} 
                block 
                onClick={() => handleTemplateSelect('enquiry_civil_land')}
              >
                Civil Nature (Land Dispute)
              </Button>
              <Button 
                type={selectedTemplate === 'enquiry_civil_finance' ? 'primary' : 'dashed'} 
                block 
                onClick={() => handleTemplateSelect('enquiry_civil_finance')}
              >
                Civil Nature (Financial Dispute)
              </Button>
              <Button 
                type={selectedTemplate === 'enquiry_ncr' ? 'primary' : 'dashed'} 
                block 
                onClick={() => handleTemplateSelect('enquiry_ncr')}
              >
                Non-Cognizable Offence (NCR)
              </Button>
              <Button 
                type={selectedTemplate === 'enquiry_fir' ? 'primary' : 'dashed'} 
                block 
                onClick={() => handleTemplateSelect('enquiry_fir')}
              >
                FIR Registered
              </Button>
              <Button 
                type={selectedTemplate === 'enquiry_transfer' ? 'primary' : 'dashed'} 
                block 
                onClick={() => handleTemplateSelect('enquiry_transfer')}
              >
                Transfer to other Police Station
              </Button>
              <Button 
                type={selectedTemplate === 'none' ? 'primary' : 'dashed'} 
                block 
                onClick={() => handleTemplateSelect('none')}
              >
                None
              </Button>
            </div>
          </Card>
        </Col>
        
        <Col span={16}>
          {selectedTemplate && selectedTemplate !== 'none' ? (
            <Card
              title={<span style={{ color: '#ffffff' }}>Document Editor / Viewer</span>}
              headStyle={{ backgroundColor: '#1890ff', borderBottom: 'none' }}
              extra={
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadDocx}
                  style={{ background: '#0891b2', borderColor: '#0891b2', color: '#fff', fontWeight: 600 }}
                >
                  Download DOCX
                </Button>
              }
            >
              <TextArea 
                rows={16} 
                value={documentText} 
                onChange={(e) => setDocumentText(e.target.value)} 
                style={{ fontSize: '15px', lineHeight: '1.6' }}
                placeholder="Select a template from the left or write your own document here..."
              />
            </Card>
          ) : null}
        </Col>
      </Row>

      <div style={{ textAlign: 'right', marginTop: '30px' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} style={{ background: '#1f1f1f', color: '#177ddc', borderColor: '#303030', borderRadius: '8px', padding: '4px 16px', fontWeight: 500 }} onClick={() => setCurrentStep(2)}>Back</Button>

          <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={handleFinalSubmit} loading={isProcessing}>
            Submit
          </Button>
        </Space>
      </div>
    </div>
  );

  const renderModeSelection = () => (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <Title level={3}>Mode of Complaint</Title>
      <Paragraph type="secondary">
        Please select how you want to input your complaint
      </Paragraph>
      <Row gutter={24} justify="center" style={{ marginTop: '40px' }}>
        <Col xs={24} sm={10}>
          <Card 
            hoverable 
            onClick={() => { setMode('pdf'); setUploadedFile(null); }}
            style={{ 
              height: '100%', 
              borderColor: mode === 'pdf' ? '#1890ff' : '#d9d9d9', 
              borderWidth: mode === 'pdf' ? '2px' : '1px' 
            }}
          >
            <div style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }}>
              <FilePdfOutlined />
            </div>
            <Title level={4}>Upload Complaint (PDF)</Title>
          </Card>
        </Col>
        <Col xs={24} sm={10}>
          <Card 
            hoverable 
            onClick={() => { setMode('voice'); setUploadedFile(null); }}
            style={{ 
              height: '100%', 
              borderColor: mode === 'voice' ? '#52c41a' : '#d9d9d9', 
              borderWidth: mode === 'voice' ? '2px' : '1px' 
            }}
          >
            <div style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }}>
              <AudioOutlined />
            </div>
            <Title level={4}>Upload Complaint (Audio)</Title>
          </Card>
        </Col>
      </Row>
      <div style={{ marginTop: '40px' }}>
        <Space>
          {onBack && (
            <Button size="large" onClick={onBack} style={{ minWidth: '120px' }}>
              ← Back
            </Button>
          )}
          <Button 
            type="primary" 
            size="large" 
            disabled={!mode} 
            onClick={() => setCurrentStep(1)}
            style={{ minWidth: '150px' }}
          >
            Proceed
          </Button>
        </Space>
      </div>
    </div>
  );

  const renderDataInput = () => (
    <div style={{ padding: '20px 0' }}>
      {mode === 'pdf' ? (
        <>
          <Title level={4}>Upload PDF</Title>
          <Dragger 
            key="pdf-upload"
            accept=".pdf"
            maxCount={1}
            fileList={uploadedFile ? [uploadedFile] : []}
            beforeUpload={(file) => {
              setUploadedFile(file);
              return false;
            }}
            onRemove={() => setUploadedFile(null)}
            style={{ padding: '40px 0', marginBottom: '24px' }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#1890ff' }}/>
            </p>
            <p className="ant-upload-text">Click or drag PDF file to this area</p>
          </Dragger>
        </>
      ) : (
        <>
          <Title level={4}>Upload Audio Note</Title>
          <Dragger 
            key="audio-upload"
            accept="audio/*"
            maxCount={1}
            fileList={uploadedFile ? [uploadedFile] : []}
            beforeUpload={(file) => {
              setUploadedFile(file);
              return false;
            }}
            onRemove={() => setUploadedFile(null)}
            style={{ padding: '40px 0', marginBottom: '24px' }}
          >
            <p className="ant-upload-drag-icon">
              <AudioOutlined style={{ color: '#52c41a' }}/>
            </p>
            <p className="ant-upload-text">Click or drag Audio file to this area</p>
          </Dragger>
        </>
      )}

      <Divider style={{ margin: '30px 0' }} />
      
      <div style={{ textAlign: 'left', marginBottom: '20px' }}>
        <Text strong style={{ fontSize: '16px', marginRight: '16px' }}>Supporting Document (if any):</Text>
        <Radio.Group 
          value={hasSupportingDoc} 
          onChange={(e) => setHasSupportingDoc(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="yes">Yes</Radio.Button>
          <Radio.Button value="no">No</Radio.Button>
        </Radio.Group>
      </div>

      {hasSupportingDoc === 'yes' && (
        <div style={{ marginTop: '20px' }}>
          <Title level={5}>Upload Supporting Documents (Photos, Videos, etc.)</Title>
          <Dragger 
            key="supporting-docs-upload"
            multiple
            fileList={supportingDocs}
            beforeUpload={(file) => {
              setSupportingDocs(prev => [...prev, file]);
              return false;
            }}
            onRemove={(file) => {
              setSupportingDocs(prev => prev.filter(f => f.uid !== file.uid));
            }}
            style={{ padding: '20px 0', marginBottom: '24px' }}
          >
            <p className="ant-upload-drag-icon">
              <PaperClipOutlined style={{ color: '#1890ff' }}/>
            </p>
            <p className="ant-upload-text">Click or drag media files to this area</p>
          </Dragger>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} style={{ background: '#1f1f1f', color: '#177ddc', borderColor: '#303030', borderRadius: '8px', padding: '4px 16px', fontWeight: 500 }} onClick={() => setCurrentStep(0)}>Back</Button>
          <Button 
            type="primary" 
            size="large" 
            icon={<RobotOutlined />} 
            loading={isProcessing}
            onClick={handleAIProcess}
          >
            Process
          </Button>
        </Space>
      </div>
    </div>
  );

  const renderForm = () => (
    <Form layout="vertical" form={form} onFinish={onFinish} requiredMark={false} onValuesChange={onValuesChange}>
      <Card 
        title={<span style={{ color: '#ffffff' }}>Complainant Details</span>}
        style={{ marginBottom: '20px' }}
        headStyle={{ backgroundColor: '#1890ff', borderBottom: 'none', fontSize: '18px' }}
      >
        <Title level={5} style={{ color: '#096dd9' }}>Personal Information</Title>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="firstName" label="First Name">
              <Input className={getHighlightClass('firstName')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lastName" label="Last Name">
              <Input className={getHighlightClass('lastName')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="mobileNumber" label="Mobile Number">
              <Input className={getHighlightClass('mobileNumber')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="gender" label="Gender">
              <Select className={getHighlightClass('gender')} placeholder="Select Gender" placement="bottomLeft">
                <Option value="Male">Male</Option>
                <Option value="Female">Female</Option>
                <Option value="Transgender">Transgender</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="natureOfComplaint" label="Source of Complaint">
              <Select className={getHighlightClass('natureOfComplaint')} placeholder="Select Source of Complaint" showSearch optionFilterProp="children" placement="bottomLeft">
                <Option value="ACS(H)">ACS(H)</Option>
                <Option value="ADGP(HR&Lit)">ADGP(HR&Lit)</Option>
                <Option value="ADGP L&O">ADGP L&O</Option>
                <Option value="Anonymous/Informer/Tip/Source Report">Anonymous/Informer/Tip/Source Report</Option>
                <Option value="AWBI">AWBI</Option>
                <Option value="CBI">CBI</Option>
                <Option value="Chief Secretary (H)">Chief Secretary (H)</Option>
                <Option value="CID (H)">CID (H)</Option>
                <Option value="Citizen Service Centre">Citizen Service Centre</Option>
                <Option value="Citizen/General Public">Citizen/General Public</Option>
                <Option value="CM Office">CM Office</Option>
                <Option value="Cognizance by Police">Cognizance by Police</Option>
                <Option value="Court">Court</Option>
                <Option value="CPs">CPs</Option>
                <Option value="CVO (P) Haryana">CVO (P) Haryana</Option>
                <Option value="DC Office">DC Office</Option>
                <Option value="DCPs">DCPs</Option>
                <Option value="DGP Office">DGP Office</Option>
                <Option value="Haryana Gau Seva Ayog">Haryana Gau Seva Ayog</Option>
                <Option value="Haryana Human Right Commission">Haryana Human Right Commission</Option>
                <Option value="Haryana Minority Commission">Haryana Minority Commission</Option>
                <Option value="Haryana SC/ST Commission">Haryana SC/ST Commission</Option>
                <Option value="Haryana SCPCR">Haryana SCPCR</Option>
                <Option value="Haryana Women Commission">Haryana Women Commission</Option>
                <Option value="HSEnB">HSEnB</Option>
                <Option value="HSNCB (H)">HSNCB (H)</Option>
                <Option value="IB">IB</Option>
                <Option value="IGP L&O">IGP L&O</Option>
                <Option value="LOKAYUKTA (H)">LOKAYUKTA (H)</Option>
                <Option value="MEA (GOI)">MEA (GOI)</Option>
                <Option value="MHA (GOI)">MHA (GOI)</Option>
                <Option value="Ministers-Speaker(Center/State)">Ministers-Speaker(Center/State)</Option>
                <Option value="MP/MLA">MP/MLA</Option>
                <Option value="National Human Rights Commission">National Human Rights Commission</Option>
                <Option value="National Minority Commission">National Minority Commission</Option>
                <Option value="National SC/ST Commission">National SC/ST Commission</Option>
                <Option value="National Women Commission">National Women Commission</Option>
                <Option value="NCPCR">NCPCR</Option>
                <Option value="NCSK">NCSK</Option>
                <Option value="NIA">NIA</Option>
                <Option value="Office of Army and Paramilitary">Office of Army and Paramilitary</Option>
                <Option value="Other Govt. Offices">Other Govt. Offices</Option>
                <Option value="Other State DGP">Other State DGP</Option>
                <Option value="Police Control Room">Police Control Room</Option>
                <Option value="President Office">President Office</Option>
                <Option value="Prime Minister Office">Prime Minister Office</Option>
                <Option value="PRISON (H)">PRISON (H)</Option>
                <Option value="Range Office - ADGP/IGP">Range Office - ADGP/IGP</Option>
                <Option value="Samadhan Parakoshth">Samadhan Parakoshth</Option>
                <Option value="SCB (H)">SCB (H)</Option>
                <Option value="SP Office">SP Office</Option>
                <Option value="SP/L&O">SP/L&O</Option>
                <Option value="SP/WS">SP/WS</Option>
                <Option value="SPCA">SPCA</Option>
                <Option value="Suo-Moto (Newspaper/Social Media/Internet etc)">Suo-Moto (Newspaper/Social Media/Internet etc)</Option>
                <Option value="SV & ACB (H)">SV & ACB (H)</Option>
                <Option value="Other Police Stations">Other Police Stations</Option>
                <Option value="Others">Others</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="typeOfAccused" label="Type of Accused">
              <Select className={getHighlightClass('typeOfAccused')} placeholder="Select Type of Accused" placement="bottomLeft">
                <Option value="Against Army and Paramilitary Force">Against Army and Paramilitary Force</Option>
                <Option value="Against Foreigner's">Against Foreigner's</Option>
                <Option value="Against Organization / Department">Against Organization / Department</Option>
                <Option value="Against Police Officer">Against Police Officer</Option>
                <Option value="Against Private Person">Against Private Person</Option>
                <Option value="Against Public Servant (Civil)">Against Public Servant (Civil)</Option>
                <Option value="Against Unknown Persons">Against Unknown Persons</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Divider />
        <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
          <Title level={5} style={{ color: '#096dd9', margin: 0 }}>Present Address</Title>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Text strong style={{ marginRight: '16px' }}>Is present address same as the permanent address?</Text>
            <Radio.Group 
              value={isSameAddress} 
              onChange={(e) => setIsSameAddress(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="yes">Yes</Radio.Button>
              <Radio.Button value="no">No</Radio.Button>
            </Radio.Group>
          </div>
        </Row>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="villageTown" label="Village / Town">
              <Input className={getHighlightClass('villageTown')} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="district" label="District">
              <Input className={getHighlightClass('district')} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="state" label="State">
              <Input className={getHighlightClass('state')} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="country" label="Country">
              <Input className={getHighlightClass('country')} />
            </Form.Item>
          </Col>
        </Row>

        {isSameAddress === 'no' && (
          <>
            <Divider />
            <Title level={5} style={{ color: '#096dd9' }}>Permanent Address</Title>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="permVillageTown" label="Village / Town">
                  <Input className={getHighlightClass('permVillageTown')} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="permDistrict" label="District">
                  <Input className={getHighlightClass('permDistrict')} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="permState" label="State">
                  <Input className={getHighlightClass('permState')} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="permCountry" label="Country">
                  <Input className={getHighlightClass('permCountry')} />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        <Divider />
        <Title level={5} style={{ color: '#096dd9' }}>Identification</Title>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="nationality" label="Country of Nationality">
              <Select className={getHighlightClass('nationality')} placeholder="Select Country of Nationality" placement="bottomLeft">
                <Option value="Indian">Indian</Option>
                <Option value="Nepalese">Nepalese</Option>
                <Option value="Bhutanese">Bhutanese</Option>
                <Option value="Bangladeshi">Bangladeshi</Option>
                <Option value="Sri Lankan">Sri Lankan</Option>
                <Option value="Pakistani">Pakistani</Option>
                <Option value="American">American</Option>
                <Option value="British">British</Option>
                <Option value="Canadian">Canadian</Option>
                <Option value="Australian">Australian</Option>
                <Option value="Other">Other</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="idType" label="Identification Type">
              <Select className={getHighlightClass('idType')} placeholder="Select Identification Type" placement="bottomLeft">
                <Option value="Aadhar Card">Aadhar Card</Option>
                <Option value="Voter Card">Voter Card</Option>
                <Option value="Income Tax (PAN Card)">Income Tax (PAN Card)</Option>
                <Option value="Driving License">Driving License</Option>
                <Option value="Passport">Passport</Option>
                <Option value="Ration Card">Ration Card</Option>
                <Option value="Arms License">Arms License</Option>
                <Option value="Visa">Visa</Option>
                <Option value="Any Other">Any Other</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="idNumber" label="Identification Number"><Input className={getHighlightClass('idNumber')} /></Form.Item>
          </Col>
        </Row>
      </Card>

      <Card 
        title={<span style={{ color: '#ffffff' }}>Accused Details</span>}
        style={{ marginBottom: '20px' }}
        headStyle={{ backgroundColor: '#1890ff', borderBottom: 'none', fontSize: '18px' }}
      >
        <Form.List name="accusedList">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Row gutter={16} key={key} style={{ marginBottom: 8, alignItems: 'baseline' }}>
                  <Col span={11}>
                    <Form.Item
                      {...restField}
                      name={[name, 'name']}
                      label={name === 0 ? 'Name' : ''}
                    >
                      <Input className={extractedData?.accusedList?.length > 0 ? 'auto-filled-field' : ''} placeholder="Accused Name" />
                    </Form.Item>
                  </Col>
                  <Col span={11}>
                    <Form.Item
                      {...restField}
                      name={[name, 'address']}
                      label={name === 0 ? 'Address' : ''}
                    >
                      <Input className={extractedData?.accusedList?.length > 0 ? 'auto-filled-field' : ''} placeholder="Accused Address" />
                    </Form.Item>
                  </Col>
                  <Col span={2}>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red', fontSize: '18px', marginTop: name === 0 ? '30px' : '0px' }} />
                  </Col>
                </Row>
              ))}
              <Form.Item>
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{ marginTop: '10px' }}>
                  Add Accused
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Card>

      <Card 
        title={<span style={{ color: '#ffffff' }}>Incident Details</span>}
        style={{ marginBottom: '20px' }}
        headStyle={{ backgroundColor: '#1890ff', borderBottom: 'none', fontSize: '18px' }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="classOfIncident" label="Class of Incident">
              <Select className={getHighlightClass('classOfIncident')} placeholder="Select Class of Incident" placement="bottomLeft">
                <Option value="Cyber Crimes (other than financial fraud)">Cyber Crimes (other than financial fraud)</Option>
                <Option value="Cyber Financial Fraud">Cyber Financial Fraud</Option>
                <Option value="Other IPC/BNS Crimes">Other IPC/BNS Crimes</Option>
                <Option value="Other LSL Crimes">Other LSL Crimes</Option>
                <Option value="Miscellaneous">Miscellaneous</Option>
                <Option value="Crimes Against SC/ST">Crimes Against SC/ST</Option>
                <Option value="Crime Against Children">Crime Against Children</Option>
                <Option value="Matrimonial Dispute">Matrimonial Dispute</Option>
                <Option value="Illegal Immigration">Illegal Immigration</Option>
                <Option value="Job Related Fraud">Job Related Fraud</Option>
                <Option value="Property/Land Dispute">Property/Land Dispute</Option>
                <Option value="Other Economic Offence">Other Economic Offence</Option>
                <Option value="Noise Pollution">Noise Pollution</Option>
                <Option value="Runaway Couple">Runaway Couple</Option>
                <Option value="Security Threat">Security Threat</Option>
                <Option value="Deserter/Absent (Army/Paramilitary)">Deserter/Absent (Army/Paramilitary)</Option>
                <Option value="Death during Police Action">Death during Police Action</Option>
                <Option value="Death in Judicial Custody">Death in Judicial Custody</Option>
                <Option value="Death in Police Custody">Death in Police Custody</Option>
                <Option value="Corruption/Demand of Bribe">Corruption/Demand of Bribe</Option>
                <Option value="Human Rights Violation">Human Rights Violation</Option>
                <Option value="Crime Against Women">Crime Against Women</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="placeOfIncident" label="Place of Incident">
              <Input className={getHighlightClass('placeOfIncident')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dateOfIncident" label="Date of Incident">
              <DatePicker className={getHighlightClass('dateOfIncident')} style={{ width: '100%' }} placement="bottomLeft" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="timeOfIncident" label="Time of Incident">
              <TimePicker className={getHighlightClass('timeOfIncident')} use12Hours format="hh:mm a" placeholder="Not mentioned" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card 
        title={<span style={{ color: '#ffffff' }}>Complaint Detail</span>}
        style={{ marginBottom: '20px' }}
        headStyle={{ backgroundColor: '#1890ff', borderBottom: 'none', fontSize: '18px' }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="typeOfComplaint" label="Type of Complaint">
              <Select className={getHighlightClass('typeOfComplaint')} placeholder="Select Type" placement="bottomLeft">
                <Option value="Fresh Complaint">Fresh Complaint</Option>
                <Option value="Repeat (Same Matter)">Repeat (Same Matter)</Option>
                <Option value="Legal Notice">Legal Notice</Option>
                <Option value="Source Report">Source Report</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="typeOfComplainant" label="Type of Complainant">
              <Select className={getHighlightClass('typeOfComplainant')} placeholder="Select Type" placement="bottomLeft">
                <Option value="Anonymous">Anonymous</Option>
                <Option value="Court">Court</Option>
                <Option value="Govt Official (other than police department)">Govt Official (other than police department)</Option>
                <Option value="Govt Official (Police department)">Govt Official (Police department)</Option>
                <Option value="Private Person">Private Person</Option>
                <Option value="Suo-Moto">Suo-Moto</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="complaintPurpose" label="Complaint Purpose">
              <Select className={getHighlightClass('complaintPurpose')} placeholder="Select Purpose" placement="bottomLeft">
                <Option value="Enquiry">Enquiry</Option>
                <Option value="FIR Registration">FIR Registration</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dateOfComplaint" label="Date of Complaint">
              <DatePicker className={getHighlightClass('dateOfComplaint')} style={{ width: '100%' }} placement="bottomLeft" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="isFirRegistered" label="Is FIR Registered?">
              <Select className={getHighlightClass('isFirRegistered')} placeholder="Select Status" placement="bottomLeft">
                <Option value="Yes">Yes</Option>
                <Option value="No">No</Option>
                <Option value="Unknown">Unknown</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="modeOfReceipt" label="Mode of Receipt">
              <Select className={getHighlightClass('modeOfReceipt')} placeholder="Select Mode of Receipt" placement="bottomLeft" getPopupContainer={trigger => trigger.parentNode}>
                <Option value="By Email">By Email</Option>
                <Option value="By Official Dak">By Official Dak</Option>
                <Option value="By Registered Post/Courier">By Registered Post/Courier</Option>
                <Option value="By Simple Post">By Simple Post</Option>
                <Option value="By SMS">By SMS</Option>
                <Option value="By Speed Post">By Speed Post</Option>
                <Option value="CM Window">CM Window</Option>
                <Option value="In-Person/By Hand">In-Person/By Hand</Option>
                <Option value="Suo-Moto(Newspaper/Social Media/Internet etc)">Suo-Moto(Newspaper/Social Media/Internet etc)</Option>
                <Option value="Telephone/Mobile call">Telephone/Mobile call</Option>
                <Option value="Wireless">Wireless</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="descriptionOfComplaint" label="Description of Complaint">
              <TextArea className={getHighlightClass('descriptionOfComplaint')} rows={4} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <div style={{ textAlign: 'right', marginTop: '20px' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} style={{ background: '#1f1f1f', color: '#177ddc', borderColor: '#303030', borderRadius: '8px', padding: '4px 16px', fontWeight: 500 }} onClick={() => setCurrentStep(1)}>Back</Button>
          <Button type="primary" htmlType="submit" size="large" style={{ minWidth: '150px' }}>
            Register Complaint
          </Button>
        </Space>
      </div>
    </Form>
  );

  return (
    <>
    <Card bordered={false}>
      <style>{`
        .auto-extracted-field,
        .auto-extracted-field.ant-select:not(.ant-select-customize-input) .ant-select-selector,
        .auto-extracted-field.ant-picker {
          background-color: rgba(24, 144, 255, 0.1) !important;
          border: 2px solid #1890ff !important;
          box-shadow: 0 0 8px rgba(24, 144, 255, 0.4) !important;
        }
        .auto-extracted-field input {
          background-color: transparent !important;
        }
      `}</style>
      {/* Only render the ACTIVE step — avoids cross-step render crashes */}
      {currentStep === 0 && renderModeSelection()}
      {currentStep === 1 && renderDataInput()}
      {currentStep === 2 && renderForm()}
    </Card>

    {/* ── Custom Duplicate Modal — fully dark, shows all matched complaints ── */}
    {duplicateModalData && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}>
        <div style={{
          background: '#1a1f2e',
          border: '1px solid #3d2b00',
          borderRadius: '12px',
          width: '580px',
          maxWidth: '95vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '18px 24px 14px',
            borderBottom: '1px solid #3d2b00',
            background: 'linear-gradient(135deg, #2d1b00 0%, #1a1200 100%)',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '24px', marginTop: '2px' }}>🚨</span>
            <div>
              <div style={{ color: '#ffd666', fontWeight: 700, fontSize: '16px' }}>
                Duplicate Complaint Alert
              </div>
              <div style={{ color: '#c9962a', fontSize: '13px', marginTop: '2px' }}>
                {duplicateModalData.duplicates.length} similar complaint{duplicateModalData.duplicates.length > 1 ? 's' : ''} already registered in the system.
              </div>
            </div>
          </div>

          {/* Scrollable Body */}
          <div style={{ padding: '16px 24px', overflowY: 'auto', flexGrow: 1 }}>
            {duplicateModalData.duplicates.map((dup, idx) => {
              const reasons = getDuplicateReasons(dup, duplicateModalData.values);
              const dupName = `${dup.firstName || ''} ${dup.lastName || ''}`.trim() || 'Unknown';
              return (
                <div key={dup.id} style={{
                  background: '#111827',
                  border: '1px solid #30363d',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  marginBottom: idx < duplicateModalData.duplicates.length - 1 ? '12px' : 0,
                }}>
                  {/* Complaint header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: '15px' }}>{dup.id}</span>
                    <span style={{
                      background: dup.ioStatus === 'Under Investigation' ? '#1d4ed8' :
                                  dup.ioStatus === 'Disposed' ? '#6b21a8' :
                                  dup.ioStatus === 'Convert to FIR' ? '#991b1b' : '#92400e',
                      color: '#ffffff',
                      borderRadius: '12px',
                      padding: '2px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}>
                      {dup.ioStatus || 'Registered'}
                    </span>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#8b949e' }}>Complainant</div>
                    <div style={{ fontSize: '13px', color: '#e6edf3', fontWeight: 500 }}>{dupName}</div>

                    <div style={{ fontSize: '12px', color: '#8b949e' }}>Mobile</div>
                    <div style={{ fontSize: '13px', color: '#e6edf3' }}>{dup.mobileNumber || '—'}</div>

                    <div style={{ fontSize: '12px', color: '#8b949e' }}>Incident Class</div>
                    <div style={{ fontSize: '13px', color: '#e6edf3' }}>{dup.classOfIncident || '—'}</div>

                    <div style={{ fontSize: '12px', color: '#8b949e' }}>Registered On</div>
                    <div style={{ fontSize: '13px', color: '#e6edf3' }}>{dup.dateRegistered || '—'}</div>

                    <div style={{ fontSize: '12px', color: '#8b949e' }}>Assigned IO</div>
                    <div style={{ fontSize: '13px', color: '#e6edf3' }}>{dup.assignedIoName || 'Unassigned'}</div>
                  </div>

                  {/* Match reasons */}
                  <div style={{ borderTop: '1px solid #21262d', paddingTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Matched Fields</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {reasons.map((r, i) => (
                        <span key={i} style={{
                          background: r.severity === 'high' ? 'rgba(239,68,68,0.15)' : r.severity === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                          border: `1px solid ${r.severity === 'high' ? 'rgba(239,68,68,0.4)' : r.severity === 'medium' ? 'rgba(245,158,11,0.4)' : 'rgba(59,130,246,0.4)'}`,
                          color: r.severity === 'high' ? '#fca5a5' : r.severity === 'medium' ? '#fcd34d' : '#93c5fd',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}>
                          {r.label}: {r.value}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', color: '#fca5a5', fontSize: '13px' }}>
              ⚠️ Registering a duplicate complaint may result in duplication of records. Please verify before proceeding.
            </div>
          </div>

          {/* Footer buttons */}
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid #30363d',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#111827',
            flexShrink: 0,
          }}>
            <span style={{ color: '#8b949e', fontSize: '12px' }}>
              {duplicateModalData.duplicates.length} duplicate{duplicateModalData.duplicates.length > 1 ? 's' : ''} found
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setDuplicateModalData(null)}
                style={{
                  padding: '7px 20px',
                  borderRadius: '6px',
                  border: '1px solid #30363d',
                  background: 'transparent',
                  color: '#60a5fa',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                ← Go Back
              </button>
              <button
                onClick={() => {
                  const { values, existing } = duplicateModalData;
                  setDuplicateModalData(null);
                  // Mark as repeat complaint when registering despite duplicate warning
                  proceedRegistration({ ...values, typeOfComplaint: 'Repeat (Same Matter)' }, existing);
                }}
                style={{
                  padding: '7px 20px',
                  borderRadius: '6px',
                  border: '1px solid #b45309',
                  background: '#92400e',
                  color: '#fef3c7',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Register as Repeat Complaint
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
