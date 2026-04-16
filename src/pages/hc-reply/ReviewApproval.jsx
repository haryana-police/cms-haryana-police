import React, { useState, useEffect } from 'react';
import { Card, Typography, Input, Button, message, Timeline, Tag, Modal, Select } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function ReviewApproval() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [comment, setComment] = useState('');
  const [statusAction, setStatusAction] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/hc-reply/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        message.error(json.error || 'Failed to load data');
      }
    } catch (e) {
      message.error('Failed to fetch data');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/hc-reply/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, comment })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      
      message.success('Status updated');
      setStatusAction(null);
      setComment('');
      fetchData();
    } catch (e) {
      message.error(e.message);
    }
  };

  if (!data) return null;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Workflow & Review</Title>
        <Button onClick={() => navigate(`/hc-reply/${id}`)}>Back to Matter</Button>
      </div>

      <Card title="Current Status" extra={<Tag color="blue">{data.status.toUpperCase()}</Tag>} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
           <Button onClick={() => setStatusAction('under_review')}>Submit for Review</Button>
           <Button type="primary" onClick={() => setStatusAction('approved')} style={{ backgroundColor: '#52c41a' }}>Approve</Button>
           <Button danger onClick={() => setStatusAction('sent_back')}>Send Back</Button>
           <Button type="primary" onClick={() => setStatusAction('finalized')}>Finalize</Button>
        </div>
      </Card>

      <Card title="Timeline & Comments">
        <Timeline>
          {data.audit_logs?.map(log => (
            <Timeline.Item key={log.id}>
              <Text strong>{log.action} - {log.actor_name}</Text>
              <br />
              <Text type="secondary">{new Date(log.created_at).toLocaleString()} - {log.details}</Text>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      <Modal 
        title={`Confirm Action: ${statusAction}`} 
        open={!!statusAction} 
        onOk={() => handleStatusChange(statusAction)} 
        onCancel={() => setStatusAction(null)}
      >
        <TextArea 
          rows={4} 
          placeholder="Add an optional comment..." 
          value={comment} 
          onChange={e => setComment(e.target.value)} 
        />
      </Modal>
    </div>
  );
}
