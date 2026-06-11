import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Typography, Row, Col, Divider, Input, message, Select, Tag, Empty, Radio, Space, Spin, Modal, List, Checkbox, Upload, Alert, Popover } from 'antd';
import { DownloadOutlined, ArrowLeftOutlined, SearchOutlined, FileTextOutlined, RobotOutlined, PlusOutlined, SwapOutlined, CheckCircleOutlined, EyeOutlined, UploadOutlined, DeleteOutlined, PaperClipOutlined } from '@ant-design/icons';
import { districts, policeStationsByDistrict } from '../../data/districtPoliceStations';
import dayjs from 'dayjs';
import { Document, Packer, Paragraph as DocxParagraph, TextRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType as DocxWidthType, BorderStyle as DocxBorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { useAuth } from '../../hooks/useAuth';
import { useWhisperSTT } from '../../hooks/useWhisperSTT';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function Enquiry({ onBack, preSelectedComplaintId }) {
  const { profile, token } = useAuth();
  const editorRef = useRef(null);
  const localHtmlRef = useRef('');
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState(() => sessionStorage.getItem('enquiry_selectedComplaintId') || preSelectedComplaintId || null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(() => sessionStorage.getItem('enquiry_selectedTemplate') || null);
  const [documentText, setDocumentText] = useState(() => sessionStorage.getItem('enquiry_documentText') || '');
  const [searchVal, setSearchVal] = useState('');
  const [showDocGen, setShowDocGen] = useState(() => sessionStorage.getItem('enquiry_showDocGen') === 'true');
  
  // IO & Status State
  const [showAssignModal, setShowAssignModal] = useState(() => sessionStorage.getItem('enquiry_showAssignModal') === 'true');
  const [showStatusModal, setShowStatusModal] = useState(() => sessionStorage.getItem('enquiry_showStatusModal') === 'true');

  // Transfer State (SHO only)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDistrict, setTransferDistrict] = useState('');
  const [transferPS, setTransferPS] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [showIoComplaintsModal, setShowIoComplaintsModal] = useState(() => sessionStorage.getItem('enquiry_showIoComplaintsModal') === 'true');

  // IO & SHO Investigation Report State
  const [showIoReportModal, setShowIoReportModal] = useState(false);
  const [activeReportComplaintId, setActiveReportComplaintId] = useState(null);
  const [ioReportText, setIoReportText] = useState('');
  const [ioAttachedFiles, setIoAttachedFiles] = useState([]);
  
  const [showShoReportModal, setShowShoReportModal] = useState(false);
  const [shoViewReportText, setShoViewReportText] = useState('');
  const [shoViewAttachedFiles, setShoViewAttachedFiles] = useState([]);

  // File Preview State
  const [previewFile, setPreviewFile] = useState(null);

  const handleClosePreview = () => {
    if (previewFile && typeof previewFile === 'object' && previewFile.url) {
      URL.revokeObjectURL(previewFile.url);
    }
    setPreviewFile(null);
  };

  useEffect(() => {
    sessionStorage.setItem('enquiry_showDocGen', showDocGen);
  }, [showDocGen]);

  useEffect(() => {
    sessionStorage.setItem('enquiry_showAssignModal', showAssignModal);
  }, [showAssignModal]);

  useEffect(() => {
    sessionStorage.setItem('enquiry_showStatusModal', showStatusModal);
  }, [showStatusModal]);

  useEffect(() => {
    sessionStorage.setItem('enquiry_showIoComplaintsModal', showIoComplaintsModal);
  }, [showIoComplaintsModal]);
  useEffect(() => {
    if (selectedComplaintId) {
      sessionStorage.setItem('enquiry_selectedComplaintId', selectedComplaintId);
    } else {
      sessionStorage.removeItem('enquiry_selectedComplaintId');
    }
  }, [selectedComplaintId]);

  useEffect(() => {
    if (selectedTemplate) {
      sessionStorage.setItem('enquiry_selectedTemplate', selectedTemplate);
    } else {
      sessionStorage.removeItem('enquiry_selectedTemplate');
    }
  }, [selectedTemplate]);

  useEffect(() => {
    sessionStorage.setItem('enquiry_documentText', documentText);
  }, [documentText]);

  // Notice template tracking states — declared here (before their useEffects to avoid TDZ)
  const [noticeIsDefault, setNoticeIsDefault] = useState(
    () => sessionStorage.getItem('enquiry_noticeIsDefault') === 'true'
  );
  const [currentUploadedTemplateId, setCurrentUploadedTemplateId] = useState(
    () => sessionStorage.getItem('enquiry_currentUploadedTemplateId') || null
  );

  useEffect(() => {
    sessionStorage.setItem('enquiry_noticeIsDefault', noticeIsDefault);
  }, [noticeIsDefault]);

  useEffect(() => {
    sessionStorage.setItem('enquiry_currentUploadedTemplateId', currentUploadedTemplateId || '');
  }, [currentUploadedTemplateId]);

  // Email template tracking states
  const [emailRecipient, setEmailRecipient] = useState(
    () => sessionStorage.getItem('enquiry_emailRecipient') || 'complainant'
  );
  const [emailOtherPersonName, setEmailOtherPersonName] = useState(
    () => sessionStorage.getItem('enquiry_emailOtherPersonName') || ''
  );
  const [emailOtherPersonAddress, setEmailOtherPersonAddress] = useState(
    () => sessionStorage.getItem('enquiry_emailOtherPersonAddress') || ''
  );
  const [emailSelectedAccusedIndices, setEmailSelectedAccusedIndices] = useState(
    () => {
      try {
        return JSON.parse(sessionStorage.getItem('enquiry_emailSelectedAccusedIndices')) || [];
      } catch (_) {
        return [];
      }
    }
  );

  useEffect(() => {
    sessionStorage.setItem('enquiry_emailRecipient', emailRecipient);
  }, [emailRecipient]);

  useEffect(() => {
    sessionStorage.setItem('enquiry_emailOtherPersonName', emailOtherPersonName);
  }, [emailOtherPersonName]);

  useEffect(() => {
    sessionStorage.setItem('enquiry_emailOtherPersonAddress', emailOtherPersonAddress);
  }, [emailOtherPersonAddress]);

  useEffect(() => {
    sessionStorage.setItem('enquiry_emailSelectedAccusedIndices', JSON.stringify(emailSelectedAccusedIndices));
  }, [emailSelectedAccusedIndices]);

  const [ioList, setIoList] = useState([]);
  const [selectedIoForAssign, setSelectedIoForAssign] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState('');

  // Notice-specific state
  const [noticeRecipient, setNoticeRecipient] = useState('accused'); // 'accused' | 'complainant' | 'other'
  const [otherPersonName, setOtherPersonName] = useState('');
  const [otherPersonAddress, setOtherPersonAddress] = useState('');
  const [customSection, setCustomSection] = useState('');
  const [customSections, setCustomSections] = useState([]);
  const [selectedAccusedIndices, setSelectedAccusedIndices] = useState([]);

  // Email-specific state
  const [emailPrompt, setEmailPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isReportTranslating, setIsReportTranslating] = useState(false);

  // Enquiry Report modification prompt state
  const [reportPrompt, setReportPrompt] = useState('');

  // Custom templates state
  const [customTemplates, setCustomTemplates] = useState(() => 
    JSON.parse(localStorage.getItem('custom_document_templates') || '[]')
  );

  // Saved draft state
  const [savedDraft, setSavedDraft] = useState(null);

  // Whisper STT Hook
  // Whisper STT Hook
  const activeSpanIdRef = useRef(null);

  const {
    isRecording,
    isTranscribing,
    toggleRecording,
    stopAndRestart
  } = useWhisperSTT({
    onStart: (spanId) => {
      if (editorRef.current) {
        editorRef.current.focus();
        
        const targetId = spanId || `whisper-temp-${Date.now()}`;
        activeSpanIdRef.current = targetId;

        // Remove any old interim span with this target ID if any
        const oldSpan = editorRef.current.querySelector(`#${targetId}`);
        if (oldSpan) oldSpan.remove();

        const sel = window.getSelection();
        if (sel.rangeCount) {
          const range = sel.getRangeAt(0);
          const tempSpan = document.createElement('span');
          tempSpan.id = targetId;
          tempSpan.style.color = '#1890ff';
          tempSpan.style.borderBottom = '1px dashed #1890ff';
          tempSpan.style.backgroundColor = 'rgba(24, 144, 255, 0.08)';
          tempSpan.style.padding = '2px 4px';
          tempSpan.style.borderRadius = '3px';
          tempSpan.style.fontStyle = 'italic';
          tempSpan.innerText = ' (Listening...)';
          
          range.deleteContents();
          range.insertNode(tempSpan);
          
          // Move cursor after the span
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          editorRef.current.innerHTML += ` <span id="${targetId}" style="color: #1890ff; border-bottom: 1px dashed #1890ff; background-color: rgba(24, 144, 255, 0.08); padding: 2px 4px; border-radius: 3px; font-style: italic;"> (Listening...)</span> `;
        }
        const html = editorRef.current.innerHTML;
        localHtmlRef.current = html;
        setDocumentText(html);
      }
    },
    onInterim: (text, spanId) => {
      if (editorRef.current && spanId) {
        const tempSpan = editorRef.current.querySelector(`#${spanId}`);
        if (tempSpan) {
          tempSpan.innerText = ` ${text}`;
          const html = editorRef.current.innerHTML;
          localHtmlRef.current = html;
          setDocumentText(html);
        }
      }
    },
    onTranscribing: (spanId) => {
      if (editorRef.current && spanId) {
        const tempSpan = editorRef.current.querySelector(`#${spanId}`);
        if (tempSpan) {
          tempSpan.style.color = '#faad14';
          tempSpan.style.borderBottom = '1px dashed #faad14';
          tempSpan.style.backgroundColor = 'rgba(250, 173, 20, 0.08)';
          tempSpan.innerText = ' (Transcribing...)';
          const html = editorRef.current.innerHTML;
          localHtmlRef.current = html;
          setDocumentText(html);
        }
      }
    },
    onSuccess: (text, spanId) => {
      if (editorRef.current && spanId) {
        const tempSpan = editorRef.current.querySelector(`#${spanId}`);
        if (tempSpan) {
          const textNode = document.createTextNode(` ${text} `);
          tempSpan.parentNode.replaceChild(textNode, tempSpan);
        } else {
          editorRef.current.focus();
          try {
            document.execCommand('insertText', false, ` ${text} `);
          } catch (err) {
            editorRef.current.innerHTML += ` ${text} `;
          }
        }
        const html = editorRef.current.innerHTML;
        localHtmlRef.current = html;
        setDocumentText(html);
      }
    },
    onFailure: (spanId) => {
      if (editorRef.current && spanId) {
        const tempSpan = editorRef.current.querySelector(`#${spanId}`);
        if (tempSpan) {
          tempSpan.remove();
          const html = editorRef.current.innerHTML;
          localHtmlRef.current = html;
          setDocumentText(html);
        }
      }
    }
  });

  const handleVoiceToggle = () => {
    if (isRecording) {
      toggleRecording();
    } else {
      const initialId = `whisper-temp-${Date.now()}`;
      toggleRecording(initialId);
    }
  };

  const [reportInterimText, setReportInterimText] = useState('');

  const {
    isRecording: reportIsRecording,
    isTranscribing: reportIsTranscribing,
    toggleRecording: reportToggleRecording
  } = useWhisperSTT({
    onStart: () => {
      setReportInterimText('');
    },
    onInterim: (text) => {
      setReportInterimText(text);
    },
    onTranscribing: () => {
      setReportInterimText('');
    },
    onSuccess: (text) => {
      setIoReportText(prev => {
        const base = prev ? prev.trim() : '';
        return base ? `${base} ${text}` : text;
      });
      setReportInterimText('');
    },
    onFailure: () => {
      setReportInterimText('');
    }
  });

  const handleReportVoiceToggle = () => {
    reportToggleRecording();
  };

  const handleEditorClickOrKey = (e) => {
    if (!isRecording) return;

    // Check key presses: we only care about cursor movements like arrow keys
    if (e.type === 'keyup') {
      const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Tab'];
      if (!allowedKeys.includes(e.key)) {
        return;
      }
    }

    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      
      const anchorNode = sel.anchorNode;
      const activeSpan = editorRef.current?.querySelector(`#${activeSpanIdRef.current}`);
      
      if (activeSpan) {
        const isInsideActive = activeSpan.contains(anchorNode) || anchorNode === activeSpan;
        if (!isInsideActive) {
          // User clicked/moved selection to a new cell/column!
          const newSpanId = `whisper-temp-${Date.now()}`;
          // Stop current recording chunk and restart in the new cell
          stopAndRestart(newSpanId);
        }
      }
    }, 50);
  };

  // When documentText changes from outside (e.g., translation, template select, draft resume)
  useEffect(() => {
    if (editorRef.current && documentText !== localHtmlRef.current) {
      editorRef.current.innerHTML = documentText || '';
      localHtmlRef.current = documentText || '';
    }
  }, [documentText]);

  // Load saved draft on complaint select
  useEffect(() => {
    if (selectedComplaint) {
      const drafts = JSON.parse(localStorage.getItem('enquiry_drafts') || '{}');
      const draft = drafts[selectedComplaint.id];
      if (draft) {
        setSavedDraft(draft);
      } else {
        setSavedDraft(null);
      }
    } else {
      setSavedDraft(null);
    }
  }, [selectedComplaint]);

  useEffect(() => {
    // Add keyframes for recording pulse animation & document editor table styles
    const styleId = 'pulse-animation-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(255, 77, 79, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
        }
        .document-editor-container {
          word-break: break-word;
          overflow-wrap: break-word;
          word-wrap: break-word;
        }
        .document-editor-container table {
          border-collapse: collapse;
          width: 100%;
          max-width: 100%;
          margin: 16px 0;
          background-color: rgba(255, 255, 255, 0.02);
          table-layout: auto;
        }
        .document-editor-container table, .document-editor-container th, .document-editor-container td {
          border: 1px solid #434343;
        }
        .document-editor-container th, .document-editor-container td {
          padding: 10px 14px;
          min-height: 32px;
          text-align: left;
          color: #f0f6fc;
          word-break: break-word;
          overflow-wrap: break-word;
          word-wrap: break-word;
          white-space: pre-wrap;
        }
        .document-editor-container th {
          background-color: rgba(255, 255, 255, 0.05);
          font-weight: 600;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleUploadTemplate = async (category, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    message.loading({ content: `Uploading & parsing "${file.name}"...`, key: 'uploadTemplate' });
    
    try {
      const res = await fetch('/api/templates/parse', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: formData
      });
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Your session has expired or is unauthorized. Please log out and log in again.');
        }
        let errorMsg = 'Failed to parse file';
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch (_) {
          try {
            errorMsg = await res.text() || errorMsg;
          } catch (__) {}
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const extractedText = data.text || '';

      const newTemplate = {
        id: `custom_${Date.now()}`,
        category,
        name: file.name,
        content: extractedText
      };

      const updated = [...customTemplates, newTemplate];
      setCustomTemplates(updated);
      localStorage.setItem('custom_document_templates', JSON.stringify(updated));
      message.success({ content: `Template "${file.name}" uploaded successfully!`, key: 'uploadTemplate', duration: 3 });
      
      // Auto-select the uploaded template immediately
      handleTemplateSelect(newTemplate.id, updated);
    } catch (err) {
      console.error(err);
      message.error({ content: `Upload failed: ${err.message}`, key: 'uploadTemplate', duration: 4 });
    }
  };

  const handleDeleteTemplate = (id) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem('custom_document_templates', JSON.stringify(updated));
    message.success('Template deleted.');
    if (selectedTemplate === id) {
      setSelectedTemplate(null);
      setDocumentText('');
    }
  };

  // recipientCtx (optional): { toName, toAddress, toType } for notice recipient-aware placeholders
  const fillTemplatePlaceholders = (text, complaint, recipientCtx = null) => {
    if (!text) return '';
    const f = getBaseFields(complaint);
    const dateToday = dayjs().format('DD-MM-YYYY');

    // Recipient-aware substitutions (used in notice templates)
    const toName    = recipientCtx?.toName    ?? f.accName;
    const toAddress = recipientCtx?.toAddress ?? f.accAddress;
    const toType    = recipientCtx?.toType    ?? 'उत्तरवादी';

    // When sending notice to specific accused — override {{accusedName}} with the selected ones
    // This makes templates using {{accusedName}} work without requiring {{toName}} placeholder
    const dynamicAccName    = (recipientCtx && toType === 'उत्तरवादी') ? toName    : f.accName;
    const dynamicAccAddress = (recipientCtx && toType === 'उत्तरवादी') ? toAddress : f.accAddress;

    const ps = complaint?.policeStation || (profile?.policeStation) || '_______';
    const dist = complaint?.district || (profile?.district) || '_______';
    const formattedRegDate = complaint?.registrationDate
      ? dayjs(complaint.registrationDate).format('DD/MM/YYYY')
      : (complaint?.dateOfComplaint ? dayjs(complaint.dateOfComplaint).format('DD/MM/YYYY') : '_______');
    const appearanceDate = dayjs().add(7, 'day').format('DD/MM/YYYY');
    const email = `sho${ps.toLowerCase().replace(/\s+/g, '')}@gmail.com`;

    let resultText = text
      // Recipient-aware placeholders (for uploaded notice templates)
      .replace(/\{\{toName\}\}/g, toName)
      .replace(/\{\{toAddress\}\}/g, toAddress)
      .replace(/\{\{toType\}\}/g, toType)
      .replace(/\{\{noticeToName\}\}/g, toName)
      .replace(/\{\{noticeToAddress\}\}/g, toAddress)
      .replace(/\{\{noticeToType\}\}/g, toType)
      // Standard complaint placeholders (accused overridden when recipient context given)
      .replace(/\{\{complaintId\}\}/g, f.complaintId)
      .replace(/\$\{complaintId\}/g, f.complaintId)
      .replace(/\{\{complainantName\}\}/g, f.compName)
      .replace(/\$\{compName\}/g, f.compName)
      .replace(/\{\{complainantPhone\}\}/g, f.compPhone)
      .replace(/\$\{compPhone\}/g, f.compPhone)
      .replace(/\{\{complainantAddress\}\}/g, f.compAddress)
      .replace(/\$\{compAddress\}/g, f.compAddress)
      .replace(/\{\{accusedName\}\}/g, dynamicAccName)
      .replace(/\$\{accName\}/g, dynamicAccName)
      .replace(/\{\{accusedAddress\}\}/g, dynamicAccAddress)
      .replace(/\$\{accAddress\}/g, dynamicAccAddress)
      .replace(/\{\{accusedInlineBlock\}\}/g, f.accusedInlineBlock)
      .replace(/\{\{accusedDetailsBlock\}\}/g, f.accusedDetailsBlock)
      .replace(/\{\{incidentClass\}\}/g, f.incidentClass)
      .replace(/\$\{incidentClass\}/g, f.incidentClass)
      .replace(/\{\{placeOfIncident\}\}/g, f.placeOfIncident)
      .replace(/\$\{placeOfIncident\}/g, f.placeOfIncident)
      .replace(/\{\{dateOfIncident\}\}/g, f.dateOfInc)
      .replace(/\$\{dateOfInc\}/g, f.dateOfInc)
      .replace(/\{\{timeOfIncident\}\}/g, f.timeOfInc)
      .replace(/\$\{timeOfInc\}/g, f.timeOfInc)
      .replace(/\{\{dateToday\}\}/g, dateToday)
      .replace(/\{\{date\}\}/g, dateToday)
      .replace(/\$\{dateToday\}/g, dateToday);

    // Smart replacement of hardcoded test values from Notice_Transcribed.docx & SHO_Official_Email_Hindi.docx
    // 1. Complaint ID (485-Peshi):
    resultText = resultText.replace(/485-Peshi/g, f.complaintId);

    // 2. Dates:
    // Registration Date (20/04/2026):
    resultText = resultText.replace(/20\/04\/2026/g, formattedRegDate);
    // Appearance Date (04/06/2026):
    resultText = resultText.replace(/04\/06\/2026/g, appearanceDate);
    // Support if it is written as 17/06/2026 or 18/06/2026
    resultText = resultText.replace(/(?:17|18)\/06\/2026/g, appearanceDate);

    // 3. Email (shosamalkha@gmail.com):
    resultText = resultText.replace(/shosamalkha@gmail\.com/g, email);

    // 4. Police Station & District references:
    resultText = resultText.replace(/थाना\s+समालखा,\s+जिला\s+पानीपत/g, `थाना ${ps}, जिला ${dist}`);
    resultText = resultText.replace(/थाना\s+समालखा\s+पानीपत/g, `थाना ${ps} ${dist}`);

    // 5. Dynamic Recipient Types:
    resultText = resultText.replace(/आप\s+उत्तरवादी\s+को/g, `आप ${toType} <strong>${toName}</strong> को`);
    resultText = resultText.replace(/आप\s+परिवादी\s+को/g, `आप ${toType} <strong>${toName}</strong> को`);

    // 6. Complainant / Recipient names & addresses replacement:
    if (/रामधन\s+सरपंच/.test(resultText)) {
      const regex = /परिवादी\s+(?:श्री\s+)?रामधन\s+सरपंच(?:\s+गांव\s+राक्?सेडा(?:\s+थाना\s+समालखा\s+पानीपत)?)?/g;
      let matchCount = 0;
      resultText = resultText.replace(regex, (match) => {
        matchCount++;
        if (matchCount === 1) {
          return `परिवादी ${f.compName} निवासी ${f.compAddress}`;
        } else {
          return `${toType} ${toName} निवासी ${toAddress}`;
        }
      });

      // Also replace isolated complainant name if any left
      resultText = resultText.replace(/(?:श्री\s+)?रामधन\s+सरपंच/g, f.compName);
    }

    // 7. Spaced header placeholders at the top
    resultText = resultText.replace(/थाना\s*-\s*(\s{5,})\s*जिला\s*-\s*/g, 'थाना - ' + ps + '$1जिला- ' + dist);
    // Replace any empty district/station references:
    resultText = resultText.replace(/थाना\s*-\s* जिला\s*-\s*$/g, `थाना - ${ps} जिला- ${dist}`);

    return resultText;
  };

  // Build recipient context object based on current UI selection
  const getRecipientContext = (recipient, selAccusedInds = [], isEmail = false) => {
    const c = selectedComplaint || {};
    const f = getBaseFields(selectedComplaint);
    if (recipient === 'complainant') {
      return { toName: f.compName, toAddress: f.compAddress, toType: 'परिवादी' };
    } else if (recipient === 'other') {
      return {
        toName: (isEmail ? emailOtherPersonName : otherPersonName) || '_______',
        toAddress: (isEmail ? emailOtherPersonAddress : otherPersonAddress) || '_______',
        toType: 'अन्य व्यक्ति'
      };
    } else {
      // accused — respect specific selection
      const rawList = (c.accusedList && c.accusedList.length > 0)
        ? c.accusedList
        : (c.accusedName ? [{ name: c.accusedName, address: c.accusedAddress || '' }] : [{ name: '[Accused Name]', address: '' }]);
      const selected = selAccusedInds && selAccusedInds.length > 0
        ? rawList.filter((_, i) => selAccusedInds.includes(i))
        : rawList;
      return {
        toName: selected.map(a => a.name).join(', '),
        toAddress: selected.map(a => a.address || '_______').join(' / '),
        toType: 'उत्तरवादी'
      };
    }
  };

  // Re-fill an uploaded template with updated recipient context
  // Returns the refilled HTML string, or null if no template found
  const refillUploadedTemplate = (templateId, recipient, selAccusedInds, category = 'notice', allTemplates = customTemplates) => {
    // Fallback: find any uploaded template in this category if ID is missing (e.g. after page reload)
    const tmpl = allTemplates.find(t => t.id === templateId)
      || allTemplates.find(t => t.category === category);
    if (!tmpl) return null;
    // Update currentUploadedTemplateId if it was null
    if (!templateId || templateId !== tmpl.id) {
      setCurrentUploadedTemplateId(tmpl.id);
    }
    const isEmail = (category === 'email');
    const ctx = getRecipientContext(recipient, selAccusedInds, isEmail);
    return fillTemplatePlaceholders(tmpl.content, selectedComplaint, ctx);
  };

  // handleToggleRecording replaced by useWhisperSTT hook

  const handleTranslateReportToEnglish = async () => {
    if (!ioReportText.trim()) {
      message.warning('There is no text to translate.');
      return;
    }
    setIsReportTranslating(true);
    const hideLoading = message.loading({ content: 'Translating report to English...', key: 'translateReportMsg', duration: 0 });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints/extract`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are an expert translator specializing in legal documents and police communications for Haryana Police.
Translate the text provided by the user into formal English suitable for official police reports and investigation documents.
Preserve all formatting, names, dates, and numbers exactly as they are.
Only output the translated text. Do not include any explanations, preambles, or markdown formatting.`
            },
            {
              role: 'user',
              content: ioReportText
            }
          ],
          temperature: 0.1
        })
      });

      if (!res.ok) throw new Error('Translation request failed.');
      const data = await res.json();
      const translated = data?.choices?.[0]?.message?.content?.trim();
      if (translated) {
        setIoReportText(translated);
        message.success({ content: 'Report translated to English!', key: 'translateReportMsg', duration: 2 });
      } else {
        message.error({ content: 'AI translation failed.', key: 'translateReportMsg', duration: 2 });
      }
    } catch (err) {
      console.error(err);
      message.error({ content: 'Translation failed: ' + err.message, key: 'translateReportMsg', duration: 2 });
    } finally {
      setIsReportTranslating(false);
      hideLoading();
    }
  };

  const handleTranslate = async (targetLang) => {
    if (!documentText.trim()) {
      message.warning('There is no text to translate.');
      return;
    }
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      message.error('Groq API key is not set in environment variables.');
      return;
    }

    setIsAiLoading(true);
    message.loading({ content: `Translating document to ${targetLang}...`, key: 'translateMsg' });
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are an expert translator specializing in legal documents and police communications for Haryana Police.
Translate the HTML content provided by the user into ${targetLang === 'English' ? 'formal English suitable for official police reports' : 'formal Hindi (in Devanagari script) suitable for official police records'}.
Maintain all HTML structure, tables, columns, rows, spacing, and tags exactly as they are. Translate only the content inside the tags.
Do not lose any formatting or table cells.
Maintain all placeholders (like {{complaintId}}, {{complainantName}}, {{accusedName}}), numbers, dates, and proper names exactly as they are.
Only output the translated HTML. Do not include any explanations, preambles, or additional conversational text.`,
            },
            {
              role: 'user',
              content: documentText,
            },
          ],
          temperature: 0.2,
          max_tokens: 4000,
        }),
      });
      const data = await res.json();
      const translated = data?.choices?.[0]?.message?.content?.trim();
      if (translated) {
        let cleaned = translated;
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```html\s*|\s*```$/gi, '');
        }
        setDocumentText(cleaned);
        message.success({ content: `Document translated to ${targetLang}!`, key: 'translateMsg', duration: 2 });
      } else {
        message.error({ content: 'AI translation failed.', key: 'translateMsg', duration: 2 });
      }
    } catch (err) {
      console.error(err);
      message.error({ content: 'Translation request failed.', key: 'translateMsg', duration: 2 });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!selectedComplaint) return;
    
    const drafts = JSON.parse(localStorage.getItem('enquiry_drafts') || '{}');
    drafts[selectedComplaint.id] = {
      templateId: selectedTemplate,
      documentText,
      noticeRecipient,
      otherPersonName,
      otherPersonAddress,
      customSections,
      selectedAccusedIndices,
      emailRecipient,
      emailOtherPersonName,
      emailOtherPersonAddress,
      emailSelectedAccusedIndices,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem('enquiry_drafts', JSON.stringify(drafts));
    message.success('Draft saved successfully! You can resume it anytime.');
  };

  const handleResumeDraft = () => {
    if (!savedDraft) return;
    setSelectedTemplate(savedDraft.templateId);
    setDocumentText(savedDraft.documentText);
    setNoticeRecipient(savedDraft.noticeRecipient || 'accused');
    setOtherPersonName(savedDraft.otherPersonName || '');
    setOtherPersonAddress(savedDraft.otherPersonAddress || '');
    setCustomSections(savedDraft.customSections || []);
    setSelectedAccusedIndices(savedDraft.selectedAccusedIndices || []);
    setEmailRecipient(savedDraft.emailRecipient || 'complainant');
    setEmailOtherPersonName(savedDraft.emailOtherPersonName || '');
    setEmailOtherPersonAddress(savedDraft.emailOtherPersonAddress || '');
    setEmailSelectedAccusedIndices(savedDraft.emailSelectedAccusedIndices || []);
    setSavedDraft(null); // Clear the alert once resumed
    message.success('Draft loaded successfully!');
  };

  const handleDiscardDraft = () => {
    if (!selectedComplaint) return;
    const drafts = JSON.parse(localStorage.getItem('enquiry_drafts') || '{}');
    delete drafts[selectedComplaint.id];
    localStorage.setItem('enquiry_drafts', JSON.stringify(drafts));
    setSavedDraft(null);
    message.info('Draft discarded.');
  };

  const renderTemplateSection = (category, label, defaultType) => {
    const categoryTemplates = customTemplates.filter(t => t.category === category);
    const isDefaultSelected = selectedTemplate === category;

    const categoryTemplateMenu = (
      <div style={{ background: '#1f1f1f', border: '1px solid #303030', borderRadius: 8, padding: 8, minWidth: 250, maxWidth: 300 }}>
        {categoryTemplates.length === 0 ? (
          <div style={{ color: '#aaa', padding: '8px 12px', textAlign: 'center' }}>No uploaded templates</div>
        ) : (
          <List
            size="small"
            dataSource={categoryTemplates}
            renderItem={t => {
              const isSelected = selectedTemplate === t.id;
              return (
                <List.Item
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '6px 8px', 
                    borderBottom: '1px solid #303030',
                    background: isSelected ? 'rgba(24,144,255,0.08)' : 'transparent' 
                  }}
                >
                  <span
                    style={{ 
                      color: isSelected ? '#1890ff' : '#f0f6fc', 
                      cursor: 'pointer', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap', 
                      maxWidth: 180,
                      fontWeight: isSelected ? 600 : 400
                    }}
                    onClick={() => handleTemplateSelect(t.id)}
                    title={t.name}
                  >
                    📄 {t.name}
                  </span>
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(t.id);
                    }}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>
    );

    return (
      <div style={{ marginBottom: 16, border: '1px solid #303030', borderRadius: 8, padding: 12, background: '#171a23' }}>
        <Button
          type={isDefaultSelected ? 'primary' : (defaultType === 'dashed' ? 'dashed' : 'default')}
          block
          onClick={() => handleTemplateSelect(category)}
          style={{ marginBottom: 10, fontWeight: 500 }}
        >
          {label}
        </Button>
        
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Upload
              accept=".docx"
              beforeUpload={(file) => {
                handleUploadTemplate(category, file);
                return false;
              }}
              showUploadList={false}
              style={{ width: '100%' }}
            >
              <Button size="small" icon={<UploadOutlined />} style={{ width: '100%', fontSize: 11 }}>
                Upload Template
              </Button>
            </Upload>
          </div>

          <div style={{ flex: 1 }}>
            <Popover 
              content={categoryTemplateMenu} 
              title={`Select ${label} Template`}
              trigger="click" 
              placement="bottomRight"
            >
              <Button size="small" icon={<FileTextOutlined />} style={{ width: '100%', fontSize: 11 }}>
                Select Template
              </Button>
            </Popover>
          </div>
        </div>
      </div>
    );
  };

  // Load all registered complaints from database
  const loadComplaints = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load complaints');
      let saved = await res.json();
      
      saved.sort((a, b) => new Date(b.registrationDate || b.registeredAt) - new Date(a.registrationDate || a.registeredAt));
      
      // If pre-selected (coming from Search Complaints or Home view), ONLY show that complaint
      if (preSelectedComplaintId) {
        saved = saved.filter(c => c.id === preSelectedComplaintId);
        if (saved.length > 0) {
          setSelectedComplaint(saved[0]);
          setSelectedComplaintId(saved[0].id);
        }
      } else {
        // If we have a selectedComplaintId from sessionStorage, we should set the selectedComplaint object
        const savedComplaintId = sessionStorage.getItem('enquiry_selectedComplaintId');
        let found = null;
        if (savedComplaintId) {
          found = saved.find(c => c.id === savedComplaintId);
        }
        if (found) {
          setSelectedComplaint(found);
          setSelectedComplaintId(found.id);
        } else if (saved.length > 0) {
          setSelectedComplaint(saved[0]);
          setSelectedComplaintId(saved[0].id);
        } else {
          setSelectedComplaint(null);
          setSelectedComplaintId(null);
        }
      }
      setComplaints(saved);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadComplaints();
    
    // Fetch IO list if user is SHO
    if (profile?.role === 'sho') {
      const token = localStorage.getItem('token');
      if (token) {
        fetch('/api/users/ios', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => {
          if (!res.ok) throw new Error(`Status ${res.status}`);
          return res.json();
        })
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
    setSelectedAccusedIndices([]);
    setEmailRecipient('complainant');
    setEmailOtherPersonName('');
    setEmailOtherPersonAddress('');
    setEmailSelectedAccusedIndices([]);
    setReportPrompt('');
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getBaseFields = (complaint) => {
    const c = complaint || {};
    const compName = [c.firstName, c.lastName].filter(Boolean).join(' ') || '[Complainant Name]';
    const compPhone = c.mobileNumber || '[Complainant Mobile]';
    const addrParts = [c.houseNumber, c.streetName, c.colonyArea, c.villageTown, c.tehsilBlock, c.district, c.state, c.pinCode];
    const compAddress = addrParts.filter(Boolean).join(', ') || '[Complainant Address]';
    const incidentClass = c.classOfIncident || '[Class of Incident]';
    const placeOfIncident = c.placeOfIncident || '[Place of Incident]';
    const dateOfInc = c.dateOfIncident ? dayjs(c.dateOfIncident).format('DD-MM-YYYY') : '[Date of Incident]';
    const timeOfInc = c.timeOfIncident ? dayjs(c.timeOfIncident).format('HH:mm') : '[Time of Incident]';
    const actDescription = c.descriptionOfComplaint || '[Description of Complaint]';
    const complaintId = c.id || '[Complaint ID]';

    // Build accused list — support both accusedList[] (new) and accusedName/accusedAddress (old fallback)
    const rawList = (c.accusedList && c.accusedList.length > 0)
      ? c.accusedList
      : (c.accusedName ? [{ name: c.accusedName, address: c.accusedAddress || '' }] : []);
    const accusedList = rawList.length > 0 ? rawList : [{ name: '[Accused Name]', address: '[Accused Address]' }];

    // For Notice "To:" block — Name + Address on separate lines for each accused
    const accusedToBlock = accusedList.length === 1
      ? `Name: ${accusedList[0].name}\nAddress: ${accusedList[0].address || '[Accused Address]'}`
      : accusedList.map((a, i) => `Accused ${i + 1}:\nName: ${a.name}\nAddress: ${a.address || '[Accused Address]'}`).join('\n\n');

    // For inline body text — "Name (R/o Address)" format
    const accusedInlineBlock = accusedList.length === 1
      ? `${accusedList[0].name} (R/o ${accusedList[0].address || '[Accused Address]'})`
      : accusedList.map((a, i) => `${i + 1}. ${a.name} (R/o ${a.address || '[Accused Address]'})`).join('\n');

    // For report "ACCUSED DETAILS" section
    const accusedDetailsBlock = accusedList.length === 1
      ? `Name: ${accusedList[0].name}\nAddress: ${accusedList[0].address || '[Accused Address]'}`
      : accusedList.map((a, i) => `${i + 1}. Name: ${a.name}\n   Address: ${a.address || '[Accused Address]'}`).join('\n');

    // First accused (for subject lines etc.)
    const accName = accusedList[0].name;
    const accAddress = accusedList[0].address || '[Accused Address]';

    return { compName, compPhone, compAddress, accName, accAddress, accusedList, accusedToBlock, accusedInlineBlock, accusedDetailsBlock, incidentClass, placeOfIncident, dateOfInc, timeOfInc, actDescription, complaintId };
  };

  // Build notice addressed to the selected recipient
  const generateNoticeText = (complaint, recipient, otherName, otherAddr, extraSections, selAccusedInds = []) => {
    const f = getBaseFields(complaint);
    const c = complaint || {};
    const ps = c.policeStation || (profile?.policeStation) || '_______';
    const dist = c.district || (profile?.district) || '_______';
    const dateToday = dayjs().format('DD-MM-YYYY');
    const formattedRegDate = c.registrationDate ? dayjs(c.registrationDate).format('DD/MM/YYYY') : '_______';
    const appearanceDate = dayjs().add(7, 'day').format('DD/MM/YYYY');
    const email = `sho${ps.toLowerCase().replace(/\s+/g, '')}@gmail.com`;

    // Determine recipient name & address
    let toName = '';
    let toAddress = '';
    if (recipient === 'complainant') {
      toName = f.compName;
      toAddress = f.compAddress;
    } else if (recipient === 'other') {
      toName = otherName || '_______';
      toAddress = otherAddr || '_______';
    } else {
      // accused — respect selected indices
      const rawList = (c.accusedList && c.accusedList.length > 0)
        ? c.accusedList
        : (c.accusedName ? [{ name: c.accusedName, address: c.accusedAddress || '' }] : [{ name: '[Accused Name]', address: '[Accused Address]' }]);
      const selected = selAccusedInds && selAccusedInds.length > 0
        ? rawList.filter((_, i) => selAccusedInds.includes(i))
        : rawList;
      toName = selected.map(a => a.name).join(', ');
      toAddress = selected.map(a => a.address || '_______').join(' / ');
    }

    const extraHtml = extraSections && extraSections.length > 0
      ? extraSections.map(sec => `<p>${sec}</p><p>&nbsp;</p>`).join('')
      : '';

    return `<table style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;">
  <tr>
    <td style="width:50%;"><strong>थाना - ${ps}</strong></td>
    <td style="width:50%; text-align:right;"><strong>जिला- ${dist}</strong></td>
  </tr>
