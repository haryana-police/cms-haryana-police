import React, { useState, useEffect } from 'react';
import { 
  Typography, Row, Col, Card, Form, Input, Button, Table, 
  Select, DatePicker, TimePicker, Badge, message, Spin, Statistic, Tag 
} from 'antd';
import { WarningOutlined, FileDoneOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export default function SmartGD() {
  const [form] = Form.useForm();
  const [entries, setEntries] = useState([]);
  const [flaggedEntries, setFlaggedEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchGDs = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/gd');
      const data = await res.json();
      setEntries(data);
      const flagged = data.filter(d => d.preventiveFlag);
      setFlaggedEntries(flagged);
    } catch (err) {
      message.error('Failed to fetch GD entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGDs();
  }, []);

  const onFinish = async (values) => {
    try {
      const payload = {
        ...values,
        gdDate: values.gdDate.toISOString(),
        gdTime: values.gdTime.format('HH:mm'),
      };
      const res = await fetch('http://localhost:3000/api/gd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        message.success('GD Entry created successfully');
        form.resetFields();
        fetchGDs();
      } else {
        message.error('Error creating entry');
      }
    } catch (err) {
      message.error('Network Error');
    }
  };

  const columns = [
    { title: 'GD No', dataIndex: 'gdNumber', key: 'gdNumber' },
    { title: 'Date', dataIndex: 'gdDate', key: 'gdDate', render: d => dayjs(d).format('YYYY-MM-DD') },
    { title: 'Time', dataIndex: 'gdTime', key: 'gdTime' },
    { title: 'Type', dataIndex: 'entryType', key: 'entryType' },
    { title: 'Place', dataIndex: 'placeText', key: 'placeText' },
    { 
      title: 'Flag', 
      key: 'preventiveFlag',
      render: (_, record) => record.preventiveFlag ? <Tag color="red">Flagged</Tag> : <Tag color="green">Normal</Tag>
    }
  ];

  return (
    <div className="dashboard-container">
      <Title level={2}>Smart GD System</Title>
      <Text type="secondary">Structured and intelligent General Diary tracking</Text>

      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} sm={12}>
          <Card bordered={false}>
            <Statistic title="Total GD Entries" value={entries.length} prefix={<FileDoneOutlined style={{ color: '#1890ff' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card bordered={false}>
            <Statistic title="Flagged Suspicious" value={flaggedEntries.length} prefix={<WarningOutlined style={{ color: '#eb2f96' }} />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} lg={14}>
          <Card title="New GD Entry" bordered={false}>
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="gdNumber" label="GD Number" rules={[{ required: true }]}>
                    <Input placeholder="GD-202X-XXX" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="gdDate" label="GD Date" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="gdTime" label="GD Time" rules={[{ required: true }]}>
                    <TimePicker format="HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="entryType" label="Entry Type" rules={[{ required: true }]}>
                    <Select placeholder="Select Type">
                      <Option value="GRIEVANCE">Grievance</Option>
                      <Option value="INCIDENT">Incident</Option>
                      <Option value="ROUTINE">Routine Patrol</Option>
                      <Option value="MISC">Miscellaneous</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
                    <Select placeholder="Select Priority">
                      <Option value="LOW">Low</Option>
                      <Option value="NORMAL">Normal</Option>
                      <Option value="HIGH">High</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="personName" label="Person Name">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="mobileNo" label="Mobile Number">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="vehicleNo" label="Vehicle Number">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="placeText" label="Place/Location" rules={[{ required: true }]}>
                <Input placeholder="E.g., Near Sector 14 Market" />
              </Form.Item>
              <Form.Item name="summary" label="Summary" rules={[{ required: true }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button type="primary" htmlType="submit" disabled={loading}>
                Submit Entry
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Flagged Intelligence" bordered={false} style={{ marginBottom: 16 }}>
            {flaggedEntries.length === 0 ? (
              <Text type="secondary">No suspicious patterns detected recently.</Text>
            ) : (
              flaggedEntries.map((fe, idx) => (
                <Badge.Ribbon text="Suspicious" color="red" key={idx}>
                  <Card size="small" style={{ marginBottom: 8, background: '#fff0f6', borderColor: '#ffadd2' }}>
                    <Text strong>{fe.gdNumber} ({fe.placeText})</Text>
                    <br />
                    <Text type="secondary">{fe.preventiveReason}</Text>
                  </Card>
                </Badge.Ribbon>
              ))
            )}
          </Card>

          <Card title="Recent Entries" bordered={false}>
            <Table 
              size="small" 
              dataSource={entries} 
              columns={columns} 
              rowKey="id" 
              loading={loading}
              pagination={{ pageSize: 5 }} 
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
