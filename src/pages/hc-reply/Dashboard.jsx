import React, { useEffect, useState } from 'react';
import { Typography, Table, Card, Row, Col, Statistic, Button, Tag, message } from 'antd';
import { PlusOutlined, FileTextOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReplies = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/hc-reply', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
          setReplies(json.data);
        } else {
          message.error(json.error || 'Failed to load replies');
        }
      } catch (e) {
        message.error('Failed to fetch replies');
      } finally {
        setLoading(false);
      }
    };
    fetchReplies();
  }, []);

  const getStatusColor = (status) => {
    switch(status) {
      case 'draft': return 'default';
      case 'under_review': return 'processing';
      case 'approved': return 'success';
      case 'sent_back': return 'error';
      case 'finalized': return 'purple';
      default: return 'default';
    }
  };

  const columns = [
    { title: 'Petition No', dataIndex: 'petition_no', key: 'petition_no' },
    { title: 'Reply Type', dataIndex: 'reply_type', key: 'reply_type' },
    { title: 'Petitioner', dataIndex: 'petitioner_name', key: 'petitioner_name' },
    { title: 'Respondent', dataIndex: 'respondent_name', key: 'respondent_name' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag> },
    { title: 'Actions', key: 'actions', render: (_, record) => <Button type="link" onClick={() => navigate(`/hc-reply/${record.id}`)}>Manage</Button> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>HC Reply Dashboard</Title>
        <div>
          <Button onClick={() => navigate('/hc-reply/templates')} style={{ marginRight: 16 }}>Templates</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/hc-reply/new')}>Create New Reply</Button>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Total Pending" value={replies.filter(r => r.status !== 'finalized').length} prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Under Review" value={replies.filter(r => r.status === 'under_review').length} prefix={<SyncOutlined spin />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Approved" value={replies.filter(r => r.status === 'approved').length} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#3f8600' }} /></Card>
        </Col>
      </Row>

      <Card title="Recent Replies">
        <Table columns={columns} dataSource={replies} rowKey="id" loading={loading} />
      </Card>
    </div>
  );
}
