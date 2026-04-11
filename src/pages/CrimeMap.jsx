import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Statistic, Table, Button, Tag, Space, message, Badge } from 'antd';
import { EnvironmentOutlined, AlertOutlined, SafetyCertificateOutlined, LineChartOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function CrimeMap() {
  const [summary, setSummary] = useState({ totalHotspots: 0, highRiskAreas: 0, pendingActions: 0, weeklySignals: 0 });
  const [hotspots, setHotspots] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const sumRes = await fetch('http://localhost:3000/api/preventive/dashboard-summary');
      const hotRes = await fetch('http://localhost:3000/api/preventive/hotspots');
      const sugRes = await fetch('http://localhost:3000/api/preventive/suggestions');
      
      setSummary(await sumRes.json());
      setHotspots(await hotRes.json());
      setSuggestions(await sugRes.json());
    } catch (err) {
      message.error('Failed to load preventive data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateHotspot = async () => {
    try {
      await fetch('http://localhost:3000/api/preventive/hotspots/generate', { method: 'POST' });
      message.success('New intelligence synced');
      fetchData();
    } catch (err) {
      message.error('Sync failed');
    }
  };

  const hotspotColumns = [
    { title: 'Area', dataIndex: 'areaName', key: 'areaName', render: text => <strong>{text}</strong> },
    { title: 'Source', dataIndex: 'sourceType', key: 'sourceType' },
    { title: 'Signals', dataIndex: 'sourceCount', key: 'sourceCount' },
    { 
      title: 'Risk Score', 
      dataIndex: 'riskScore', 
      key: 'riskScore',
      render: score => (
        <Tag color={score >= 70 ? 'red' : score >= 40 ? 'orange' : 'green'}>
          {score} / 100
        </Tag>
      )
    },
    { title: 'Type', dataIndex: 'hotspotType', key: 'hotspotType' }
  ];

  return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2}>Preventive Policing & Crime Map</Title>
          <Text type="secondary">Intelligence-driven active policing and hotspot tracking</Text>
        </div>
        <Button type="primary" onClick={handleGenerateHotspot} icon={<EnvironmentOutlined />}>
          Sync Intelligence
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={12} sm={6}>
          <Card bordered={false}>
            <Statistic title="Identified Hotspots" value={summary.totalHotspots} prefix={<EnvironmentOutlined style={{ color: '#1890ff' }} />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false}>
            <Statistic title="High Risk Zones" value={summary.highRiskAreas} prefix={<AlertOutlined style={{ color: '#f5222d' }} />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false}>
            <Statistic title="Weekly Signals" value={summary.weeklySignals} prefix={<LineChartOutlined style={{ color: '#722ed1' }} />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false}>
            <Statistic title="Action Required" value={summary.pendingActions} prefix={<SafetyCertificateOutlined style={{ color: '#faad14' }} />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} lg={16}>
          <Card title="Active Hotspots & Risk Areas" bordered={false}>
            <Table 
              size="middle" 
              dataSource={hotspots} 
              columns={hotspotColumns} 
              rowKey="id" 
              loading={loading}
              pagination={{ pageSize: 5 }} 
            />
          </Card>

          <Card title="Pattern Detection Overview" bordered={false} style={{ marginTop: 16 }}>
            <div style={{ padding: '20px', textAlign: 'center', background: '#fafafa', borderRadius: '8px', border: '1px dashed #d9d9d9' }}>
               <AlertOutlined style={{ fontSize: 24, color: '#1890ff' }} />
               <p style={{ marginTop: 16 }}>
                 The system automatically correlates data from <strong>Smart GD</strong>, <strong>Complaints</strong>, and <strong>FIRs</strong>. 
                 <br />No manual entry required. AI pattern detection runs periodically.
               </p>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Suggested Actions" bordered={false}>
            {suggestions.length === 0 ? (
              <Text type="secondary">No new actions suggested.</Text>
            ) : (
              suggestions.map((sug) => (
                <Card size="small" style={{ marginBottom: 12, borderLeft: '4px solid #1890ff' }}>
                  <Text strong>{sug.suggestionText}</Text>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <Tag>{sug.priority} Priority</Tag>
                    <Button size="small" type="link">Mark Done</Button>
                  </div>
                </Card>
              ))
            )}
            
            {/* Mock suggestion just to show UI if DB is empty */}
            {suggestions.length === 0 && Array(3).fill(null).map((_, i) => (
              <Card size="small" style={{ marginBottom: 12, borderLeft: '4px solid #1890ff' }} key={i}>
                <Text strong>Increase nighttime patrol in Sector {10 + i * 2}</Text>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <Tag color="orange">HIGH Priority</Tag>
                  <Button size="small" type="link">Mark Done</Button>
                </div>
              </Card>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
