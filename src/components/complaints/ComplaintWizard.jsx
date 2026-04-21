import React, { useState } from 'react';
import { Card, Steps, Button, Typography, Space, Row, Col, Upload, message, Form, Input, Select, DatePicker, TimePicker, Divider, Result, Radio } from 'antd';
import { FilePdfOutlined, AudioOutlined, InboxOutlined, RobotOutlined, CheckCircleOutlined, PaperClipOutlined, DownloadOutlined } from '@ant-design/icons';
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

export default function ComplaintWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [mode, setMode] = useState(null); // 'pdf' or 'voice'
  const [isProcessing, setIsProcessing] = useState(false);
  const [form] = Form.useForm();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null); // Save extracted data for reliable auto-fill
  const [complaintData, setComplaintData] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [documentText, setDocumentText] = useState('');

  // Safe auto-fill execution when Form successfully mounts in Step 2
  React.useEffect(() => {
    if (currentStep === 2 && extractedData) {
      form.setFieldsValue(extractedData);
    }
  }, [currentStep, extractedData, form]);
  
  // Voice Upload State using same uploadedFile
  
  // Supporting Documents State
  const [hasSupportingDoc, setHasSupportingDoc] = useState('no');
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [isSameAddress, setIsSameAddress] = useState('yes');


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

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      message.error('VITE_GROQ_API_KEY not found in .env! Cannot process with AI.');
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

        const audioResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${apiKey}`
          },
          body: formData
        });

        const audioData = await audioResponse.json();
        if (audioData.error) throw new Error(audioData.error.message || 'Groq Audio Error');

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
          "accusedName": "string",
          "accusedAddress": "string",
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

      const prompt = `You are an expert Police Complaint analyzer for Haryana Police. The complaint may be in Hindi, English, or Hinglish (mix of both).
Carefully read the text AND images provided. Extract all relevant information and return it as a strict JSON object matching the schema below.

=== EXTRACTION RULES ===

[1] LANGUAGE
- Translate ALL Hindi content to English.
- Transliterate Hindi names/places into Roman script. Example: "रामकुमार" becomes "Ramkumar", "हिसार" becomes "Hisar".

[2] COMPLAINANT NAME AND GENDER
- firstName = first/given name only. lastName = surname/family name only.
- If name is a single word, put it all in firstName, leave lastName as empty string.
- Extract the COMPLAINANT name only, NOT the accused, witness, or officer name.
- Deduce gender from context and name. Indian male names: Ram, Suresh, Vikram, Mohit. Female: Sunita, Priya, Kavita.

[3] MOBILE NUMBER
- Extract the complainant 10-digit mobile number. Strip +91 or leading 0 if present.
- If not present: return empty string.

[4] ACCUSED
- accusedName: The person the complaint is filed AGAINST. Look for keywords like "ke viruddh", "against", "pratadit". If unknown write "Unknown".
- accusedAddress: The accused address. If unknown write "Unknown".

[5] DATES AND TIME
- dateOfIncident: Date the actual crime occurred. Format YYYY-MM-DD. If unclear or missing return empty string.
- timeOfIncident: Time the crime occurred in 24-hour format like "14:30:00". If not mentioned return "Not mentioned".
- dateOfComplaint: Date complaint was written or submitted. Format YYYY-MM-DD. Default to today if missing.
- NEVER invent or guess dates. Extract only what is explicitly written in the document.

[6] ID PROOF
- idType: Detect any government ID mentioned such as Aadhar Card, Voter Card, PAN Card, Driving License, Passport, Ration Card, Arms License, Visa. Match to exact schema enum value.
- idNumber: Extract the actual ID number. Return empty string if not found.

[7] INCIDENT DETAILS
- classOfIncident: Categorize from schema enum. Examples: land grab maps to "Property/Land Dispute", UPI fraud maps to "Cyber Financial Fraud", wife beating maps to "Crime Against Women", bribe demand maps to "Corruption/Demand of Bribe".
- placeOfIncident: The specific location where the incident happened. Never leave empty, use "Unknown" if truly missing.

[8] COMPLAINT TYPE AND PURPOSE - Use EXACT enum values only
- typeOfComplaint:
  "Fresh Complaint" means brand new first-time complaint
  "Repeat (Same Matter)" means re-filed on same incident
  "Legal Notice" means legally accompanied notice
  "Source Report" means from informant or intelligence tip
