import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Row, Col, Divider, Input, message, Select, Tag, Empty, Radio, Space, Spin, Modal, List } from 'antd';
import { DownloadOutlined, ArrowLeftOutlined, SearchOutlined, FileTextOutlined, RobotOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Document, Packer, Paragraph as DocxParagraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { useAuth } from '../../hooks/useAuth';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function Enquiry({ onBack, preSelectedComplaintId }) {
  const { profile } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState(preSelectedComplaintId || null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [documentText, setDocumentText] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [showDocGen, setShowDocGen] = useState(false);
  
  // IO & Status State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showIoComplaintsModal, setShowIoComplaintsModal] = useState(false);
  const [ioList, setIoList] = useState([]);
  const [selectedIoForAssign, setSelectedIoForAssign] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState('');

  // Notice-specific state
  const [noticeRecipient, setNoticeRecipient] = useState('accused'); // 'accused' | 'complainant' | 'other'
  const [otherPersonName, setOtherPersonName] = useState('');
  const [otherPersonAddress, setOtherPersonAddress] = useState('');
  const [customSection, setCustomSection] = useState('');
  const [customSections, setCustomSections] = useState([]);

  // Email-specific state
  const [emailPrompt, setEmailPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Load all registered complaints from localStorage
  const loadComplaints = () => {
    let saved = JSON.parse(localStorage.getItem('registeredComplaints') || '[]');
    saved.sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate));
    
    // If pre-selected (coming from Search Complaints or Home view), ONLY show that complaint
    if (preSelectedComplaintId) {
      saved = saved.filter(c => c.id === preSelectedComplaintId);
      if (saved.length > 0) {
        setSelectedComplaint(saved[0]);
      }
    }
    setComplaints(saved);
  };

  useEffect(() => {
    loadComplaints();
    
    // Fetch IO list if user is SHO
    if (profile?.role === 'sho') {
      const token = localStorage.getItem('token');
      if (token) {
        fetch('http://localhost:3000/api/users/ios', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setIoList(data))
        .catch(err => console.error('Error fetching IOs:', err));
      }
    }
  }, [preSelectedComplaintId, profile]);

  const handleComplaintSelect = (id) => {
    setSelectedComplaintId(id);
    const found = complaints.find(c => c.id === id);
    setSelectedComplaint(found || null);
    setSelectedTemplate(null);
    setDocumentText('');
    setNoticeRecipient('accused');
    setOtherPersonName('');
    setOtherPersonAddress('');
    setCustomSections([]);
    setCustomSection('');
    setEmailPrompt('');
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getBaseFields = (complaint) => {
    const c = complaint || {};
    const compName = [c.firstName, c.lastName].filter(Boolean).join(' ') || '[Complainant Name]';
    const compPhone = c.mobileNumber || '[Complainant Mobile]';
    const addrParts = [c.houseNumber, c.streetName, c.colonyArea, c.villageTown, c.tehsilBlock, c.district, c.state, c.pinCode];
    const compAddress = addrParts.filter(Boolean).join(', ') || '[Complainant Address]';
    const accName = c.accusedName || '[Accused Name]';
    const accAddress = c.accusedAddress || '[Accused Address]';
    const incidentClass = c.classOfIncident || '[Class of Incident]';
    const placeOfIncident = c.placeOfIncident || '[Place of Incident]';
    const dateOfInc = c.dateOfIncident ? dayjs(c.dateOfIncident).format('DD-MM-YYYY') : '[Date of Incident]';
    const timeOfInc = c.timeOfIncident ? dayjs(c.timeOfIncident).format('HH:mm') : '[Time of Incident]';
    const actDescription = c.descriptionOfComplaint || '[Description of Complaint]';
    const complaintId = c.id || '[Complaint ID]';
    return { compName, compPhone, compAddress, accName, accAddress, incidentClass, placeOfIncident, dateOfInc, timeOfInc, actDescription, complaintId };
  };

  // Build notice addressed to the selected recipient
  const generateNoticeText = (complaint, recipient, otherName, otherAddr, extraSections) => {
    const dateToday = dayjs().format('DD-MM-YYYY');
    const f = getBaseFields(complaint);

    let toName, toAddress, subjectLine;
    if (recipient === 'complainant') {
      toName = f.compName; toAddress = f.compAddress;
      subjectLine = `Notice regarding your complaint (ID: ${f.complaintId}) filed against ${f.accName}.`;
    } else if (recipient === 'other') {
      toName = otherName || '[Recipient Name]'; toAddress = otherAddr || '[Recipient Address]';
      subjectLine = `Notice regarding complaint (ID: ${f.complaintId}) filed by ${f.compName}.`;
    } else {
      toName = f.accName; toAddress = f.accAddress;
      subjectLine = `Notice for appearance regarding complaint filed by ${f.compName}.`;
    }

    const customBlock = extraSections.length > 0
      ? '\n\nADDITIONAL DIRECTIONS:\n' + extraSections.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : '';

    return `NOTICE FOR APPEARANCE

Notice Number: _______
Date: ${dateToday}
Complaint ID: ${f.complaintId}

To,
Name: ${toName}
Address: ${toAddress}

Subject: ${subjectLine}

WHEREAS, a complaint has been registered at this Police Station by ${f.compName} (R/o ${f.compAddress}) against ${f.accName} (R/o ${f.accAddress}).

BRIEF FACT OF COMPLAINT:
The complainant alleges that an incident of "${f.incidentClass}" occurred at ${f.placeOfIncident} on ${f.dateOfInc} around ${f.timeOfInc}.

Therefore, in exercise of the powers conferred upon me, you are hereby directed to appear before the undersigned at the Police Station on __-__-____ at __:__ AM/PM for the purpose of further enquiry and to present your side of the facts along with relevant documents/evidence, if any.

Please note that failure to comply with the terms of this notice may render you liable for action under relevant provisions of law.${customBlock}


Signature of Investigating Officer
Name: _______________
Designation: _______________
Police Station: _______________`;
  };

  const generateTemplateText = (templateType, complaint) => {
    const dateToday = dayjs().format('DD-MM-YYYY');
    const f = getBaseFields(complaint);
    const { compName, compPhone, compAddress, accName, accAddress, incidentClass, placeOfIncident, dateOfInc, timeOfInc, actDescription, complaintId } = f;

    switch (templateType) {
      case 'notice':
        return generateNoticeText(complaint, noticeRecipient, otherPersonName, otherPersonAddress, customSections);

      case 'email':
        return `Subject: Status Update on Complaint Registration - ${incidentClass}

Dear Sir/Madam,

This is to officially inform you that we are in receipt of your complaint (ID: ${complaintId}) regarding the incident of "${incidentClass}".

COMPLAINT DETAILS:
- Complainant Name: ${compName}
- Complainant Contact: ${compPhone}
- Accused Named: ${accName}
- Alleged Incident Place: ${placeOfIncident}
- Date of Occurrence: ${dateOfInc}

We have documented your submission and the matter is currently under preliminary enquiry. Our Investigating Officer will be reaching out to you shortly for any further clarifications or statements required as per the procedure.

For any interim query, you may contact the Helpdesk at the undersigned Police Station.

Sincerely,

Station House Officer (SHO)
[Police Station Name]
Date: ${dateToday}`;

      case 'enquiry_rajinama':
        return `ENQUIRY REPORT - MUTUAL SETTLEMENT (RAJINAMA)

Date: ${dateToday}
Complaint ID: ${complaintId}

1. REFERENCE COMPLAINT
Complainant: ${compName}, R/o ${compAddress}, Ph: ${compPhone}
Accused: ${accName}, R/o ${accAddress}
Nature of Incident: ${incidentClass}
Date & Place of Occurrence: ${dateOfInc} at ${placeOfIncident}

2. BRIEF ALLEGATIONS
As per the contents of the complaint, the complainant alleged that:
"${actDescription}"

3. PROCEEDINGS & FINDINGS
During the course of the preliminary enquiry, both the complainant and the accused were summoned to the Police Station. After comprehensive discussions and in the presence of respectable persons from society, both parties have amicably resolved their differences.

The complainant (${compName}) has furnished a written statement stating that the matter has been resolved mutually without any coercion, threat, or undue influence. The complainant does not wish to pursue any further legal or police action regarding this matter.

4. CONCLUSION & RECOMMENDATION
Since the parties have arrived at a mutual compromise (Rajinama) and the complainant is no longer desirous of pursuing the case, no cognizable offence requiring police intervention survives.

Accordingly, it is recommended to consign this complaint to the records (File / Filed without FIR).


Submitted by:
[IO Signature]
Name/Rank: _______________`;

      case 'enquiry_civil':
        return `ENQUIRY REPORT - PROCEEDING OF CIVIL NATURE

Date: ${dateToday}
Complaint ID: ${complaintId}

1. REFERENCE COMPLAINT
Complainant: ${compName}, R/o ${compAddress}, Ph: ${compPhone}
Accused: ${accName}, R/o ${accAddress}
Subject/Category: ${incidentClass}
Date & Place of Incident: ${dateOfInc} at ${placeOfIncident}

2. BRIEF OF COMPLAINT
Briefly, the complainant states that:
"${actDescription}"

3. ENQUIRY CONDUCTED & FACTUAL POSITION
An extensive preliminary enquiry was conducted by the undersigned. The relevant documents submitted by the complainant and the statements of both parties were examined.

The scrutiny reveals that the crux of the dispute between the parties pertains to land, finances, or contractual obligations, which fundamentally falls within the contours of a Civil Dispute. The elements of mens rea (criminal intent) or a cognizable criminal offence under the BNS/LSL are entirely absent.

4. CONCLUSION & RECOMMENDATION
In light of the Honourable Supreme Court guidelines preventing the criminalization of civil disputes, police interference in this matter is strictly unwarranted.

The complainant has been properly briefed and advised to approach the appropriate Honourable Civil Court / Revenue Authority for the redressal of the grievance.

Therefore, it is recommended to file this complaint.


Submitted by:
[IO Signature]
Name/Rank: _______________`;

      case 'enquiry_ncr':
        return `NON-COGNIZABLE REPORT (NCR) / ENQUIRY REPORT

Date: ${dateToday}
Complaint ID: ${complaintId}

1. COMPLAINANT DETAILS
Name: ${compName}
Address: ${compAddress}
Contact: ${compPhone}

2. ACCUSED DETAILS
Name: ${accName}
Address: ${accAddress}

3. INCIDENT DETAILS
Category: ${incidentClass}
Date & Time: ${dateOfInc} | ${timeOfInc}
Place of Occurrence: ${placeOfIncident}

4. FACTS OF THE COMPLAINT
The complainant has reported that:
"${actDescription}"

5. IO'S OPINION & ACTION TAKEN
Upon careful perusal of the complaint and preliminary enquiry, it is concluded that the allegations raised by the complainant disclose the commission of a strictly Non-Cognizable Offence.

Accordingly, the substance of the information has been duly entered into the Daily Diary Document (Rapt/DDR). The police cannot investigate a non-cognizable case without the order of a Magistrate having power to try such cases.

The complainant, ${compName}, has been properly informed and legally advised to approach the Honourable Magistrate under the relevant sections of the BNSS for further judicial remedy.


Prepared by:
[IO Signature]
Name/Rank: _______________`;

      case 'enquiry_fir':
        return `ENQUIRY REPORT - FIR REGISTRATION RECOMMENDED

Date: ${dateToday}
Complaint ID: ${complaintId}

1. REFERENCE
Source of Complaint: Received from ${compName} (Ph: ${compPhone})
Complainant Address: ${compAddress}
Alleged Accused: ${accName}, R/o ${accAddress}

2. INCIDENT PARTICULARS
Classification: ${incidentClass}
Time, Date & Place: ${timeOfInc} on ${dateOfInc} at ${placeOfIncident}

3. GIST OF ALLEGATIONS
"${actDescription}"

4. ENQUIRY OBSERVATIONS
During the preliminary enquiry, physical and documentary constraints were gathered. Based on the facts presented and the sequence of events outlined in the complaint, prima-facie, a cognizable offence is conclusively made out against the accused person(s).

5. RECOMMENDATION
Since the allegations disclose explicit commission of a Cognizable Offence, it is legally imperative to initiate investigation. Consequently, it is strongly recommended that a First Information Report (FIR) be registered without any delay under the relevant sections of BNS / Minor Acts.

After registration of the FIR, the investigation file may kindly be handed over to the Investigating Officer for due procedures of law.


Submitted by:
[IO Signature]
Name/Rank: _______________

Forwarded to SHO for approval / FIR Registration.`;

      default:
        return '';
    }
  };

  const handleTemplateSelect = (value) => {
    setSelectedTemplate(value);
    const generatedText = generateTemplateText(value, selectedComplaint);
    setDocumentText(generatedText);
  };

  // Regenerate notice whenever recipient changes
  const handleNoticeRecipientChange = (val) => {
    setNoticeRecipient(val);
    if (val !== 'other') {
      const text = generateNoticeText(selectedComplaint, val, otherPersonName, otherPersonAddress, customSections);
      setDocumentText(text);
    }
  };

  const handleAddCustomSection = () => {
    if (!customSection.trim()) return;
    const updated = [...customSections, customSection.trim()];
    setCustomSections(updated);
    setCustomSection('');
    const text = generateNoticeText(selectedComplaint, noticeRecipient, otherPersonName, otherPersonAddress, updated);
    setDocumentText(text);
  };

  const handleRemoveCustomSection = (idx) => {
    const updated = customSections.filter((_, i) => i !== idx);
    setCustomSections(updated);
    const text = generateNoticeText(selectedComplaint, noticeRecipient, otherPersonName, otherPersonAddress, updated);
    setDocumentText(text);
  };

  const handleGenerateEmailWithAI = async () => {
    if (!emailPrompt.trim()) {
      message.warning('Please describe what you want to write in the email.');
      return;
    }
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) { message.error('Groq API key not set.'); return; }

    const f = getBaseFields(selectedComplaint);
    setIsAiLoading(true);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are a professional police officer drafting official emails for a complaint management system. 
Write formal, professional emails in English. Always include Subject line at the top.
Complaint context:
- Complaint ID: ${f.complaintId}
- Complainant: ${f.compName} (Ph: ${f.compPhone})
- Accused: ${f.accName}
- Incident: ${f.incidentClass} at ${f.placeOfIncident} on ${f.dateOfInc}
- Description: ${f.actDescription}
Output ONLY the email text, no explanation.`,
            },
            {
              role: 'user',
              content: emailPrompt,
            },
          ],
          temperature: 0.4,
          max_tokens: 800,
        }),
      });
      const data = await res.json();
      const draft = data?.choices?.[0]?.message?.content?.trim();
      if (draft) {
        setDocumentText(draft);
        message.success('Email drafted by AI!');
      } else {
        message.error('AI did not return a valid response.');
      }
    } catch (err) {
      console.error(err);
      message.error('AI request failed. Check your API key and connection.');
    } finally {
      setIsAiLoading(false);
    }
  };


  const handleDownloadDocx = () => {
    if (!documentText) {
      message.error('No document text to download.');
      return;
    }
    const lines = documentText.split('\n');
    let isFirstLine = true;
    const docxParagraphs = lines.map((line) => {
      const isEmpty = line.trim() === '';
      if (isEmpty) return new DocxParagraph({ children: [new TextRun('')] });
      if (isFirstLine) {
        isFirstLine = false;
        return new DocxParagraph({
          children: [new TextRun({ text: line, bold: true, size: 28, font: 'Arial' })],
          spacing: { after: 200 },
        });
      }
      return new DocxParagraph({
        children: [new TextRun({ text: line, font: 'Arial', size: 22 })],
        spacing: { after: 80 },
      });
    });

    const templateNames = {
      notice: 'Notice for Appearance',
      email: 'Email / Status Update',
      enquiry_rajinama: 'Enquiry — Rajinama',
      enquiry_civil: 'Enquiry — Civil Nature',
      enquiry_ncr: 'Enquiry — NCR',
      enquiry_fir: 'Enquiry — FIR Recommended',
    };

    const doc = new Document({ sections: [{ properties: {}, children: docxParagraphs }] });
    Packer.toBlob(doc).then(blob => {
      const fileKeys = {
        notice: 'Notice',
        email: 'Email_Update',
        enquiry_rajinama: 'Enquiry_Rajinama',
        enquiry_civil: 'Enquiry_Civil',
        enquiry_ncr: 'Enquiry_NCR',
        enquiry_fir: 'Enquiry_FIR',
      };
      const fileName = `${selectedComplaint?.id || 'Complaint'}_${fileKeys[selectedTemplate] || 'Document'}.docx`;
      saveAs(blob, fileName);
      message.success(`Downloaded: ${fileName}`);

      // Save applied template status back to this complaint in localStorage
      if (selectedComplaint?.id) {
        const saved = JSON.parse(localStorage.getItem('registeredComplaints') || '[]');
        const updated = saved.map(c =>
          c.id === selectedComplaint.id
            ? { ...c, appliedTemplate: templateNames[selectedTemplate] || selectedTemplate }
            : c
        );
        localStorage.setItem('registeredComplaints', JSON.stringify(updated));
      }
    }).catch(err => {
      console.error('DOCX Generation Error:', err);
      message.error('Failed to generate DOCX file.');
    });
  };

  const handleAssignIo = () => {
    if (!selectedIoForAssign || !selectedComplaint) {
      message.error('Please select an IO and ensure a complaint is selected.');
      return;
    }
    const io = ioList.find(i => i.id === selectedIoForAssign);
    if (!io) return;

    const saved = JSON.parse(localStorage.getItem('registeredComplaints') || '[]');
    const updated = saved.map(c => {
      if (c.id === selectedComplaint.id) {
        return { 
          ...c, 
          assignedIoId: io.id, 
          assignedIoName: io.full_name,
          ioStatus: 'Pending'
        };
      }
      return c;
    });
    localStorage.setItem('registeredComplaints', JSON.stringify(updated));
    message.success(`Complaint assigned to ${io.full_name}`);
    setShowAssignModal(false);
    loadComplaints();
  };

  const handleUpdateStatus = (complaintId, newStatus) => {
    const saved = JSON.parse(localStorage.getItem('registeredComplaints') || '[]');
    const updated = saved.map(c => {
      if (c.id === complaintId) {
        return { ...c, ioStatus: newStatus };
      }
      return c;
    });
    localStorage.setItem('registeredComplaints', JSON.stringify(updated));
    message.success(`Status updated successfully to ${newStatus}`);
    loadComplaints();
    if (selectedComplaint && selectedComplaint.id === complaintId) {
      setSelectedComplaint({ ...selectedComplaint, ioStatus: newStatus });
    }
  };

  const filteredComplaints = complaints.filter(c => {
    const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    const q = searchVal.toLowerCase();
    return !q || name.includes(q) || (c.id && c.id.toLowerCase().includes(q)) || (c.mobileNumber && c.mobileNumber.includes(q));
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={showDocGen ? () => setShowDocGen(false) : onBack}>Back</Button>
        <Title level={3} style={{ margin: 0 }}>
          {showDocGen ? 'Enquire Registered Complaints — Document Generation' : 'Enquire Registered Complaints'}
        </Title>
      </div>

      {!showDocGen ? (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start', padding: '16px 0' }}>
            <Button 
              type="primary" 
              size="large" 
              icon={<FileTextOutlined />} 
              onClick={() => setShowDocGen(true)}
              style={{ borderRadius: '8px', fontWeight: 'bold', width: '250px', textAlign: 'left' }}
            >
              Document Generation
            </Button>

            {profile?.role === 'sho' && (
              <>
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<PlusOutlined />} 
                  onClick={() => setShowAssignModal(true)}
                  style={{ borderRadius: '8px', fontWeight: 'bold', width: '250px', textAlign: 'left' }}
                >
                  IO Assigned
                </Button>
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<SearchOutlined />} 
                  onClick={() => setShowStatusModal(true)}
                  style={{ borderRadius: '8px', fontWeight: 'bold', width: '250px', textAlign: 'left' }}
                >
                  Status of Complaint
                </Button>
              </>
            )}

            {profile?.role === 'io' && (
              <Button 
                type="primary" 
                size="large" 
                icon={<RobotOutlined />} 
                onClick={() => setShowIoComplaintsModal(true)}
                style={{ borderRadius: '8px', fontWeight: 'bold', width: '250px', textAlign: 'left' }}
              >
                Complaints Assigned
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* Step 1: Select Complaint */}
          <Card
        title={
          <span style={{ fontWeight: 600 }}>
            Step 1: Select a Registered Complaint
          </span>
        }
        style={{ marginBottom: 24 }}
      >
        {complaints.length === 0 ? (
          <Empty
            image={<FileTextOutlined style={{ fontSize: 48, color: '#aaa' }} />}
            description={
              <span>
                No registered complaints found. Please{' '}
                <a onClick={onBack}>register a complaint</a> first.
              </span>
            }
          />
        ) : (
          <>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search complaint by ID, Name, or Mobile..."
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              style={{ maxWidth: 420, marginBottom: 16 }}
              allowClear
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 380, overflowY: 'auto' }}>
              {filteredComplaints.map(c => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown';
                const isSelected = selectedComplaintId === c.id;
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: '16px 20px',
                      border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      borderRadius: 10,
                      background: isSelected ? 'rgba(24,144,255,0.07)' : 'transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 16,
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Single row: all details side by side */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', flex: 1 }}>
                      <div style={{ minWidth: 80 }}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Complaint ID</Text>
                        <Text strong style={{ fontSize: 14 }}>{c.id}</Text>
                      </div>
                      <div style={{ minWidth: 120 }}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Complainant Name</Text>
                        <Text style={{ fontSize: 14 }}>{name}</Text>
                      </div>
                      <div style={{ minWidth: 110 }}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Mobile Number</Text>
                        <Text style={{ fontSize: 14 }}>{c.mobileNumber || '—'}</Text>
                      </div>
                      <div style={{ minWidth: 100 }}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Date Registered</Text>
                        <Text style={{ fontSize: 14 }}>{dayjs(c.registrationDate).format('DD MMM YYYY')}</Text>
                      </div>
                      <div style={{ flex: 1 }}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Incident Class</Text>
                        {c.classOfIncident
                          ? <Tag color="blue">{c.classOfIncident}</Tag>
                          : <Text type="secondary">—</Text>}
                      </div>
                      {c.appliedTemplate && (
                        <div style={{ minWidth: 120 }}>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Last Document</Text>
                          <Tag color="purple">{c.appliedTemplate}</Tag>
                        </div>
                      )}
                    </div>

                    {/* Right: Select button */}
                    <Button
                      type={isSelected ? 'primary' : 'default'}
                      onClick={() => handleComplaintSelect(c.id)}
                      style={{ minWidth: 160, fontWeight: 500, flexShrink: 0 }}
                    >
                      {isSelected 
                        ? (c.appliedTemplate ? '✓ Generated' : '✓ Selected') 
                        : (c.appliedTemplate ? 'Generate Another' : 'Select & Generate Doc')}
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Step 2: Select Template & Generate Document */}
      {selectedComplaint && (
        <Card
          title={
            <span style={{ fontWeight: 600 }}>
              Step 2: Select Document Template for Complaint <Tag color="blue">{selectedComplaint.id}</Tag>
            </span>
          }
        >
          <Row gutter={24}>
            <Col span={7}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Button
                  type={selectedTemplate === 'notice' ? 'primary' : 'default'}
                  block
                  onClick={() => handleTemplateSelect('notice')}
                >
                  Notice for Appearance
                </Button>
                <Button
                  type={selectedTemplate === 'email' ? 'primary' : 'default'}
                  block
                  onClick={() => handleTemplateSelect('email')}
                >
                  Email / Status Update
                </Button>
                <Divider style={{ margin: '8px 0', fontSize: 12 }}>Enquiry Reports</Divider>
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
                  Civil Nature (Land / Financial)
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
                  FIR Registration Recommended
                </Button>
              </div>
            </Col>

            <Col span={17}>
              {selectedTemplate ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* -- Notice Configuration Header -- */}
                  {selectedTemplate === 'notice' && (
                    <div style={{ marginBottom: 16, padding: '16px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid #434343', borderRadius: 8 }}>
                      <Text strong style={{ display: 'block', marginBottom: 12 }}>Notice Recipient:</Text>
                      <Radio.Group 
                        value={noticeRecipient} 
                        onChange={e => handleNoticeRecipientChange(e.target.value)}
                        style={{ marginBottom: 16 }}
                      >
                        <Radio value="accused">Accused</Radio>
                        <Radio value="complainant">Complainant</Radio>
                        <Radio value="other">Other Person</Radio>
                      </Radio.Group>

                      {noticeRecipient === 'other' && (
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                          <Col span={10}>
                            <Input 
                              placeholder="Name" 
                              value={otherPersonName} 
                              onChange={e => setOtherPersonName(e.target.value)} 
                              onBlur={() => handleNoticeRecipientChange('other')}
                            />
                          </Col>
                          <Col span={14}>
                            <Input 
                              placeholder="Full Address" 
                              value={otherPersonAddress} 
                              onChange={e => setOtherPersonAddress(e.target.value)}
                              onBlur={() => handleNoticeRecipientChange('other')}
                            />
                          </Col>
                        </Row>
                      )}
                    </div>
                  )}

                  {/* -- Email Configuration Header -- */}
                  {selectedTemplate === 'email' && (
                    <div style={{ marginBottom: 16, padding: '16px', background: 'rgba(24, 144, 255, 0.1)', borderRadius: 8, border: '1px solid rgba(24, 144, 255, 0.3)' }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, color: '#1890ff' }}>
                        <RobotOutlined style={{ marginRight: 6 }} />
                        Draft Email with AI
                      </Text>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
                        The AI knows the details of Complaint {selectedComplaint?.id}. Just tell it who to email and what to say.
                      </Text>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                        <TextArea 
                          rows={2} 
                          placeholder="E.g., Write an email to the SHO requesting more time because the accused is out of town." 
                          value={emailPrompt}
                          onChange={e => setEmailPrompt(e.target.value)}
                          style={{ resize: 'none' }}
                        />
                        <Button 
                          type="primary" 
                          icon={<RobotOutlined />} 
                          style={{ height: 'auto', minWidth: 140, fontWeight: 500 }}
                          onClick={handleGenerateEmailWithAI}
                          loading={isAiLoading}
                        >
                          Draft Email
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* -- Actions & Editor -- */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                    <Text strong>Document Preview:</Text>
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={handleDownloadDocx}
                      disabled={!documentText}
                    >
                      Download as DOCX
                    </Button>
                  </div>
                  
                  <Spin spinning={isAiLoading} tip="AI is drafting the email...">
                    <TextArea
                      rows={selectedTemplate === 'notice' || selectedTemplate === 'email' ? 14 : 22}
                      value={documentText}
                      onChange={e => setDocumentText(e.target.value)}
                      style={{ fontSize: 14, lineHeight: '1.7', fontFamily: 'monospace', width: '100%' }}
                    />
                  </Spin>
                  
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                    You can edit the text directly above before downloading.
                  </Text>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: '#aaa' }}>
                  ← Select a template to auto-generate the document with complaint data.
                </div>
              )}
            </Col>
          </Row>
        </Card>
      )}
        </>
      )}

      {/* MODAL: SHO Assigns IO */}
      <Modal
        title="Assign IO to Complaint"
        open={showAssignModal}
        onCancel={() => setShowAssignModal(false)}
        onOk={handleAssignIo}
        okText="Assign IO"
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Selected Complaint ID: </Text>
          <Text>{selectedComplaint?.id || 'None selected'}</Text>
        </div>
        {selectedComplaint?.id ? (
          <div>
            <Text>Select Investigating Officer:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select an IO"
              value={selectedIoForAssign}
              onChange={setSelectedIoForAssign}
            >
              {ioList.map(io => (
                <Option key={io.id} value={io.id}>{io.username} - {io.full_name}</Option>
              ))}
            </Select>
          </div>
        ) : (
          <Empty description="No complaint selected. Please select a complaint first." />
        )}
      </Modal>

      {/* MODAL: SHO Checks Status of ALL Assigned Complaints */}
      <Modal
        title="Status of Complaints"
        open={showStatusModal}
        onCancel={() => setShowStatusModal(false)}
        footer={[<Button key="close" onClick={() => setShowStatusModal(false)}>Close</Button>]}
        width={680}
      >
        {(() => {
          const assigned = complaints.filter(c => c.assignedIoId);
          if (assigned.length === 0) {
            return <Empty description="No complaints have been assigned to any IO yet." />;
          }
          return assigned.map((c, idx) => {
            const statusColor =
              c.ioStatus === 'Under Investigation' ? 'blue' :
              c.ioStatus === 'Disposed' ? 'purple' :
              c.ioStatus === 'Convert to FIR' ? 'red' : 'orange';
            return (
              <Card
                key={c.id}
                size="small"
                style={{ marginBottom: 12, borderLeft: '4px solid #1890ff' }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text strong>#{idx + 1} &nbsp; {c.id}</Text>
                    <Tag color={statusColor}>{c.ioStatus || 'Pending'}</Tag>
                  </div>
                }
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <span><Text type="secondary">Complainant: </Text><Text>{c.firstName} {c.lastName}</Text></span>
                  <span><Text type="secondary">Date: </Text><Text>{dayjs(c.registrationDate).format('DD MMM YYYY')}</Text></span>
                  <span><Text type="secondary">Assigned To: </Text><Tag color="cyan">{c.assignedIoName}</Tag></span>
                </div>
              </Card>
            );
          });
        })()}
      </Modal>
      {/* MODAL: IO Checks ALL Assigned Complaints + Update Status */}
      <Modal
        title="Complaints Assigned to You"
        open={showIoComplaintsModal}
        onCancel={() => setShowIoComplaintsModal(false)}
        footer={null}
        width={700}
      >
        {/* IO Details */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20, padding: '10px 14px', borderRadius: 8, border: '1px solid #1890ff' }}>
          <Text><strong>Name:</strong> {profile?.full_name || profile?.username || 'N/A'}</Text>
          <Text><strong>Username:</strong> {profile?.username || 'N/A'}</Text>
          <Text><strong>Role:</strong> Investigating Officer</Text>
        </div>

        {/* List of assigned complaints */}
        {(() => {
          const assigned = complaints.filter(c => String(c.assignedIoId).trim() === String(profile?.id).trim());
          if (assigned.length === 0) {
            return <Empty description="No complaints assigned to you yet." />;
          }
          return assigned.map((c, idx) => {
            const statusColor =
              c.ioStatus === 'Under Investigation' ? 'blue' :
              c.ioStatus === 'Disposed' ? 'purple' :
              c.ioStatus === 'Convert to FIR' ? 'red' : 'orange';
            return (
              <Card
                key={c.id}
                size="small"
                style={{ marginBottom: 16, borderLeft: '4px solid #1890ff' }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text strong>#{idx + 1} &nbsp; Complaint ID: {c.id}</Text>
                    <Tag color={statusColor}>{c.ioStatus || 'Pending'}</Tag>
                  </div>
                }
              >
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary">Complainant: </Text>
                  <Text>{c.firstName} {c.lastName}</Text>
                  <Text type="secondary" style={{ marginLeft: 16 }}>Date: </Text>
                  <Text>{dayjs(c.registrationDate).format('DD MMM YYYY')}</Text>
                  <Text type="secondary" style={{ marginLeft: 16 }}>Class: </Text>
                  <Tag color="blue">{c.classOfIncident || 'N/A'}</Tag>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Pending', 'Under Investigation', 'Disposed', 'Convert to FIR'].map(status => (
                    <Button
                      key={status}
                      size="middle"
                      type={(c.ioStatus || 'Pending') === status ? 'primary' : 'default'}
                      danger={status === 'Convert to FIR' && (c.ioStatus || 'Pending') === status}
                      onClick={() => handleUpdateStatus(c.id, status)}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </Card>
            );
          });
        })()}
      </Modal>

    </div>
  );
}
