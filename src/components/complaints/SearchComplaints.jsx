import React, { useState, useMemo } from 'react';
import { Table, Input, Button, Typography, Tag, Modal, Card, Row, Col, Divider, Badge } from 'antd';
import { SearchOutlined, EyeOutlined, UserOutlined, EnvironmentOutlined, SafetyOutlined, FileTextOutlined, TeamOutlined, InfoCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';

const { Title, Text } = Typography;
const { Search } = Input;

// Read-only field component
const ReadField = ({ label, value, span = 1 }) => (
  <Col span={span * 8}>
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#8c9ab5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '14px',
        color: value ? '#e8eaf0' : '#4a5568',
        minHeight: '36px',
        wordBreak: 'break-word',
      }}>
        {value || <span style={{ fontStyle: 'italic', color: '#4a5568' }}>—</span>}
      </div>
    </div>
  </Col>
);

// Section card header style
const sectionCard = (icon, title, color = '#1890ff') => ({
  title: (
    <span style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {React.cloneElement(icon, { style: { fontSize: '16px' } })}
      {title}
    </span>
  ),
  headStyle: { backgroundColor: color, borderBottom: 'none', fontSize: '15px', padding: '10px 16px' },
  style: { marginBottom: '16px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' },
  bodyStyle: { background: '#1a1f2e', padding: '20px 16px 4px' },
});

