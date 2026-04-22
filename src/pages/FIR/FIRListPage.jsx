import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Typography, Space, Input,
  Select, Card, Statistic, Row, Col, Tooltip, message,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, FileTextOutlined,
  FileDoneOutlined, ClockCircleOutlined, CheckCircleOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { RoleGate } from '../../components/Auth/RoleGate';

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
  const { token } = useAuth();
  const navigate = useNavigate();

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
    closed:        firs.filter(f => f.status === 'closed').length,
  };

  const columns = [
    {
      title: 'FIR No.',
      dataIndex: 'fir_number',
      key: 'fir_number',
      width: 100,
      render: (num, row) => (
        <div>
          <Text strong style={{ color: '#69c0ff', fontFamily: 'monospace', fontSize: 14 }}>
            {num}/{row.year}
          </Text>
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
      ellipsis: true,
    },
    {
      title: 'Acts & Sections',
      dataIndex: 'acts_sections',
      key: 'acts_sections',
      ellipsis: true,
      render: (val) => {
        try {
          const arr = JSON.parse(val || '[]');
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
      width: 160,
      render: (status) => {
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.registered;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Linked Data',
      key: 'links',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          {row.complaint_id && (
            <Tooltip title="Linked Complaint">
              <Tag icon={<LinkOutlined />} color="cyan" style={{ fontSize: 11, marginBottom: 4 }}>CMP: {row.complaint_id}</Tag>
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
      width: 130,
      ellipsis: true,
      render: (name) => <Text style={{ fontSize: 12 }}>{name || '—'}</Text>,
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
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => navigate('/fir/new')}
            className="fir-new-btn"
          >
            Register New FIR
          </Button>
        </RoleGate>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total FIRs', value: counts.total, color: '#1890ff' },
          { title: 'Registered', value: counts.registered, color: '#1890ff' },
          { title: 'Under Investigation', value: counts.investigating, color: '#fa8c16' },
          { title: 'Closed', value: counts.closed, color: '#52c41a' },
        ].map((s, i) => (
          <Col xs={12} sm={6} key={i}>
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
    </div>
  );
}
