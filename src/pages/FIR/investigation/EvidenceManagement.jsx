import React, { useState, useEffect } from 'react';
import {
  Card, Button, Form, Typography, List, Tag, Skeleton,
  message, Modal, Input, Tabs, Upload, Divider, Row, Col, Space
} from 'antd';
import {
  FileSearchOutlined, FileProtectOutlined, PrinterOutlined,
  UploadOutlined, VideoCameraOutlined, PictureOutlined,
  UserOutlined, EnvironmentOutlined, NumberOutlined,
  SafetyCertificateOutlined, TeamOutlined, EditOutlined,
  AudioOutlined
} from '@ant-design/icons';
import { useAuth } from '../../../hooks/useAuth';

const { Text } = Typography;
const { TextArea } = Input;

/* ─────────────────────────────────────────────────────────────
   फर्द मकबूजगी (Seizure Memo) — Official Printable Template
   Mirrors the official Haryana Police Seizure Memo format
───────────────────────────────────────────────────────────── */
function SeizureMemoPreview({ evidence, fir }) {
  const dateStr = evidence.seizure_date
    ? new Date(evidence.seizure_date).toLocaleDateString('hi-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      })
    : new Date(evidence.created_at || Date.now()).toLocaleDateString('hi-IN');

  const firDate = fir?.date_time_of_fir
    ? new Date(fir.date_time_of_fir).toLocaleDateString('hi-IN')
    : '—';

  const sections = (() => {
    try {
      const parsed = typeof fir?.acts_sections === 'string'
        ? JSON.parse(fir.acts_sections) : (fir?.acts_sections || []);
      return parsed.map(s => `${s.sections} ${s.act}`).join(', ');
    } catch { return '—'; }
  })();

  const accusedList = (() => {
    try {
      const parsed = typeof fir?.accused_details === 'string'
        ? JSON.parse(fir.accused_details) : (fir?.accused_details || []);
      return parsed.map(a => `${a.name}${a.relative_name ? ' ' + a.relative_name : ''}`).join(', ');
    } catch { return '—'; }
  })();

  return (
    <div
      id="seizure-memo-print"
      style={{
        fontFamily: '"Noto Serif", "Times New Roman", Georgia, serif',
        background: '#fff',
        color: '#000',
        padding: '40px 48px',
        maxWidth: '760px',
        margin: '0 auto',
        fontSize: '13.5px',
        lineHeight: 1.9,
      }}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ fontWeight: 700, textDecoration: 'underline', fontSize: '14px' }}>
          थाना {fir?.police_station || '____________'}
        </span>
        <span style={{ fontWeight: 700, textDecoration: 'underline', fontSize: '14px' }}>
          जिला {fir?.district || '____________'}
        </span>
      </div>
      <div style={{ height: '18px' }} />

      {/* ── Case particulars ────────────────────────────── */}
      <p style={{ margin: '6px 0' }}>
        <strong>राज्य दवारा:-</strong>{' '}
        {fir?.complainant_name || '____________'}
        {fir?.complainant_father_name ? ` S/0 ${fir.complainant_father_name}` : ''}{' '}
        {fir?.complainant_present_address || ''}।
      </p>
      <p style={{ margin: '6px 0' }}>
        <strong>बनाम:-</strong>{' '}
        {accusedList || '____________'}{' '}
        <span style={{ fontSize: '12px' }}>(गिरफतार शुदा)</span>
      </p>
      <p style={{ margin: '6px 0' }}>
        <strong>मुकदमा नम्बर</strong> {fir?.fir_number || '____'}{' '}
        <strong>दिनाँक</strong> {firDate}{' '}
        {sections && <><strong>धारा</strong> {sections}</>}{' '}
        <strong>थाना</strong> {fir?.police_station || '____'}{' '}
        <strong>जिला</strong> {fir?.district || '____'}।
      </p>

      <div style={{ height: '22px' }} />

      {/* ── Title ───────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <span style={{ fontWeight: 700, textDecoration: 'underline', fontSize: '15px' }}>
          फर्द मकबूजगी
          {evidence.item_id ? ` कन्टेनर नम्बर  ${evidence.item_id}` : ''}
        </span>
      </div>

      {/* ── Body Narrative ──────────────────────────────── */}
      <div style={{ textIndent: '40px', textAlign: 'justify', lineHeight: 2.1, marginBottom: '28px' }}>
        {evidence.seizure_narrative ||
          `निम्न लिखित गहावन के सामने मुकदमा बा जुर्म उपरोक्त दौरान तफतीश ${evidence.description || '____________'}
           जो ${evidence.location || evidence.seizure_place || '____________'} पर बरामद हुई।
           उपरोक्त को फर्द द्वारा कब्जा पुलिस ने लिया गया। फर्द मकबुजगी तैयार की गई फर्द पर गवाह ने अपने-2 हस्ताक्षर किये।`
        }
      </div>

      {/* ── Item details (if any) ────────────────────────── */}
      {(evidence.description || evidence.extra_details) && (
        <div style={{ marginBottom: '20px', paddingLeft: '20px', borderLeft: '2px solid #000' }}>
          {evidence.description && (
            <p style={{ margin: '4px 0' }}><strong>बरामद माल:</strong> {evidence.description}</p>
          )}
          {evidence.extra_details && (
            <p style={{ margin: '4px 0' }}><strong>विशेष विवरण:</strong> {evidence.extra_details}</p>
          )}
          {evidence.seizure_place && (
            <p style={{ margin: '4px 0' }}><strong>बरामदगी स्थान:</strong> {evidence.seizure_place}</p>
          )}
        </div>
      )}

      {/* ── Signature Block ──────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '48px', alignItems: 'flex-end' }}>
        {/* Left — Witness */}
        <div style={{ width: '48%' }}>
          <div style={{ marginBottom: '6px', fontWeight: 700 }}>गवाह-</div>
          <div style={{ height: '48px', borderBottom: '1px solid #000', marginBottom: '6px' }} />
          {evidence.witness_name && <div>{evidence.witness_name}</div>}
          {evidence.witness_badge && <div>{evidence.witness_badge}</div>}
          {evidence.witness_post && <div>{evidence.witness_post}</div>}
          {fir?.police_station && !evidence.witness_post && (
            <div>थाना {fir.police_station} {fir.district}</div>
          )}
        </div>

        {/* Right — Seizing Officer */}
        <div style={{ width: '44%', textAlign: 'right' }}>
          <div style={{ height: '48px', borderBottom: '1px solid #000', marginBottom: '6px' }} />
          <div>{evidence.officer_post || (fir?.police_station ? `पुलिस चौकी / थाना ${fir.police_station}` : '')}</div>
          {fir?.district && <div>थाना {fir.police_station} {fir.district}।</div>}
          <div style={{ marginTop: '6px' }}>दिनाँक {dateStr}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function EvidenceManagement({ firId, firData }) {
  const [notices, setNotices] = useState([]);
  const [evidences, setEvidences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [addingEvidence, setAddingEvidence] = useState(false);

  const [memoOpen, setMemoOpen] = useState(false);
  const [currentEvidence, setCurrentEvidence] = useState(null);

  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(null);

  const [docOpen, setDocOpen] = useState(false);
  const [docContent, setDocContent] = useState(null);
  const [docTitle, setDocTitle] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [dictationLang, setDictationLang] = useState('hi-IN');

  const { token } = useAuth();
  const [noticeForm] = Form.useForm();
  const [evidenceForm] = Form.useForm();

  const fetchInvestigationData = async () => {
    try {
      setLoading(true);
      const [nRes, eRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/notices`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/evidences`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (nRes.ok) setNotices(await nRes.json());
      if (eRes.ok) setEvidences(await eRes.json());
    } catch (e) {
      message.error('डेटा लोड करने में त्रुटि');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvestigationData(); }, [firId]);

  /* Notice submit */
  const handleGenerateNotice = async (vals) => {
    setGenerating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/notices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(vals)
      });
      if (res.ok) { message.success('Notice generated!'); noticeForm.resetFields(); fetchInvestigationData(); }
    } catch { message.error('Error generating notice'); }
    finally { setGenerating(false); }
  };

  /* Evidence submit */
  const getBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });

  const handleAddEvidence = async (vals) => {
    setAddingEvidence(true);
    try {
      let mediaFile = null;
      if (vals.media?.fileList?.length > 0) {
        mediaFile = await getBase64(vals.media.fileList[0].originFileObj);
      }
      const payload = { ...vals, media_file: mediaFile };
      delete payload.media;

      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/evidences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        message.success('साक्ष्य दर्ज हो गया और फर्द मकबूजगी तैयार हो गई!');
        evidenceForm.resetFields();
        fetchInvestigationData();
      } else {
        const err = await res.json();
        message.error(err.error || 'Error adding evidence');
      }
    } catch (e) { message.error('Error: ' + e.message); }
    finally { setAddingEvidence(false); }
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
      const currentVal = evidenceForm.getFieldValue('seizure_narrative') || '';
      evidenceForm.setFieldsValue({ seizure_narrative: currentVal ? `${currentVal} ${transcript}` : transcript });
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

  /* Print handler */
  const handlePrintMemo = () => {
    const el = document.getElementById('seizure-memo-print');
    if (!el) return;
    const win = window.open('', '_blank', 'width=900,height=750');
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>फर्द मकबूजगी — Haryana Police</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Serif:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 15mm 14mm; }
          body { margin:0; padding:20px; font-family:'Noto Serif','Times New Roman',serif; font-size:13.5px; color:#000; background:#fff; }
          @media print { body { padding:0; } }
        </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Tabs defaultActiveKey="2" type="card">

        {/* ══ Tab 1: Search & Seizure Notices ══════════════════════ */}
        <Tabs.TabPane tab={<span><FileSearchOutlined /> तलाशी व जब्ती नोटिस</span>} key="1">
          <Card bordered={false} className="fir-card" style={{ borderRadius: '0 0 12px 12px' }}>
            <Form form={noticeForm} layout="vertical" onFinish={handleGenerateNotice}>
              <Row gutter={16}>
                <Col xs={24} sm={10}>
                  <Form.Item name="notice_type" label="Notice Type" rules={[{ required: true }]}>
                    <Input.TextArea placeholder="Search & Seizure Notice (Sec 93/94)" rows={1} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={14}>
                  <Form.Item name="details" label="Specific Details / Location" rules={[{ required: true }]}>
                    <Input placeholder="e.g. premises at Model Town, Panipat" />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" loading={generating} icon={<FileSearchOutlined />}>
                Generate Notice
              </Button>
            </Form>

            <List
              style={{ marginTop: 24 }}
              header={<Text strong>Generated Notices</Text>}
              dataSource={notices}
              loading={loading}
              locale={{ emptyText: 'No notices generated.' }}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button key="v" type="link" icon={<PrinterOutlined />}
                      onClick={() => { setDocTitle('Legal Notice'); setDocContent(item.content); setDocOpen(true); }}>
                      View Notice
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={<Tag color="blue">{item.notice_type.replace('_', ' ').toUpperCase()}</Tag>}
                    description={`Generated on: ${new Date(item.created_at).toLocaleString()}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Tabs.TabPane>

        {/* ══ Tab 2: Evidence & Seizure Memo ════════════════════════ */}
        <Tabs.TabPane tab={<span><FileProtectOutlined /> साक्ष्य व फर्द मकबूजगी</span>} key="2">
          <Card bordered={false} className="fir-card" style={{ borderRadius: '0 0 12px 12px', background: 'rgba(15,27,45,0.85)' }}>
            <Form form={evidenceForm} layout="vertical" onFinish={handleAddEvidence}>

              {/* ── 1. Item Identification ── */}
              <Divider orientation="left" style={{ color: '#90caf9', borderColor: 'rgba(255,255,255,0.1)' }}>
                <NumberOutlined /> 1. बरामद माल का पहचान / विवरण
              </Divider>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="item_id" label="कन्टेनर / वस्तु सं. / ID नम्बर">
                    <Input prefix={<NumberOutlined />} placeholder="जैसे: HR67B-4093" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={16}>
                  <Form.Item name="description" label="बरामद माल का विवरण" rules={[{ required: true, message: 'विवरण अनिवार्य है' }]}>
                    <Input prefix={<EditOutlined />} placeholder="जैसे: एक मोबाइल iPhone 13 काले रंग का, एक कन्टेनर HR67B-4093" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="extra_details" label="विशेष विवरण (IMEI, Markings, etc.)">
                    <TextArea rows={2} placeholder="IMEI नं., वाहन नं., चिन्ह आदि" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="location" label="बरामद स्थान (Recovered From)" rules={[{ required: true, message: 'स्थान अनिवार्य है' }]}>
                    <Input prefix={<EnvironmentOutlined />} placeholder="जैसे: आरोपी का घर, मॉडल टाउन, पानीपत" />
                  </Form.Item>
                </Col>
              </Row>

              {/* ── 2. Seizure Details ── */}
              <Divider orientation="left" style={{ color: '#90caf9', borderColor: 'rgba(255,255,255,0.1)' }}>
                <EnvironmentOutlined /> 2. जब्ती का विवरण
              </Divider>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="seizure_date" label="जब्ती की तिथि">
                    <Input type="date" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={16}>
                  <Form.Item name="seizure_place" label="जब्ती का स्थान विस्तृत">
                    <Input prefix={<EnvironmentOutlined />} placeholder="जैसे: ICD कन्टेनर ऐड तुगलकाबाद दिल्ली" />
                  </Form.Item>
                </Col>
              </Row>

              {/* ── 3. Seizure Narrative ── */}
              <Divider orientation="left" style={{ color: '#90caf9', borderColor: 'rgba(255,255,255,0.1)' }}>
                <EditOutlined /> 3. फर्द का मसौदा (Seizure Narrative)
              </Divider>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: '#fff' }}>Hindi Narrative (फर्द का पाठ)</span>
                <Button 
                  type={isRecording ? "primary" : "default"} 
                  danger={isRecording}
                  shape="round" 
                  icon={<AudioOutlined />} 
                  onClick={handleVoiceToText}
                  size="small"
                >
                  {isRecording ? "Listening..." : "Dictate (Voice)"}
                </Button>
              </div>

              <Form.Item
                name="seizure_narrative"
                extra="यह text exact वैसे ही memo में छपेगा। FIR नम्बर, धारा, आरोपी आदि automatically ऊपर header में आएंगे।"
              >
                <TextArea
                  rows={5}
                  placeholder="निम्न लिखित गहावन के सामने मुकदमा बा जुर्म उपरोक्त दौरान तफतीश चोरी शुदा कन्टेनर न0 HR67B-4093 जो ICD कन्टेनर ऐड तुगलकाबाद दिल्ली के स्टेन्ट पर लावारिस खड़ा मिला..."
                />
              </Form.Item>

              {/* ── 4. Witness ── */}
              <Divider orientation="left" style={{ color: '#90caf9', borderColor: 'rgba(255,255,255,0.1)' }}>
                <TeamOutlined /> 4. गवाह का विवरण
              </Divider>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="witness_name" label="गवाह का नाम / पद">
                    <Input prefix={<UserOutlined />} placeholder="जैसे: EHC सतीश 485" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="witness_badge" label="बैज / नम्बर">
                    <Input placeholder="जैसे: 485" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="witness_post" label="गवाह की तैनाती">
                    <Input placeholder="जैसे: पुलिस चौकी बोहली, थाना मतलौंडा पानीपत" />
                  </Form.Item>
                </Col>
              </Row>

              {/* ── 5. Seizing Officer Post ── */}
              <Divider orientation="left" style={{ color: '#90caf9', borderColor: 'rgba(255,255,255,0.1)' }}>
                <SafetyCertificateOutlined /> 5. जब्ती करने वाले अधिकारी की तैनाती
              </Divider>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="officer_post" label="पुलिस चौकी / थाना">
                    <Input prefix={<SafetyCertificateOutlined />} placeholder="जैसे: पुलिस चौकी बोहली, थाना मतलौंडा पानीपत" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="media"
                    label="फोटो / वीडियो अटैच करें (Optional)"
                    valuePropName="fileList"
                    getValueFromEvent={(e) => Array.isArray(e) ? e : e?.fileList}
                  >
                    <Upload beforeUpload={() => false} accept="image/*,video/*" maxCount={1} listType="picture">
                      <Button icon={<UploadOutlined />}>Select Image or Video</Button>
                    </Upload>
                  </Form.Item>
                </Col>
              </Row>

              <Button
                type="primary"
                htmlType="submit"
                loading={addingEvidence}
                icon={<FileProtectOutlined />}
                size="large"
                style={{ marginTop: '8px', background: 'linear-gradient(135deg,#1565c0,#0d47a1)', border: 'none' }}
              >
                साक्ष्य दर्ज करें और फर्द मकबूजगी तैयार करें
              </Button>
            </Form>

            {/* ── Evidence Records List ── */}
            <Divider style={{ borderColor: 'rgba(255,255,255,0.1)', marginTop: 32 }} />
            {loading ? <Skeleton active /> : (
              <List
                header={<Text strong style={{ color: '#fff', fontSize: 15 }}><FileProtectOutlined /> दर्ज साक्ष्य और जब्त माल</Text>}
                dataSource={evidences}
                locale={{ emptyText: 'अभी तक कोई साक्ष्य दर्ज नहीं हुआ।' }}
                renderItem={item => (
                  <List.Item
                    actions={[
                      item.media_file && (
                        <Button key="media" type="link"
                          icon={item.media_file.startsWith('data:video') ? <VideoCameraOutlined /> : <PictureOutlined />}
                          onClick={() => { setMediaUrl(item.media_file); setMediaOpen(true); }}>
                          Media
                        </Button>
                      ),
                      <Button
                        key="memo" type="primary" ghost
                        icon={<PrinterOutlined />}
                        onClick={() => { setCurrentEvidence(item); setMemoOpen(true); }}
                      >
                        फर्द मकबूजगी देखें / प्रिंट
                      </Button>
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      avatar={<Tag color="orange" style={{ fontSize: '12px', padding: '3px 8px' }}>जब्त</Tag>}
                      title={<span style={{ color: '#fff', fontWeight: 600 }}>{item.description}</span>}
                      description={
                        <Space direction="vertical" size={1}>
                          <Text style={{ color: '#90caf9', fontSize: '12px' }}>
                            <EnvironmentOutlined /> {item.location || item.seizure_place || '—'}
                          </Text>
                          {item.item_id && (
                            <Text style={{ color: '#ffd54f', fontSize: '12px' }}>
                              <NumberOutlined /> {item.item_id}
                            </Text>
                          )}
                          <Text style={{ color: '#b0bec5', fontSize: '11px' }}>
                            दिनाँक: {new Date(item.seizure_date || item.created_at).toLocaleDateString('hi-IN')}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* ══ Seizure Memo Preview Modal ════════════════════════════ */}
      <Modal
        title={
          <span>
            <PrinterOutlined style={{ marginRight: 8, color: '#f57c00' }} />
            फर्द मकबूजगी — आधिकारिक प्रारूप
          </span>
        }
        open={memoOpen}
        onCancel={() => setMemoOpen(false)}
        width={840}
        footer={[
          <Button key="close" onClick={() => setMemoOpen(false)}>बंद करें</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrintMemo}
            style={{ background: '#e65100', border: 'none' }}>
            प्रिंट करें / PDF सहेजें
          </Button>
        ]}
        styles={{ body: { background: '#f5f5f5', padding: '16px', maxHeight: '80vh', overflowY: 'auto' } }}
      >
        {currentEvidence && (
          <SeizureMemoPreview evidence={currentEvidence} fir={firData} />
        )}
      </Modal>

      {/* ══ Media Preview Modal ═══════════════════════════════════ */}
      <Modal title="Evidence Media" open={mediaOpen} onCancel={() => setMediaOpen(false)} footer={null} width={800}>
        {mediaUrl && (mediaUrl.startsWith('data:video') ? (
          <video src={mediaUrl} controls style={{ width: '100%' }} />
        ) : (
          <img src={mediaUrl} alt="Evidence" style={{ width: '100%' }} />
        ))}
      </Modal>

      {/* ══ Notice Text Preview Modal ════════════════════════════ */}
      <Modal
        title={docTitle}
        open={docOpen}
        onCancel={() => setDocOpen(false)}
        footer={[
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
        ]}
        width={600}
      >
        <div style={{ background: '#f5f5f5', padding: '24px', borderRadius: '8px', minHeight: '300px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {docContent}
        </div>
      </Modal>
    </div>
  );
}