- complaintPurpose:
  "Enquiry" means investigation request, fact-finding, NCR, preventive, lost and found, verification
  "FIR Registration" means explicit demand for FIR or clear cognizable offence
- typeOfComplainant:
  "Private Person" means common citizen, victim, witness, family member
  "Govt Official (Police department)" means police officer, SHO, constable
  "Govt Official (other than police department)" means other government employee
  "Court" means court-directed complaint
  "Anonymous" means identity hidden or unknown
  "Suo-Moto" means police registration on their own initiative
- isFirRegistered: "Yes" if FIR already exists, "No" if not yet, "Unknown" if unclear

[9] SOURCE OF COMPLAINT (natureOfComplaint)
- Identify the origin or channel of the complaint. Match to closest enum value.
- Examples: direct citizen walk-in maps to "Citizen/General Public", letter from CM office maps to "CM Office", court order maps to "Court", police themselves maps to "Cognizance by Police", anonymous tip maps to "Anonymous/Informer/Tip/Source Report".

[10] MODE OF RECEIPT (modeOfReceipt)
- Determine HOW this complaint was received or delivered. Match to the closest enum value:
  * "In-Person/By Hand" → complainant came in person, handed over physically at police station
  * "By Email" → complaint sent via email
  * "By SMS" → complaint received via SMS/text message
  * "Telephone/Mobile call" → complaint received over phone call
  * "By Speed Post" → delivered by India Post speed post
  * "By Registered Post/Courier" → sent via registered post or courier service
  * "By Simple Post" → sent via ordinary post
  * "By Official Dak" → received through official government dak/dispatch
  * "CM Window" → received via Chief Minister's complaint window/portal
  * "Wireless" → received via police wireless communication
  * "Suo-Moto(Newspaper/Social Media/Internet etc)" → police took note from newspaper/social media/internet
- If method is unclear or not mentioned, default to "In-Person/By Hand".

[11] DESCRIPTION
- Write a COMPREHENSIVE and DETAILED paragraph of minimum 6 to 8 sentences.
- Cover: complainant identity, accused identity, what happened, when, where, amounts or losses involved, demands made, relevant background, and any evidence mentioned.

[12] ADDRESS ANALYSIS (CRITICAL)
- The complainant may have a Present/Current Address and a separate Permanent Address.
- Read carefully to avoid hallucinations or mixing up the addresses.
- If both are mentioned and are DIFFERENT, extract the Present Address into the regular address fields (houseNumber, villageTown, etc.) AND extract the Permanent Address strictly into the fields prefixed with 'perm' (permHouseNumber, permVillageTown, etc.).
- If only one address is mentioned, or if it explicitly says "Present Address is same as Permanent Address", extract it to the regular address fields ONLY and leave ALL 'perm' prefixed fields as empty strings ("").

