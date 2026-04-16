import React, { useState } from 'react';
import { Card, Form, Input, Button, DatePicker, Select, Typography, message, Row, Col, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

export default function CreateReply() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/hc-reply', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      message.success('HC Reply matter created');
      navigate(`/hc-reply/${data.id}`);
    } catch (e) {
      message.error('Failed to create matter: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const autoFetchCaseData = async () => {
    const firNo = form.getFieldValue('related_fir_number');
    if (!firNo) return message.warning('Please enter FIR number first');
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/hc-reply/integration/auto-fetch?fir_no=${firNo}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      form.setFieldsValue({
        police_station: data.police_station,
        district: data.district,
      });
      message.success('Successfully linked and fetched FIR data');
    } catch (e) {
      message.error('Integration Error: ' + e.message);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Create New HC Reply Matter</Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Title level={5}>Petition Details</Title>
              <Form.Item name="court_name" label="Court Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Punjab and Haryana High Court" />
              </Form.Item>
              <Form.Item name="petition_type" label="Petition Type" rules={[{ required: true }]}>
                 <Select placeholder="Select type">
                   <Option value="CWP">CWP (Civil Writ Petition)</Option>
                   <Option value="CRM-M">CRM-M</Option>
                   <Option value="CRA">CRA</Option>
                 </Select>
              </Form.Item>
              <Form.Item name="petition_no" label="Petition Number" rules={[{ required: true }]}>
                <Input placeholder="e.g. CRM-M-1234-2023" />
              </Form.Item>
              <Form.Item 
                name="hearing_date" 
                label="Next Hearing Date"
                rules={[
                  {
                    validator: (_, value) => {
                      if (value && value.isBefore(dayjs().startOf('day'))) {
                        return Promise.reject(new Error('Next hearing date cannot be in the past'));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
              <Form.Item name="petitioner_name" label="Petitioner Name">
                <Input />
              </Form.Item>
              <Form.Item name="respondent_name" label="Respondent Name">
                <Input defaultValue="State of Haryana" />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Title level={5}>Linkages & Reply Setup</Title>
              <Form.Item name="reply_type" label="Reply Type Required" rules={[{ required: true }]}>
                 <Select placeholder="Select type">
                   <Option value="status_report">Status Report</Option>
                   <Option value="para_wise_reply">Para-wise Reply</Option>
                   <Option value="affidavit">Affidavit</Option>
                   <Option value="bail_reply">Bail Reply</Option>
                   <Option value="action_taken_report">Action Taken Report</Option>
                 </Select>
              </Form.Item>

              <Form.Item label="Link FIR">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="related_fir_number" noStyle>
                    <Input placeholder="Enter FIR Number" />
                  </Form.Item>
                  <Button onClick={autoFetchCaseData}>Auto-Fetch Case Data</Button>
                </Space.Compact>
              </Form.Item>
              
              <Form.Item name="police_station" label="Police Station">
                <Input />
              </Form.Item>
              <Form.Item name="district" label="District">
                <Input />
              </Form.Item>
              
              <Form.Item name="linked_complaint" label="Link Complaint ID (Optional)">
                <Input placeholder="CMS Complaint ID if applicable" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
            <Button onClick={() => navigate('/hc-reply')} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>Save & Open Matter</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
