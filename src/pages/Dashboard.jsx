import React, { useEffect, useState } from 'react';
import { Typography, Row, Col, Card, Statistic, List, Tag, Button, Spin } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { FileTextOutlined, WarningOutlined, FileDoneOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role || 'constable';
  const navigate = useNavigate();

  const [firs, setFirs] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [firsRes, complaintsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/firs`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${import.meta.env.VITE_API_URL}/complaints`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (firsRes.ok) setFirs(await firsRes.json());
        if (complaintsRes.ok) setComplaints(await complaintsRes.json());
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const getStats = () => {
    switch (role) {
      case 'constable':
      case 'io': {
        const openComplaintsCount = complaints.filter(c => c.ioStatus !== 'Disposed' && c.ioStatus !== 'Convert to FIR' && c.ioStatus !== 'Transferred').length;
        const activeInvestigationsCount = complaints.filter(c => c.ioStatus === 'Under Investigation').length;
        const pendingApprovalCount = complaints.filter(c => c.ioStatus === 'Pending SHO Approval').length;
        return [
          { title: 'My Open Complaints', value: openComplaintsCount, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
          { title: 'Active Investigations', value: activeInvestigationsCount, icon: <SearchOutlined style={{ color: '#eb2f96' }} /> },
          { title: 'Pending SHO Approval', value: pendingApprovalCount, icon: <WarningOutlined style={{ color: '#faad14' }} /> },
        ];
      }
      case 'sho':
      case 'supervisor':
      case 'admin': {
        const stationComplaintsCount = complaints.length;
        const activeFirsCount = firs.length;
        const pendingSignOffsCount = complaints.filter(c => c.ioStatus === 'Pending SHO Approval').length;
        return [
          { title: role === 'admin' ? 'Total Complaints' : 'Station Complaints', value: stationComplaintsCount, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
          { title: role === 'admin' ? 'Total FIRs' : 'Active FIRs', value: activeFirsCount, icon: <FileDoneOutlined style={{ color: '#52c41a' }} /> },
          { title: 'Pending Approvals', value: pendingSignOffsCount, icon: <WarningOutlined style={{ color: '#faad14' }} /> },
        ];
      }
      default:
        return [
          { title: 'Total Tasks', value: 0, icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
        ];
    }
  };

  const getRecentActivity = () => {
    const activities = [];

    // Add complaints activities
    complaints.forEach(c => {
      const date = new Date(c.registrationDate || c.registeredAt || c.created_at);
      activities.push({
        id: `c-${c.id}`,
        action: 'Complaint Registered',
        case: c.complaint_number || c.id,
        time: date,
        displayTime: c.dateRegistered || date.toLocaleDateString(),
        status: 'processing',
        link: '/complaints'
      });
    });

    // Add FIRs activities
    firs.forEach(f => {
      const date = new Date(f.created_at || f.date_time_of_fir);
      activities.push({
        id: `f-${f.id}`,
        action: 'FIR Registered',
        case: f.fir_number,
        time: date,
        displayTime: date.toLocaleDateString(),
        status: 'success',
        link: '/fir'
      });
    });

    // Sort by actual time desc
    activities.sort((a, b) => b.time - a.time);

    return activities.slice(0, 5);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const recentActivity = getRecentActivity();

  return (
    <div className="dashboard-container">
      <Title level={2}>Dashboard</Title>
      <Text type="secondary">Welcome back, {profile?.full_name}</Text>
      
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        {getStats().map((stat, idx) => (
          <Col xs={24} sm={8} key={idx}>
            <Card bordered={false}>
              <Statistic 
                title={stat.title} 
                value={stat.value} 
                prefix={stat.icon} 
              />
            </Card>
          </Col>
        ))}
      </Row>
 
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} md={12}>
          <Card title="Recent Activity" bordered={false}>
            {recentActivity.length === 0 ? (
              <div style={{ color: '#888', padding: '16px 0', textAlign: 'center' }}>No recent activity.</div>
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={recentActivity}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <span>
                          {item.action} 
                          <Tag 
                            color={item.status} 
                            style={{ marginLeft: 8, cursor: 'pointer' }}
                            onClick={() => navigate(item.link)}
                          >
                            {item.case}
                          </Tag>
                        </span>
                      }
                      description={item.displayTime}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Quick Actions" bordered={false}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button 
                type="primary"
                onClick={() => {
                  sessionStorage.setItem('complaintsCurrentView', 'register');
                  navigate('/complaints?view=register');
                }}
              >
                Register Complaint
              </Button>
              <Button onClick={() => navigate('/gd')}>New GD Entry</Button>
              <Button onClick={() => navigate('/fir')}>Search Cases</Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
