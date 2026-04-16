import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Spin, Row, Col, message, Typography } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';

const { Title } = Typography;

export default function FactSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchFacts = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:3000/api/hc-reply/${id}/facts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
          form.setFieldsValue(json.data);
        } else if (!json.success) {
           message.error(json.error || 'Failed to load facts');
        }
      } catch (e) {
        message.error('Failed to load facts');
      } finally {
        setLoading(false);
      }
    };
    fetchFacts();
  }, [id, form]);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/hc-reply/${id}/facts`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save');
      
      message.success('Facts saved successfully');
      navigate(`/hc-reply/${id}`);
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 50, textAlign: 'center' }}><Spin /></div>;

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Structured Case Facts</Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="fir_no" label="FIR No"><Input /></Form.Item>
              <Form.Item name="fir_date" label="FIR Date"><Input /></Form.Item>
              <Form.Item name="police_station" label="Police Station"><Input /></Form.Item>
              <Form.Item name="district" label="District"><Input /></Form.Item>
              <Form.Item name="sections" label="Sections"><Input /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="complainant_name" label="Complainant Name"><Input /></Form.Item>
              <Form.Item name="accused_names" label="Accused Names"><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="io_name" label="IO Name"><Input /></Form.Item>
              <Form.Item name="investigation_stage" label="Investigation Stage"><Input /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="arrest_status" label="Arrest Status"><Input /></Form.Item>
              <Form.Item name="recovery_status" label="Recovery Status"><Input /></Form.Item>
              <Form.Item name="fsl_status" label="FSL Status"><Input /></Form.Item>
              <Form.Item name="challan_status" label="Challan Status"><Input /></Form.Item>
              <Form.Item name="trial_status" label="Trial Status"><Input /></Form.Item>
            </Col>
          </Row>
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Button onClick={() => navigate(`/hc-reply/${id}`)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Save Facts</Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