</table>
<p><strong>क्रमांक - &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>दिनांक - ${dateToday}</strong></p>
<p>आपको इस नोटिस के माध्यम से सूचित किया जाता है कि ${recipient === 'complainant' ? 'परिवादी' : 'उत्तरवादी'} <strong>${toName}</strong> निवासी ${toAddress} के विरुद्ध/द्वारा परिवाद नंबर <strong>${f.complaintId}</strong>-Peshi दिनांक ${formattedRegDate} को प्राप्त हुई है।</p>
<p>इसलिए आप ${recipient === 'complainant' ? 'परिवादी' : 'उत्तरवादी'} <strong>${toName}</strong> निवासी ${toAddress} को निर्देश दिया जाता है कि आप दिनांक <strong>${appearanceDate}</strong> को समय <strong>11:00 AM</strong> पर प्रारंभिक जांच में सभी दस्तावेज़ों, साक्षों और सामग्री के साथ व्यक्तिगत रूप से शामिल हों। या अपनी प्रतिनिधि को भेजें शिकायत की जांच के सम्बन्ध में यदि आप अपनी उपस्थिति को वीडियो कॉन्फ्रेंस के माध्यम से चाहते हैं तो थाना प्रभारी की ईमेल <strong>${email}</strong> पर लिखित निवेदन ${appearanceDate} से पहले भेजना सुनिश्चित करें।</p>
${extraHtml}
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;थाना प्रभारी</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;थाना ${ps}, जिला ${dist}</p>`;
  };

  const generateEmailText = (complaint, recipient, otherName, otherAddr, selAccusedInds = []) => {
    const fe = getBaseFields(complaint);
    const ce = complaint || {};
    const pse = ce.policeStation || (profile?.policeStation) || '_______';
    const diste = ce.district || (profile?.district) || '_______';
    const regDate = ce.registrationDate ? dayjs(ce.registrationDate).format('DD/MM/YYYY') : '_______';
    const appearanceDate = dayjs().add(7, 'day').format('DD/MM/YYYY');
    const shoEmail = `sho${pse.toLowerCase().replace(/\s+/g, '')}@gmail.com`;

    const rawList = (ce.accusedList && ce.accusedList.length > 0)
      ? ce.accusedList
      : (ce.accusedName ? [{ name: ce.accusedName, address: ce.accusedAddress || '' }] : [{ name: '[Accused Name]', address: '' }]);
    const selected = selAccusedInds && selAccusedInds.length > 0
      ? rawList.filter((_, i) => selAccusedInds.includes(i))
      : rawList;
    const selectedAccusedNames = selected.map(a => a.name).join(', ');
    const compFullAddress = [ce.villageTown, ce.tehsilBlock, diste, ce.state].filter(Boolean).join(', ') || fe.compAddress;

    let toName = '';
    let toAddress = '';
    let toPhone = '';
    let toTypeLabel = '';

    if (recipient === 'complainant') {
      toName = fe.compName;
      toAddress = fe.compAddress;
      toPhone = fe.compPhone;
      toTypeLabel = 'परिवादी';
    } else if (recipient === 'other') {
      toName = otherName || '_______';
      toAddress = otherAddr || '_______';
      toPhone = '';
      toTypeLabel = 'अन्य व्यक्ति';
    } else {
      toName = selectedAccusedNames;
      toAddress = selected.map(a => a.address || '_______').join(' / ');
      toPhone = '';
      toTypeLabel = 'उत्तरवादी';
    }

    let bodyPara1 = '';
    let bodyPara2 = '';
    let bodyPara3 = '';

    if (recipient === 'complainant') {
      bodyPara1 = `आपको सूचित किया जाता है कि परिवादी <strong>${fe.compName}</strong> निवासी ${compFullAddress} थाना ${pse} ${diste} द्वारा प्रस्तुत परिवाद संख्या <strong>${fe.complaintId}</strong> दिनांक ${regDate} थाना ${pse}, जिला ${diste} में प्राप्त हुआ है। उक्त परिवाद की प्रारंभिक जांच की जानी प्रस्तावित है।`;
      bodyPara2 = `अतः आप परिवादी <strong>${fe.compName}</strong> को निर्देशित किया जाता है कि दिनांक <strong>${appearanceDate}</strong> को प्रातः <strong>11:00 बजे</strong> प्रारंभिक जांच के दौरान समस्त संबंधित दस्तावेजों, साक्षों एवं अन्य आवश्यक सामग्री सहित व्यक्तिगत रूप से उपस्थित होना सुनिश्चित करें। यदि आप स्वयं उपस्थित होने में असमर्थ हों तो अपने अधिकृत प्रतिनिधि को भेज सकते हैं।`;
      bodyPara3 = `यदि आप शिकायत की जांच के संबंध में वीडियो कॉन्फ्रेंसिंग के माध्यम से अपनी उपस्थिति दर्ज कराना चाहते हैं, तो कृपया दिनांक <strong>${appearanceDate}</strong> से पूर्व थाना प्रभारी के ईमेल <strong>${shoEmail}</strong> पर लिखित अनुरोध प्रेषित करना सुनिश्चित करें।`;
    } else if (recipient === 'accused') {
      bodyPara1 = `आपको सूचित किया जाता है कि परिवादी <strong>${fe.compName}</strong> निवासी ${compFullAddress} थाना ${pse} ${diste} द्वारा प्रस्तुत परिवाद संख्या <strong>${fe.complaintId}</strong> दिनांक ${regDate} थाना ${pse}, जिला ${diste} में प्राप्त हुआ है। उक्त परिवाद की प्रारंभिक जांच की जानी प्रस्तावित है।`;
      bodyPara2 = `अतः आप उत्तरवादी <strong>${selectedAccusedNames}</strong> को निर्देशित किया जाता है कि दिनांक <strong>${appearanceDate}</strong> को प्रातः <strong>11:00 बजे</strong> प्रारंभिक जांच के दौरान समस्त संबंधित दस्तावेजों, साक्षों एवं अन्य आवश्यक सामग्री सहित व्यक्तिगत रूप से उपस्थित होना सुनिश्चित करें। यदि आप स्वयं उपस्थित होने में असमर्थ हों तो अपने अधिकृत प्रतिनिधि को भेज सकते हैं।`;
      bodyPara3 = `यदि आप शिकायत की जांच के संबंध में वीडियो कॉन्फ्रेंसिंग के माध्यम से अपनी उपस्थिति दर्ज कराना चाहते हैं, तो कृपया दिनांक <strong>${appearanceDate}</strong> से पूर्व थाना प्रभारी के ईमेल <strong>${shoEmail}</strong> पर लिखित अनुरोध प्रेषित करना सुनिश्चित करें।`;
    } else {
      bodyPara1 = `आपको सूचित किया जाता है कि परिवादी <strong>${fe.compName}</strong> निवासी ${compFullAddress} थाना ${pse} ${diste} द्वारा प्रस्तुत परिवाद संख्या <strong>${fe.complaintId}</strong> दिनांक ${regDate} थाना ${pse}, जिला ${diste} में प्राप्त हुआ है।`;
      bodyPara2 = `अतः आपको निर्देशित किया जाता है कि दिनांक <strong>${appearanceDate}</strong> को प्रातः <strong>11:00 बजे</strong> प्रारंभिक जांच के दौरान समस्त संबंधित दस्तावेजों, साक्षों एवं अन्य आवश्यक सामग्री सहित व्यक्तिगत रूप से उपस्थित होना सुनिश्चित करें। यदि आप स्वयं उपस्थित होने में असमर्थ हों तो अपने अधिकृत प्रतिनिधि को भेज सकते हैं।`;
      bodyPara3 = `यदि आप शिकायत की जांच के संबंध में वीडियो कॉन्फ्रेंसिंग के माध्यम से अपनी उपस्थिति दर्ज कराना चाहते हैं, तो कृपया दिनांक <strong>${appearanceDate}</strong> से पूर्व थाना प्रभारी के ईमेल <strong>${shoEmail}</strong> पर लिखित अनुरोध प्रेषित करना सुनिश्चित करें।`;
    }

    return `<table style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;">
  <tr>
    <td style="width:50%;"><strong>थाना - ${pse}</strong></td>
    <td style="width:50%; text-align:right;"><strong>जिला- ${diste}</strong></td>
  </tr>
