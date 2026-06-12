import React, { useState } from 'react';
import { Typography, Row, Col, Card, Button, Alert, Spin, Modal, Table, Tag, Space } from 'antd';
import { SearchOutlined, FormOutlined, FileTextOutlined, SwapOutlined, WarningOutlined, EyeOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ComplaintWizard from '../components/complaints/ComplaintWizard';
import Enquiry from '../components/complaints/Enquiry';
import SearchComplaints, { ComplaintDetailView } from '../components/complaints/SearchComplaints';
import TransferComplaint from '../components/complaints/TransferComplaint';
import { useAuth } from '../hooks/useAuth';

const { Title, Paragraph, Text } = Typography;

// Error boundary to catch render crashes (e.g. corrupted localStorage)
class WizardErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch() {
    // Get where the user was before the crash
    const crashedStep = parseInt(localStorage.getItem('complaint_currentStep') || '0', 10);

    // ── IMPORTANT DATA — keep these, user worked hard for them ──────────────
    // complaint_mode, complaint_extractedData, complaint_data → PRESERVED

    // ── UI/transient state — safe to clear ──────────────────────────────────
    ['complaint_formData', 'complaint_template', 'complaint_docText'].forEach(k =>
      localStorage.removeItem(k)
    );

    // Go back ONE step (minimum step 0) instead of going to home
    // Step 2 (form) → Step 1 (upload) — extracted data still there
    // Step 1 (upload) → Step 0 (mode selection)
    // Step 0 → clear everything and go home (no data to preserve)
    if (crashedStep <= 0) {
      // Nothing to go back to — full reset to home
      ['complaint_currentStep','complaint_mode','complaint_extractedData','complaint_data',
       'complaint_hasDoc','complaint_sameAddr'
      ].forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem('complaintsCurrentView');
      setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname);
        window.location.reload();
      }, 100);
    } else {
      // Go back one step — stay in wizard, keep extracted data
      localStorage.setItem('complaint_currentStep', String(crashedStep - 1));
      sessionStorage.setItem('complaintsCurrentView', 'register'); // stay in wizard!
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  }


  render() {
    // hasError state set but redirect is already in progress — show nothing
    if (this.state.hasError) return null;
    return this.props.children;
  }
}


