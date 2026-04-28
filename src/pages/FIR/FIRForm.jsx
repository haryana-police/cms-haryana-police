import React, { useState, useRef } from 'react';
import {
  Form, Input, Select, DatePicker, TimePicker, Button, Card,
  Typography, Row, Col, Divider, InputNumber, Radio,
  message, Alert, Tag, Space, Tooltip, Upload, Result,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined,
  FileAddOutlined, InfoCircleOutlined, UploadOutlined, PrinterOutlined,
  AudioOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import dayjs from 'dayjs';
import '../../styles/fir.css';
import FIRPrintDocument from './FIRPrintDocument';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ─── DATA CONSTANTS ───────────────────────────────────────────────────────────

const ACTS_LIST = [
  'THE BHARATIYA NYAYA SANHITA (BNS), 2023',
  'THE BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS), 2023',
  'THE BHARATIYA SAKSHYA ADHINIYAM (BSA), 2023',
  'ARMS ACT, 1959',
  'NARCOTIC DRUGS AND PSYCHOTROPIC SUBSTANCES ACT, 1985 (NDPS)',
  'INFORMATION TECHNOLOGY ACT, 2000',
  'MOTOR VEHICLES ACT, 1988',
  'PROTECTION OF CHILDREN FROM SEXUAL OFFENCES ACT, 2012 (POCSO)',
  'PREVENTION OF CORRUPTION ACT, 1988',
  'SC/ST (PREVENTION OF ATROCITIES) ACT, 1989',
  'EXPLOSIVES ACT, 1884',
  'EXCISE ACT',
  'GAMBLING ACT',
  'FOREST ACT',
  'OTHER',
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_PERIODS = [
  'Pahar 1 (00:00–03:00 hrs)', 'Pahar 2 (03:00–06:00 hrs)',
  'Pahar 3 (06:00–09:00 hrs)', 'Pahar 4 (09:00–12:00 hrs)',
  'Pahar 5 (12:00–15:00 hrs)', 'Pahar 6 (15:00–18:00 hrs)',
  'Pahar 7 (18:00–21:00 hrs)', 'Pahar 8 (21:00–24:00 hrs)',
];

const DIRECTIONS = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTH-EAST', 'NORTH-WEST', 'SOUTH-EAST', 'SOUTH-WEST'];

const ID_TYPES = ['Aadhaar Card', 'Voter ID Card', 'Passport', 'Driving License', 'PAN Card', 'Ration Card', 'Other'];

const PROPERTY_CATEGORIES = ['Cash', 'Vehicle', 'Weapon', 'Electronic Device', 'Jewellery', 'Drugs/Narcotics', 'Documents', 'Other'];

const OFFICER_RANKS = [
  'DGP', 'ADGP', 'IGP', 'DIG', 'SSP', 'SP', 'ASP', 'DSP',
  'Inspector', 'Sub-Inspector (SI)', 'Asst. Sub-Inspector (ASI)',
  'Head Constable (HC)', 'Constable', 'Other',
];

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────

const SectionHeader = ({ number, title, subtitle }) => (
  <div className="fir-section-header">
    <div className="fir-section-badge">{number}</div>
    <div className="fir-section-text">
      <span className="fir-section-title">{title}</span>
      {subtitle && <span className="fir-section-subtitle"> ({subtitle})</span>}
    </div>
  </div>
);

const SubLabel = ({ letter, text, textHi }) => (
  <div className="fir-sub-label">
    <span className="fir-sub-letter">({letter})</span>
    <span>{text}</span>
    {textHi && <span className="fir-sub-hindi"> {textHi}</span>}
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const normFile = (e) => {
  if (Array.isArray(e)) {
    return e;
  }
  return e?.fileList;
};

export default function FIRForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [registeredFir, setRegisteredFir] = useState(null);
  const { token, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // AI & Query Params Auto-Fill states
  const [autoFilledFields, setAutoFilledFields] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [extractingContent, setExtractingContent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [dictationLang, setDictationLang] = useState('hi-IN');

  React.useEffect(() => {
    // Check for query params passed from other modules (M1 Complaint, M8 GD)
    const searchParams = new URLSearchParams(location.search);
    const complaintId = searchParams.get('complaint_id');
    const gdEntryNo = searchParams.get('gd_entry_no');

    if (complaintId || gdEntryNo) {
      const updates = {};
      const fields = [];

      if (complaintId) {
        updates.complaint_id = complaintId;
        // Pre-fill fields if passed from Complaints module
        if (searchParams.get('complainant_name')) { updates.complainant_name = searchParams.get('complainant_name'); fields.push('complainant_name'); }
        if (searchParams.get('complainant_phone')) { updates.complainant_phone = searchParams.get('complainant_phone'); fields.push('complainant_phone'); }
        if (searchParams.get('district')) { updates.district = searchParams.get('district'); fields.push('district'); }
      }

      if (gdEntryNo) {
        updates.gd_entry_no = gdEntryNo;
        fields.push('gd_entry_no');
        if (searchParams.get('description')) {
          updates.fir_content = `GD Entry Context: ${searchParams.get('description')}\n`;
          fields.push('fir_content');
        }
      }

      if (Object.keys(updates).length > 0) {
        form.setFieldsValue(updates);
        setAutoFilledFields(prev => [...new Set([...prev, ...fields])]);
        message.info('Form pre-filled with data from linked module.');
      }
    }
  }, [location, form]);

  const handlePdfUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    setExtracting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/extract-pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract PDF');
      
      const parsedData = { ...data };
      if (parsedData.date_time_of_fir) {
        parsedData.date_time_of_fir = dayjs(parsedData.date_time_of_fir);
      }

      form.setFieldsValue(parsedData);
      setAutoFilledFields(Object.keys(parsedData));
      message.success('AI Auto-Fill complete. Please review the highlighted fields.');
    } catch (err) {
      message.error(err.message);
    } finally {
      setExtracting(false);
    }
    return false; // prevent default upload action
  };

  const handleContentPdfUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    setExtractingContent(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/extract-pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract text from PDF');
      
      const currentVal = form.getFieldValue('fir_content') || '';
      const newText = data.fir_content || '';
      form.setFieldsValue({ fir_content: currentVal ? `${currentVal}\n\n${newText}` : newText });
      message.success('Text extracted and added to narrative.');
    } catch (err) {
      message.error(err.message);
    } finally {
      setExtractingContent(false);
    }
    return false; // prevent default upload action
  };

  const handleVoiceToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      message.error("Speech Recognition is not supported in this browser. Try Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = dictationLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      message.info("Listening... Speak your narrative clearly.");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const currentVal = form.getFieldValue('fir_content') || '';
      form.setFieldsValue({ fir_content: currentVal ? `${currentVal} ${transcript}` : transcript });
      message.success("Speech captured and added!");
    };

    recognition.onerror = (event) => {
      console.error(event.error);
      message.error("Microphone error or no speech detected.");
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleValuesChange = (changedValues) => {
    const changedKeys = Object.keys(changedValues);
    setAutoFilledFields(prev => prev.filter(k => !changedKeys.includes(k)));
  };

  const getAiClass = (fieldName) => autoFilledFields.includes(fieldName) ? 'fir-ai-filled fir-ai-filled-label' : '';

  // Dynamic table states
  const [actsSections, setActsSections] = useState([{ act: '', sections: '' }]);
  const [accused, setAccused] = useState([{ name: '', alias: '', relative_name: '', phone: '', address: '' }]);
  const [idDetails, setIdDetails] = useState([]);
  const [properties, setProperties] = useState([]);

  const totalPropertyValue = properties.reduce((s, p) => s + (Number(p.value) || 0), 0);

  // ── SUBMIT ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (values) => {
    const filteredActs = actsSections.filter(r => r.act.trim());
    if (filteredActs.length === 0) {
      message.error('At least one Act & Section is required (Section 2)');
      return;
    }

    setLoading(true);
    try {
      const fmt = (d) => d ? d.format('YYYY-MM-DD') : null;
      const fmtT = (t) => t ? t.format('HH:mm') : null;
      const fmtDT = (dt) => dt ? dt.format('YYYY-MM-DD HH:mm') : null;

      const payload = {
        district: values.district,
        police_station: values.police_station,
        date_time_of_fir: fmtDT(values.date_time_of_fir) || dayjs().format('YYYY-MM-DD HH:mm'),
        acts_sections: filteredActs,
        occurrence_day: values.occurrence_day,
        occurrence_date_from: fmt(values.occurrence_date_from),
        occurrence_date_to: fmt(values.occurrence_date_to),
        occurrence_time_period: values.occurrence_time_period,
        occurrence_time_from: fmtT(values.occurrence_time_from),
        occurrence_time_to: fmtT(values.occurrence_time_to),
        info_received_date: fmt(values.info_received_date),
        info_received_time: fmtT(values.info_received_time),
        gd_entry_no: values.gd_entry_no,
        gd_date_time: fmtDT(values.gd_date_time),
        info_type: values.info_type || 'Written',
        place_direction: values.place_direction,
        place_distance: values.place_distance,
        beat_no: values.beat_no,
        place_address: values.place_address,
        outside_ps_name: values.outside_ps_name,
        outside_district: values.outside_district,
        complainant_name: values.complainant_name,
        complainant_father_name: values.complainant_father_name,
        complainant_dob: values.complainant_dob,
        complainant_nationality: values.complainant_nationality || 'INDIA',
        complainant_uid: values.complainant_uid,
        complainant_passport: values.complainant_passport,
        complainant_id_details: idDetails.filter(r => r.id_type),
        complainant_occupation: values.complainant_occupation,
        complainant_present_address: values.complainant_present_address,
        complainant_permanent_address: values.complainant_permanent_address,
        complainant_phone: values.complainant_phone,
        accused_details: accused.filter(a => a.name.trim()),
        delay_reason: values.delay_reason,
        property_details: properties,
        total_property_value: totalPropertyValue,
        fir_content: values.fir_content,
        io_name: values.io_name,
        io_rank: values.io_rank,
        io_no: values.io_no,
        refused_reason: values.refused_reason,
        transferred_ps: values.transferred_ps,
        transferred_district: values.transferred_district,
        officer_name: values.officer_name,
        officer_rank: values.officer_rank,
        officer_no: values.officer_no,
        dispatch_date_time: fmtDT(values.dispatch_date_time),
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register FIR');
      message.success(`FIR #${data.fir_number} registered successfully!`);
      // save full data so the printable template has all fields
      setRegisteredFir({
        ...data,
        ...payload,
        registered_by_name: profile?.full_name,
      });
      window.scrollTo(0, 0);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── DYNAMIC ROW HELPERS ──────────────────────────────────────────────────────
  const updateRow = (setter) => (i, field, val) =>
    setter(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n; });
  const removeRow = (setter) => (i) =>
    setter(prev => prev.filter((_, idx) => idx !== i));

  const updateAct = updateRow(setActsSections);
  const removeAct = removeRow(setActsSections);
  const updateAccused = updateRow(setAccused);
  const removeAccused = removeRow(setAccused);
  const updateId = updateRow(setIdDetails);
  const removeId = removeRow(setIdDetails);
  const updateProp = updateRow(setProperties);
  const removeProp = removeRow(setProperties);

  // ── RENDER ───────────────────────────────────────────────────────────────────
  // ── Print helper — opens a clean popup with the FIR document ──────────────
  const handlePrint = () => {
    const printContent = document.getElementById('fir-print-root');
    if (!printContent) return;
    const html = printContent.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=800');
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>FIR ${registeredFir.fir_number}/${registeredFir.year} — Haryana Police</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Serif:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 12mm 10mm; }
          body { margin:0; padding:20px; font-family:'Noto Serif','Times New Roman',Georgia,serif; font-size:11.5px; color:#000; background:#fff; }
          table { width:100%; border-collapse:collapse; }
          @media print { body { padding:0; } }
        </style>
      </head><body>${html}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 800);
  };

  if (registeredFir) {
    return (
      <div className="fir-form-container">
        {/* ── Success Banner (screen only) ── */}
        <div className="no-print">
          <Card bordered={false} style={{ textAlign: 'center', padding: '32px 0 24px', marginBottom: 16 }}>
            <Result
              status="success"
              title={`FIR ${registeredFir.fir_number}/${registeredFir.year} Registered!`}
              subTitle="सफलतापूर्वक दर्ज हो गई। नीचे preview देखें, Print / PDF download करें।"
              extra={[
                <Button key="print" type="primary" size="large" icon={<PrinterOutlined />} onClick={handlePrint}>
                  Print FIR / Save as PDF
                </Button>,
                <Button key="list" size="large" onClick={() => navigate('/fir')}>
                  Go to FIR List
                </Button>,
              ]}
            />
          </Card>

          {/* Live Preview of the print document */}
          <div style={{ background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8, padding: '24px', maxWidth: 900, margin: '0 auto 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
            <FIRPrintDocument fir={registeredFir} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fir-form-container no-print">

      {/* ── PAGE HEADER ── */}
      <div className="fir-page-header">
        <Button ghost icon={<ArrowLeftOutlined />} onClick={() => navigate('/fir')} className="fir-back-btn">
          Back
        </Button>
        <div className="fir-header-center">
          <div className="fir-header-logo">🚔 Haryana Police</div>
          <Title level={3} className="fir-main-title">FIRST INFORMATION REPORT</Title>
          <Text className="fir-sub-title-en">Under Section 173 B.N.S.S.</Text>
          <Text className="fir-sub-title-hi">प्रथम सूचना रिपोर्ट | धारा 173 बी एन एस एस के तहत</Text>
        </div>
        <div className="fir-header-right">
          <Text className="fir-officer-label">Registering as</Text>
          <Text strong className="fir-officer-name">{profile?.full_name}</Text>
          <Tag color="geekblue">{profile?.role?.toUpperCase()}</Tag>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={handleValuesChange}
        initialValues={{
          date_time_of_fir: dayjs(),
          complainant_nationality: 'INDIA',
          info_type: 'Written',
        }}
        scrollToFirstError
        className="fir-form"
      >

        {/* ── AI AUTO-FILL UPLOAD ── */}
        <Card className="fir-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={5} style={{ color: '#e6f7ff', margin: 0 }}>AI Auto-Fill using Complaint PDF / Image</Title>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Upload an initial complaint document to automatically fill fields using AI.</Text>
            </div>
            <Upload 
              beforeUpload={handlePdfUpload}
              showUploadList={false}
              accept=".pdf,image/*"
            >
              <Button type="primary" icon={<UploadOutlined />} loading={extracting} style={{ backgroundColor: '#52c41a' }}>
                {extracting ? 'Extracting AI Data...' : 'Upload Doc & Auto-Fill'}
              </Button>
            </Upload>
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 1 — Basic FIR Details
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-1">
          <SectionHeader
            number="1"
            title="Basic FIR Details"
            subtitle="मूल विवरण"
          />
          <Row gutter={[20, 0]}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="district"
                label="District (जिला)"
                rules={[{ required: true, message: 'District is required' }]}
                className={getAiClass('district')}
              >
                <Input placeholder="e.g. PANIPAT" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="police_station"
                label="P.S. (थाना)"
                rules={[{ required: true, message: 'Police Station is required' }]}
                className={getAiClass('police_station')}
              >
                <Input placeholder="e.g. SAMALKHA" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="date_time_of_fir"
                label="Date & Time of FIR (दिनांक और समय)"
                rules={[{ required: true, message: 'Date & Time required' }]}
                className={getAiClass('date_time_of_fir')}
              >
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>
          <div className="fir-auto-note">
            <InfoCircleOutlined style={{ color: '#69c0ff', marginRight: 6 }} />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              FIR Number (प्र.सू.रि. सं.) and Year (वर्ष) will be auto-generated upon registration.
            </Text>
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2 — Acts & Sections
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-2">
          <SectionHeader
            number="2"
            title="Acts & Sections Under Which FIR is Registered"
            subtitle="अधिनियम और धाराएँ"
          />

          <div className="fir-dyn-table">
            <div className="fir-dyn-head">
              <span className="fir-col-sno">S.No.<br /><span className="fir-col-hi">क्र.सं.</span></span>
              <span className="fir-col-act">Acts (अधिनियम)</span>
              <span className="fir-col-sec">Sections (धारा(एँ))</span>
              <span className="fir-col-action" />
            </div>

            {actsSections.map((row, i) => (
              <div key={i} className="fir-dyn-row">
                <span className="fir-col-sno fir-row-num">{i + 1}</span>
                <div className="fir-col-act">
                  <Select
                    value={row.act || undefined}
                    onChange={(v) => updateAct(i, 'act', v)}
                    placeholder="Select Act / अधिनियम चुनें"
                    style={{ width: '100%' }}
                    showSearch
                    optionFilterProp="children"
                  >
                    {ACTS_LIST.map(a => <Option key={a} value={a}>{a}</Option>)}
                  </Select>
                </div>
                <div className="fir-col-sec">
                  <Input
                    value={row.sections}
                    onChange={(e) => updateAct(i, 'sections', e.target.value)}
                    placeholder="e.g. 302, 34"
                  />
                </div>
                <div className="fir-col-action">
                  <Tooltip title="Remove row">
                    <Button
                      type="text" danger size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeAct(i)}
                      disabled={actsSections.length === 1}
                    />
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setActsSections(p => [...p, { act: '', sections: '' }])}
            className="fir-add-btn"
          >
            Add Act / Section
          </Button>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 3 — Occurrence of Offence
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-3">
          <SectionHeader number="3" title="Occurrence of Offence" subtitle="अपराध की घटना" />

          {/* 3(a) */}
          <SubLabel letter="a" text="Date & Time of Occurrence" textHi="(घटना की दिनांक एवं समय)" />
          <Row gutter={[16, 0]} style={{ marginTop: 12 }}>
            <Col xs={24} sm={4}>
              <Form.Item name="occurrence_day" label="Day (दिन)">
                <Select placeholder="Day">
                  {DAYS_OF_WEEK.map(d => <Option key={d} value={d}>{d}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={5}>
              <Form.Item name="occurrence_date_from" label="Date From (दिनांक से)">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={5}>
              <Form.Item name="occurrence_date_to" label="Date To (दिनांक तक)">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={5}>
              <Form.Item name="occurrence_time_period" label="Time Period (समय अवधि)">
                <Select placeholder="Pahar">
                  {TIME_PERIODS.map(p => <Option key={p} value={p}>{p}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={3}>
              <Form.Item name="occurrence_time_from" label="Time From (से)">
                <TimePicker format="HH:mm" style={{ width: '100%' }} minuteStep={5} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={2}>
              <Form.Item name="occurrence_time_to" label="Time To (तक)">
                <TimePicker format="HH:mm" style={{ width: '100%' }} minuteStep={5} />
              </Form.Item>
            </Col>
          </Row>

          <Divider dashed className="fir-divider" />

          {/* 3(b) */}
          <SubLabel letter="b" text="Information Received at P.S." textHi="(थाना जहाँ सूचना प्राप्त हुई)" />
          <Row gutter={[16, 0]} style={{ marginTop: 12 }}>
            <Col xs={24} sm={6}>
              <Form.Item name="info_received_date" label="Date (दिनांक)">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="info_received_time" label="Time (समय)">
                <TimePicker format="HH:mm" style={{ width: '100%' }} minuteStep={5} />
              </Form.Item>
            </Col>
          </Row>

          <Divider dashed className="fir-divider" />

          {/* 3(c) */}
          <SubLabel letter="c" text="General Diary Reference" textHi="(रोजनामचा संदर्भ)" />
          <Row gutter={[16, 0]} style={{ marginTop: 12 }}>
            <Col xs={24} sm={5}>
              <Form.Item name="gd_entry_no" label="Entry No. (प्रविष्टि सं.)">
                <Input placeholder="e.g. 055" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="gd_date_time" label="Date and Time (दिनांक और समय)">
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 4 — Type of Information
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-4">
          <SectionHeader number="4" title="Type of Information" subtitle="सूचना का प्रकार" />
          <Form.Item name="info_type">
            <Radio.Group size="large">
              <Space>
                <Radio value="Written">Written <span className="fir-hindi-small">(लिखित)</span></Radio>
                <Radio value="Oral">Oral <span className="fir-hindi-small">(मौखिक)</span></Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 5 — Place of Occurrence
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-5">
          <SectionHeader number="5" title="Place of Occurrence" subtitle="घटनास्थल" />

          <Row gutter={[16, 0]}>
            <Col xs={12} sm={4}>
              <Form.Item name="place_direction" label="(a) Direction (थाना से दिशा)">
                <Select placeholder="Direction" showSearch>
                  {DIRECTIONS.map(d => <Option key={d} value={d}>{d}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12} sm={4}>
              <Form.Item name="place_distance" label="Distance in Km(s) (दूरी)">
                <Input placeholder="e.g. 10" suffix="Km" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={4}>
              <Form.Item name="beat_no" label="Beat No. (बीट सं.)">
                <Input placeholder="Beat No." />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="place_address"
                label="(b) Address (पता)"
                rules={[{ required: true, message: 'Place of occurrence address is required' }]}
                className={getAiClass('place_address')}
              >
                <TextArea rows={2} placeholder="गांव/मोहल्ला, District, State, INDIA" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="latitude" label="Latitude (अक्षांश)">
                <Input placeholder="e.g. 29.3909" type="number" step="any" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="longitude" label="Longitude (देशांतर)">
                <Input placeholder="e.g. 76.9635" type="number" step="any" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item
                name="outside_ps_name"
                label="(c) If outside limit — Name of P.S. (यदि थाना सीमा के बाहर हो, तो थाना का नाम)"
              >
                <Input placeholder="Police Station Name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="outside_district" label="District (State) (जिला/राज्य)">
                <Input placeholder="District, State" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 6 — Complainant Details
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-6">
          <SectionHeader
            number="6"
            title="Complainant / Informant Details"
            subtitle="शिकायतकर्ता / सूचनाकर्ता का विवरण"
          />

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="complainant_name"
                label="(a) Name (नाम)"
                rules={[{ required: true, message: 'Complainant name is required' }]}
                className={getAiClass('complainant_name')}
              >
                <Input placeholder="Full name of complainant" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="complainant_father_name" label="(b) Father's Name (पिता का नाम)" className={getAiClass('complainant_father_name')}>
                <Input placeholder="Father's full name" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="complainant_dob" label="(c) Date/Year of Birth (जन्म तिथि / वर्ष)">
                <Input placeholder="e.g. 1983 or 15/08/1983" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="complainant_nationality" label="(d) Nationality (राष्ट्रीयता)">
                <Input placeholder="e.g. INDIA" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="complainant_uid" label="(e) UID No. / Aadhaar (यूआईडी सं.)">
                <Input placeholder="Aadhaar Number" maxLength={12} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="complainant_passport" label="(f) Passport No. (पासपोर्ट सं.)">
                <Input placeholder="Passport Number" />
              </Form.Item>
            </Col>
          </Row>

          {/* (g) ID Details dynamic table */}
          <div style={{ marginTop: 8 }}>
            <SubLabel
              letter="g"
              text="ID Details"
              textHi="(राशन कार्ड, मतदाता कार्ड, पासपोर्ट, यूआईडी, ड्राइविंग लाइसेंस, पैन कार्ड)"
            />
            <div className="fir-dyn-table" style={{ marginTop: 10 }}>
              {idDetails.length > 0 && (
                <div className="fir-dyn-head">
                  <span className="fir-col-sno">S.No.</span>
                  <span style={{ flex: 1 }}>ID Type (पहचान पत्र का प्रकार)</span>
                  <span style={{ flex: 1 }}>ID Number (पहचान संख्या)</span>
                  <span className="fir-col-action" />
                </div>
              )}
              {idDetails.map((row, i) => (
                <div key={i} className="fir-dyn-row">
                  <span className="fir-col-sno fir-row-num">{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <Select
                      value={row.id_type || undefined}
                      onChange={(v) => updateId(i, 'id_type', v)}
                      placeholder="Select ID Type"
                      style={{ width: '100%' }}
                    >
                      {ID_TYPES.map(t => <Option key={t} value={t}>{t}</Option>)}
                    </Select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Input
                      value={row.id_number}
                      onChange={(e) => updateId(i, 'id_number', e.target.value)}
                      placeholder="ID Number"
                    />
                  </div>
                  <div className="fir-col-action">
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeId(i)} />
                  </div>
                </div>
              ))}
              <Button
                type="dashed" size="small"
                icon={<PlusOutlined />}
                onClick={() => setIdDetails(p => [...p, { id_type: '', id_number: '' }])}
                className="fir-add-btn"
              >
                Add ID Detail
              </Button>
            </div>
          </div>

          {/* (h) Occupation & (j) Phone */}
          <Row gutter={[16, 0]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={8}>
              <Form.Item name="complainant_occupation" label="(h) Occupation (व्यवसाय)">
                <Input placeholder="e.g. Farmer, Service, Business" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="complainant_phone" label="(j) Phone Number (दूरभाष सं.)" className={getAiClass('complainant_phone')}>
                <Input placeholder="9812265996" addonBefore="+91" maxLength={10} />
              </Form.Item>
            </Col>
          </Row>

          {/* (i) Address */}
          <SubLabel letter="i" text="Address (पता)" />
          <Row gutter={[16, 0]} style={{ marginTop: 10 }}>
            <Col xs={24} sm={12}>
              <Form.Item name="complainant_present_address" label="Present Address (वर्तमान पता)" className={getAiClass('complainant_present_address')}>
                <TextArea rows={2} placeholder="गांव/मोहल्ला, City, District, Haryana, INDIA" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="complainant_permanent_address" label="Permanent Address (स्थायी पता)">
                <TextArea rows={2} placeholder="गांव/मोहल्ला, City, District, Haryana, INDIA" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 7 — Accused Details
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-7">
          <SectionHeader
            number="7"
            title="Details of Known / Suspected / Unknown Accused"
            subtitle="ज्ञात / संदिग्ध / अज्ञात अभियुक्त का पूरा विवरण"
          />

          <div className="fir-dyn-table">
            <div className="fir-dyn-head">
              <span className="fir-col-sno">S.No.</span>
              <span style={{ flex: 2 }}>Name (नाम) &amp; Alias (उपनाम)</span>
              <span style={{ flex: 2 }}>Relative's Name (रिश्तेदार का नाम)</span>
              <span style={{ flex: 3 }}>Present Address (वर्तमान पता)</span>
              <span className="fir-col-action" />
            </div>

            {accused.map((row, i) => (
              <div key={i} className="fir-dyn-row fir-accused-row">
                <span className="fir-col-sno fir-row-num" style={{ paddingTop: 8 }}>{i + 1}</span>
                <div style={{ flex: 2 }}>
                  <Input
                    value={row.name}
                    onChange={(e) => updateAccused(i, 'name', e.target.value)}
                    placeholder="Name (नाम)"
                    style={{ marginBottom: 6 }}
                  />
                  <Input
                    value={row.alias}
                    onChange={(e) => updateAccused(i, 'alias', e.target.value)}
                    placeholder="उर्फ / Alias"
                    size="small"
                    addonBefore={<span style={{ fontSize: 11 }}>उर्फ</span>}
                    style={{ marginBottom: 6 }}
                  />
                  <Input
                    value={row.phone}
                    onChange={(e) => updateAccused(i, 'phone', e.target.value)}
                    placeholder="Phone (मोबाइल सं.)"
                    size="small"
                    maxLength={10}
                    addonBefore={<span style={{ fontSize: 11 }}>Phone</span>}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <TextArea
                    value={row.relative_name}
                    onChange={(e) => updateAccused(i, 'relative_name', e.target.value)}
                    placeholder="S/o, W/o, D/o, Father Name..."
                    autoSize={{ minRows: 2 }}
                  />
                </div>
                <div style={{ flex: 3 }}>
                  <TextArea
                    value={row.address}
                    onChange={(e) => updateAccused(i, 'address', e.target.value)}
                    placeholder="गांव/मोहल्ला, City, District, State, INDIA"
                    autoSize={{ minRows: 2 }}
                  />
                </div>
                <div className="fir-col-action" style={{ paddingTop: 8 }}>
                  <Button
                    type="text" danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeAccused(i)}
                    disabled={accused.length === 1}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setAccused(p => [...p, { name: '', alias: '', relative_name: '', address: '' }])}
            className="fir-add-btn"
          >
            Add Accused
          </Button>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 8 — Delay Reason
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-8">
          <SectionHeader
            number="8"
            title="Reasons for Delay in Reporting"
            subtitle="शिकायतकर्ता / सूचनाकर्ता द्वारा रिपोर्ट देरी से दर्ज कराने के कारण"
          />
          <Form.Item name="delay_reason">
            <TextArea rows={3} placeholder="State the reasons for delay in reporting the FIR (if any)" />
          </Form.Item>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 9 & 10 — Property Details
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-9">
          <SectionHeader number="9" title="Particulars of Properties of Interest" subtitle="संम्बन्धित सम्पत्ति का विवरण" />

          {properties.length > 0 && (
            <div className="fir-dyn-table">
              <div className="fir-dyn-head">
                <span className="fir-col-sno">S.No.</span>
                <span style={{ flex: 1 }}>Property Category (सम्पत्ति श्रेणी)</span>
                <span style={{ flex: 1 }}>Property Type (सम्पत्ति का प्रकार)</span>
                <span style={{ flex: 2 }}>Description (विवरण)</span>
                <span style={{ flex: 1 }}>Value in Rs. (मूल्य)</span>
                <span className="fir-col-action" />
              </div>
              {properties.map((row, i) => (
                <div key={i} className="fir-dyn-row">
                  <span className="fir-col-sno fir-row-num">{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <Select
                      value={row.category || undefined}
                      onChange={(v) => updateProp(i, 'category', v)}
                      placeholder="Category"
                      style={{ width: '100%' }}
                    >
                      {PROPERTY_CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                    </Select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Input
                      value={row.type_detail}
                      onChange={(e) => updateProp(i, 'type_detail', e.target.value)}
                      placeholder="Specify type..."
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <TextArea
                      value={row.description}
                      onChange={(e) => updateProp(i, 'description', e.target.value)}
                      placeholder="Detailed description..."
                      autoSize={{ minRows: 1 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <InputNumber
                      value={row.value}
                      onChange={(v) => updateProp(i, 'value', v)}
                      placeholder="0"
                      style={{ width: '100%' }}
                      min={0}
                      prefix="₹"
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => v.replace(/,*/g, '')}
                    />
                  </div>
                  <div className="fir-col-action">
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeProp(i)} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setProperties(p => [...p, { category: '', type_detail: '', description: '', value: '' }])}
            className="fir-add-btn"
          >
            Add Property
          </Button>

          {/* Section 10 — Total Value */}
          {properties.length > 0 && (
            <div className="fir-total-property-bar">
              <div>
                <Text strong style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                  Section 10 — Total Value of Property (सम्पत्ति का कुल मूल्य — Rs.):
                </Text>
              </div>
              <Text strong className="fir-total-amount">
                ₹ {totalPropertyValue.toLocaleString('en-IN')}
              </Text>
            </div>
          )}
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 12 — First Information Contents (Narrative)
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card fir-narrative-card" id="sec-12">
          <SectionHeader number="12" title="First Information Contents" subtitle="प्रथम सूचना तथ्य" />
          <Text className="fir-narrative-hint">
            Detailed narrative / statement of the incident as reported by the complainant / informant.
            (शिकायतकर्ता / सूचनाकर्ता द्वारा बताई गई घटना का विस्तृत विवरण)
          </Text>

          <div style={{ display: 'flex', gap: '10px', marginTop: 12, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Upload beforeUpload={handleContentPdfUpload} showUploadList={false} accept=".pdf,image/*">
              <Button type="default" icon={<UploadOutlined />} loading={extractingContent}>
                {extractingContent ? 'Extracting Text...' : 'Upload Complaint Text/PDF'}
              </Button>
            </Upload>
            
            <Button 
              type={isRecording ? "primary" : "default"} 
              danger={isRecording}
              shape="round" 
              icon={<AudioOutlined />} 
              onClick={handleVoiceToText}
            >
              {isRecording ? "Listening..." : "Dictate"}
            </Button>
            <Select 
              value={dictationLang} 
              onChange={setDictationLang} 
              style={{ width: 100 }}
              disabled={isRecording}
            >
              <Option value="en-US">English</Option>
              <Option value="hi-IN">Hindi</Option>
            </Select>
          </div>

          <Form.Item
            name="fir_content"
            style={{ marginTop: 12 }}
            rules={[{ required: true, message: 'FIR content / narrative is required (Section 12)' }]}
            className={getAiClass('fir_content')}
          >
            <TextArea
              rows={12}
              placeholder="नकल तहरीर जैल है सेवा में... (Write the full FIR narrative here in Hindi / English)"
              className="fir-narrative-textarea"
            />
          </Form.Item>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 13 — Action Taken
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-13">
          <SectionHeader
            number="13"
            title="Action Taken"
            subtitle="की गई कार्यवाही — चूँकि उपरोक्त जानकारी से पता चलता है कि अपराध किये जाने का तरीका मद सं. 2 में उल्लेख धारा के तहत है"
          />

          {/* Action (1) */}
          <div className="fir-action-block">
            <div className="fir-action-num-badge">(1)</div>
            <div className="fir-action-body">
              <div className="fir-action-label">
                Registered the case and took up the investigation — ✓ / (या)
              </div>
              <Text className="fir-action-hi">प्रकरण दर्ज किया गया और जांच के लिए लिया गया</Text>
            </div>
          </div>

          <Divider dashed className="fir-divider" />

          {/* Action (2) — IO */}
          <div className="fir-action-block">
            <div className="fir-action-num-badge">(2)</div>
            <div className="fir-action-body fir-action-full">
              <div className="fir-action-label">
                Directed (Name of I.O.) to take up the Investigation — जांच अधिकारी का नाम
              </div>
              <Row gutter={[16, 0]} style={{ marginTop: 12 }}>
                <Col xs={24} sm={10}>
                  <Form.Item name="io_name" label="Name of I.O. (जांच अधिकारी का नाम)">
                    <Input placeholder="Full Name" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="io_rank" label="Rank (पद)">
                    <Select placeholder="Select Rank">
                      {OFFICER_RANKS.map(r => <Option key={r} value={r}>{r}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={6}>
                  <Form.Item name="io_no" label="No. (सं.)">
                    <Input placeholder="e.g. 39" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </div>

          <Divider dashed className="fir-divider" />

          {/* Action (3) — Refused */}
          <div className="fir-action-block">
            <div className="fir-action-num-badge">(3)</div>
            <div className="fir-action-body fir-action-full">
              <div className="fir-action-label">
                Refused investigation due to — जांच के लिए इनकार किया or (या)
              </div>
              <Form.Item name="refused_reason" style={{ marginTop: 10 }}>
                <Input placeholder="Reason for refusal (if applicable)" />
              </Form.Item>
            </div>
          </div>

          <Divider dashed className="fir-divider" />

          {/* Action (4) — Transfer */}
          <div className="fir-action-block">
            <div className="fir-action-num-badge">(4)</div>
            <div className="fir-action-body fir-action-full">
              <div className="fir-action-label">
                Transferred to P.S. (थाना हस्तांतरित) on point of jurisdiction (क्षेत्राधिकार के कारण हस्तांतरित)
              </div>
              <Row gutter={[16, 0]} style={{ marginTop: 10 }}>
                <Col xs={24} sm={8}>
                  <Form.Item name="transferred_ps" label="P.S. Name (थाना)">
                    <Input placeholder="Police Station Name" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="transferred_district" label="District (जिला)">
                    <Input placeholder="District" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </div>

          <Alert
            type="info"
            showIcon
            className="fir-roac-alert"
            message="R.O.A.C. (आर.ओ.ए.सी.)"
            description="FIR read over to the complainant / informant, admitted to be correctly recorded and a copy given to the complainant / informant free of cost. (सही दर्ज हुई माना और एक प्रति निःशुल्क शिकायतकर्ता को दी गयी)"
          />
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 14 — Officer in Charge Signature
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-14">
          <SectionHeader
            number="14"
            title="Signature of Officer in Charge, Police Station"
            subtitle="थाना प्रभारी के हस्ताक्षर"
          />
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={10}>
              <Form.Item name="officer_name" label="Name (नाम)">
                <Input placeholder="Officer's Full Name" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="officer_rank" label="Rank (पद)">
                <Select placeholder="Select Rank" size="large">
                  {OFFICER_RANKS.map(r => <Option key={r} value={r}>{r}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="officer_no" label="No. (सं.)">
                <Input placeholder="e.g. PSI / Badge No." size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Divider dashed className="fir-divider" />
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12}>
              <div style={{ padding: '16px', height: '100%', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Text style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 12 }}>
                  Digital Signature of Officer in Charge <br/>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>(थाना प्रभारी के हस्ताक्षर)</span>
                </Text>
                <Form.Item
                  name="officer_signature"
                  valuePropName="fileList"
                  getValueFromEvent={normFile}
                  noStyle
                >
                  <Upload accept="image/*" listType="picture" maxCount={1} beforeUpload={() => false}>
                    <Button icon={<UploadOutlined />}>Upload Officer Signature</Button>
                  </Upload>
                </Form.Item>
              </div>
            </Col>
            
            <Col xs={24} sm={12}>
              <div style={{ padding: '16px', height: '100%', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Text style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 12 }}>
                  Signature / Thumb impression of Complainant <br/>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>(शिकायतकर्ता के हस्ताक्षर / अंगूठे का निशान)</span>
                </Text>
                <Form.Item
                  name="complainant_signature"
                  valuePropName="fileList"
                  getValueFromEvent={normFile}
                  noStyle
                >
                  <Upload accept="image/*" listType="picture" maxCount={1} beforeUpload={() => false}>
                    <Button icon={<UploadOutlined />}>Upload Complainant Signature</Button>
                  </Upload>
                </Form.Item>
              </div>
            </Col>
          </Row>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 15 — Dispatch Date/Time
        ══════════════════════════════════════════════════════════════ */}
        <Card className="fir-card" id="sec-15">
          <SectionHeader
            number="15"
            title="Date and Time of Dispatch to the Court"
            subtitle="अदालत में प्रेषण की दिनांक और समय"
          />
          <Form.Item name="dispatch_date_time">
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: 320 }} size="large" />
          </Form.Item>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SUBMIT BAR
        ══════════════════════════════════════════════════════════════ */}
        <div className="fir-submit-bar">
          <Button size="large" onClick={() => navigate('/fir')}>
            Cancel
          </Button>
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            loading={loading}
            icon={<FileAddOutlined />}
            className="fir-register-btn"
          >
            {loading ? 'Registering FIR...' : 'Register FIR'}
          </Button>
        </div>

      </Form>
    </div>
  );
}