</table>
<p><strong>विषय:</strong> परिवाद संख्या <strong>${fe.complaintId}</strong> दिनांक ${regDate} के संबंध में प्रारंभिक जांच हेतु सूचना</p>
<p>महोदय,</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;${bodyPara1}</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;${bodyPara2}</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;${bodyPara3}</p>
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;थाना प्रभारी</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;थाना ${pse}, जिला ${diste}</p>`;
  };

  const generateTemplateText = (templateType, complaint) => {
    switch (templateType) {
      case 'notice':
        return generateNoticeText(complaint, noticeRecipient, otherPersonName, otherPersonAddress, customSections, selectedAccusedIndices);

      case 'email': {
        return generateEmailText(complaint, emailRecipient, emailOtherPersonName, emailOtherPersonAddress, emailSelectedAccusedIndices);
      }

      case 'enquiry_rajinama':
        return `<p><strong>पुलिस विभाग &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; जिला -</strong> <br />			जांच रिपोर्ट परिवाद नम्बरी – </p>
<table>
  <tr>
    <td><p><strong>परिवादी </strong></p></td>
    <td><p><br></p></td>
  </tr>
  <tr>
    <td><p><strong>परिवाद का सार </strong></p></td>
    <td><p><br></p></td>
  </tr>
  <tr>
    <td><p><strong>उत्तरवादी का विवरण </strong></p></td>
    <td><p><br></p></td>
  </tr>
  <tr>
    <td><p><strong>जांच की स्थिति का विवरण </strong></p></td>
    <td><p><br></p></td>
  </tr>
