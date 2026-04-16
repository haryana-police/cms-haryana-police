import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Button, Tag, Modal, Form, Input, Select, message } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { Option } = Select;

export default function Templates() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/hc-reply/templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTemplates(data);
    } catch (e) {
      message.error('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    form.setFieldsValue(template);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const url = editingTemplate 
        ? `http://localhost:3000/api/hc-reply/templates/${editingTemplate.id}`
        : 'http://localhost:3000/api/hc-reply/templates';
      
      const res = await fetch(url, {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values)
      });

      if (!res.ok) throw new Error('Failed to save template');
      
      message.success(`Template ${editingTemplate ? 'updated' : 'created'} successfully`);
      setIsModalOpen(false);
      fetchTemplates();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Reply Type', dataIndex: 'reply_type', key: 'reply_type' },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (val) => val ? <Tag color="green">Active</Tag> : <Tag color="default">Inactive</Tag> },
    { title: 'Actions', key: 'actions', render: (_, record) => (
      <Button type="link" onClick={() => handleEdit(record)}>Edit</Button>
    )}
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Reply Templates</Title>
        <div>
          <Button onClick={() => navigate('/hc-reply')} style={{ marginRight: 8 }}>Back to Dashboard</Button>
          <Button type="primary" onClick={handleCreate}>Create Template</Button>
        </div>
      </div>
      <Card>
        <Table columns={columns} dataSource={templates} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editingTemplate ? "Edit Template" : "Create New Template"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ is_active: true }}>
          <Form.Item name="title" label="Template Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="reply_type" label="Reply Type" rules={[{ required: true }]}>
            <Select placeholder="Select type">
              <Option value="status_report">Status Report</Option>
              <Option value="para_wise_reply">Para-wise Reply</Option>
              <Option value="affidavit">Affidavit</Option>
              <Option value="bail_reply">Bail Reply</Option>
              <Option value="action_taken_report">Action Taken Report</Option>
            </Select>
          </Form.Item>
          <Form.Item name="content" label="Template Content" rules={[{ required: true }]}>
            <Input.TextArea rows={12} style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          {editingTemplate && (
            <Form.Item name="is_active" label="Status" valuePropName="checked">
              <Select>
                <Option value={true}>Active</Option>
                <Option value={false}>Inactive</Option>
              </Select>
            </Form.Item>
          )}
          <Form.Item style={{ textAlign: 'right', marginTop: 16 }}>
            <Button onClick={() => setIsModalOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingTemplate ? "Update Template" : "Save Template"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
