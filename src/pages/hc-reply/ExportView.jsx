import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { PrinterOutlined, FilePdfOutlined, FileWordOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function ExportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState('');

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
        setContent(json.data.draft_content || 'No draft content available. Please assemble a draft first.');
      } else {
        message.error(json.error || 'Failed to load content');
      }
    } catch (e) {
      message.error('Failed to fetch data');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = async (format) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/hc-reply/${id}/export`, {
         method: 'POST',
         headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
         },
         body: JSON.stringify({ format, content })
      });
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HC_Reply_${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      message.success(`${format.toUpperCase()} Exported successfully!`);
    } catch (e) {
      message.error(e.message);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Export Preview</Title>
        <div>
           <Button onClick={() => navigate(`/hc-reply/${id}`)} style={{ marginRight: 8 }}>Back</Button>
           <Button icon={<PrinterOutlined />} onClick={handlePrint} style={{ marginRight: 8 }}>Print</Button>
           <Button icon={<FilePdfOutlined />} onClick={() => handleExport('pdf')} style={{ marginRight: 8 }}>Export PDF</Button>
           <Button icon={<FileWordOutlined />} onClick={() => handleExport('docx')}>Export DOCX</Button>
        </div>
      </div>

      <Card id="printable-area" style={{ minHeight: '800px', backgroundColor: '#fff', color: '#000', border: 'none', boxShadow: '0 0 10px rgba(0,0,0,0.1)', padding: '20mm' }}>
         <div 
            style={{ fontFamily: 'Times New Roman, serif', fontSize: '16px' }} 
            dangerouslySetInnerHTML={{ __html: content.replace(/<hr\s*\/?>/g, '<div class="page-break"></div>') }} 
         />
      </Card>

    </div>
  );
}