</table>`;

      case 'enquiry_civil_land':
        return `<p><strong>पुलिस विभाग &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; जिला -</strong> <br />			जांच रिपोर्ट परिवाद नम्बरी – </p>
<table>
  <tr>
    <td><p><strong>परिवादी </strong></p></td>
    <td><p><br></p></td>
  </tr>
  <tr>
    <td><p><strong>परिवाद का सार </strong></p></td>
    <td><p><br></p></td>
  </tr>
  <tr>
    <td><p><strong>उत्तरवादी का विवरण </strong></p></td>
    <td><p><br></p></td>
  </tr>
  <tr>
    <td><p><strong>जांच की स्थिति का विवरण </strong></p></td>
    <td><p><br></p></td>
  </tr>
</table>`;

      case 'enquiry_civil_finance': {
        const fcf = getBaseFields(complaint);
        const ccf = complaint || {};
        const pscf = ccf.policeStation || (profile?.policeStation) || '_______';
        const distcf = ccf.district || (profile?.district) || '_______';
        const datecf = dayjs().format('DD-MM-YYYY');
        const regDatecf = ccf.registrationDate ? dayjs(ccf.registrationDate).format('DD/MM/YYYY') : '_______';
        return `<table style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;">
  <tr>
    <td style="width:50%;"><strong>थाना - ${pscf}</strong></td>
    <td style="width:50%; text-align:right;"><strong>जिला- ${distcf}</strong></td>
  </tr>
</table>
<p><strong>क्रमांक - &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>दिनांक - ${datecf}</strong></p>
<p><strong>जांच रिपोर्ट परिवाद नम्बरी – ${fcf.complaintId}</strong></p>
<table style="width:100%; border-collapse:collapse; border:1px solid #999;">
  <tr style="border:1px solid #999;">
    <td style="padding:6px; border:1px solid #999; width:35%;"><p><strong>परिवादी का विवरण</strong></p></td>
    <td style="padding:6px; border:1px solid #999;"><p>${fcf.compName}<br>मो. ${fcf.compPhone}<br>${fcf.compAddress}</p></td>
  </tr>
  <tr style="border:1px solid #999;">
    <td style="padding:6px; border:1px solid #999;"><p><strong>परिवाद प्राप्ति दिनांक</strong></p></td>
    <td style="padding:6px; border:1px solid #999;"><p>${regDatecf}</p></td>
  </tr>
  <tr style="border:1px solid #999;">
    <td style="padding:6px; border:1px solid #999;"><p><strong>उत्तरवादी का विवरण</strong></p></td>
    <td style="padding:6px; border:1px solid #999;"><p>${fcf.accusedDetailsBlock}</p></td>
  </tr>
  <tr style="border:1px solid #999;">
    <td style="padding:6px; border:1px solid #999;"><p><strong>परिवाद में लगाए गए आरोप</strong></p></td>
    <td style="padding:6px; border:1px solid #999;"><p>${fcf.actDescription}</p></td>
  </tr>
  <tr style="border:1px solid #999;">
    <td style="padding:6px; border:1px solid #999;"><p><strong>रिपोर्ट दिनांक</strong></p></td>
    <td style="padding:6px; border:1px solid #999;"><p>${datecf}</p></td>
  </tr>
  <tr style="border:1px solid #999;">
    <td style="padding:6px; border:1px solid #999;"><p><strong>नागरिक संतुष्टि</strong></p></td>
    <td style="padding:6px; border:1px solid #999;"><p><br></p></td>
  </tr>
  <tr style="border:1px solid #999;">
    <td style="padding:6px; border:1px solid #999;"><p><strong>जांच अधिकारी की अंतिम रिपोर्ट</strong></p></td>
    <td style="padding:6px; border:1px solid #999;"><p><br></p></td>
  </tr>
</table>`;
      }

      case 'enquiry_transfer': {
        const ft = getBaseFields(complaint);
        const ct = complaint || {};
        const pst = ct.policeStation || (profile?.policeStation) || '_______';
        const distt = ct.district || (profile?.district) || '_______';
        const datet = dayjs().format('DD-MM-YYYY');
        const regDatet = ct.registrationDate ? dayjs(ct.registrationDate).format('DD/MM/YYYY') : '_______';
        return `<table style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;">
  <tr>
    <td style="width:50%;"><strong>थाना - ${pst}</strong></td>
    <td style="width:50%; text-align:right;"><strong>जिला- ${distt}</strong></td>
  </tr>
</table>
<p><strong>क्रमांक - &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>दिनांक - ${datet}</strong></p>
<p><strong>जांच रिपोर्ट परिवाद नम्बरी – ${ft.complaintId}</strong> (अन्य थाने को स्थानांतरण हेतु)</p>
<p><strong>1. संदर्भ परिवाद विवरण</strong></p>
<table style="width:100%; border-collapse:collapse; border:1px solid #999;">
  <tr><td style="padding:6px; border:1px solid #999; width:35%;"><strong>परिवादी</strong></td><td style="padding:6px; border:1px solid #999;">${ft.compName}, मो. ${ft.compPhone}<br>${ft.compAddress}</td></tr>
  <tr><td style="padding:6px; border:1px solid #999;"><strong>उत्तरवादी</strong></td><td style="padding:6px; border:1px solid #999;">${ft.accusedDetailsBlock}</td></tr>
  <tr><td style="padding:6px; border:1px solid #999;"><strong>परिवाद प्राप्ति दिनांक</strong></td><td style="padding:6px; border:1px solid #999;">${regDatet}</td></tr>
  <tr><td style="padding:6px; border:1px solid #999;"><strong>घटना का स्थान</strong></td><td style="padding:6px; border:1px solid #999;">${ft.placeOfIncident}</td></tr>
  <tr><td style="padding:6px; border:1px solid #999;"><strong>घटना दिनांक एवं समय</strong></td><td style="padding:6px; border:1px solid #999;">${ft.dateOfInc} समय ${ft.timeOfInc}</td></tr>
</table>
<p><strong>2. परिवाद का सार</strong></p>
<p>${ft.actDescription}</p>
<p><strong>3. जांच एवं क्षेत्राधिकार के तथ्य</strong></p>
<p>प्रारंभिक जांच की गई। घटना स्थल का सत्यापन किया गया। सत्यापन से ज्ञात हुआ कि घटना की संपूर्ण कार्यवाही थाना ____________, जिला ____________ की सीमा में घटित हुई है। घटना का कोई भी भाग इस थाने की सीमा में नहीं आता।</p>
<p><strong>4. निष्कर्ष एवं सिफारिश</strong></p>
<p>क्षेत्राधिकार नियमों के अनुसार इस थाने द्वारा इस परिवाद की जांच नहीं की जा सकती। अतः यह परिवाद सम्बन्धित सभी दस्तावेजों सहित थाना ____________, जिला ____________ को BNSS के प्रावधानों के अन्तर्गत आगे की कार्यवाही हेतु स्थानांतरित करना उचित है।</p>
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;जांच अधिकारी</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;थाना ${pst}, जिला ${distt}</p>`;
      }

      case 'enquiry_ncr': {
        const fn = getBaseFields(complaint);
        const cn = complaint || {};
        const psn = cn.policeStation || (profile?.policeStation) || '_______';
        const distn = cn.district || (profile?.district) || '_______';
        const daten = dayjs().format('DD-MM-YYYY');
        const regDaten = cn.registrationDate ? dayjs(cn.registrationDate).format('DD/MM/YYYY') : '_______';
        return `<table style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;">
  <tr>
    <td style="width:50%;"><strong>थाना - ${psn}</strong></td>
    <td style="width:50%; text-align:right;"><strong>जिला- ${distn}</strong></td>
  </tr>
