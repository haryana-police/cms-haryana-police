import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Form, Typography, List, Tag, Skeleton, message, Space } from 'antd';
import { MailOutlined, SyncOutlined, CheckCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '../../../hooks/useAuth';

const { Title, Text } = Typography;
const { Option } = Select;

export default function CDRManagement({ firId, accusedList = [] }) {
  const [cdrs, setCdrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const { token } = useAuth();
  const [form] = Form.useForm();

  const fetchCdrs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/cdrs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCdrs(await res.json());
      }
    } catch (e) {
      console.error(e);
      message.error("Failed to load CDRs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCdrs();
  }, [firId]);

  const handleRequestCDR = async (vals) => {
    setRequesting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/cdrs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(vals)
      });
      if (res.ok) {
        message.success("CDR requested successfully!");
        form.resetFields();
        fetchCdrs();
      } else {
        message.error("Failed to request CDR");
      }
    } catch (e) {
      console.error(e);
      message.error("Error requesting CDR");
    } finally {
      setRequesting(false);
    }
  };

  const markReceived = async (cdrId) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/cdrs/${cdrId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'received' })
      });
      message.success("Marked as Received!");
      fetchCdrs();
    } catch (e) {
      message.error("Status update failed");
    }
  };

  const renderStatus = (status) => {
    if (status === 'received') return <Tag color="green" icon={<CheckCircleOutlined />}>Received</Tag>;
    return <Tag color="orange" icon={<SyncOutlined spin />}>Requested</Tag>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card
        title={<span><MailOutlined /> Request Call Detail Records</span>}
        bordered={false}
        className="fir-card"
      >
        <Form form={form} layout="vertical" onFinish={handleRequestCDR}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <Form.Item
              name="phone_number"
              label="Accused Phone Number"
              rules={[{ required: true }]}
              style={{ flex: 1, minWidth: '200px' }}
            >
              <Select placeholder="Select a phone number">
                {accusedList.map((a, i) => (
                  <Option key={i} value={a.phone || `Unknown-${i}`}>
                    {a.name} ({a.phone || 'No phone'})
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="tsp_name"
              label="Telecom Service Provider (TSP)"
              rules={[{ required: true }]}
              style={{ flex: 1, minWidth: '200px' }}
            >
              <Select placeholder="Select TSP">
                <Option value="Jio">Jio</Option>
                <Option value="Airtel">Airtel</Option>
                <Option value="Vi">Vi (Vodafone Idea)</Option>
                <Option value="BSNL">BSNL</Option>
              </Select>
            </Form.Item>
          </div>
          <Text type="secondary" style={{ display: 'block', marginBottom: '16px', fontSize: '13px' }}>
            Note: This action automatically formats an email to the selected TSP for supervisory approval.
          </Text>
          <Button type="primary" htmlType="submit" loading={requesting} icon={<SafetyCertificateOutlined />}>
            Generate & Request CDR
          </Button>
        </Form>
      </Card>

      <Card
        title="CDR Request History"
        bordered={false}
        className="fir-card"
      >
        {loading ? <Skeleton active /> : (
          <List
            itemLayout="horizontal"
            dataSource={cdrs}
            locale={{ emptyText: "No CDRs requested yet." }}
            renderItem={item => (
              <List.Item
                actions={[
                  item.status !== 'received' && (
                    <Button size="small" type="dashed" onClick={() => markReceived(item.id)}>
                      Mark Received
                    </Button>
                  )
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={<span>{item.phone_number} <Text type="secondary" style={{ fontSize: 12 }}>({item.tsp_name})</Text></span>}
                  description={
                    <Space size="middle" style={{ marginTop: 4 }}>
                      {renderStatus(item.status)}
                      <Text style={{ fontSize: 12 }} type="secondary">
                        Requested on {new Date(item.updated_at).toLocaleString()}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
      
      {cdrs.some(c => c.status === 'received') && (
        <Card style={{ background: '#f6ffed', borderColor: '#b7eb8f', borderRadius: 8 }}>
          <Title level={5} style={{ color: '#389e0d', margin: 0 }}>Analysis Ready</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Some CDRs have been received. Please switch to the Case Data Analysis (M5) module to analyze call patterns, tower dumps, and links.
          </Text>
        </Card>
      )}
    </div>
  );
}
