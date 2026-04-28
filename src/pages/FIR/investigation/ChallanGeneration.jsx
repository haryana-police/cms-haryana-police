import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Typography, Input, message, Skeleton, List, Divider, Space } from 'antd';
import { FileDoneOutlined, AudioOutlined, PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../../hooks/useAuth';

const { Title, Text } = Typography;

export default function ChallanGeneration({ firId }) {
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const { token } = useAuth();
  const [form] = Form.useForm();

  const fetchChallans = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/challans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setChallans(await res.json());
    } catch (e) {
      message.error("Failed to load Challan data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChallans(); }, [firId]);

  const handleGenerateChallan = async (vals) => {
    setGenerating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/challans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(vals)
      });
      if (res.ok) {
        message.success("Challan (Final Report) Generated Successfully!");
        form.resetFields();
        fetchChallans();
      }
    } catch (e) {
      message.error("Error generating challan");
    } finally {
      setGenerating(false);
    }
  };

  // Voice to Text Feature using Web Speech API
  const handleVoiceToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      message.error("Speech Recognition is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // Can be changed or made dynamic (e.g. hi-IN for Hindi)
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      message.info("Listening... Speak your notes clearly.");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const currentVal = form.getFieldValue('io_notes') || '';
      form.setFieldsValue({ io_notes: currentVal ? `${currentVal} ${transcript}` : transcript });
      message.success("Speech captured!");
    };

    recognition.onerror = (event) => {
      console.error(event.error);
      message.error("Microphone error or no speech detected.");
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card
        title={<span><FileDoneOutlined /> Generate Final Report (Challan)</span>}
        bordered={false}
        className="fir-card"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Generating a final report will package all collected evidences, arrest memos, CDR hits, and case diaries into a unified Section 173 CrPC report. It will also mark the FIR as 'Chargesheeted'.
        </Text>
        
        <Form form={form} layout="vertical" onFinish={handleGenerateChallan}>
          <Form.Item label="IO Final Directions / Remarks" name="io_notes">
            <Input.TextArea 
              rows={6} 
              placeholder="Enter your final remarks, analysis summary, and directions..." 
              style={{ paddingBottom: '40px' }}
            />
          </Form.Item>
          {/* Voice to text button absolutely positioned inside the text area visual space */}
          <div style={{ marginTop: '-48px', marginBottom: '24px', marginLeft: '12px', zIndex: 1, position: 'relative' }}>
            <Button 
              type={isRecording ? "primary" : "default"} 
              danger={isRecording}
              shape="round" 
              icon={<AudioOutlined />} 
              onClick={handleVoiceToText}
              size="small"
            >
              {isRecording ? "Listening..." : "Dictate Notes (Voice-to-Text)"}
            </Button>
          </div>

          <Button type="primary" htmlType="submit" size="large" loading={generating} icon={<CheckCircleOutlined />} style={{ width: '100%', marginTop: '16px' }}>
            Generate & Submit Final Challan
          </Button>
        </Form>
      </Card>

      <Card
        title="Final Reports History"
        bordered={false}
        className="fir-card"
      >
        {loading ? <Skeleton active /> : (
          <List
            itemLayout="vertical"
            dataSource={challans}
            locale={{ emptyText: "No challan has been generated for this FIR yet." }}
            renderItem={item => (
              <List.Item
                actions={[
                  <Button type="primary" ghost icon={<PrinterOutlined />} onClick={() => window.print()}>
                    Print Challan
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={`Challan Generated on ${new Date(item.generated_at).toLocaleString()}`}
                  description={<Text type="success">Status: Chargesheeted</Text>}
                />
                <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginTop: '12px' }}>
                  <Text strong>IO Remarks:</Text>
                  <Paragraph style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                    {item.io_notes || 'No remarks provided.'}
                  </Paragraph>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text type="secondary" style={{ fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {item.final_report}
                  </Text>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
