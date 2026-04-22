import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Card, Descriptions, Tag, Button, Spin, message, Tabs, Space } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, BuildOutlined, PrinterOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';

// Investigation Components
import CDRManagement from './investigation/CDRManagement';
import ArrestManagement from './investigation/ArrestManagement';
import EvidenceManagement from './investigation/EvidenceManagement';
import ChallanGeneration from './investigation/ChallanGeneration';
import CaseDiaryManagement from './investigation/CaseDiaryManagement';
import FIRPrintDocument from './FIRPrintDocument';

const { Title, Text } = Typography;

export default function FIRDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, profile } = useAuth();
  const [fir, setFir] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFIR = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch FIR');
        const data = await res.json();
        
        // Parse JSON arrays back to arrays
        if (typeof data.accused_details === 'string') data.accused_details = JSON.parse(data.accused_details);
        if (typeof data.acts_sections === 'string') data.acts_sections = JSON.parse(data.acts_sections);
        
        setFir(data);
      } catch (err) {
        message.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFIR();
  }, [id, token]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  }

  if (!fir) {
    return <div>FIR not found</div>;
  }

  const isIO = profile?.role === 'io' || profile?.role === 'sho' || profile?.role === 'admin';

  const handlePrintFIR = () => {
    const el = document.getElementById('fir-print-root');
    if (!el) return;
    const html = el.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=800');
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>FIR ${fir.fir_number}/${fir.year} — Haryana Police</title>
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

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/fir')} shape="circle" />
        <Title level={2} style={{ margin: 0 }}>FIR {fir.fir_number} / {fir.year}</Title>
        <Tag color={fir.status === 'closed' ? 'green' : fir.status === 'chargesheeted' ? 'purple' : 'blue'}>
          {fir.status.toUpperCase().replace('_', ' ')}
        </Tag>
        <div style={{ marginLeft: 'auto' }}>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrintFIR}
            style={{ background: 'linear-gradient(135deg,#1565c0,#0d47a1)', border: 'none' }}
          >
            Print FIR / Save PDF
          </Button>
        </div>
      </div>

      {/* Hidden print-ready document */}
      <div style={{ display: 'none' }}>
        <FIRPrintDocument fir={fir} />
      </div>

      <Tabs 
        defaultActiveKey="1" 
        size="large"
        items={[
          {
            key: '1',
            label: <span><EyeOutlined /> Basic Information</span>,
            children: (
              <Card bordered={false} className="fir-card">
                <Descriptions bordered column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}>
                  <Descriptions.Item label="Police Station">{fir.police_station}, {fir.district}</Descriptions.Item>
                  <Descriptions.Item label="Date of Registration">{new Date(fir.date_time_of_fir).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="Complainant">{fir.complainant_name}</Descriptions.Item>
                  <Descriptions.Item label="Place of Occurrence">{fir.place_address || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Investigating Officer">{fir.io_name || 'Unassigned'} ({fir.io_rank})</Descriptions.Item>
                  <Descriptions.Item label="Registered By">{fir.registered_by_name}</Descriptions.Item>
                  
                  <Descriptions.Item label="Acts & Sections" span={3}>
                    {fir.acts_sections?.map((act, i) => (
                      <Tag key={i} color="geekblue" style={{ marginBottom: 4 }}>{act.act} - Sec {act.sections}</Tag>
                    ))}
                  </Descriptions.Item>

                  <Descriptions.Item label="Accused Details" span={3}>
                    {fir.accused_details && fir.accused_details.length > 0 ? (
                      fir.accused_details.map((accused, i) => (
                        <Tag key={i}>{accused.name} {accused.phone ? `(${accused.phone})` : ''}</Tag>
                      ))
                    ) : (
                      <Text type="secondary">Unknown/None mentioned</Text>
                    )}
                  </Descriptions.Item>

                  <Descriptions.Item label="FIR Narrative" span={3}>
                    <div style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', color: '#d9d9d9', padding: '16px', borderRadius: '8px' }}>
                      {fir.fir_content}
                    </div>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )
          },
          ...(isIO ? [
            {
              key: '2',
              label: <span><BuildOutlined /> Investigation Actions</span>,
              children: (
                <Tabs tabPosition="left" style={{ background: '#0f1b2d', padding: '24px 0', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.07)' }}>
                  <Tabs.TabPane tab="CDR Requests" key="inv-1">
                    <div style={{ padding: '0 24px' }}>
                      <CDRManagement firId={fir.id} accusedList={fir.accused_details || []} />
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane tab="Arrests" key="inv-2">
                    <div style={{ padding: '0 24px' }}>
                      <ArrestManagement firId={fir.id} firData={fir} accusedList={fir.accused_details || []} />
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane tab="Evidences & Notices" key="inv-3">
                    <div style={{ padding: '0 24px' }}>
                      <EvidenceManagement firId={fir.id} firData={fir} />
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane tab="Case Diary" key="inv-4">
                    <div style={{ padding: '0 24px' }}>
                      <CaseDiaryManagement firId={fir.id} />
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane tab="Final Report (Challan)" key="inv-5">
                    <div style={{ padding: '0 24px' }}>
                      <ChallanGeneration firId={fir.id} />
                    </div>
                  </Tabs.TabPane>
                </Tabs>
              )
            }
          ] : [])
        ]}
      />
    </div>
  );
}