// Full Detail View Component
export function ComplaintDetailView({ record }) {
  if (!record) return null;

  const d = record;
  const hasPermAddr = d.permVillageTown || d.permDistrict || d.permState;
  const accusedList = d.accusedList || (d.accusedName ? [{ name: d.accusedName, address: d.accusedAddress || '' }] : []);

  const formatDate = (val) => {
    if (!val) return '';
    const parsed = dayjs(val);
    return parsed.isValid() ? parsed.format('DD MMM YYYY') : val;
  };
  const formatTime = (val) => {
    if (!val) return '';
    const parsed = dayjs(val);
    return parsed.isValid() ? parsed.format('hh:mm A') : val;
  };

  // Status tag color
  const statusColor = { Pending: 'orange', 'Under Investigation': 'blue', Disposed: 'purple', 'Convert to FIR': 'red', Registered: 'green' };
  const statusLabel = d.ioStatus || 'Registered';

  return (
    <div style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>

      {/* Header Bar */}
      <div style={{
        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ color: '#cce7ff', fontSize: '12px', fontWeight: 600, letterSpacing: '1px' }}>COMPLAINT ID</div>
          <div style={{ color: '#fff', fontSize: '24px', fontWeight: 700, letterSpacing: '1px' }}>{d.id}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginBottom: '6px' }}>
            <Tag color={statusColor[statusLabel] || 'green'} style={{ fontSize: '13px', padding: '2px 10px' }}>
              {statusLabel}
            </Tag>
          </div>
          <div style={{ color: '#cce7ff', fontSize: '12px' }}>
            Registered: {formatDate(d.registrationDate || d.registeredAt)}
          </div>
          {d.assignedIoName && (
            <div style={{ color: '#cce7ff', fontSize: '12px' }}>IO: {d.assignedIoName}</div>
          )}
        </div>
      </div>

      {/* 1. Complainant Details */}
      <Card {...sectionCard(<UserOutlined />, 'Complainant Details', '#1890ff')}>
        <Row gutter={16}>
          <ReadField label="First Name" value={d.firstName} />
          <ReadField label="Last Name" value={d.lastName} />
          <ReadField label="Mobile Number" value={d.mobileNumber} />
          <ReadField label="Gender" value={d.gender} />
          <ReadField label="Source of Complaint" value={d.natureOfComplaint} span={2} />
          <ReadField label="Type of Accused" value={d.typeOfAccused} span={1} />
        </Row>
      </Card>

      {/* 2. Address */}
      <Card {...sectionCard(<EnvironmentOutlined />, 'Address Details', '#13c2c2')}>
        <div style={{ color: '#8c9ab5', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
          Present Address
        </div>
        <Row gutter={16}>
          <ReadField label="Village / Town" value={d.villageTown} />
          <ReadField label="District" value={d.district} />
          <ReadField label="State" value={d.state} />
        </Row>
        {hasPermAddr && (
          <>
            <Divider style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '8px 0 16px' }} />
            <div style={{ color: '#8c9ab5', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
              Permanent Address
            </div>
            <Row gutter={16}>
              <ReadField label="Village / Town" value={d.permVillageTown} />
              <ReadField label="District" value={d.permDistrict} />
              <ReadField label="State" value={d.permState} />
            </Row>
          </>
        )}
      </Card>

      {/* 3. Identification */}
      <Card {...sectionCard(<SafetyOutlined />, 'Identification', '#722ed1')}>
        <Row gutter={16}>
          <ReadField label="Nationality" value={d.nationality} />
          <ReadField label="ID Type" value={d.idType} />
          <ReadField label="ID Number" value={d.idNumber} />
        </Row>
      </Card>

      {/* 4. Incident Details */}
      <Card {...sectionCard(<InfoCircleOutlined />, 'Incident Details', '#fa8c16')}>
        <Row gutter={16}>
          <ReadField label="Class of Incident" value={d.classOfIncident} span={2} />
          <ReadField label="Place of Incident" value={d.placeOfIncident} span={1} />
          <ReadField label="Date of Incident" value={formatDate(d.dateOfIncident)} />
          <ReadField label="Time of Incident" value={formatTime(d.timeOfIncident)} />
          <ReadField label="Date of Complaint" value={formatDate(d.dateOfComplaint)} />
        </Row>
      </Card>

      {/* 5. Complaint Classification */}
      <Card {...sectionCard(<FileTextOutlined />, 'Complaint Classification', '#52c41a')}>
        <Row gutter={16}>
          <ReadField label="Type of Complaint" value={d.typeOfComplaint} />
          <ReadField label="Type of Complainant" value={d.typeOfComplainant} />
          <ReadField label="Complaint Purpose" value={d.complaintPurpose} />
          <ReadField label="FIR Registered?" value={d.isFirRegistered} />
          <ReadField label="Mode of Receipt" value={d.modeOfReceipt} span={2} />
        </Row>
      </Card>

      {/* 6. Accused List */}
      {accusedList.length > 0 && (
        <Card {...sectionCard(<TeamOutlined />, `Accused (${accusedList.length})`, '#cf1322')}>
          {accusedList.map((acc, idx) => (
            <div key={idx} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,80,80,0.2)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: idx < accusedList.length - 1 ? '10px' : 0,
            }}>
              <Row gutter={16}>
                <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'rgba(207,19,34,0.2)', border: '1px solid rgba(207,19,34,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#ff7875', fontWeight: 700, fontSize: '13px',
                  }}>
                    {idx + 1}
                  </div>
                </Col>
                <Col span={11}>
                  <div style={{ fontSize: '11px', color: '#8c9ab5', marginBottom: '3px', textTransform: 'uppercase' }}>Name</div>
                  <div style={{ color: '#e8eaf0', fontSize: '14px' }}>{acc.name || '—'}</div>
                </Col>
                <Col span={11}>
                  <div style={{ fontSize: '11px', color: '#8c9ab5', marginBottom: '3px', textTransform: 'uppercase' }}>Address</div>
                  <div style={{ color: '#e8eaf0', fontSize: '14px' }}>{acc.address || '—'}</div>
                </Col>
              </Row>
            </div>
          ))}
        </Card>
      )}

      {/* 7. Description */}
      {d.descriptionOfComplaint && (
        <Card {...sectionCard(<FileTextOutlined />, 'Description of Complaint', '#597ef7')}>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '14px',
            color: '#c8cfe0',
            fontSize: '14px',
            lineHeight: '1.8',
            whiteSpace: 'pre-wrap',
          }}>
            {d.descriptionOfComplaint}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function SearchComplaints({ onBack, onStartEnquiry, hideHeader }) {
  const [searchText, setSearchText] = useState('');
  const [viewComplaint, setViewComplaint] = useState(null);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [complaintsList, setComplaintsList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setComplaintsList(data);
      }
    } catch (e) {
      console.error("Error loading complaints:", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchComplaints();
  }, []);

  React.useEffect(() => {
    const openId = searchParams.get('open_id');
    if (openId && complaintsList.length > 0) {
      const found = complaintsList.find(c => c.id === openId);
      if (found) {
        setViewComplaint(found);
      }
    }
  }, [searchParams, complaintsList]);

  const complaints = useMemo(() => {
    const list = [...complaintsList];
    list.sort((a, b) => new Date(b.registrationDate || b.registeredAt) - new Date(a.registrationDate || a.registeredAt));
    return list;
  }, [complaintsList]);

  const filteredComplaints = useMemo(() => {
    if (!searchText) return complaints;
    const lower = searchText.toLowerCase();
    return complaints.filter(c => {
      // 1. Existing search criteria (ID, Name, Mobile Number)
      const matchesExisting = 
        (c.id && c.id.toLowerCase().includes(lower)) ||
        (c.firstName && c.firstName.toLowerCase().includes(lower)) ||
        (c.lastName && c.lastName.toLowerCase().includes(lower)) ||
        (c.mobileNumber && c.mobileNumber.includes(lower));

      if (matchesExisting) return true;

      // 2. Status matching (based on UI status cards & tags)
      const rawStatus = (c.ioStatus || 'Registered').toLowerCase();
      
      // Determine if transferred in to this station
      const isDestination =
        c.ioStatus === 'Transferred' &&
        profile?.role !== 'admin' &&
        (c.policeStation || 'SAMALKHA') === profile?.station_id &&
        (c.originalStation || 'SAMALKHA') !== profile?.station_id;

      // Build array of matching display labels for status
      const displayLabels = [rawStatus];
      if (isDestination) {
        displayLabels.push('pending (transferred in)', 'pending', 'transferred in');
      } else {
        if (rawStatus === 'pending' || rawStatus === 'pending sho approval' || rawStatus === 'registered') {
          displayLabels.push('pending enquiry', 'pending', 'enquiry', 'registered');
        } else if (rawStatus === 'under investigation') {
          displayLabels.push('under investigation', 'investigation');
        } else if (rawStatus === 'disposed') {
          displayLabels.push('disposed');
        } else if (rawStatus === 'convert to fir') {
          displayLabels.push('convert to fir', 'fir');
        } else if (rawStatus === 'transferred') {
          displayLabels.push('transferred');
        }
      }

      // Check if any computed status string matches the query
      return displayLabels.some(label => label.includes(lower));
    });
  }, [complaints, searchText, profile]);

  const columns = [
    {
      title: 'Complaint ID',
      dataIndex: 'id',
      key: 'id',
      width: '12%',
      render: (text, record) => (
        <Button 
          type="link" 
          style={{ padding: 0, fontWeight: 700, height: 'auto', color: '#177ddc' }}
          onClick={() => setViewComplaint(record)}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'registrationDate',
      key: 'registrationDate',
      width: '10%',
      render: date => <span style={{ whiteSpace: 'nowrap' }}>{dayjs(date).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Complainant',
      key: 'name',
      width: '13%',
      render: (_, record) => <span>{`${record.firstName || ''} ${record.lastName || ''}`.trim() || 'Unknown'}</span>,
    },
    {
      title: 'Incident Class',
      dataIndex: 'classOfIncident',
      key: 'classOfIncident',
      width: '18%',
      render: text => <Tag color="blue">{text || 'N/A'}</Tag>,
    },
    {
      title: 'Status',
      key: 'status',
      width: '14%',
      render: (_, record) => {
        // If complaint was transferred TO this station (we are the destination)
        // show it as 'Pending (Transferred In)' not 'Transferred'
        const isDestination =
          record.ioStatus === 'Transferred' &&
          profile?.role !== 'admin' &&
          (record.policeStation || 'SAMALKHA') === profile?.station_id &&
          (record.originalStation || 'SAMALKHA') !== profile?.station_id;

        let color = 'green';
        let label = record.ioStatus || 'Registered';
        if (isDestination) { label = 'Pending (Transferred In)'; color = 'orange'; }
        else if (label === 'Pending') color = 'orange';
        else if (label === 'Under Investigation') color = 'blue';
        else if (label === 'Disposed') color = 'purple';
        else if (label === 'Convert to FIR') color = 'red';
        else if (label === 'Transferred') color = 'volcano';
        return (
          <div>
            <Tag color={color}>{label}</Tag>
            {record.ioStatus === 'Convert to FIR' && record.linkedFirNumber && (
              <div style={{ marginTop: 3 }}>
                <Tag color="volcano" style={{ fontSize: 10, fontFamily: 'monospace' }}>FIR: {record.linkedFirNumber}</Tag>
              </div>
            )}
            {isDestination && record.transferredFrom && (
              <div style={{ marginTop: 3 }}>
                <Tag color="geekblue" style={{ fontSize: 10 }}>From: {record.transferredFrom}</Tag>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Assigned To',
      key: 'assignedIoName',
      width: '15%',
      render: (_, record) => record.assignedIoName
        ? <Tag color="cyan">{record.assignedIoName}</Tag>
        : <Text type="secondary">Unassigned</Text>,
    },
    {
      title: 'Enquire Complaints',
      key: 'action',
      width: '18%',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Button
            type="default"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => setViewComplaint(record)}
          >
            View
          </Button>
          {record.ioStatus !== 'Convert to FIR' && (
            <Button
              type="primary"
              size="small"
              onClick={() => { if (onStartEnquiry) onStartEnquiry(record.id); }}
            >
              Enquire
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: hideHeader ? '0' : '24px', borderRadius: '8px' }}>
      {!hideHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={3} style={{ margin: 0 }}>Search Complaints</Title>
          <Button icon={<ArrowLeftOutlined />} style={{ background: '#1f1f1f', color: '#177ddc', borderColor: '#303030', borderRadius: '8px', padding: '4px 16px', fontWeight: 500 }} onClick={onBack}>Back</Button>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <Search
          placeholder="Search by ID, Name, or Mobile Number..."
          allowClear
          enterButton={<Button type="primary" style={{ background: '#1890ff', borderColor: '#1890ff', color: 'white' }}>Search</Button>}
          size="large"
          onSearch={setSearchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 500 }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredComplaints}
        rowKey="id"
        pagination={{ pageSize: 5 }}
        locale={{ emptyText: 'No complaints found.' }}
        tableLayout="fixed"
      />

      {/* Full Detail Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <EyeOutlined style={{ color: '#1890ff' }} />
            <span>Complaint Details</span>
          </div>
        }
        open={!!viewComplaint}
        onCancel={() => {
          setViewComplaint(null);
          const params = new URLSearchParams(window.location.search);
          if (params.has('open_id')) {
            params.delete('open_id');
            setSearchParams(params);
          }
        }}
        footer={[
          viewComplaint?.ioStatus !== 'Convert to FIR' && (
            <Button key="enquire" type="primary" onClick={() => { setViewComplaint(null); if (onStartEnquiry) onStartEnquiry(viewComplaint?.id); }}>
              Start Enquiry
            </Button>
          ),
          viewComplaint?.ioStatus === 'Convert to FIR' && (
            <Button key="view-fir" type="primary" danger onClick={() => { setViewComplaint(null); navigate('/fir'); }}>
              View FIR
            </Button>
          ),
          <Button key="close" onClick={() => {
            setViewComplaint(null);
            const params = new URLSearchParams(window.location.search);
            if (params.has('open_id')) {
              params.delete('open_id');
              setSearchParams(params);
            }
          }}>Close</Button>,
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
}
