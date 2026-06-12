import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Typography, Input, message, Skeleton, List, Divider } from 'antd';
import { BookOutlined, AudioOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../../hooks/useAuth';

const { Title, Text, Paragraph } = Typography;

export default function CaseDiaryManagement({ firId }) {
  const [diaries, setDiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [dictationLang, setDictationLang] = useState('en-US');
  const [translating, setTranslating] = useState(false);
  const { token } = useAuth();
  const [form] = Form.useForm();

  const fetchDiaries = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/case-diaries`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setDiaries(await res.json());
    } catch (e) {
      message.error("Failed to load Case Diaries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDiaries(); }, [firId]);

  const handleAddDiary = async (vals) => {
    setAdding(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${firId}/case-diaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(vals)
      });
      if (res.ok) {
        message.success("Case Diary Entry Added Successfully!");
        form.resetFields();
        fetchDiaries();
      }
    } catch (e) {
      message.error("Error adding case diary");
    } finally {
      setAdding(false);
    }
  };

  const handleVoiceToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      message.error("Speech Recognition is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = dictationLang;
    recognition.lang = 'hi-IN'; // Always Hindi
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      message.info("Listening... Speak your diary entry clearly.");
      message.info("सुन रहा है... हिंदी में स्पष्ट रूप से बोलें।");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const currentVal = form.getFieldValue('entry_text') || '';
      form.setFieldsValue({ entry_text: currentVal ? `${currentVal} ${transcript}` : transcript });
      message.success("Speech captured!");
      message.success("हिंदी में आवाज़ जोड़ी गई!");
    };

    recognition.onerror = (event) => {
      console.error(event.error);
      message.error("Microphone error or no speech detected.");
      message.error("माइक्रोफोन में त्रुटि या आवाज़ नहीं सुनी।");
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleTranslateToEnglish = async () => {
    const hindiText = form.getFieldValue('entry_text');
    if (!hindiText || !hindiText.trim()) {
      message.warning('अनुवाद के लिए पहले हिंदी में कुछ लिखें या बोलें।');
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(hindiText)}&langpair=hi|en`
      );
      const data = await res.json();
      if (data.responseStatus === 200) {
        form.setFieldsValue({ entry_text: data.responseData.translatedText });
        message.success('हिंदी से अंग्रेज़ी में अनुवाद हो गया!');
      } else {
        throw new Error('Translation failed');
      }
    } catch {
      message.error('अनुवाद में त्रुटि। कृपया पुनः प्रयास करें।');
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card
        title={<span><BookOutlined /> Maintain Case Diary</span>}
        bordered={false}
        className="fir-card"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Record the day-to-day proceedings of the investigation. Entries are time-stamped and cannot be altered once submitted.
        </Text>
        
        <Form form={form} layout="vertical" onFinish={handleAddDiary}>
          <Form.Item 
            label="Case Diary Entry Details" 
            name="entry_text" 
            rules={[{ required: true, message: 'Please enter diary details' }]}
          >
            <Input.TextArea 
              rows={6} 
              placeholder="Enter details of investigation, places visited, statements recorded..." 
              style={{ paddingBottom: '40px' }}
            />
          </Form.Item>
          {/* Hindi Dictate + Translate buttons */}
          <div style={{ marginTop: '-48px', marginBottom: '24px', marginLeft: '12px', zIndex: 1, position: 'relative', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              type={isRecording ? 'primary' : 'default'}
              danger={isRecording}
              shape="round"
              icon={<AudioOutlined />}
              onClick={handleVoiceToText}
              size="small"
            >
              {isRecording ? '🎙️ सुन रहा है...' : '🎙️ हिंदी में बोलें'}
            </Button>
            <Button
              shape="round"
              size="small"
              loading={translating}
              onClick={handleTranslateToEnglish}
              style={{ background: '#1565c0', color: '#fff', border: 'none' }}
            >
              {translating ? 'Translating...' : '🌐 English में बदलें'}
            </Button>
          </div>

          <Button type="primary" htmlType="submit" size="large" loading={adding} icon={<PlusCircleOutlined />} style={{ width: '100%', marginTop: '16px' }}>
            Add Entry to Case Diary
          </Button>
        </Form>
      </Card>

      <Card
        title="Case Diary Proceedings"
        bordered={false}
        className="fir-card"
      >
        {loading ? <Skeleton active /> : (
          <List
            itemLayout="vertical"
            dataSource={diaries}
            locale={{ emptyText: "No case diary entries have been recorded yet." }}
            renderItem={(item, index) => (
              <List.Item>
                <List.Item.Meta
                  title={`Entry #${diaries.length - index}`}
                  description={`Date/Time: ${new Date(item.created_at).toLocaleString()}`}
                />
                <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginTop: '12px' }}>
                  <Text type="secondary" style={{ whiteSpace: 'pre-wrap', color: '#333' }}>
                    {item.entry_text}
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
