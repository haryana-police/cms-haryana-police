import React, { useState } from 'react';
import { Card, Button, Input, Typography, Space, message } from 'antd';
import { Mic, Send, Bot } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const { Title, Text } = Typography;

export default function AiChat() {
  const { token } = useAuth();
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;
  if (recognition) {
    recognition.continuous = false;
    recognition.lang = 'hi-IN'; // Default to Hindi, mostly understands Hinglish too
    recognition.interimResults = false;
  }

  const toggleListen = () => {
    if (!recognition) {
      message.error("Speech Recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setChatInput((prev) => prev ? prev + ' ' + transcript : transcript);
        setIsListening(false);
      };
      recognition.onerror = (e) => {
        message.error("Microphone error: " + e.error);
        setIsListening(false);
      };
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const newMsg = { role: 'user', content: chatInput };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput('');
    setIsChatting(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/ai/chat`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          history: chatMessages.slice(-6), 
          currentMessage: chatInput 
        })
      });

      if (!response.ok) throw new Error('Chat failed');
      const data = await response.json();
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      message.error('Failed to get response');
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>

        <div>
          <Title level={2} style={{ margin: 0 }}>AI Investigation Assistant</Title>
          <Text type="secondary">Your personal 24/7 AI Guide for legal references (BNS/BNSS)</Text>
        </div>
      </div>

      <Card style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }} bodyStyle={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
          <div style={{ flex: 1, overflowY: 'auto', background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', marginTop: '15%' }}>

                <p style={{ marginTop: 16 }}>Hello! I am your AI Assistant. Ask me anything about sections, procedures, or SC judgments.</p>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div key={i} style={{ 
                  textAlign: msg.role === 'user' ? 'right' : 'left', 
                  marginBottom: '16px' 
                }}>
                  <div style={{ 
                    display: 'inline-block',
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: msg.role === 'user' ? '#1890ff' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#000',
                    border: msg.role === 'user' ? 'none' : '1px solid #d9d9d9',
                    textAlign: 'left',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {isChatting && <Text type="secondary" style={{ fontStyle: 'italic' }}>AI is thinking...</Text>}
          </div>
          
          <Space.Compact style={{ width: '100%' }}>
            <Button 
              size="large" 
              type={isListening ? 'primary' : 'default'} 
              danger={isListening}
              icon={<Mic size={18} />} 
              onClick={toggleListen}
            />
            <Input 
              size="large"
              placeholder="Ask your legal query in Hindi or English..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onPressEnter={handleSendChat}
            />
            <Button size="large" type="primary" icon={<Send size={18} />} onClick={handleSendChat} loading={isChatting}>
              Send
            </Button>
          </Space.Compact>
        </div>
      </Card>
    </div>
  );
}