</table>
<p><strong>क्रमांक - &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>दिनांक - ${daten}</strong></p>
<p><strong>जांच रिपोर्ट परिवाद नम्बरी – ${fn.complaintId}</strong> (असंज्ञेय अपराध / NCR)</p>
<table style="width:100%; border-collapse:collapse; border:1px solid #999;">
  <tr><td style="padding:6px; border:1px solid #999; width:35%;"><strong>1. परिवादी विवरण</strong></td><td style="padding:6px; border:1px solid #999;">${fn.compName}<br>मो. ${fn.compPhone}<br>${fn.compAddress}</td></tr>
  <tr><td style="padding:6px; border:1px solid #999;"><strong>2. उत्तरवादी विवरण</strong></td><td style="padding:6px; border:1px solid #999;">${fn.accusedDetailsBlock}</td></tr>
  <tr><td style="padding:6px; border:1px solid #999;"><strong>3. घटना विवरण</strong></td><td style="padding:6px; border:1px solid #999;">श्रेणी: ${fn.incidentClass}<br>दिनांक एवं समय: ${fn.dateOfInc}, ${fn.timeOfInc}<br>घटना स्थान: ${fn.placeOfIncident}</td></tr>
  <tr><td style="padding:6px; border:1px solid #999;"><strong>4. परिवाद के तथ्य</strong></td><td style="padding:6px; border:1px solid #999;">${fn.actDescription}</td></tr>
  <tr><td style="padding:6px; border:1px solid #999;"><strong>परिवाद प्राप्ति दिनांक</strong></td><td style="padding:6px; border:1px solid #999;">${regDaten}</td></tr>
</table>
<p><strong>5. जांच अधिकारी की राय एवं की गई कार्यवाही</strong></p>
<p>परिवाद के सावधानीपूर्वक अवलोकन एवं प्रारंभिक जांच के उपरांत यह निष्कर्ष निकाला गया है कि परिवादी <strong>${fn.compName}</strong> द्वारा लगाए गए आरोप एक पूर्णतः <strong>असंज्ञेय अपराध (Non-Cognizable Offence)</strong> को इंगित करते हैं।</p>
<p>तदनुसार, इस सूचना का सार रोजनामचा दैनिक (Rapt/DDR) में विधिवत दर्ज कर लिया गया है। पुलिस बिना किसी सक्षम मजिस्ट्रेट के आदेश के असंज्ञेय मामले की जांच नहीं कर सकती।</p>
<p>परिवादी <strong>${fn.compName}</strong> को विधिवत सूचित कर दिया गया है तथा उन्हें BNSS की संबंधित धाराओं के अंतर्गत माननीय मजिस्ट्रेट के समक्ष जाने की विधिक सलाह दी गई है।</p>
<p>&nbsp;</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;जांच अधिकारी</p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;थाना ${psn}, जिला ${distn}</p>`;
      }

      case 'enquiry_fir':
        return `<p><strong>पुलिस विभाग &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;जिला-</strong></p>
<p>श्रीमान जी </p>
<p>&nbsp;&nbsp;&nbsp;&nbsp; परिवाद नम्बरी: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; पेशी दिनांक: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; शिकायतकर्ता: </p>
<p>जांच हेतु प्राप्त हुई |</p>
<p>परिवाद की जांच रिपोर्ट इस प्रकार है-<br /></p>
<table>
  <tr>
    <td><p><strong>शिकायतकर्ता द्वारा लगाए गये आरोप (बिन्दुवार)</strong></p></td>
    <td><p><strong>जांच का विवरण (सही/गलत) बिन्दुवार कारण सहित</strong></p></td>
    <td><p><strong>स्थानीय पुलिस /एस.एच.ओ. द्वारा की गई कार्यवाही</strong></p></td>
  </tr>
  <tr>
    <td><p><br></p></td>
    <td><p><br></p></td>
    <td><p><br></p></td>
  </tr>