export default function Complaints() {
  const { token, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlView = searchParams.get('view');
  const [syncVersion, setSyncVersion] = useState(0);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHabitualModal, setShowHabitualModal] = useState(false);
  const [viewComplaint, setViewComplaint] = useState(null);

  const getHabitualReason = (c) => {
    const phone = (c.mobileNumber || '').trim();
    const desc = (c.descriptionOfComplaint || '').trim();
    const reasons = [];

    // Mobile Number Checks
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 0) {
      if (cleanPhone.length !== 10) {
        reasons.push('Invalid length (Must be 10 digits)');
      } else {
        if (!/^[6-9]/.test(cleanPhone)) {
          reasons.push('Invalid starting digit (Must start with 6, 7, 8, or 9)');
        }
        if (/^(\d)\1{9}$/.test(cleanPhone)) {
          reasons.push('Repetitive digits (e.g. 1111111111)');
        }
        if (/^(\d\d)\1{4}$/.test(cleanPhone)) {
          reasons.push('Alternating digits (e.g. 1212121212)');
        }
        if (cleanPhone === '1234567890' || cleanPhone === '0987654321') {
          reasons.push('Sequential digits (e.g. 1234567890)');
        }
      }
    }

    // Description Checks
    if (!desc) {
      reasons.push('Empty description');
    } else if (desc.length < 15) {
      reasons.push('Extremely short description (Less than 15 chars)');
    } else {
      const words = desc.split(/\s+/);
      const hasKeyboardMash = /asdf|qwerty|zxcv/i.test(desc);
      const longConsonantWord = words.some(w => w.length > 8 && !/[aeiouyअआइईउऊएऐओऔक-ह]/i.test(w));
      const repeatingLetters = /(\w)\1{4}/.test(desc);
      const uniqueWords = new Set(words);
      const wordRepeatRatio = uniqueWords.size / words.length;
      const isHighlyRepetitive = words.length > 5 && wordRepeatRatio < 0.3;

      if (hasKeyboardMash) reasons.push('Gibberish content (Keyboard mash detected)');
      if (longConsonantWord) reasons.push('Unreadable word (Gibberish consonant cluster)');
      if (repeatingLetters) reasons.push('Repetitive letters (e.g. aaaaa)');
      if (isHighlyRepetitive) reasons.push('Highly repetitive text (Spam)');
    }

    return reasons;
  };

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch complaints');
      const data = await res.json();
      setComplaints(data);
    } catch (err) {
      console.error('Error fetching complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Clear old localStorage complaints to start fresh
    localStorage.removeItem('registeredComplaints');
    
    if (token) {
      fetchComplaints();
    }
  }, [token, syncVersion]);

  // RULE: sessionStorage stores THE LAST VIEW the user was on (including 'register', 'enquiry').
  // This means navigating to FIR module and back will ALWAYS restore the same page.
  const persistedView = sessionStorage.getItem('complaintsCurrentView');
  const persistedEnquiryId = sessionStorage.getItem('complaintsEnquiryId');

  // Determine enquiry complaint ID: URL param first, then sessionStorage
  const urlEnquiryId = searchParams.get('id');
  const enquiryComplaintId = urlEnquiryId || (persistedView === 'enquiry' ? persistedEnquiryId : null);

  const currentView = urlView || persistedView || 'home';

  const setCurrentView = (view) => {
    sessionStorage.setItem('complaintsCurrentView', view); // Save ALL views including 'register'
    setSearchParams({ view });
  };

  // On mount: restore from sessionStorage if no URL params
  React.useEffect(() => {
    if (!urlView && persistedView && persistedView !== currentView) {
      // For enquiry view, also restore the complaint ID in URL
      if (persistedView === 'enquiry' && persistedEnquiryId) {
        setSearchParams({ view: 'enquiry', id: persistedEnquiryId }, { replace: true });
      } else {
        setSearchParams({ view: persistedView }, { replace: true });
      }
    }
  }, []);

  const handleStartEnquiry = (complaintId) => {
    // Save BOTH view and complaintId in sessionStorage so they survive module switching
    sessionStorage.setItem('complaintsCurrentView', 'enquiry');
    sessionStorage.setItem('complaintsEnquiryId', complaintId);
    setSearchParams({ view: 'enquiry', id: complaintId });
  };

  const handleBackFromEnquiry = () => {
    // Clear saved enquiry ID when going back to home
    sessionStorage.removeItem('complaintsEnquiryId');
    setSyncVersion(v => v + 1); // trigger refresh
    setCurrentView('home');
  };

  const renderHome = () => {
    // Read complaints from state
    let saved = complaints;
    
    // Filter by role/station
    if (profile?.role === 'io') {
      saved = saved.filter(c => String(c.assignedIoId).trim() === String(profile?.id).trim());
    } else if (profile?.role === 'sho') {
      saved = saved.filter(c => {
        const station = c.policeStation || 'SAMALKHA';
        const origStation = c.originalStation || 'SAMALKHA';
        return station === profile?.station_id || (origStation === profile?.station_id && c.ioStatus === 'Transferred');
      });
    }

    const myStation = profile?.station_id;
    const isAdmin = profile?.role === 'admin';

    // Helper: complaint is currently AT this station (destination or originally registered here)
    const atMyStation = (c) => isAdmin || (c.policeStation || 'SAMALKHA') === myStation;

    // Helper: complaint was SENT AWAY from this station to another station
    const sentFromMyStation = (c) =>
      c.ioStatus === 'Transferred' &&
      (isAdmin || ((c.originalStation || 'SAMALKHA') === myStation && (c.policeStation || 'SAMALKHA') !== myStation));

    // Helper: complaint was RECEIVED by this station (transferred IN from another station, no action yet)
    const receivedAtMyStation = (c) =>
      c.ioStatus === 'Transferred' &&
      !isAdmin &&
      (c.policeStation || 'SAMALKHA') === myStation &&
      (c.originalStation || 'SAMALKHA') !== myStation;

    const total = saved.filter(c => atMyStation(c)).length;
    const pendingEnquiry = saved.filter(c =>
      atMyStation(c) &&
      (!c.ioStatus || c.ioStatus === 'Pending' || c.ioStatus === 'Pending SHO Approval' || receivedAtMyStation(c))
    ).length;
    const underInvestigation = saved.filter(c =>
      atMyStation(c) && c.ioStatus === 'Under Investigation'
    ).length;
    const disposed = saved.filter(c =>
      atMyStation(c) && c.ioStatus === 'Disposed'
    ).length;
    const convertToFir = saved.filter(c =>
      atMyStation(c) && c.ioStatus === 'Convert to FIR'
    ).length;
    // Transferred = complaints WE sent away to another station
    const transferred = saved.filter(c => sentFromMyStation(c)).length;

    return (
      <div style={{ padding: '0px' }}>
        {loading && <Spin style={{ display: 'block', margin: '20px auto' }} />}
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>Complaint Management</Title>
            <Paragraph type="secondary" style={{ margin: 0, fontSize: '14px' }}>
              Register, Search, and Enquire Complaints
            </Paragraph>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button 
              type="primary" 
              size="large" 
              icon={<WarningOutlined />}
              onClick={() => setShowHabitualModal(true)}
              style={{ 
                borderRadius: '8px', 
                fontWeight: 'bold',
                backgroundColor: '#1677ff',
                borderColor: '#1677ff'
              }}
            >
              Habitual Complainants ({saved.filter(c => getHabitualReason(c).length > 0).length})
            </Button>
            <Button 
              type="primary" 
              size="large" 
              onClick={() => setCurrentView('register')}
              style={{ borderRadius: '8px', fontWeight: 'bold' }}
            >
              + Register New Complaint
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
          <Col style={{ flex: 1, minWidth: '180px' }}>
            <Card style={{ borderRadius: '12px', background: '#141414', borderColor: '#303030' }} bodyStyle={{ padding: '16px 20px' }}>
              <Paragraph type="secondary" style={{ margin: 0, marginBottom: '4px' }}>Total Complaints</Paragraph>
              <Title level={2} style={{ margin: 0 }}>{total}</Title>
            </Card>
          </Col>
          <Col style={{ flex: 1, minWidth: '180px' }}>
            <Card style={{ borderRadius: '12px', background: '#141414', borderColor: '#303030' }} bodyStyle={{ padding: '16px 20px' }}>
              <Paragraph type="secondary" style={{ margin: 0, marginBottom: '4px' }}>Pending Enquiry</Paragraph>
              <Title level={2} style={{ margin: 0 }}>{pendingEnquiry}</Title>
            </Card>
          </Col>
          <Col style={{ flex: 1, minWidth: '180px' }}>
            <Card style={{ borderRadius: '12px', background: '#141414', borderColor: '#303030' }} bodyStyle={{ padding: '16px 20px' }}>
              <Paragraph type="secondary" style={{ margin: 0, marginBottom: '4px' }}>Disposed</Paragraph>
              <Title level={2} style={{ margin: 0 }}>{disposed}</Title>
            </Card>
          </Col>
          <Col style={{ flex: 1, minWidth: '180px' }}>
            <Card
              onClick={() => navigate('/fir')}
              style={{
                borderRadius: '12px',
                background: 'rgba(255,77,79,0.08)',
                borderColor: '#ff4d4f',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
              }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              <Paragraph type="secondary" style={{ margin: 0, marginBottom: '4px', color: '#ff7875' }}>Convert To FIR</Paragraph>
              <Title level={2} style={{ margin: 0, color: '#ff4d4f' }}>{convertToFir}</Title>
            </Card>
          </Col>
          {profile?.role !== 'io' && (
            <Col style={{ flex: 1, minWidth: '180px' }}>
              <Card style={{ borderRadius: '12px', background: '#141414', borderColor: '#303030', cursor: 'pointer' }} bodyStyle={{ padding: '16px 20px' }}>
                <Paragraph type="secondary" style={{ margin: 0, marginBottom: '4px' }}>Transferred</Paragraph>
                <Title level={2} style={{ margin: 0 }}>{transferred}</Title>
              </Card>
            </Col>
          )}
        </Row>

        {/* Embedded Unified Search and Data Table */}
        <div style={{ background: '#141414', borderRadius: '12px', padding: '16px', border: '1px solid #303030' }}>
          <SearchComplaints 
            key={syncVersion}
            onBack={() => {}} 
            onStartEnquiry={handleStartEnquiry}
            hideHeader={true}
          />
        </div>

        {/* Habitual Complainants Modal */}
        <Modal
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
              <WarningOutlined style={{ color: '#ff4d4f' }} />
              Habitual Complainants & Suspicious Submissions
            </span>
          }
          open={showHabitualModal}
          onCancel={() => setShowHabitualModal(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setShowHabitualModal(false)}>
              Close
            </Button>
          ]}
          width={950}
        >
          <Table 
            dataSource={saved.filter(c => getHabitualReason(c).length > 0)}
            columns={[
              {
                title: 'Complaint ID',
                dataIndex: 'id',
                key: 'id',
                render: (text) => <Tag color="blue">{text}</Tag>
              },
              {
                title: 'Complainant',
                key: 'complainantName',
                render: (_, record) => `${record.firstName || ''} ${record.lastName || ''}`
              },
              {
                title: 'Mobile Number',
                dataIndex: 'mobileNumber',
                key: 'mobileNumber',
                render: (text) => <Text style={{ fontFamily: 'monospace' }}>{text}</Text>
              },
              {
                title: 'Description',
                dataIndex: 'descriptionOfComplaint',
                key: 'descriptionOfComplaint',
                ellipsis: true,
                render: (text) => (
                  <Text title={text} style={{ maxWidth: 220, display: 'inline-block' }} ellipsis>
                    {text}
                  </Text>
                )
              },
              {
                title: 'Reason Flagged',
                key: 'reasons',
                render: (_, record) => {
                  const reasons = getHabitualReason(record);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {reasons.map((r, idx) => (
                        <Tag key={idx} color="red">{r}</Tag>
                      ))}
                    </div>
                  );
                }
              },
              {
                title: 'Action',
                key: 'action',
                render: (_, record) => (
                  <Space size="middle">
                    <Button 
                      type="default" 
                      size="small" 
                      icon={<EyeOutlined />}
                      onClick={() => setViewComplaint(record)}
                    >
                      View
                    </Button>
                    <Button 
                      type="primary" 
                      size="small" 
                      onClick={() => {
                        setShowHabitualModal(false);
                        handleStartEnquiry(record.id);
                      }}
                    >
                      Enquire
                    </Button>
                  </Space>
                )
              }
            ]}
            rowKey="id"
            pagination={{ pageSize: 5 }}
            style={{ marginTop: 16 }}
          />
        </Modal>

        {/* Complaint Details Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <EyeOutlined style={{ color: '#1890ff' }} />
              <span>Complaint Details</span>
            </div>
          }
          open={!!viewComplaint}
          onCancel={() => setViewComplaint(null)}
          footer={[
            viewComplaint?.ioStatus !== 'Convert to FIR' && (
              <Button 
                key="enquire" 
                type="primary" 
                onClick={() => { 
                  setViewComplaint(null); 
                  setShowHabitualModal(false); 
                  handleStartEnquiry(viewComplaint?.id); 
                }}
              >
                Enquire
              </Button>
            ),
            <Button key="close" onClick={() => setViewComplaint(null)}>Close</Button>,
          ]}
          width={860}
          styles={{
            body: { background: '#111827', padding: '20px' },
            header: { background: '#1a2236', borderBottom: '1px solid rgba(255,255,255,0.08)' },
            footer: { background: '#1a2236', borderTop: '1px solid rgba(255,255,255,0.08)' },
            content: { background: '#111827' },
            mask: { backdropFilter: 'blur(4px)' },
          }}
        >
          <ComplaintDetailView record={viewComplaint} />
        </Modal>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {currentView === 'home' && renderHome()}

      {currentView === 'register' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <Title level={2}>Register New Complaint</Title>
          </div>
          <WizardErrorBoundary>
            <ComplaintWizard
              profile={profile}
              onBack={() => {
                // Called on: (a) Back from Step 0 (explicit exit), (b) After successful registration
                // Both cases: clear wizard state and go to home to see the updated complaint list
                ['complaint_currentStep','complaint_mode','complaint_extractedData','complaint_data',
                 'complaint_template','complaint_docText','complaint_formData','complaint_hasDoc','complaint_sameAddr'
                ].forEach(k => localStorage.removeItem(k));
                sessionStorage.removeItem('complaintsCurrentView');
                setCurrentView('home');
              }}
            />
          </WizardErrorBoundary>
        </>
      )}

      {currentView === 'transfer' && (
        <TransferComplaint onBack={() => setCurrentView('home')} />
      )}

      {currentView === 'enquiry' && (
        <Enquiry
          onBack={handleBackFromEnquiry}
          preSelectedComplaintId={enquiryComplaintId}
        />
      )}

      {currentView === 'search' && (
        <SearchComplaints
          key={syncVersion}
          onBack={() => setCurrentView('home')}
          onStartEnquiry={handleStartEnquiry}
        />
      )}
    </div>
  );
}
