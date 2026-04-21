import re

filepath = r'src\components\complaints\ComplaintWizard.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the start and end of the prompt
start_marker = "const prompt = `You are an expert Police Complaint analyzer."
end_marker = "${textToProcess}\n      `;"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1:
    print("ERROR: Could not find prompt start")
    exit(1)

if end_idx == -1:
    print("ERROR: Could not find prompt end")
    exit(1)

end_idx = end_idx + len(end_marker)

new_prompt = r"""const prompt = `You are an expert Police Complaint analyzer for Haryana Police. The complaint may be in Hindi, English, or Hinglish (mix of both).
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

[10] DESCRIPTION
- Write a COMPREHENSIVE and DETAILED paragraph of minimum 6 to 8 sentences.
- Cover: complainant identity, accused identity, what happened, when, where, amounts or losses involved, demands made, relevant background, and any evidence mentioned.

=== OUTPUT RULES ===
- Output ONLY raw JSON. No markdown, no backtick fences, no preamble, no explanation text.
- ALL enum fields must use EXACTLY the values from the schema with no abbreviations and no translations.
- ALL keys must be present in the output. Use empty string for unknown string fields. Use null for unknown date fields.

Schema:
${schemaDefinition}

Extracted Text from document (may be garbled for scanned or Hindi-font PDFs, cross-reference with images if provided):
${textToProcess}
      `;"""

content = content[:start_idx] + new_prompt + content[end_idx:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: AI prompt updated in ComplaintWizard.jsx")