</table>`;

      default:
        return '';
    }
  };

  const handleTemplateSelect = (value, templatesList = customTemplates) => {
    setSelectedTemplate(value);
    if (value && value.startsWith('custom_')) {
      // Explicitly selected custom template by ID
      setNoticeIsDefault(false);
      const found = templatesList.find(t => t.id === value);
      if (found) {
        setCurrentUploadedTemplateId(found.id);
        const isEmail = (found.category === 'email');
        const ctx = getRecipientContext(
          isEmail ? emailRecipient : noticeRecipient,
          isEmail ? emailSelectedAccusedIndices : selectedAccusedIndices,
          isEmail
        );
        const generatedText = fillTemplatePlaceholders(found.content, selectedComplaint, ctx);
        setDocumentText(generatedText);
      } else {
        message.error('Custom template not found.');
        setCurrentUploadedTemplateId(null);
        setDocumentText('');
      }
    } else {
      // Category-based selection — check for uploaded template first
      const uploaded = templatesList.find(t => t.category === value);
      if (uploaded) {
        // User has an uploaded custom template → preserve its format, re-fill with current recipient
        setNoticeIsDefault(false);
        setCurrentUploadedTemplateId(uploaded.id);
        const isEmail = (value === 'email');
        const ctx = (value === 'notice' || value === 'email')
          ? getRecipientContext(
              isEmail ? emailRecipient : noticeRecipient,
              isEmail ? emailSelectedAccusedIndices : selectedAccusedIndices,
              isEmail
            )
          : null;
        const generatedText = fillTemplatePlaceholders(uploaded.content, selectedComplaint, ctx);
        setDocumentText(generatedText);
      } else {
        // No uploaded template → using built-in default
        setNoticeIsDefault(value === 'notice' || value === 'email');
        setCurrentUploadedTemplateId(null);
        const generatedText = generateTemplateText(value, selectedComplaint);
        setDocumentText(generatedText);
      }
    }
  };

  // When recipient/accused changes: re-fill uploaded template OR regenerate default
  const handleNoticeRecipientChange = (val) => {
    setNoticeRecipient(val);
    // Only act when a notice template is active
    const noticeActive = selectedTemplate === 'notice' || customTemplates.some(t => t.id === selectedTemplate && t.category === 'notice');
    if (!noticeActive) return;
    if (noticeIsDefault) {
      // Built-in default — full regenerate
      const text = generateNoticeText(selectedComplaint, val, otherPersonName, otherPersonAddress, customSections, selectedAccusedIndices);
      setDocumentText(text);
    } else {
      // Uploaded template — re-fill with new recipient, same layout
      // refillUploadedTemplate falls back to any notice-category template if ID is missing
      const text = refillUploadedTemplate(currentUploadedTemplateId, val, selectedAccusedIndices, 'notice');
      if (text !== null) setDocumentText(text);
    }
  };

  const handleAccusedSelectionChange = (checkedValues) => {
    setSelectedAccusedIndices(checkedValues);
    const noticeActive = selectedTemplate === 'notice' || customTemplates.some(t => t.id === selectedTemplate && t.category === 'notice');
    if (!noticeActive) return;
    if (noticeIsDefault) {
      const text = generateNoticeText(selectedComplaint, noticeRecipient, otherPersonName, otherPersonAddress, customSections, checkedValues);
      setDocumentText(text);
    } else {
      const text = refillUploadedTemplate(currentUploadedTemplateId, noticeRecipient, checkedValues, 'notice');
      if (text !== null) setDocumentText(text);
    }
  };

  const handleEmailRecipientChange = (val) => {
    setEmailRecipient(val);
    // Only act when an email template is active
    const emailActive = selectedTemplate === 'email' || customTemplates.some(t => t.id === selectedTemplate && t.category === 'email');
    if (!emailActive) return;
    if (noticeIsDefault) {
      // Built-in default — full regenerate
      const text = generateEmailText(selectedComplaint, val, emailOtherPersonName, emailOtherPersonAddress, emailSelectedAccusedIndices);
      setDocumentText(text);
    } else {
      // Uploaded template — re-fill with new recipient, same layout
      const text = refillUploadedTemplate(currentUploadedTemplateId, val, emailSelectedAccusedIndices, 'email');
      if (text !== null) setDocumentText(text);
    }
  };

  const handleEmailAccusedSelectionChange = (checkedValues) => {
    setEmailSelectedAccusedIndices(checkedValues);
    const emailActive = selectedTemplate === 'email' || customTemplates.some(t => t.id === selectedTemplate && t.category === 'email');
    if (!emailActive) return;
    if (noticeIsDefault) {
      const text = generateEmailText(selectedComplaint, emailRecipient, emailOtherPersonName, emailOtherPersonAddress, checkedValues);
      setDocumentText(text);
    } else {
      const text = refillUploadedTemplate(currentUploadedTemplateId, emailRecipient, checkedValues, 'email');
      if (text !== null) setDocumentText(text);
    }
  };

  const handleAddCustomSection = () => {
    if (!customSection.trim()) return;
    const updated = [...customSections, customSection.trim()];
    setCustomSections(updated);
    setCustomSection('');
    if (noticeIsDefault && selectedTemplate === 'notice') {
      const text = generateNoticeText(selectedComplaint, noticeRecipient, otherPersonName, otherPersonAddress, updated, selectedAccusedIndices);
      setDocumentText(text);
    }
  };

  const handleRemoveCustomSection = (idx) => {
    const updated = customSections.filter((_, i) => i !== idx);
    setCustomSections(updated);
    if (noticeIsDefault && selectedTemplate === 'notice') {
      const text = generateNoticeText(selectedComplaint, noticeRecipient, otherPersonName, otherPersonAddress, updated, selectedAccusedIndices);
      setDocumentText(text);
    }
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
- Accused Detail(s):\n${f.accusedDetailsBlock}
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

  const handleModifyReportWithAI = async () => {
    if (!reportPrompt.trim()) {
      message.warning('Please describe how you want to modify the report.');
      return;
    }
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      message.error('Groq API key is not set in environment variables.');
      return;
    }

    setIsAiLoading(true);
    message.loading({ content: 'Modifying report with AI...', key: 'modifyReportMsg' });
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are an expert police officer and assistant specializing in legal reports and police documentation for Haryana Police.
Your task is to modify the official Enquiry Report HTML content provided by the user based on their instruction/prompt.
Follow these rules strictly:
1. Maintain all existing HTML structures, tables, cells, rows, labels, and CSS formatting exactly as they are.
2. Only modify or fill in the content details (such as details of complainant, accused, investigation status, facts, or conclusions) as requested by the user's prompt.
3. Keep the formal, legal Hindi language style intact.
4. Output ONLY the modified HTML content. Do not include any explanations, markdown code fences (like \`\`\`html), preambles, or postscripts.`
            },
            {
              role: 'user',
              content: `Original HTML Content:\n${documentText}\n\nUser Instruction/Prompt: ${reportPrompt}`
            }
          ],
          temperature: 0.3,
          max_tokens: 4000,
        })
      });

      const data = await res.json();
      const updatedContent = data?.choices?.[0]?.message?.content?.trim();
      if (updatedContent) {
        let cleaned = updatedContent;
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```html\s*|\s*```$/gi, '');
        }
        setDocumentText(cleaned);
        setReportPrompt('');
        message.success({ content: 'Report modified successfully!', key: 'modifyReportMsg', duration: 2 });
      } else {
        message.error({ content: 'AI modification failed.', key: 'modifyReportMsg', duration: 2 });
      }
    } catch (err) {
      console.error(err);
      message.error({ content: 'AI modification failed: ' + err.message, key: 'modifyReportMsg', duration: 2 });
    } finally {
      setIsAiLoading(false);
    }
  };


  const convertHtmlToDocx = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const body = doc.body;

    const parseTextFormatting = (node, isBold = false, isItalic = false) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        if (text) {
          return new TextRun({
            text,
            bold: isBold,
            italic: isItalic,
            size: 22,
            font: 'Arial',
          });
        }
        return null;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        const currentBold = isBold || tagName === 'strong' || tagName === 'b' || tagName === 'th';
        const currentItalic = isItalic || tagName === 'em' || tagName === 'i';

        if (tagName === 'br') {
          return new TextRun({ break: 1 });
        }

        const runs = [];
        node.childNodes.forEach(child => {
          const res = parseTextFormatting(child, currentBold, currentItalic);
          if (res) {
            if (Array.isArray(res)) {
              runs.push(...res);
            } else {
              runs.push(res);
            }
          }
        });
        return runs;
      }
      return null;
    };

    const parseBlockElement = (node) => {
      const tagName = node.tagName.toLowerCase();

      if (tagName === 'p') {
        const paragraphChildren = [];
        node.childNodes.forEach(child => {
          const res = parseTextFormatting(child);
          if (res) {
            if (Array.isArray(res)) {
              paragraphChildren.push(...res);
            } else {
              paragraphChildren.push(res);
            }
          }
        });
        return new DocxParagraph({ children: paragraphChildren, spacing: { after: 120 } });
      }

      if (tagName === 'table') {
        const rows = [];
        const trs = node.querySelectorAll('tr');
        
        trs.forEach(trNode => {
          const cells = [];
          const tds = trNode.querySelectorAll('td, th');
          
          tds.forEach(tdNode => {
            const cellChildren = convertContainerToDocxElements(tdNode);
            
            if (cellChildren.length === 0) {
              cellChildren.push(new DocxParagraph({ children: [new TextRun('')] }));
            }
            
            cells.push(new DocxTableCell({
              children: cellChildren,
              width: { size: 100 / (tds.length || 1), type: DocxWidthType.PERCENTAGE },
              borders: {
                top: { style: DocxBorderStyle.SINGLE, size: 6, color: '808080' },
                bottom: { style: DocxBorderStyle.SINGLE, size: 6, color: '808080' },
                left: { style: DocxBorderStyle.SINGLE, size: 6, color: '808080' },
                right: { style: DocxBorderStyle.SINGLE, size: 6, color: '808080' },
              },
              padding: { top: 100, bottom: 100, left: 150, right: 150 }
            }));
          });
          
          if (cells.length > 0) {
            rows.push(new DocxTableRow({ children: cells }));
          }
        });
        
        if (rows.length > 0) {
          return new DocxTable({ rows, width: { size: 100, type: DocxWidthType.PERCENTAGE } });
        }
      }

      if (tagName === 'ul' || tagName === 'ol') {
        const listItems = [];
        node.childNodes.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'li') {
            const itemChildren = [];
            child.childNodes.forEach(c => {
              const res = parseTextFormatting(c);
              if (res) {
                if (Array.isArray(res)) {
                  itemChildren.push(...res);
                } else {
                  itemChildren.push(res);
                }
              }
            });
            listItems.push(new DocxParagraph({ 
              children: itemChildren, 
              bullet: { level: 0 },
              spacing: { after: 80 }
            }));
          }
        });
        return listItems;
      }

      if (['h1', 'h2', 'h3', 'h4'].includes(tagName)) {
        const paragraphChildren = [];
        node.childNodes.forEach(child => {
          const res = parseTextFormatting(child);
          if (res) {
            if (Array.isArray(res)) {
              paragraphChildren.push(...res);
            } else {
              paragraphChildren.push(res);
            }
          }
        });
        const fontSize = tagName === 'h1' ? 32 : tagName === 'h2' ? 28 : tagName === 'h3' ? 24 : 22;
        paragraphChildren.forEach(run => {
          run.bold = true;
          run.size = fontSize;
        });
        return new DocxParagraph({ 
          children: paragraphChildren, 
          spacing: { before: 240, after: 120 }
        });
      }

      return convertContainerToDocxElements(node);
    };

    const convertContainerToDocxElements = (containerNode) => {
      const elements = [];
      let currentInlineRuns = [];

      const flushInlineRuns = () => {
        if (currentInlineRuns.length > 0) {
          elements.push(new DocxParagraph({ children: currentInlineRuns, spacing: { after: 120 } }));
          currentInlineRuns = [];
        }
      };

      containerNode.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.nodeValue;
          if (text && text.trim()) {
            currentInlineRuns.push(new TextRun({ text, font: 'Arial', size: 22 }));
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tagName = child.tagName.toLowerCase();
          
          if (['strong', 'b', 'em', 'i', 'span', 'a', 'br'].includes(tagName)) {
            const runs = parseTextFormatting(child);
            if (runs) {
              if (Array.isArray(runs)) {
                currentInlineRuns.push(...runs);
              } else {
                currentInlineRuns.push(runs);
              }
            }
          } else {
            flushInlineRuns();
            const blockElement = parseBlockElement(child);
            if (blockElement) {
              if (Array.isArray(blockElement)) {
                elements.push(...blockElement);
              } else {
                elements.push(blockElement);
              }
            }
          }
        }
      });

      flushInlineRuns();
      return elements;
    };

    const children = convertContainerToDocxElements(body);

    if (children.length === 0) {
      children.push(new DocxParagraph({ children: [new TextRun('')] }));
    }

    return new Document({ sections: [{ properties: {}, children }] });
  };

  const handleDownloadDocx = () => {
    if (!documentText) {
      message.error('No document text to download.');
      return;
    }

    const templateNames = {
      notice: 'Notice for Appearance',
      email: 'Email / Status Update',
      enquiry_rajinama: 'Enquiry — Rajinama',
      enquiry_civil_land: 'Enquiry — Civil Nature (Land)',
      enquiry_civil_finance: 'Enquiry — Civil Nature (Finance)',
      enquiry_ncr: 'Enquiry — NCR',
      enquiry_fir: 'Enquiry — FIR Recommended',
      enquiry_transfer: 'Enquiry — Transfer to other PS',
    };

    try {
      const doc = convertHtmlToDocx(documentText);
      Packer.toBlob(doc).then(blob => {
        const fileKeys = {
          notice: 'Notice',
          email: 'Email_Update',
          enquiry_rajinama: 'Enquiry_Rajinama',
          enquiry_civil_land: 'Enquiry_Civil_Land',
          enquiry_civil_finance: 'Enquiry_Civil_Finance',
          enquiry_ncr: 'Enquiry_NCR',
          enquiry_fir: 'Enquiry_FIR',
          enquiry_transfer: 'Enquiry_Transfer_PS',
        };
        const fileName = `${selectedComplaint?.id || 'Complaint'}_${fileKeys[selectedTemplate] || 'Document'}.docx`;
        saveAs(blob, fileName);
        message.success(`Downloaded: ${fileName}`);

        // Save applied template status back to this complaint in database
        if (selectedComplaint?.id) {
          const token = localStorage.getItem('token');
          fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints/${selectedComplaint.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ appliedTemplate: templateNames[selectedTemplate] || selectedTemplate })
          }).then(res => {
            if (res.ok) loadComplaints();
          }).catch(err => console.error(err));
        }
      }).catch(err => {
        console.error('Packer error:', err);
        message.error('Failed to bundle docx: ' + err.message);
      });
    } catch (err) {
      console.error('DOCX Generation Error:', err);
      message.error('Failed to generate DOCX file: ' + err.message);
    }
  };

  const handleTransfer = async () => {
    if (!selectedComplaint) { message.warning('Please select a complaint first from Document Generation.'); return; }
    if (!transferDistrict || !transferPS) { message.warning('Please select both District and Police Station.'); return; }
    if (!transferReason || !transferReason.trim()) { message.warning('Please enter Transfer Reason.'); return; }

    const updates = {
      ioStatus: 'Transferred',
      transferredTo: { district: transferDistrict, policeStation: transferPS },
      transferReason: transferReason.trim(),
      transferDate: new Date().toISOString(),
      policeStation: transferPS,
      district: transferDistrict,
      assignedIoId: null,
      assignedIoName: null,
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints/${selectedComplaint.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to transfer complaint');
      
      message.success(`Complaint ${selectedComplaint.id} transferred to ${transferPS}, ${transferDistrict}`);
      setShowTransferModal(false);
      setTransferDistrict('');
      setTransferPS('');
      setTransferReason('');
      await loadComplaints();
      
      setSelectedComplaint(prev => prev ? { ...prev, ...updates } : prev);
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleAssignIo = async () => {
    if (!selectedIoForAssign || !selectedComplaint) {
      message.error('Please select an IO and ensure a complaint is selected.');
      return;
    }
    const io = ioList.find(i => i.id === selectedIoForAssign);
    if (!io) return;

    const updates = { 
      assignedIoId: io.id, 
      assignedIoName: io.full_name,
      ioStatus: 'Pending'
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints/${selectedComplaint.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to assign IO');
      
      message.success(`Complaint assigned to ${io.full_name}`);
      setShowAssignModal(false);
      await loadComplaints();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleUpdateStatus = async (complaintId, newStatus) => {
    const targetC = complaints.find(c => c.id === complaintId);

    if (targetC?.ioStatus === 'Disposed' || targetC?.ioStatus === 'Convert to FIR') {
       message.error('This complaint has already been finalized by the SHO. Status cannot be changed.');
       return;
    }
    if (targetC?.ioStatus === 'Pending SHO Approval') {
       message.error('Your recommendation is pending SHO approval. Status cannot be changed.');
       return;
    }

    // Check: docs required for Disposed/Convert to FIR
    const hasInvestigationDocs =
      !targetC?.isReportRejected && (
        (targetC?.investigationReport && targetC.investigationReport.trim() !== '') ||
        (targetC?.investigationFiles && targetC.investigationFiles.length > 0)
      );
    if ((newStatus === 'Disposed' || newStatus === 'Convert to FIR') && !hasInvestigationDocs) {
      message.error(`You must attach investigation documents before marking as ${newStatus}.`);
      return;
    }

    let updatedStatus = newStatus;
    let pendingStatus = null;

    if (newStatus === 'Disposed' || newStatus === 'Convert to FIR') {
      updatedStatus = 'Pending SHO Approval';
      pendingStatus = newStatus;
    }

    const updates = pendingStatus 
      ? { ioStatus: updatedStatus, pendingIoStatus: pendingStatus } 
      : { ioStatus: updatedStatus, pendingIoStatus: null };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints/${complaintId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update status');

      message.success(pendingStatus ? `Sent request to SHO for ${pendingStatus}` : `Status updated successfully to ${newStatus}`);
      await loadComplaints();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleSaveIoReport = async () => {
    if (!ioReportText.trim() && ioAttachedFiles.length === 0) {
      message.warning('Please enter the report content or attach documents.');
      return;
    }

    let savedFileRecords = [];

    // Upload files to server if any are attached
    if (ioAttachedFiles.length > 0) {
      const hide = message.loading('Uploading files to server...', 0);
      try {
        const formData = new FormData();
        for (const f of ioAttachedFiles) {
          const fileObj = f.originFileObj || f;
          if (fileObj instanceof File || fileObj instanceof Blob) {
            formData.append('files', fileObj, fileObj.name || f.name);
          }
        }
        const res = await fetch(`${import.meta.env.VITE_API_URL}/complaint-files/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        hide();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        // data.files = [{ name, url, mimetype }]
        savedFileRecords = data.files;
        message.success(`${savedFileRecords.length} file(s) uploaded successfully.`);
      } catch (err) {
        hide();
        message.error(`File upload failed: ${err.message}`);
        return;
      }
    }

    const reportText = ioReportText.trim() || (savedFileRecords.length > 0 ? '[Files Attached]' : '');
    const updates = { investigationReport: reportText, investigationFiles: savedFileRecords, isReportRejected: false };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints/${activeReportComplaintId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to save investigation report');

      message.success('Final investigation report and documents attached successfully.');
      setShowIoReportModal(false);
      await loadComplaints();
      if (selectedComplaint && selectedComplaint.id === activeReportComplaintId) {
        setSelectedComplaint({ ...selectedComplaint, investigationReport: reportText, investigationFiles: savedFileRecords, isReportRejected: false });
      }
    } catch (err) {
      message.error(err.message);
    }
  };


  const handleShoApproval = async (complaintId, isApproved) => {
    const targetC = complaints.find(c => c.id === complaintId && c.ioStatus === 'Pending SHO Approval');
    if (!targetC) return;
    // ── Normal approval / rejection ─────────────────────────────────────────
    let msg = '';
    let updates = {};
    if (isApproved) {
      msg = `Approved: Status is now ${targetC.pendingIoStatus}`;
      updates = { ioStatus: targetC.pendingIoStatus, pendingIoStatus: null };
    } else {
      msg = `Rejected request for ${targetC.pendingIoStatus}. Status reverted to Under Investigation.`;
      updates = { 
        ioStatus: 'Under Investigation', 
        pendingIoStatus: null, 
        isReportRejected: true,
        investigationReport: '',
        investigationFiles: []
      };
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints/${complaintId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update complaint status');
      
      message.success(msg);
      await loadComplaints();
    } catch (err) {
      message.error(err.message);
    }
  };

  const filteredComplaints = complaints.filter(c => {
    const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    const q = searchVal.toLowerCase();
    return !q || name.includes(q) || (c.id && c.id.toLowerCase().includes(q)) || (c.mobileNumber && c.mobileNumber.includes(q));
  });

  const isEnquiryReport = selectedTemplate && (
    selectedTemplate.startsWith('enquiry_') ||
    customTemplates.some(t => t.id === selectedTemplate && t.category.startsWith('enquiry_'))
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} style={{ background: '#1f1f1f', color: '#177ddc', borderColor: '#303030', borderRadius: '8px', padding: '4px 16px', fontWeight: 500 }} onClick={showDocGen ? () => setShowDocGen(false) : onBack}>Back</Button>
        <Title level={3} style={{ margin: 0 }}>
          {showDocGen ? 'Document Generation' : 'Enquire Registered Complaints'}
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

            {['sho', 'admin'].includes(String(profile?.role).toLowerCase()) && (
              <>
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<PlusOutlined />} 
                  onClick={() => {
                    setSelectedIoForAssign(null);
                    setShowAssignModal(true);
                  }}
                  style={{ borderRadius: '8px', fontWeight: 'bold', width: '250px', textAlign: 'left' }}
                >
                  Assign / Change IO
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

                <Button 
                  type="primary" 
                  size="large" 
                  icon={<SwapOutlined />} 
                  onClick={() => setShowTransferModal(true)}
                  style={{ borderRadius: '8px', fontWeight: 'bold', width: '250px', textAlign: 'left' }}
                >
                  Transfer Complaint
                </Button>
              </>
            )}

            {String(profile?.role).toLowerCase() === 'io' && (
              <Button 
                type="primary" 
                size="large" 
                icon={<RobotOutlined />} 
                onClick={() => setShowIoComplaintsModal(true)}
                style={{ borderRadius: '8px', fontWeight: 'bold', width: '250px', textAlign: 'left' }}
              >
                Assigned Complaints & Status
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {complaints.length === 0 && (
            <Card style={{ marginBottom: 24 }}>
              <Empty
                image={<FileTextOutlined style={{ fontSize: 48, color: '#aaa' }} />}
                description={
                  <span>
                    No registered complaints found. Please{' '}
                    <a onClick={onBack}>register a complaint</a> first.
                  </span>
                }
              />
            </Card>
          )}
          {selectedComplaint && (
            <Card
              title={
                <span style={{ fontWeight: 600 }}>
                  Select Document Template for Complaint <Tag color="blue">{selectedComplaint.id}</Tag>
                </span>
              }
            >
              {/* Alert for saved draft */}
              {savedDraft && (
                <Alert
                  message={
                    <span>
                      You have a saved draft for this complaint from{' '}
                      <strong>{dayjs(savedDraft.updatedAt).format('DD MMM YYYY, hh:mm A')}</strong>.
                    </span>
                  }
                  type="info"
                  showIcon
                  action={
                    <Space>
                      <Button size="small" type="primary" onClick={handleResumeDraft}>
                        Resume Draft
                      </Button>
                      <Button size="small" type="text" danger onClick={handleDiscardDraft}>
                        Discard
                      </Button>
                    </Space>
                  }
                  style={{ marginBottom: 16 }}
                />
              )}

              <Row gutter={24}>
                <Col span={7}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 }}>
                    {renderTemplateSection('notice', 'Notice for Appearance', 'default')}
                    {renderTemplateSection('email', 'Email / Status Update', 'default')}
                    <div style={{ margin: '20px 0 12px 0', textAlign: 'center', background: 'rgba(24, 144, 255, 0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(24, 144, 255, 0.35)', boxShadow: '0 0 6px rgba(24,144,255,0.1)' }}>
                      <Text strong style={{ color: '#1890ff', fontSize: 13, letterSpacing: '0.8px', textTransform: 'uppercase', textShadow: '0 0 4px rgba(24,144,255,0.2)' }}>Enquiry Reports</Text>
                    </div>
                    {renderTemplateSection('enquiry_rajinama', 'Rajinama (Mutual Settlement)', 'dashed')}
                    {renderTemplateSection('enquiry_civil_land', 'Civil Nature (Land Dispute)', 'dashed')}
                    {renderTemplateSection('enquiry_civil_finance', 'Civil Nature (Financial Dispute)', 'dashed')}
                    {renderTemplateSection('enquiry_ncr', 'Non-Cognizable Offence (NCR)', 'dashed')}
                    {renderTemplateSection('enquiry_fir', 'FIR Registration Recommended', 'dashed')}
                    {renderTemplateSection('enquiry_transfer', 'Transfer to other Police Station', 'dashed')}
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

                          {noticeRecipient === 'accused' && selectedComplaint?.accusedList?.length > 1 && (
                            <div style={{ marginBottom: 16, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                              <Text strong style={{ display: 'block', marginBottom: 8, color: '#1890ff' }}>Select Specific Accused for Notice:</Text>
                              <Checkbox.Group 
                                options={selectedComplaint.accusedList.map((a, i) => ({ label: a.name, value: i }))} 
                                value={selectedAccusedIndices} 
                                onChange={handleAccusedSelectionChange} 
                              />
                              <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                                (If none selected, notice will be addressed to all accused)
                              </Text>
                            </div>
                          )}

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
                        <div style={{ marginBottom: 16, padding: '16px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid #434343', borderRadius: 8 }}>
                          <Text strong style={{ display: 'block', marginBottom: 12 }}>Email Recipient:</Text>
                          <Radio.Group 
                            value={emailRecipient} 
                            onChange={e => handleEmailRecipientChange(e.target.value)}
                            style={{ marginBottom: 16 }}
                          >
                            <Radio value="accused">Accused</Radio>
                            <Radio value="complainant">Complainant</Radio>
                            <Radio value="other">Other Person</Radio>
                          </Radio.Group>

                          {emailRecipient === 'accused' && selectedComplaint?.accusedList?.length > 1 && (
                            <div style={{ marginBottom: 16, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                              <Text strong style={{ display: 'block', marginBottom: 8, color: '#1890ff' }}>Select Specific Accused for Email:</Text>
                              <Checkbox.Group 
                                options={selectedComplaint.accusedList.map((a, i) => ({ label: a.name, value: i }))} 
                                value={emailSelectedAccusedIndices} 
                                onChange={handleEmailAccusedSelectionChange} 
                              />
                              <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                                (If none selected, email will be addressed to all accused)
                              </Text>
                            </div>
                          )}

                          {emailRecipient === 'other' && (
                            <Row gutter={16} style={{ marginBottom: 16 }}>
                              <Col span={10}>
                                <Input 
                                  placeholder="Name" 
                                  value={emailOtherPersonName} 
                                  onChange={e => setEmailOtherPersonName(e.target.value)} 
                                  onBlur={() => handleEmailRecipientChange('other')}
                                />
                              </Col>
                              <Col span={14}>
                                <Input 
                                  placeholder="Full Address" 
                                  value={emailOtherPersonAddress} 
                                  onChange={e => setEmailOtherPersonAddress(e.target.value)}
                                  onBlur={() => handleEmailRecipientChange('other')}
                                />
                              </Col>
                            </Row>
                          )}

                          {/* -- Draft Email with AI block -- */}
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #303030' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div>
                                <Text strong style={{ display: 'block', marginBottom: 2, color: '#1890ff' }}>
                                  <RobotOutlined style={{ marginRight: 6 }} />
                                  Draft Email with AI
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  Describe what you want to write — AI will draft the full email.
                                </Text>
                              </div>
                              <Button
                                type="primary"
                                icon={<RobotOutlined />}
                                onClick={handleGenerateEmailWithAI}
                                loading={isAiLoading}
                                disabled={!emailPrompt.trim()}
                                size="small"
                              >
                                Generate
                              </Button>
                            </div>
                            <TextArea
                              rows={2}
                              placeholder="E.g., Write that accused should appear on 25th June with all documents related to the land dispute."
                              value={emailPrompt}
                              onChange={e => setEmailPrompt(e.target.value)}
                              style={{ resize: 'none', width: '100%' }}
                            />
                          </div>
                        </div>
                      )}

                      {/* -- Enquiry Report Configuration Header (AI Prompt Block) -- */}
                      {isEnquiryReport && (
                        <div style={{ marginBottom: 16, padding: '16px', background: 'rgba(24, 144, 255, 0.1)', borderRadius: 8, border: '1px solid rgba(24, 144, 255, 0.3)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div>
                              <Text strong style={{ display: 'block', marginBottom: 4, color: '#1890ff' }}>
                                <RobotOutlined style={{ marginRight: 6 }} />
                                Modify Report with AI
                              </Text>
                              <Text type="secondary" style={{ fontSize: 13 }}>
                                Tell the AI what details to modify, add, or fill in this Enquiry Report.
                              </Text>
                            </div>
                            <Button 
                              type="primary" 
                              icon={<RobotOutlined />} 
                              onClick={handleModifyReportWithAI}
                              loading={isAiLoading}
                            >
                              Modify Report
                            </Button>
                          </div>
                          <TextArea 
                            rows={2} 
                            placeholder="E.g., Write that complainant and accused settled the dispute and signed the settlement copy." 
                            value={reportPrompt}
                            onChange={e => setReportPrompt(e.target.value)}
                            style={{ resize: 'none', width: '100%' }}
                          />
                        </div>
                      )}

                      {/* -- Actions & Editor Toolbar -- */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Button
                            type={isRecording ? 'primary' : 'default'}
                            danger={isRecording}
                            loading={isTranscribing}
                            icon={<RobotOutlined spin={isRecording} />}
                            onClick={handleVoiceToggle}
                            style={{
                              animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                            }}
                          >
                            {isRecording ? 'Listening (Click to Stop)' : isTranscribing ? 'Transcribing...' : 'Voice Typing (STT)'}
                          </Button>
                          
                          <Button
                            type="default"
                            onClick={() => handleTranslate('English')}
                            disabled={isAiLoading || !documentText.trim()}
                          >
                            Convert to English
                          </Button>
                          <Button
                            type="default"
                            onClick={() => handleTranslate('Hindi')}
                            disabled={isAiLoading || !documentText.trim()}
                          >
                            Convert to Hindi
                          </Button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Button
                            type="default"
                            icon={<CheckCircleOutlined />}
                            onClick={handleSaveDraft}
                            style={{ background: '#141414', color: '#52c41a', borderColor: '#303030' }}
                          >
                            Save Draft
                          </Button>
                          <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleDownloadDocx}
                            disabled={!documentText}
                          >
                            Download as DOCX
                          </Button>
                        </div>
                      </div>
                      
                      <Spin spinning={isAiLoading} tip="Processing document...">
                        <div
                          ref={editorRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(e) => {
                            const html = e.currentTarget.innerHTML;
                            localHtmlRef.current = html;
                            setDocumentText(html);
                          }}
                          onMouseUp={handleEditorClickOrKey}
                          onKeyUp={handleEditorClickOrKey}
                          className="document-editor-container"
                          style={{ 
                            fontSize: 14, 
                            lineHeight: '1.7', 
                            fontFamily: 'Arial, sans-serif', 
                            width: '100%',
                            minHeight: selectedTemplate === 'notice' || selectedTemplate === 'email' ? '300px' : '500px',
                            maxHeight: '65vh',
                            overflowY: 'auto',
                            padding: '24px',
                            background: '#141414',
                            color: '#f0f6fc',
                            borderRadius: '8px',
                            border: isRecording ? '2px solid #ff4d4f' : '1px solid #303030',
                            boxShadow: isRecording ? '0 0 8px rgba(255, 77, 79, 0.2)' : 'none',
                            outline: 'none',
                            transition: 'all 0.3s ease',
                            whiteSpace: 'pre-wrap'
                          }}
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

      {/* MODAL: SHO Assigns or Changes IO */}
      <Modal
        title={selectedComplaint?.assignedIoId ? "Change IO for Complaint" : "Assign IO to Complaint"}
        open={showAssignModal}
        onCancel={() => setShowAssignModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowAssignModal(false)}>
            Cancel
          </Button>,
          <Button 
            key="assign" 
            type="primary" 
            onClick={() => {
              if (!selectedIoForAssign) {
                message.warning('Please select an IO.');
                return;
              }
              handleAssignIo();
            }}
            style={{ backgroundColor: '#1890ff', borderColor: '#1890ff', color: '#fff', borderRadius: '8px' }}
          >
            {selectedComplaint?.assignedIoId ? "Change IO" : "Assign IO"}
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Selected Complaint ID: </Text>
          <Text>{selectedComplaint?.id || 'None selected'}</Text>
        </div>
        
        {selectedComplaint?.assignedIoName && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>Currently Assigned IO: </Text>
            <Tag color="blue">{selectedComplaint.assignedIoName}</Tag>
          </div>
        )}

        {selectedComplaint?.id ? (
          <div>
            <Text>{selectedComplaint?.assignedIoId ? "Select New Investigating Officer:" : "Select Investigating Officer:"}</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select an IO"
              value={selectedIoForAssign}
              onChange={setSelectedIoForAssign}
            >
              {ioList
                .filter(io => io.id !== selectedComplaint?.assignedIoId)
                .map(io => (
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
              c.ioStatus === 'Pending SHO Approval' ? 'gold' :
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
                {c.ioStatus === 'Pending SHO Approval' && (
                  <div style={{ marginTop: 12, padding: 8, background: '#141414', border: '1px solid #d48806', borderRadius: 4 }}>
                    <Text strong style={{ color: '#d48806' }}>Action Required: </Text>
                    <Text>IO requested to mark as <strong style={{ color: c.pendingIoStatus === 'Convert to FIR' ? '#ff4d4f' : '#b37feb' }}>{c.pendingIoStatus}</strong></Text>
                    
                    {c.investigationReport && (
                      <div style={{ marginTop: 12, marginBottom: 12 }}>
                        <Button 
                          type="dashed" 
                          icon={<EyeOutlined />} 
                          onClick={() => {
                            setShoViewReportText(c.investigationReport);
                            setShoViewAttachedFiles(c.investigationFiles || []);
                            setShowShoReportModal(true);
                          }}
                        >
                          View IO Report & Documents
                        </Button>
                      </div>
                    )}

                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <Button type="primary" size="small" style={{ background: '#52c41a' }} onClick={() => handleShoApproval(c.id, true)}>Approve</Button>
                      <Button danger size="small" onClick={() => handleShoApproval(c.id, false)}>Reject</Button>
                    </div>
                  </div>
                )}
                {/* Show linked FIR badge once complaint has been converted */}
                {c.ioStatus === 'Convert to FIR' && c.linkedFirNumber && (
                  <div style={{ marginTop: 10, padding: '7px 12px', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.35)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Tag color="red" icon={<FileTextOutlined />} style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>FIR: {c.linkedFirNumber}</Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>Complaint converted — View & manage this case in the <strong>FIR Module</strong>.</Text>
                  </div>
                )}
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
              c.ioStatus === 'Pending SHO Approval' ? 'gold' :
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
                {c.ioStatus === 'Pending SHO Approval' && (
                  <div style={{ marginBottom: 12, color: '#d48806', fontWeight: 500 }}>
                    <i className="fas fa-clock" style={{ marginRight: 6 }}></i>
                    Waiting for SHO to approve your request to mark as "{c.pendingIoStatus}"
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Pending', 'Under Investigation', 'Disposed', 'Convert to FIR'].map(status => {
                    const isPendingApproval = c.ioStatus === 'Pending SHO Approval';
                    const isAlreadyClosed = c.ioStatus === 'Disposed' || c.ioStatus === 'Convert to FIR';
                    const isCurrent = (c.ioStatus || 'Pending') === status || (isPendingApproval && c.pendingIoStatus === status);
                    
                    const requiresReport = status === 'Disposed' || status === 'Convert to FIR';
                    // hasReport is true if either: (1) there is non-empty report text, OR (2) files were attached
                    const hasReport = !c.isReportRejected && ((c.investigationReport && c.investigationReport.trim() !== '') ||
                      (c.investigationFiles && c.investigationFiles.length > 0));
                    
                    // Disabled if already finalized, or pending approval, or missing report when needed
                    const disabled = isAlreadyClosed || isPendingApproval || (requiresReport && !hasReport);
                    
                    let titleText = '';
                    if (isAlreadyClosed) titleText = 'Finalized by SHO. Cannot be changed.';
                    else if (isPendingApproval) titleText = 'Pending SHO approval. Cannot be changed.';
                    else if (requiresReport && !hasReport) titleText = 'Please attach investigation documents first';

                    return (
                      <Button
                        key={status}
                        size="middle"
                        type={isCurrent ? 'primary' : 'default'}
                        danger={status === 'Convert to FIR' && isCurrent}
                        disabled={disabled}
                        title={titleText}
                        onClick={() => handleUpdateStatus(c.id, status)}
                      >
                        {status}
                      </Button>
                    );
                  })}
                </div>
                
                {/* Attach Report Section */}
                {c.ioStatus === 'Under Investigation' && (
                  <div style={{ marginTop: 16, padding: 12, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        <FileTextOutlined style={{ marginRight: 6 }} />
                        {c.investigationReport && !c.isReportRejected ? 'Documents attached. Ready for Disposal/FIR.' : 'Attach investigation documents to proceed to Disposed/FIR.'}
                      </Text>
                      <Button 
                        type={c.investigationReport && !c.isReportRejected ? "default" : "primary"} 
                        size="small"
                        icon={c.investigationReport && !c.isReportRejected ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <PlusOutlined />}
                        onClick={() => {
                          setActiveReportComplaintId(c.id);
                          setIoReportText(c.isReportRejected ? '' : (c.investigationReport || ''));
                          setIoAttachedFiles(c.isReportRejected ? [] : (c.investigationFiles ? c.investigationFiles.map((f, i) => {
                            const isObj = f && typeof f === 'object';
                            const name = isObj ? f.name : f;
                            return { uid: i, name, status: 'done' };
                          }) : []));
                          setShowIoReportModal(true);
                        }}
                        style={{ borderColor: c.investigationReport && !c.isReportRejected ? '#52c41a' : undefined }}
                      >
                        {c.investigationReport && !c.isReportRejected ? 'View Attached Documents' : 'Attach Documents'}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          });
        })()}
      </Modal>

      {/* ── Transfer Complaint Modal (SHO Only) ── */}
      {showTransferModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            background: '#1e2130',
            border: '1px solid #30363d',
            borderRadius: '10px',
            width: '480px',
            maxWidth: '95vw',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #30363d',
              background: 'rgba(59,130,246,0.15)',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <SwapOutlined style={{ fontSize: 18, color: '#3b82f6' }} />
              <span style={{ color: '#f0f6fc', fontWeight: 700, fontSize: '16px' }}>
                Transfer Complaint
              </span>
            </div>

            {/* Selected Complaint Info */}
            <div style={{ padding: '16px 24px 0', color: '#8b949e', fontSize: 13 }}>
              {selectedComplaint ? (
                <div style={{
                  background: 'rgba(59,130,246,0.08)',
                  border: '1px solid rgba(59,130,246,0.25)',
                  borderRadius: 6, padding: '10px 14px',
                }}>
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>Selected: </span>
                  <span style={{ color: '#f0f6fc' }}>{selectedComplaint.id}</span>
                  <span style={{ color: '#8b949e', marginLeft: 10 }}>
                    {[selectedComplaint.firstName, selectedComplaint.lastName].filter(Boolean).join(' ')}
                  </span>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.25)',
                  borderRadius: 6, padding: '10px 14px', color: '#fbbf24',
                }}>
                  ⚠️ No complaint selected. Please select a complaint first via Document Generation.
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* District */}
              <div>
                <label style={{ color: '#c9d1d9', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Transfer to District
                </label>
                <select
                  value={transferDistrict}
                  onChange={e => { setTransferDistrict(e.target.value); setTransferPS(''); }}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: '#252839', border: '1px solid #30363d',
                    color: '#f0f6fc', fontSize: 13, outline: 'none',
                  }}
                >
                  <option value="">-- Select District --</option>
                  {districts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Police Station */}
              <div>
                <label style={{ color: '#c9d1d9', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Transfer to Police Station
                </label>
                <select
                  value={transferPS}
                  onChange={e => setTransferPS(e.target.value)}
                  disabled={!transferDistrict}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: '#252839', border: '1px solid #30363d',
                    color: transferDistrict ? '#f0f6fc' : '#8b949e', fontSize: 13, outline: 'none',
                    opacity: transferDistrict ? 1 : 0.6,
                  }}
                >
                  <option value="">-- Select Police Station --</option>
                  {(policeStationsByDistrict[transferDistrict] || []).map(ps => (
                    <option key={ps} value={ps}>{ps}</option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label style={{ color: '#c9d1d9', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Transfer Reason
                </label>
                <textarea
                  rows={3}
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  placeholder="Enter reason for transfer..."
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: '#252839', border: '1px solid #30363d',
                    color: '#f0f6fc', fontSize: 13, outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 24px 20px',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
            }}>
              <button
                onClick={() => { setShowTransferModal(false); setTransferDistrict(''); setTransferPS(''); setTransferReason(''); }}
                style={{
                  padding: '7px 20px', borderRadius: 6,
                  border: '1px solid #30363d', background: 'transparent',
                  color: '#3b82f6', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!selectedComplaint || !transferDistrict || !transferPS || !transferReason.trim()}
                style={{
                  padding: '7px 20px', borderRadius: 6,
                  border: 'none', background: (!selectedComplaint || !transferDistrict || !transferPS || !transferReason.trim()) ? '#1f2937' : '#1677ff',
                  color: '#ffffff', cursor: (!selectedComplaint || !transferDistrict || !transferPS || !transferReason.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IO Report Modal (Read-Only once saved) ── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: '#3b82f6' }} />
            <span>Attach Investigation Documents & Report</span>
          </div>
        }
        open={showIoReportModal}
        onCancel={() => {
          if (reportIsRecording) {
            reportToggleRecording();
          }
          setShowIoReportModal(false);
        }}
        footer={null}
        width={700}
      >
        {(() => {
          const currentC = complaints.find(c => c.id === activeReportComplaintId);
          const isAlreadyAttached = (!!currentC?.investigationReport || (currentC?.investigationFiles && currentC.investigationFiles.length > 0)) && !currentC?.isReportRejected;
          
          return (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">Complaint ID:</Text> <Text strong>{activeReportComplaintId}</Text>
              </div>
              
              {isAlreadyAttached ? (
                <div style={{ background: '#1e2130', padding: 16, borderRadius: 8, border: '1px solid #30363d' }}>
                  <div style={{ marginBottom: 12, color: '#52c41a', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircleOutlined /> Documents and report have been finalized and cannot be rewritten.
                  </div>
                  {currentC.investigationFiles && currentC.investigationFiles.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Attached Files:</Text>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {currentC.investigationFiles.map((file, idx) => {
                          const isObj = file && typeof file === 'object';
                          const name = isObj ? file.name : file;
                          return (
                            <div key={idx} style={{ background: '#252839', padding: '8px 12px', borderRadius: 4, border: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <UploadOutlined style={{ color: '#8b949e' }} />
                              <Text style={{ color: '#c9d1d9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Text>
                              <Button size="small" type="primary" ghost style={{ flexShrink: 0 }}
                                onClick={() => isObj ? setPreviewFile({ name: file.name, url: file.url, type: file.mimetype || '' }) : setPreviewFile(name)}
                              >View File</Button>
                            </div>
                          );
                        })}
                      </Space>
                    </div>
                  )}
                  {currentC.investigationReport && (
                    <>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Written Details:</Text>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#e5e7eb', fontSize: 14, fontFamily: 'monospace', lineHeight: 1.6, background: '#13151f', padding: 12, borderRadius: 4 }}>
                        {currentC.investigationReport}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {currentC?.isReportRejected && (
                    <div style={{ marginBottom: 12, color: '#f87171', fontSize: 13, background: '#450a0a', padding: '8px 12px', borderRadius: 6, border: '1px solid #7f1d1d' }}>
                      ❌ Your previous report was rejected by the SHO. Please update your documents/details and submit again.
                    </div>
                  )}
                  <div style={{ marginBottom: 12, color: '#fbbf24', fontSize: 13 }}>
                    ⚠️ Note: Once these documents and details are saved, they become final and <strong>cannot be edited or rewritten</strong>.
                  </div>
                  
                  <div style={{ marginBottom: 20 }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Attach Evidences (PDF, Image, Video, Audio):</Text>
                    <Upload
                      multiple
                      fileList={ioAttachedFiles}
                      beforeUpload={(file) => {
                        setIoAttachedFiles(prev => [...prev, file]);
                        return false; // Prevent auto upload
                      }}
                      onRemove={(file) => {
                        setIoAttachedFiles(prev => prev.filter(f => f.uid !== file.uid));
                      }}
                      itemRender={(originNode, file, currFileList, actions) => {
                        return (
                          <div 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              padding: '8px 12px', 
                              background: '#252839', 
                              border: '1px solid #30363d', 
                              borderRadius: 4, 
                              marginBottom: 8 
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', marginRight: 12 }}>
                              <PaperClipOutlined style={{ color: '#8b949e', flexShrink: 0 }} />
                              <span style={{ color: '#c9d1d9', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {file.name}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                              <Button 
                                size="small" 
                                type="primary" 
                                ghost 
                                onClick={() => {
                                  const fileObj = file.originFileObj || file;
                                  const isRealFile = fileObj instanceof File || fileObj instanceof Blob || (fileObj && typeof fileObj === 'object' && 'size' in fileObj && 'type' in fileObj);
                                  if (isRealFile) {
                                    const url = URL.createObjectURL(fileObj);
                                    setPreviewFile({
                                      name: file.name || fileObj.name,
                                      url: url,
                                      type: fileObj.type || ''
                                    });
                                  } else {
                                    setPreviewFile(file.name || file.uid);
                                  }
                                }}
                              >
                                View File
                              </Button>
                              <DeleteOutlined 
                                style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 16 }} 
                                onClick={actions.remove} 
                              />
                            </div>
                          </div>
                        );
                      }}
                    >
                      <Button icon={<UploadOutlined />}>Select Files</Button>
                    </Upload>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text type="secondary" style={{ margin: 0 }}>Written Details (Optional):</Text>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Button
                        type="default"
                        size="small"
                        disabled={reportIsRecording || reportIsTranscribing || isReportTranslating || !ioReportText.trim()}
                        loading={isReportTranslating}
                        onClick={handleTranslateReportToEnglish}
                        style={{
                          borderRadius: '6px',
                          fontWeight: 500,
                        }}
                      >
                        Convert to English
                      </Button>
                      <Button
                        type={reportIsRecording ? 'primary' : 'default'}
                        danger={reportIsRecording}
                        loading={reportIsTranscribing}
                        icon={<RobotOutlined spin={reportIsRecording} />}
                        onClick={handleReportVoiceToggle}
                        size="small"
                        style={{
                          animation: reportIsRecording ? 'pulse 1.5s infinite' : 'none',
                          borderRadius: '6px',
                          fontWeight: 500,
                        }}
                      >
                        {reportIsRecording ? 'Listening (Click to Stop)' : reportIsTranscribing ? 'Transcribing...' : 'Voice Typing (STT)'}
                      </Button>
                    </div>
                  </div>
                  <TextArea
                    rows={8}
                    value={
                      reportIsTranscribing 
                        ? `${ioReportText}\n[Transcribing...]` 
                        : reportIsRecording 
                          ? `${ioReportText}\n[Listening: ${reportInterimText || '...'}]` 
                          : ioReportText
                    }
                    onChange={e => {
                      if (!reportIsRecording && !reportIsTranscribing) {
                        setIoReportText(e.target.value);
                      }
                    }}
                    disabled={reportIsRecording || reportIsTranscribing}
                    placeholder="Enter the detailed investigation report, actions taken, and final recommendations here..."
                    style={{ fontFamily: 'monospace', fontSize: 14, padding: 12 }}
                  />
                  <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <Button onClick={() => setShowIoReportModal(false)}>Cancel</Button>
                    <Button type="primary" onClick={handleSaveIoReport} disabled={!ioReportText.trim() && ioAttachedFiles.length === 0}>
                      Submit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ── SHO View Report Modal ── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EyeOutlined style={{ color: '#3b82f6' }} />
            <span>IO Investigation Documents & Report</span>
          </div>
        }
        open={showShoReportModal}
        onCancel={() => setShowShoReportModal(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setShowShoReportModal(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        <div style={{ background: '#1e2130', padding: 16, borderRadius: 8, border: '1px solid #30363d', maxHeight: '60vh', overflowY: 'auto' }}>
          {shoViewAttachedFiles && shoViewAttachedFiles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Attached Files:</Text>
              <Space direction="vertical" style={{ width: '100%' }}>
                {shoViewAttachedFiles.map((file, idx) => {
                  const isObj = file && typeof file === 'object';
                  const name = isObj ? file.name : file;
                  return (
                    <div key={idx} style={{ background: '#252839', padding: '8px 12px', borderRadius: 4, border: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <UploadOutlined style={{ color: '#8b949e' }} />
                      <Text style={{ color: '#c9d1d9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Text>
                      <Button size="small" type="primary" ghost style={{ flexShrink: 0 }}
                        onClick={() => isObj ? setPreviewFile({ name: file.name, url: file.url, type: file.mimetype || '' }) : setPreviewFile(name)}
                      >View File</Button>
                    </div>
                  );
                })}

              </Space>
            </div>
          )}
          {shoViewReportText && (
            <>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Written Details:</Text>
              <div style={{ whiteSpace: 'pre-wrap', color: '#e5e7eb', fontSize: 14, fontFamily: 'monospace', lineHeight: 1.6, background: '#13151f', padding: 12, borderRadius: 4 }}>
                {shoViewReportText}
              </div>
            </>
          )}
          {!shoViewReportText && (!shoViewAttachedFiles || shoViewAttachedFiles.length === 0) && (
            <Empty description="No documents or details were provided by the IO." />
          )}
        </div>
      </Modal>

      {/* ── File Preview Modal ── */}
      <Modal
        title={previewFile && typeof previewFile === 'object' ? `Viewing: ${previewFile.name}` : `Viewing: ${previewFile}`}
        open={!!previewFile}
        onCancel={handleClosePreview}
        footer={[
          <Button key="close" type="primary" onClick={handleClosePreview}>
            Close
          </Button>
        ]}
        width={800}
        style={{ top: 20 }}
      >
        <div style={{ height: '60vh', background: '#141414', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          {previewFile && typeof previewFile === 'object' && previewFile.url ? (
            (() => {
              const type = previewFile.type || '';
              const name = previewFile.name || '';
              
              if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
                return (
                  <iframe
                    src={previewFile.url}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title={name}
                  />
                );
              } else if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)) {
                return (
                  <img
                    src={previewFile.url}
                    alt={name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                );
              } else if (type.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(name)) {
                return (
                  <video
                    src={previewFile.url}
                    controls
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  />
                );
              } else if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(name)) {
                return (
                  <audio
                    src={previewFile.url}
                    controls
                    style={{ width: '80%' }}
                  />
                );
              } else {
                return (
                  <div style={{ padding: 20, textAlign: 'center' }}>
                    <FileTextOutlined style={{ fontSize: 64, color: '#3b82f6', marginBottom: 16 }} />
                    <Text style={{ color: '#e5e7eb', fontSize: 18, display: 'block' }}>{name}</Text>
                    <Text type="secondary" style={{ marginTop: 12 }}>
                      No preview available for this file type.
                    </Text>
                  </div>
                );
              }
            })()
          ) : (
            <>
              <FileTextOutlined style={{ fontSize: 64, color: '#3b82f6', marginBottom: 16 }} />
              <Text style={{ color: '#e5e7eb', fontSize: 18 }}>{previewFile}</Text>
              <Text type="secondary" style={{ marginTop: 12, textAlign: 'center', maxWidth: 400 }}>
                Document preview is simulated.<br />
                In a real environment with a backend, this area would display the actual PDF, Image, or Video content uploaded by the IO.
              </Text>
            </>
          )}
        </div>
      </Modal>

    </div>
  );
}
