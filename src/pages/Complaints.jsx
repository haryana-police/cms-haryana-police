import React, { useState } from 'react';
import { Typography, Row, Col, Card, Button, Alert } from 'antd';
import { SearchOutlined, FormOutlined, FileTextOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import ComplaintWizard from '../components/complaints/ComplaintWizard';
import Enquiry from '../components/complaints/Enquiry';
import SearchComplaints from '../components/complaints/SearchComplaints';
import TransferComplaint from '../components/complaints/TransferComplaint';
import { useAuth } from '../hooks/useAuth';

const { Title, Paragraph } = Typography;

// Error boundary to catch render crashes (e.g. corrupted localStorage)
class WizardErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error, info) {
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
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlView = searchParams.get('view');

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
    setCurrentView('home');
  };

  const renderHome = () => {
    // Read local stats
    // Read local stats
    let saved = JSON.parse(localStorage.getItem('registeredComplaints') || '[]');
    
    // If the user is an IO, only show complaints assigned to them
    if (profile?.role === 'io') {
      saved = saved.filter(c => String(c.assignedIoId).trim() === String(profile?.id).trim());
    }

    const total = saved.length;
    const pendingEnquiry = saved.filter(c => !c.ioStatus || c.ioStatus === 'Pending' || c.ioStatus === 'Pending SHO Approval').length;
    const underInvestigation = saved.filter(c => c.ioStatus === 'Under Investigation').length;
    const disposed = saved.filter(c => c.ioStatus === 'Disposed').length;
    const convertToFir = saved.filter(c => c.ioStatus === 'Convert to FIR').length;

    return (
      <div style={{ padding: '0px' }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>Complaint Management</Title>
            <Paragraph type="secondary" style={{ margin: 0, fontSize: '14px' }}>
              Register, Search, and Enquire Complaints
            </Paragraph>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {profile?.role === 'sho' && (
              <Button 
                type="primary"
                size="large" 
                onClick={() => setCurrentView('transfer')}
                style={{ borderRadius: '8px', fontWeight: 'bold' }}
              >
                Transfer Complaint
              </Button>
            )}
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
              <Paragraph type="secondary" style={{ margin: 0, marginBottom: '4px' }}>Under Investigation</Paragraph>
              <Title level={2} style={{ margin: 0 }}>{underInvestigation}</Title>
            </Card>
          </Col>
          <Col style={{ flex: 1, minWidth: '180px' }}>
            <Card style={{ borderRadius: '12px', background: '#141414', borderColor: '#303030' }} bodyStyle={{ padding: '16px 20px' }}>
              <Paragraph type="secondary" style={{ margin: 0, marginBottom: '4px' }}>Disposed</Paragraph>
              <Title level={2} style={{ margin: 0 }}>{disposed}</Title>
            </Card>
          </Col>
          <Col style={{ flex: 1, minWidth: '180px' }}>
            <Card style={{ borderRadius: '12px', background: '#141414', borderColor: '#303030' }} bodyStyle={{ padding: '16px 20px' }}>
              <Paragraph type="secondary" style={{ margin: 0, marginBottom: '4px' }}>Convert To FIR</Paragraph>
              <Title level={2} style={{ margin: 0 }}>{convertToFir}</Title>
            </Card>
          </Col>
        </Row>

        {/* Embedded Unified Search and Data Table */}
        <div style={{ background: '#141414', borderRadius: '12px', padding: '16px', border: '1px solid #303030' }}>
          <SearchComplaints 
            onBack={() => {}} 
            onStartEnquiry={handleStartEnquiry}
            hideHeader={true}
          />
        </div>
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
          onBack={() => setCurrentView('home')}
          onStartEnquiry={handleStartEnquiry}
        />
      )}
    </div>
  );
}