=== OUTPUT RULES ===
- Output ONLY raw JSON. No markdown, no backtick fences, no preamble, no explanation text.
- ALL enum fields must use EXACTLY the values from the schema with no abbreviations and no translations.
- ALL keys must be present in the output. Use empty string for unknown string fields. Use null for unknown date fields.

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

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestPayload)
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || 'Groq API Error');
      
      const responseText = data.choices[0].message.content;
      // Guarantee JSON safety if Vision model adds markdown wrappers
      let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsedData = JSON.parse(cleanJson);
      
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

      setExtractedData(parsedData); // Save to state to trigger useEffect auto-fill
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

  const onFinish = (values) => {
    console.log('Submitted Data:', values);
    setComplaintData(values);
    
    // Auto-select NCR template if the purpose is NCR
    if (values.complaintPurpose === 'Non-Cognizable Report (NCR)') {
      setSelectedTemplate('enquiry_ncr');
      setDocumentText(generateTemplateText('enquiry_ncr', values));
    } else {
      setSelectedTemplate(null);
      setDocumentText('');
    }
    
    setCurrentStep(3);
  };

  const generateTemplateText = (templateType, data) => {
    const d = data || {};
    const dateToday = dayjs().format('DD-MM-YYYY');

    // Extracting comprehensive variables
    const compName = `${d.firstName || ''} ${d.lastName || ''}`.trim() || '[Complainant Name]';
    const compPhone = d.mobileNumber || '[Complainant Mobile]';
    const compAddress = [d.houseNumber, d.streetName, d.colonyArea, d.villageTown, d.district, d.state, d.pinCode].filter(Boolean).join(', ') || '[Complainant Address]';
    
    const accName = d.accusedName || '[Accused Name]';
    const accAddress = d.accusedAddress || '[Accused Address]';
    
    const incidentClass = d.classOfIncident || '[Class of Incident]';
    const placeOfIncident = d.placeOfIncident || '[Place of Incident]';
    const dateOfInc = d.dateOfIncident ? dayjs(d.dateOfIncident).format('DD-MM-YYYY') : '[Date of Incident]';
    const timeOfInc = d.timeOfIncident ? dayjs(d.timeOfIncident).format('hh:mm A') : '[Time of Incident]';
    
    const actDescription = d.descriptionOfComplaint || '[Description of Complaint]';

    switch (templateType) {
      case 'notice':
        return `NOTICE FOR APPEARANCE\n\nNotice Number: _______\nDate: ${dateToday}\n\nTo,\nName: ${accName}\nAddress: ${accAddress}\n\nSubject: Notice for appearance regarding complaint filed by ${compName}.\n\nWHEREAS, a complaint has been registered against you at this Police Station by ${compName} (R/o ${compAddress}).\n\nBRIEF FACT OF COMPLAINT:\nThe complainant alleges that an incident of "${incidentClass}" occurred at ${placeOfIncident} on ${dateOfInc} around ${timeOfInc}. \n\nTherefore, in exercise of the powers conferred upon me, you are hereby directed to appear before the undersigned at the Police Station on __-__-____ at __:__ AM/PM for the purpose of further enquiry and to present your side of the facts along with relevant documents/evidence, if any.\n\nPlease note that failure to comply with the terms of this notice may render you liable for action under relevant provisions of law.\n\n\nSignature of Investigating Officer\nName: _______________\nDesignation: _______________\nPolice Station: _______________`;
        
      case 'email':
        return `Subject: Status Update on Complaint Registration - ${incidentClass}\n\nDear Sir/Madam,\n\nThis is to officially inform you that we are in receipt of your complaint regarding the incident of "${incidentClass}".\n\nCOMPLAINT DETAILS:\n- Complainant Name: ${compName}\n- Complainant Contact: ${compPhone}\n- Accused Named: ${accName}\n- Alleged Incident Place: ${placeOfIncident}\n- Date of Occurrence: ${dateOfInc}\n\nWe have documented your submission and the matter is currently under preliminary enquiry. Our Investigating Officer will be reaching out to you shortly for any further clarifications or statements required as per the procedure.\n\nFor any interim query, you may contact the Helpdesk at the undersigned Police Station.\n\nSincerely,\n\nStation House Officer (SHO)\n[Police Station Name]\nDate: ${dateToday}`;

      case 'enquiry_rajinama':
        return `ENQUIRY REPORT - MUTUAL SETTLEMENT (RAJINAMA)\n\nDate: ${dateToday}\n\n1. REFERENCE COMPLAINT\nComplainant: ${compName}, R/o ${compAddress}, Ph: ${compPhone}\nAccused: ${accName}, R/o ${accAddress}\nNature of Incident: ${incidentClass}\nDate & Place of Occurrence: ${dateOfInc} at ${placeOfIncident}\n\n2. BRIEF ALLEGATIONS\nAs per the contents of the complaint, the complainant alleged that: \n"${actDescription}"\n\n3. PROCEEDINGS & FINDINGS\nDuring the course of the preliminary enquiry, both the complainant and the accused were summoned to the Police Station. After comprehensive discussions and in the presence of respectable persons from society, both parties have amicably resolved their differences.\n\nThe complainant (${compName}) has furnished a written statement stating that the matter has been resolved mutually without any coercion, threat, or undue influence. The complainant does not wish to pursue any further legal or police action regarding this matter.\n\n4. CONCLUSION & RECOMMENDATION\nSince the parties have arrived at a mutual compromise (Rajinama) and the complainant is no longer desirous of pursuing the case, no cognizable offence requiring police intervention survives.\n\nAccordingly, it is recommended to consign this complaint to the records (File / Filed without FIR).\n\n\nSubmitted by:\n[IO Signature]\nName/Rank: _______________`;

      case 'enquiry_civil':
        return `ENQUIRY REPORT - PROCEEDING OF CIVIL NATURE\n\nDate: ${dateToday}\n\n1. REFERENCE COMPLAINT\nComplainant: ${compName}, R/o ${compAddress}, Ph: ${compPhone}\nAccused: ${accName}, R/o ${accAddress}\nSubject/Category: ${incidentClass}\nDate & Place of Incident: ${dateOfInc} at ${placeOfIncident}\n\n2. BRIEF OF COMPLAINT\nBriefly, the complainant states that: \n"${actDescription}"\n\n3. ENQUIRY CONDUCTED & FACTUAL POSITION\nAn extensive preliminary enquiry was conducted by the undersigned. The relevant documents submitted by the complainant and the statements of both parties were examined.\n\nThe scrutiny reveals that the crux of the dispute between the parties pertains to land, finances, or contractual obligations, which fundamentally falls within the contours of a Civil Dispute. The elements of mens rea (criminal intent) or a cognizable criminal offence under the BNS/LSL are entirely absent.\n\n4. CONCLUSION & RECOMMENDATION\nIn light of the Honourable Supreme Court guidelines preventing the criminalization of civil disputes, police interference in this matter is strictly unwarranted.\n\nThe complainant has been properly briefed and advised to approach the appropriate Honourable Civil Court / Revenue Authority for the redressal of the grievance.\n\nTherefore, it is recommended to file this complaint.\n\n\nSubmitted by:\n[IO Signature]\nName/Rank: _______________`;

      case 'enquiry_ncr':
        return `NON-COGNIZABLE REPORT (NCR) / ENQUIRY REPORT\n\nDate: ${dateToday}\n\n1. COMPLAINANT DETAILS\nName: ${compName}\nAddress: ${compAddress}\nContact: ${compPhone}\n\n2. ACCUSED DETAILS\nName: ${accName}\nAddress: ${accAddress}\n\n3. INCIDENT DETAILS\nCategory: ${incidentClass}\nDate & Time: ${dateOfInc} | ${timeOfInc}\nPlace of Occurrence: ${placeOfIncident}\n\n4. FACTS OF THE COMPLAINT\nThe complainant has reported that: \n"${actDescription}"\n\n5. IO'S OPINION & ACTION TAKEN\nUpon careful perusal of the complaint and preliminary enquiry, it is concluded that the allegations raised by the complainant disclose the commission of a strictly Non-Cognizable Offence. \n\nAccordingly, the substance of the information has been duly entered into the Daily Diary Document (Rapt/DDR). The police cannot investigate a non-cognizable case without the order of a Magistrate having power to try such cases.\n\nThe complainant, ${compName}, has been properly informed and legally advised to approach the Honourable Magistrate under the relevant sections of the BNSS for further judicial remedy.\n\n\nPrepared by:\n[IO Signature]\nName/Rank: _______________`;

      case 'enquiry_fir':
        return `ENQUIRY REPORT - FIR REGISTRATION RECOMMENDED\n\nDate: ${dateToday}\n\n1. REFERENCE\nSource of Complaint: Received from ${compName} (Ph: ${compPhone})\nComplainant Address: ${compAddress}\nAlleged Accused: ${accName}, R/o ${accAddress}\n\n2. INCIDENT PARTICULARS\nClassification: ${incidentClass}\nTime, Date & Place: ${timeOfInc} on ${dateOfInc} at ${placeOfIncident}\n\n3. GIST OF ALLEGATIONS\n"${actDescription}"\n\n4. ENQUIRY OBSERVATIONS\nDuring the preliminary enquiry, physical and documentary constraints were gathered. Based on the facts presented and the sequence of events outlined in the complaint, prime-facie, a cognizable offence is conclusively made out against the accused person(s).\n\n5. RECOMMENDATION\nSince the allegations disclose explicit commission of a Cognizable Offence, it is legally imperative to initiate investigation. Consequently, it is strongly recommended that a First Information Report (FIR) be registered without any delay under the relevant sections of BNS / Minor Acts.\n\nAfter registration of the FIR, the investigation file may kindly be handed over to the Investigating Officer for due procedures of law.\n\n\nSubmitted by:\n[IO Signature]\nName/Rank: _______________\n\nForwarded to SHO for approval / FIR Registration.`;

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
        enquiry_civil: 'Enquiry_Civil',
        enquiry_ncr: 'Enquiry_NCR',
        enquiry_fir: 'Enquiry_FIR',
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
                type={selectedTemplate === 'enquiry_civil' ? 'primary' : 'dashed'} 
                block 
                onClick={() => handleTemplateSelect('enquiry_civil')}
              >
                Civil Nature (Land/Financial)
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
          <Button onClick={() => setCurrentStep(2)}>Back</Button>

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
        <Button 
          type="primary" 
          size="large" 
          disabled={!mode} 
          onClick={() => setCurrentStep(1)}
          style={{ minWidth: '150px' }}
        >
          Proceed
        </Button>
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
          <Button onClick={() => setCurrentStep(0)}>Back</Button>
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
    <Form layout="vertical" form={form} onFinish={onFinish}>
      <Card 
        title={<span style={{ color: '#ffffff' }}>Complainant Details</span>}
        style={{ marginBottom: '20px' }}
        headStyle={{ backgroundColor: '#1890ff', borderBottom: 'none', fontSize: '18px' }}
      >
        <Title level={5} style={{ color: '#096dd9' }}>Personal Information</Title>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="firstName" label="First Name" rules={[{ required: true, message: 'Please enter First Name' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lastName" label="Last Name">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="mobileNumber" label="Mobile Number" rules={[{ required: true, message: 'Please enter Mobile Number' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="gender" label="Gender" rules={[{ required: true, message: 'Please select Gender' }]}>
              <Select placeholder="Select Gender" placement="bottomLeft">
                <Option value="Male">Male</Option>
                <Option value="Female">Female</Option>
                <Option value="Transgender">Transgender</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="natureOfComplaint" label="Source of Complaint" rules={[{ required: true, message: 'Please select Source of Complaint' }]}>
              <Select placeholder="Select Source of Complaint" showSearch optionFilterProp="children" placement="bottomLeft">
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
            <Form.Item name="typeOfAccused" label="Type of Accused" rules={[{ required: true, message: 'Please select Type of Accused' }]}>
              <Select placeholder="Select Type of Accused" placement="bottomLeft">
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
          <Col span={8}><Form.Item name="houseNumber" label="House Number"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="streetName" label="Street Name"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="colonyArea" label="Colony / Area"><Input /></Form.Item></Col>
          <Col span={8}>
            <Form.Item name="villageTown" label="Village / Town" rules={[{ required: true, message: 'Please enter Village/Town' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}><Form.Item name="tehsilBlock" label="Tehsil / Block / Mandal"><Input /></Form.Item></Col>
          <Col span={8}>
            <Form.Item name="country" label="Country" rules={[{ required: true, message: 'Please enter Country' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="state" label="State" rules={[{ required: true, message: 'Please enter State' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="district" label="District" rules={[{ required: true, message: 'Please enter District' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}><Form.Item name="policeStation" label="Police Station"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="pinCode" label="Pin Code"><Input /></Form.Item></Col>
        </Row>

        {isSameAddress === 'no' && (
          <>
            <Divider />
            <Title level={5} style={{ color: '#096dd9' }}>Permanent Address</Title>
            <Row gutter={16}>
              <Col span={8}><Form.Item name="permHouseNumber" label="House Number"><Input /></Form.Item></Col>
              <Col span={8}><Form.Item name="permStreetName" label="Street Name"><Input /></Form.Item></Col>
              <Col span={8}><Form.Item name="permColonyArea" label="Colony / Area"><Input /></Form.Item></Col>
              <Col span={8}>
                <Form.Item name="permVillageTown" label="Village / Town" rules={[{ required: true, message: 'Please enter Village/Town' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}><Form.Item name="permTehsilBlock" label="Tehsil / Block / Mandal"><Input /></Form.Item></Col>
              <Col span={8}>
                <Form.Item name="permCountry" label="Country" rules={[{ required: true, message: 'Please enter Country' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="permState" label="State" rules={[{ required: true, message: 'Please enter State' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="permDistrict" label="District" rules={[{ required: true, message: 'Please enter District' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}><Form.Item name="permPoliceStation" label="Police Station"><Input /></Form.Item></Col>
              <Col span={8}><Form.Item name="permPinCode" label="Pin Code"><Input /></Form.Item></Col>
            </Row>
          </>
        )}

        <Divider />
        <Title level={5} style={{ color: '#096dd9' }}>Identification</Title>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="nationality" label="Country of Nationality" rules={[{ required: true, message: 'Please select Country of Nationality' }]}>
              <Select placeholder="Select Country of Nationality" placement="bottomLeft">
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
              <Select placeholder="Select Identification Type" placement="bottomLeft">
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
            <Form.Item name="idNumber" label="Identification Number"><Input /></Form.Item>
          </Col>
        </Row>
      </Card>

      <Card 
        title={<span style={{ color: '#ffffff' }}>Accused Details</span>}
        style={{ marginBottom: '20px' }}
        headStyle={{ backgroundColor: '#1890ff', borderBottom: 'none', fontSize: '18px' }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="accusedName" label="Name" rules={[{ required: true, message: 'Please enter Accused Name' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="accusedAddress" label="Address" rules={[{ required: true, message: 'Please enter Accused Address' }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card 
        title={<span style={{ color: '#ffffff' }}>Incident Details</span>}
        style={{ marginBottom: '20px' }}
        headStyle={{ backgroundColor: '#1890ff', borderBottom: 'none', fontSize: '18px' }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="classOfIncident" label="Class of Incident" rules={[{ required: true, message: 'Please select Class of Incident' }]}>
              <Select placeholder="Select Class of Incident" placement="bottomLeft">
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
            <Form.Item name="placeOfIncident" label="Place of Incident" rules={[{ required: true, message: 'Please enter Place of Incident' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dateOfIncident" label="Date of Incident" rules={[{ required: true, message: 'Please select Date' }]}>
              <DatePicker style={{ width: '100%' }} placement="bottomLeft" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="timeOfIncident" label="Time of Incident">
              <TimePicker use12Hours format="hh:mm a" placeholder="Not mentioned" style={{ width: '100%' }} />
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
            <Form.Item name="typeOfComplaint" label="Type of Complaint" rules={[{ required: true, message: 'Please select' }]}>
              <Select placeholder="Select Type" placement="bottomLeft">
                <Option value="Fresh Complaint">Fresh Complaint</Option>
                <Option value="Repeat (Same Matter)">Repeat (Same Matter)</Option>
                <Option value="Legal Notice">Legal Notice</Option>
                <Option value="Source Report">Source Report</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="typeOfComplainant" label="Type of Complainant" rules={[{ required: true, message: 'Please select' }]}>
              <Select placeholder="Select Type" placement="bottomLeft">
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
            <Form.Item name="complaintPurpose" label="Complaint Purpose" rules={[{ required: true, message: 'Please select' }]}>
              <Select placeholder="Select Purpose" placement="bottomLeft">
                <Option value="Enquiry">Enquiry</Option>
                <Option value="FIR Registration">FIR Registration</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dateOfComplaint" label="Date of Complaint" rules={[{ required: true, message: 'Please select Date of Complaint' }]}>
              <DatePicker style={{ width: '100%' }} placement="bottomLeft" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="isFirRegistered" label="Is FIR Registered?" rules={[{ required: true, message: 'Please select FIR Status' }]}>
              <Select placeholder="Select Status" placement="bottomLeft">
                <Option value="Yes">Yes</Option>
                <Option value="No">No</Option>
                <Option value="Unknown">Unknown</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="modeOfReceipt" label="Mode of Receipt" rules={[{ required: true, message: 'Please select Mode of Receipt' }]}>
              <Select placeholder="Select Mode of Receipt" placement="bottomLeft" getPopupContainer={trigger => trigger.parentNode}>
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
            <Form.Item name="descriptionOfComplaint" label="Description of Complaint" rules={[{ required: true, message: 'Please enter Description' }]}>
              <TextArea rows={4} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <div style={{ textAlign: 'right', marginTop: '20px' }}>
        <Space>
          <Button onClick={() => setCurrentStep(1)}>Back</Button>
          <Button type="primary" htmlType="submit" size="large" style={{ minWidth: '150px' }}>
            Proceed
          </Button>
        </Space>
      </div>
    </Form>
  );

  return (
    <Card bordered={false}>
      {isSubmitted ? (
        <Result
          status="success"
          title="Complaint Registered Successfully!"
          subTitle="Your complaint has been processed and recorded in the system."
          extra={[
            <Button type="primary" key="console" onClick={() => {
              setIsSubmitted(false);
              setCurrentStep(0);
              setMode(null);
              setComplaintData(null);
              setSelectedTemplate(null);
              setDocumentText('');
              setIsSameAddress('yes');
              form.resetFields();
            }}>
              Register Another
            </Button>
          ]}
        />
      ) : (
        <>
          <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
            {renderModeSelection()}
          </div>
          <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
            {renderDataInput()}
          </div>
          <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
            {renderForm()}
          </div>
          <div style={{ display: currentStep === 3 ? 'block' : 'none' }}>
            {renderDocumentGeneration()}
          </div>
        </>
      )}
    </Card>
  );
}
