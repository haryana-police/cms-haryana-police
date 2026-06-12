import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Typography, Space, Input,
  Select, Card, Statistic, Row, Col, Tooltip, message, Modal,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, FileTextOutlined,
  FileDoneOutlined, ClockCircleOutlined, CheckCircleOutlined, LinkOutlined, SwapOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { RoleGate } from '../../components/Auth/RoleGate';
import { ComplaintDetailView } from '../../components/complaints/SearchComplaints';
import '../../styles/fir.css';

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_CONFIG = {
  registered:          { color: 'blue',   label: 'Registered',           icon: <FileTextOutlined /> },
  under_investigation: { color: 'orange', label: 'Under Investigation',   icon: <ClockCircleOutlined /> },
  chargesheeted:       { color: 'purple', label: 'Chargesheeted',         icon: <FileDoneOutlined /> },
  closed:              { color: 'green',  label: 'Closed',                icon: <CheckCircleOutlined /> },
};

export default function FIRListPage() {
  const [firs, setFirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
  const { token, profile } = useAuth();
  const isSHO = profile?.role === 'sho' || profile?.role === 'admin';
  const isIO  = profile?.role === 'io';

  const [viewComplaintId, setViewComplaintId] = useState(null);
  const [viewComplaintData, setViewComplaintData] = useState(null);
  const [viewComplaintLoading, setViewComplaintLoading] = useState(false);

  useEffect(() => {
    if (!viewComplaintId) {
      setViewComplaintData(null);
      return;
    }
    const fetchComplaint = async () => {
      try {
        setViewComplaintLoading(true);
        // Check localStorage first
        const allSaved = JSON.parse(localStorage.getItem('registeredComplaints') || '[]');
        const found = allSaved.find(c => c.id === viewComplaintId);
        if (found) {
          setViewComplaintData(found);
          return;
        }

        // Fetch from database
        const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/complaints/${viewComplaintId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        let data;
        if (!res.ok) {
          // Fallback: If not found in DB, try to find in current FIRs list
          const linkedFir = firs.find(f => f.complaint_id === viewComplaintId);
          if (linkedFir) {
            data = {
              id: viewComplaintId,
              created_at: linkedFir.date_time_of_fir,
              complainant_name: linkedFir.complainant_name || 'Unknown',
              complainant_phone: linkedFir.complainant_phone || '',
              complainant_present_address: linkedFir.complainant_present_address || '',
              district: linkedFir.district || '',
              incident_place: linkedFir.place_address || 'Unknown',
              incident_date: linkedFir.date_time_of_fir ? linkedFir.date_time_of_fir.slice(0, 10) : null,
              complaint_text: linkedFir.fir_content || '',
              status: 'Convert to FIR'
            };
          } else {
            throw new Error('Failed to load complaint details');
          }
        } else {
          data = await res.json();
        }
        
        // Normalize
        const normalized = {
          id: data.id || data.complaint_number,
          registrationDate: data.created_at,
          firstName: data.complainant_name || 'Unknown',
          lastName: '',
          mobileNumber: data.complainant_phone || '',
          gender: data.complainant_gender || 'Male',
          natureOfComplaint: 'Citizen/General Public',
          typeOfAccused: 'Against Private Person',
          villageTown: data.complainant_present_address || '',
          district: data.district || '',
          state: 'Haryana',
          nationality: data.complainant_nationality || 'Indian',
          idType: 'Aadhar Card',
          idNumber: data.complainant_uid || '',
          classOfIncident: 'Other IPC/BNS Crimes',
          placeOfIncident: data.incident_place || 'Unknown',
          dateOfIncident: data.incident_date || null,
          dateOfComplaint: data.created_at || null,
          typeOfComplaint: 'Fresh Complaint',
          typeOfComplainant: 'Private Person',
          complaintPurpose: 'FIR Registration',
          isFirRegistered: 'Yes',
          modeOfReceipt: 'In-Person/By Hand',
          descriptionOfComplaint: data.complaint_text || '',
          ioStatus: data.status || 'Registered',
          accusedList: []
        };
        setViewComplaintData(normalized);
      } catch (err) {
        message.error(err.message);
        setViewComplaintId(null);
      } finally {
        setViewComplaintLoading(false);
      }
    };
    fetchComplaint();
  }, [viewComplaintId, token]);

  const fetchFIRs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFirs(data);
    } catch (err) {
      message.error('Failed to load FIRs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFIRs(); }, []);

  const filtered = firs.filter(f => {
    const matchSearch =
      !search ||
      f.fir_number?.toLowerCase().includes(search.toLowerCase()) ||
      f.complainant_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.district?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    total:         firs.length,
    registered:    firs.filter(f => f.status === 'registered').length,
    investigating: firs.filter(f => f.status === 'under_investigation').length,
    chargesheeted: firs.filter(f => f.status === 'chargesheeted').length,
    closed:        firs.filter(f => f.status === 'closed').length,
    converted:     firs.filter(f => !!f.complaint_id).length,
  };

  const columns = [
    {
      title: 'FIR No.',
      dataIndex: 'fir_number',
      key: 'fir_number',
      width: 120,
      render: (num, row) => (
        <div>
          <Text strong style={{ color: '#69c0ff', fontFamily: 'monospace', fontSize: 14 }}>
            {num}/{row.year}
          </Text>
          {row.complaint_id && (
            <div style={{ marginTop: 3 }}>
              <Tag
                color="volcano"
                icon={<SwapOutlined />}
                style={{ fontSize: 10, lineHeight: '16px', padding: '0 5px' }}
              >
                From Complaint
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Date & P.S.',
      key: 'date_ps',
      width: 160,
      render: (_, row) => (
        <div>
          <Text style={{ fontSize: 12 }}>{row.date_time_of_fir?.slice(0, 10)}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{row.police_station}, {row.district}</Text>
        </div>
      ),
    },
    {
      title: 'Complainant',
      dataIndex: 'complainant_name',
      key: 'complainant_name',
    },
    {
      title: 'Acts & Sections',
      dataIndex: 'acts_sections',
      key: 'acts_sections',
      width: 160,
      render: (val) => {
        try {
          const arr = JSON.parse(val || '[]');
          if (!arr || arr.length === 0) return '—';
          return (
            <Space size={4} wrap>
              {arr.slice(0, 2).map((a, i) => (
                <Tooltip key={i} title={a.act}>
                  <Tag color="geekblue" style={{ fontSize: 11 }}>{a.sections}</Tag>
                </Tooltip>
              ))}
              {arr.length > 2 && <Tag>+{arr.length - 2} more</Tag>}
            </Space>
          );
        } catch { return '—'; }
      },
    },
    {
      title: 'IO',
      key: 'io',
      width: 130,
      render: (_, row) => row.io_name
        ? <Text style={{ fontSize: 12 }}>{row.io_name}<br /><Text type="secondary" style={{ fontSize: 11 }}>{row.io_rank}</Text></Text>
        : <Tag>Unassigned</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => {
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.under_investigation;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Linked Data',
      key: 'links',
      width: 130,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          {row.complaint_id && (
            <Tooltip title="View Linked Complaint">
              <Tag
                icon={<LinkOutlined />}
                color="cyan"
                style={{ fontSize: 11, marginBottom: 4, cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setViewComplaintId(row.complaint_id);
                }}
              >
                CMP: {row.complaint_id}
              </Tag>
            </Tooltip>
          )}
          {row.gd_entry_no && (
            <Tooltip title="Linked GD Entry">
              <Tag icon={<LinkOutlined />} color="cyan" style={{ fontSize: 11 }}>GD: {row.gd_entry_no}</Tag>
            </Tooltip>
          )}
          {!row.complaint_id && !row.gd_entry_no && <Text type="secondary" style={{ fontSize: 12 }}>None</Text>}
        </Space>
      ),
    },
    {
      title: 'Registered By',
      dataIndex: 'registered_by_name',
      key: 'registered_by_name',
      width: 185,
      render: (name) => <Text style={{ fontSize: 12 }}>{name || '—'}</Text>,
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/fir/${row.id}`);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="fir-list-container">
      {/* Header */}
      <div className="fir-list-header">
        <div>
          <Title level={3} style={{ margin: 0, color: '#e6f7ff' }}>FIR Management</Title>
          <Text type="secondary">First Information Reports — प्रथम सूचना रिपोर्ट</Text>
        </div>
        <RoleGate allowedRoles={['io', 'sho', 'admin']}>
        {isSHO && (
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => navigate('/fir/new')}
            className="fir-new-btn"
          >
            Register New FIR
          </Button>
        )}
        </RoleGate>
      </div>
      {/* IO Info Banner */}
      {isIO && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(24,144,255,0.12), rgba(24,144,255,0.05))',
          border: '1px solid rgba(24,144,255,0.3)',
          borderRadius: 10,
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          color: '#69c0ff',
        }}>
          <FileTextOutlined style={{ fontSize: 18 }} />
          <span>
            <strong>IO View:</strong> आपको केवल वे FIR दिखाई जा रही हैं जो SHO द्वारा आपको assign की गई हैं।
            {firs.length === 0 && !loading && ' अभी कोई FIR assign नहीं हुई है।'}
          </span>
        </div>
      )}
      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }} align="stretch">
        {[
          { title: 'Total FIRs',                value: counts.total,         color: '#1890ff' },
          { title: 'Registered',                value: counts.registered,    color: '#1890ff' },
          { title: 'Under Investigation',        value: counts.investigating,  color: '#fa8c16' },
          { title: 'Closed',                    value: counts.closed,        color: '#52c41a' },
          { title: 'Chargesheeted',             value: counts.chargesheeted, color: '#722ed1' },
        ].map((s, i) => (
          <Col xs={12} sm={12} md={8} lg={4} style={{ flex: '1 1 180px' }} key={i}>
            <Card className="fir-stat-card" bordered={false}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{s.title}</span>}
                value={s.value}
                valueStyle={{ color: s.color, fontSize: 28 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <div className="fir-filter-bar">
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search by FIR No., Complainant, District..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 320 }}
        />
        <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 200 }}>
          <Option value="all">All Statuses</Option>
          {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
            <Option key={val} value={val}>{cfg.label}</Option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <Card className="fir-list-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showTotal: (t) => `Total ${t} FIRs` }}
          onRow={(record) => ({
            onClick: () => navigate(`/fir/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          className="fir-table"
          locale={{ emptyText: 'No FIRs found. Register a new FIR to get started.' }}
        />
      </Card>

      {/* Linked Complaint View Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span>Complaint Details</span>
          </div>
        }
        open={!!viewComplaintId}
        onCancel={() => setViewComplaintId(null)}
        footer={[
          <Button key="close" onClick={() => setViewComplaintId(null)}>Close</Button>
        ]}
        width={860}
        loading={viewComplaintLoading}
        styles={{
          body: { background: '#111827', padding: '20px' },
          header: { background: '#1a2236', borderBottom: '1px solid rgba(255,255,255,0.08)' },
          footer: { background: '#1a2236', borderTop: '1px solid rgba(255,255,255,0.08)' },
          content: { background: '#111827' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        {viewComplaintData && <ComplaintDetailView record={viewComplaintData} />}
      </Modal>
    </div>
  );
}
