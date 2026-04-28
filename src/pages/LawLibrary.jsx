import React, { useState, useEffect } from 'react';
import { Card, Input, Typography, Collapse, Tag, Spin, Empty, Alert, Button, message } from 'antd';
import { Book, FolderOpen, FileText, Bot } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const { Title, Text } = Typography;
const { Panel } = Collapse;

export default function LawLibrary() {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleAiSearch = async (value) => {
    if (!value.trim()) return;
    setAiLoading(true);
    setAiResult('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/ai/search-kb`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: value })
      });
      if (!response.ok) throw new Error('AI Search failed');
      const data = await response.json();
      setAiResult(data.answer);
    } catch (err) {
      message.error(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const fetchKb = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/kb', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch knowledge base');
        const data = await response.json();
        setFiles(data.files || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchKb();
  }, [token]);

  // Group files by category
  const groupedFiles = files.reduce((acc, file) => {
    if (!acc[file.category]) acc[file.category] = [];
    acc[file.category].push(file);
    return acc;
  }, {});

  const filteredCategories = Object.keys(groupedFiles).reduce((acc, category) => {
    const filteredGroup = groupedFiles[category].filter(file => 
      file.name.toLowerCase().includes(search.toLowerCase()) || 
      (typeof file.content === 'string' && file.content.toLowerCase().includes(search.toLowerCase()))
    );
    if (filteredGroup.length > 0) acc[category] = filteredGroup;
    return acc;
  }, {});

  return (
    <div style={{ padding: '0px 20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <Book size={28} color="#1890ff" style={{ marginRight: '12px' }} />
        <div>
          <Title level={2} style={{ margin: 0 }}>Knowledge Base</Title>
          <Text type="secondary">Dynamic Local References & Standards</Text>
        </div>
      </div>

      <Input.Search 
        placeholder="Filter locally, or press Enter to AI search inside your documents..." 
        size="large" 
        prefix={<FileText size={18} style={{ color: '#bfbfbf', marginRight: 8 }} />} 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onSearch={handleAiSearch}
        enterButton={true}
        loading={aiLoading}
        style={{ marginBottom: '20px' }}
      />

      {aiResult && (
        <Card 
          style={{ marginBottom: '30px', background: '#141414', borderColor: '#434343' }} 
          title={<span style={{ color: '#1890ff', display: 'flex', alignItems: 'center' }}><Bot size={20} style={{ marginRight: 8 }} /> AI Smart Reference</span>} 
          extra={<Button type="text" style={{ color: '#bfbfbf' }} onClick={() => setAiResult('')}>Close</Button>}
        >
          <div style={{ whiteSpace: 'pre-wrap', color: '#e6e6e6', lineHeight: '1.6' }}>{aiResult}</div>
        </Card>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
      ) : error ? (
        <Alert type="error" message="Error loading documents" description={error} showIcon />
      ) : Object.keys(filteredCategories).length === 0 ? (
        <Empty description="No documents found in knowledge base" />
      ) : (
        Object.keys(filteredCategories).map(category => (
          <div key={category} style={{ marginBottom: '30px' }}>
            <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#1890ff' }}>
              <FolderOpen size={20} style={{ marginRight: '8px' }} />
              {category.toUpperCase()}
            </Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredCategories[category].map((file, idx) => (
                <a 
                  key={`${category}-${idx}`}
                  href={`http://localhost:5000/kb-files/${file.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
                    background: '#1f1f1f', borderRadius: '8px', border: '1px solid #434343',
                    textDecoration: 'none', transition: 'background 0.2s', cursor: 'pointer'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#2b2b2b'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#1f1f1f'}
                >
                  <Text strong style={{ color: '#e6e6e6' }}>{file.name}</Text>
                  <Tag color={file.ext === '.pdf' ? 'red' : file.ext === '.json' ? 'green' : 'blue'} style={{ margin: 0 }}>
                    {file.ext.replace('.', '').toUpperCase()}
                  </Tag>
                </a>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
