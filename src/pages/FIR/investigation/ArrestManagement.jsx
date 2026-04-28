import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Select, Button, Form, Typography, List, Tag,
  Skeleton, message, Modal, Input, Divider, Space, Row, Col
} from 'antd';
import {
  UsergroupAddOutlined, SolutionOutlined, PrinterOutlined,
  UserOutlined, EnvironmentOutlined, PhoneOutlined, TeamOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import { useAuth } from '../../../hooks/useAuth';

const { Title, Text } = Typography;
const { Option } = Select;

/* ─────────────────────────────────────────────
   Printable Arrest Memo – mirrors the official
   Haryana Police "गिरफ्तारी मिमो" template
───────────────────────────────────────────── */
function ArrestMemoPreview({ arrest, fir }) {
  const dateStr = arrest.date_of_arrest
    ? new Date(arrest.date_of_arrest).toLocaleString('hi-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    : '—';

  const firDate = fir?.date_time_of_fir
    ? new Date(fir.date_time_of_fir).toLocaleDateString('hi-IN')
    : '—';

  const sections = (() => {
    try {
      const parsed = typeof fir?.acts_sections === 'string'
        ? JSON.parse(fir.acts_sections) : (fir?.acts_sections || []);
      return parsed.map(s => `धारा ${s.sections} ${s.act}`).join(', ');
    } catch { return '—'; }
  })();

  const rows = [
    {
      no: 1,
      label: 'गिरफ्तार करने वाले अधिकारी का नाम पद',
      value: [
        arrest.arresting_officer_rank,
        arrest.arresting_officer_name,
        arrest.arresting_officer_badge ? `(बैज नं. ${arrest.arresting_officer_badge})` : '',
        arrest.arresting_officer_post
      ].filter(Boolean).join(' ')
    },
    {
      no: 2,
      label: 'गिरफ्तार व्यक्ति का नाम पता',
      value: [arrest.accused_name, arrest.accused_address].filter(Boolean).join(', ')
    },
    {
      no: 3,
      label: 'गिरफ्तारी का समय, तिथि, स्थान',
      value: `दिनाँक ${dateStr}${arrest.arrest_place ? ', ' + arrest.arrest_place : ''}`
    },
    {
      no: 4,
      label: 'गिरफ्तारी की सूचना प्राप्त करने वाले का नाम पता',
      value: [
        arrest.informed_person_name,
        arrest.informed_person_address,
        arrest.informed_person_phone
      ].filter(Boolean).join(', ')
    },
    {
      no: 5,
      label: 'गिरफ्तारी के समय गवाह',
      value: [arrest.witness_name, arrest.witness_post].filter(Boolean).join(', ')
    }
  ];

  return (
    <div
      id="arrest-memo-print"
      style={{
        fontFamily: '"Noto Sans Devanagari", "Mangal", Arial, sans-serif',
        background: '#fff',
        color: '#000',
        padding: '40px',
        maxWidth: '760px',
        margin: '0 auto',
        fontSize: '14px',
        lineHeight: 1.8
      }}
    >
      {/* ── Header ─────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontWeight: 700, fontSize: '15px' }}>
          थाना {fir?.police_station || '____________'}
        </span>
        <span style={{ fontWeight: 700, fontSize: '15px' }}>
          जिला {fir?.district || '____________'}
        </span>
      </div>
      <hr style={{ borderTop: '2px solid #000', margin: '6px 0 12px' }} />

      {/* राज्य / बनाम */}
      <p style={{ margin: '4px 0' }}>
        <strong>राज्य दवारा:-</strong> {fir?.complainant_name || '____________'}
        {fir?.complainant_father_name ? ` पुत्र ${fir.complainant_father_name}` : ''}
        {fir?.complainant_present_address ? ` ${fir.complainant_present_address}` : ''}।
      </p>
      <p style={{ margin: '4px 0' }}>
        <strong>बनाम:-</strong> {arrest.accused_name || '____________'}
        {arrest.accused_address ? ` ${arrest.accused_address}` : ''}।
      </p>
      <p style={{ margin: '4px 0' }}>
        <strong>मुकदमा नम्बर</strong> {fir?.fir_number || '____'}{' '}
        <strong>दिनाँक</strong> {firDate}{' '}
        {sections && <><strong>धारा</strong> {sections}</>}{' '}
        <strong>थाना</strong> {fir?.police_station || '____'}{' '}
        <strong>जिला</strong> {fir?.district || '____'}।
      </p>

      <hr style={{ borderTop: '1px solid #000', margin: '14px 0' }} />

      {/* ── Title ──────────────────────────────── */}
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '16px', marginBottom: '12px', textDecoration: 'underline' }}>
        गिरफतारी मिमो + सूचना गिरफतारी आरोपियान
      </div>

      {/* ── 5-row Table ────────────────────────── */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13.5px'
        }}
      >
        <tbody>
          {rows.map(row => (
            <tr key={row.no}>
              <td
                style={{
                  border: '1px solid #000',
                  padding: '10px 12px',
                  width: '40px',
                  textAlign: 'center',
                  fontWeight: 700,
                  verticalAlign: 'top'
                }}
              >
                {row.no}
              </td>
              <td
                style={{
                  border: '1px solid #000',
                  padding: '10px 14px',
                  width: '45%',
                  verticalAlign: 'top'
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  border: '1px solid #000',
                  padding: '10px 14px',
                  verticalAlign: 'top',
                  minHeight: '60px'
                }}
              >
                {row.value || '—'}
                {/* space for signature in rows 2, 4, 5 */}
                {[2, 4, 5].includes(row.no) && (
                  <div style={{ marginTop: '32px', textAlign: 'right', fontSize: '12px', color: '#555' }}>
                    (हस्ताक्षर)
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Footer ─────────────────────────────── */}
      <div style={{ textAlign: 'right', marginTop: '48px' }}>
        <div style={{ marginBottom: '4px', height: '40px' }}></div>
        <div style={{ fontWeight: 700 }}>
          {arrest.arresting_officer_rank} {arrest.arresting_officer_name}
        </div>
        <div>{arrest.arresting_officer_post || fir?.police_station}</div>
        <div style={{ marginTop: '8px', fontSize: '13px' }}>
          दिनाँक {dateStr}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export default function ArrestManagement({ firId, firData, accusedList = [] }) {
  const [arrests, setArrests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [currentArrest, setCurrentArrest] = useState(null);
  const { token } = useAuth();
  const [form] = Form.useForm();

  const fetchArrests = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/arrests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setArrests(await res.json());
    } catch (e) {
      message.error('गिरफ्तारी रिकॉर्ड लोड करने में त्रुटि');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchArrests(); }, [firId]);

  const handleSubmit = async (vals) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/arrests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(vals)
      });
      if (res.ok) {
        message.success('गिरफ्तारी दर्ज हो गई और मिमो तैयार हो गया!');
        form.resetFields();
        fetchArrests();
      } else {
        const err = await res.json();
        message.error(err.error || 'गिरफ्तारी दर्ज करने में त्रुटि');
      }
    } catch (e) {
      message.error('त्रुटि: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    const content = document.getElementById('arrest-memo-print');
    if (!content) return;
    const printWin = window.open('', '_blank', 'width=900,height=700');
    printWin.document.write(`
      <html>
        <head>
          <title>गिरफ्तारी मिमो</title>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap" rel="stylesheet">
          <style>
            body { margin: 0; padding: 20px; font-family: 'Noto Sans Devanagari', Arial, sans-serif; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Form Card ──────────────────────────── */}
      <Card
        title={
          <span style={{ color: '#fff' }}>
            <UsergroupAddOutlined /> गिरफ्तारी दर्ज करें — आधिकारिक मिमो
          </span>
        }
        bordered={false}
        className="fir-card"
        style={{ background: 'rgba(15,27,45,0.85)' }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>

          {/* ── Row 1: अधिकारी विवरण ──────────── */}
          <Divider orientation="left" style={{ color: '#90caf9', borderColor: 'rgba(255,255,255,0.1)' }}>
            <SafetyCertificateOutlined /> 1. गिरफ्तार करने वाले अधिकारी का विवरण
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="arresting_officer_rank" label="पद (Rank)"
                rules={[{ required: true, message: 'पद अनिवार्य है' }]}>
                <Select placeholder="पद चुनें">
                  {['HC', 'ASI', 'SI', 'Inspector', 'DSP', 'SP', 'ASP', 'DYSP', 'स.उप.नि.', 'मुख्य सिपाही'].map(r => (
                    <Option key={r} value={r}>{r}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="arresting_officer_name" label="अधिकारी का नाम"
                rules={[{ required: true, message: 'नाम अनिवार्य है' }]}>
                <Input prefix={<UserOutlined />} placeholder="जैसे: श्रीनिवास" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="arresting_officer_badge" label="बैज नम्बर">
                <Input placeholder="जैसे: 929" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="arresting_officer_post" label="तैनाती / चौकी"
                rules={[{ required: true, message: 'तैनाती अनिवार्य है' }]}>
                <Input prefix={<EnvironmentOutlined />} placeholder="जैसे: चौकी बोहली पानीपत" />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Row 2: आरोपी का विवरण ─────────── */}
          <Divider orientation="left" style={{ color: '#90caf9', borderColor: 'rgba(255,255,255,0.1)' }}>
            <UserOutlined /> 2. गिरफ्तार व्यक्ति का नाम एवं पता
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="accused_name" label="आरोपी का नाम"
                rules={[{ required: true, message: 'आरोपी का नाम अनिवार्य है' }]}>
                <Select placeholder="FIR से चुनें या टाइप करें" showSearch allowClear>
                  {accusedList.map((a, i) => (
                    <Option key={i} value={a.name}>{a.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="accused_address" label="आरोपी का पूरा पता">
                <Input placeholder="जैसे: पुत्र राजमल, गाँव बिरधाना, जिला झज्जर" />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Row 3: गिरफ्तारी की तिथि/स्थान ── */}
          <Divider orientation="left" style={{ color: '#90caf9', borderColor: 'rgba(255,255,255,0.1)' }}>
            <EnvironmentOutlined /> 3. गिरफ्तारी का समय, तिथि एवं स्थान
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="date_of_arrest" label="गिरफ्तारी की तिथि व समय"
                rules={[{ required: true, message: 'तिथि अनिवार्य है' }]}>
                <Input type="datetime-local" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="arrest_place" label="गिरफ्तारी का स्थान">
                <Input prefix={<EnvironmentOutlined />} placeholder="जैसे: बोहली, पानीपत" />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Row 4: सूचना प्राप्त करने वाले का विवरण ── */}
          <Divider orientation="left" style={{ color: '#90caf9', borderColor: 'rgba(255,255,255,0.1)' }}>
            <PhoneOutlined /> 4. गिरफ्तारी की सूचना प्राप्त करने वाले का विवरण
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="informed_person_name" label="सूचित व्यक्ति का नाम">
                <Input prefix={<UserOutlined />} placeholder="जैसे: रणाधीर पुत्र लक्ष्मीदत" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="informed_person_address" label="सूचित व्यक्ति का पता">
                <Input placeholder="जैसे: म.न. 56 चोथ पाना, सिलाना जिला सोनीपत" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="informed_person_phone" label="मोबाइल नम्बर">
                <Input prefix={<PhoneOutlined />} placeholder="जैसे: 9466531239" />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Row 5: गवाह ──────────────────────── */}
          <Divider orientation="left" style={{ color: '#90caf9', borderColor: 'rgba(255,255,255,0.1)' }}>
            <TeamOutlined /> 5. गिरफ्तारी के समय गवाह
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="witness_name" label="गवाह का नाम">
                <Input prefix={<UserOutlined />} placeholder="जैसे: मु.सि. विक्रम न. 902" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="witness_post" label="गवाह की तैनाती">
                <Input placeholder="जैसे: पुलिस चौकी बोहली" />
              </Form.Item>
            </Col>
          </Row>

          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            icon={<SolutionOutlined />}
            size="large"
            style={{ marginTop: '8px', background: 'linear-gradient(135deg,#1565c0,#0d47a1)', border: 'none' }}
          >
            गिरफ्तारी दर्ज करें और मिमो तैयार करें
          </Button>
        </Form>
      </Card>

      {/* ── Arrest Records List ─────────────── */}
      <Card
        title={<span style={{ color: '#fff' }}><SolutionOutlined /> गिरफ्तारी रिकॉर्ड</span>}
        bordered={false}
        className="fir-card"
        style={{ background: 'rgba(15,27,45,0.85)' }}
      >
        {loading ? (
          <Skeleton active />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={arrests}
            locale={{ emptyText: 'अभी तक कोई गिरफ्तारी दर्ज नहीं हुई।' }}
            renderItem={item => {
              const dt = item.date_of_arrest
                ? new Date(item.date_of_arrest).toLocaleString('hi-IN')
                : '—';
              return (
                <List.Item
                  actions={[
                    <Button
                      key="view"
                      type="primary"
                      ghost
                      icon={<PrinterOutlined />}
                      onClick={() => { setCurrentArrest(item); setMemoOpen(true); }}
                    >
                      मिमो देखें / प्रिंट
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Tag color="red" style={{ fontSize: '13px', padding: '4px 10px' }}>गिरफ्तार</Tag>}
                    title={<span style={{ color: '#fff', fontWeight: 600 }}>{item.accused_name}</span>}
                    description={
                      <Space direction="vertical" size={2}>
                        <Text style={{ color: '#90caf9' }}>
                          <EnvironmentOutlined /> {item.arrest_place || '—'} &nbsp;|&nbsp; दिनाँक: {dt}
                        </Text>
                        <Text style={{ color: '#b0bec5', fontSize: '12px' }}>
                          गिरफ्तार करने वाले: {item.arresting_officer_rank} {item.arresting_officer_name}
                          {item.arresting_officer_post ? `, ${item.arresting_officer_post}` : ''}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      {/* ── Memo Preview Modal ──────────────── */}
      <Modal
        title={
          <span>
            <PrinterOutlined style={{ marginRight: 8, color: '#1976d2' }} />
            गिरफ्तारी मिमो — आधिकारिक प्रारूप
          </span>
        }
        open={memoOpen}
        onCancel={() => setMemoOpen(false)}
        width={820}
        footer={[
          <Button key="close" onClick={() => setMemoOpen(false)}>बंद करें</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
            प्रिंट करें / PDF सहेजें
          </Button>
        ]}
        styles={{ body: { background: '#f5f5f5', padding: '16px', maxHeight: '80vh', overflowY: 'auto' } }}
      >
        {currentArrest && (
          <ArrestMemoPreview arrest={currentArrest} fir={firData} />
        )}
      </Modal>
    </div>
  );
}
