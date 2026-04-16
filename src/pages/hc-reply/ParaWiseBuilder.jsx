import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Input, Button, Spin, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { TextArea } = Input;

export default function ParaWiseBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState([]);

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
        setReplies(json.data.paragraphs || []);
      } else {
        message.error(json.error || 'Failed to load paragraphs');
      }
    } catch (e) {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleUseAI = async (index) => {
    try {
      const para = replies[index];
      const token = localStorage.getItem('token');
      
      const res = await fetch(`http://localhost:3000/api/hc-reply/${id}/generate-rebuttal`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          petitionText: para.petition_content,
          paraNumber: para.para_number
        })
      });
      
      const json = await res.json();
      if (json.success) {
        const newReplies = [...replies];
        newReplies[index].reply_content = json.rebuttal;
        setReplies(newReplies);
        message.success(`AI suggestion generated for Para ${para.para_number}`);
      } else {
        message.error(json.error || 'AI generation failed');
      }
    } catch (e) {
      message.error('Failed to connect to AI service');
    }
  };

  const handleSave = async (index, replyContent) => {
     // For now we still show info but at least let's pretend it saves locally in state
     message.success('Draft updated in current session. Full persistence coming soon.');
  };


  if (loading) return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Para-wise Builder</Title>
        <Button onClick={() => navigate(`/hc-reply/${id}`)}>Done</Button>
      </div>

      <Row gutter={16}>
        <Col span={12}><Title level={4}>Petition Statement</Title></Col>
        <Col span={12}><Title level={4}>Our Reply</Title></Col>
      </Row>

      {replies.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
           <p>No paragraphs found. Please upload a petition PDF first to auto-extract paragraphs.</p>
           <Button type="primary" onClick={() => navigate(`/hc-reply/${id}`)}>Go to Matter Detail</Button>
        </Card>
      ) : replies.map((para, idx) => (
        <Card key={para.id || idx} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <b>Para {para.para_number}</b>
              <p style={{ marginTop: 8 }}>{para.petition_content}</p>
            </Col>
            <Col span={12}>
              <TextArea 
                rows={4} 
                value={para.reply_content} 
                onChange={(e) => {
                  const newReplies = [...replies];
                  newReplies[idx].reply_content = e.target.value;
                  setReplies(newReplies);
                }}
                placeholder="Draft reply for this para..." 
              />

              <div style={{ marginTop: 8, textAlign: 'right' }}>
                 <Button 
                   type="dashed" 
                   size="small" 
                   style={{ marginRight: 8 }}
                   onClick={() => handleUseAI(idx)}
                 >
                   Use AI
                 </Button>
                 <Button type="primary" size="small" onClick={() => handleSave(idx, para.reply_content)}>Save</Button>
              </div>
            </Col>
          </Row>
        </Card>
      ))}
    </div>
  );
}
