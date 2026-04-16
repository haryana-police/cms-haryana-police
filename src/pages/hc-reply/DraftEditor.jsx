import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Button, message, Layout, Spin, Divider } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;

// Define A4 Styles
const pageStyle = {
  background: 'white',
  width: '210mm',
  minHeight: '297mm',
  padding: '25mm',
  margin: '0 auto',
  boxShadow: '0 0 10px rgba(0,0,0,0.2)',
  boxSizing: 'border-box',
  color: 'black',
  position: 'relative',
  textAlign: 'left'
};

const containerStyle = {
  background: '#121212',
  padding: '60px 0',
  overflowY: 'auto',
  height: 'calc(100vh - 180px)',
  display: 'flex',
  justifyContent: 'center',
  perspective: '1000px'
};

export default function DraftEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [loadingFacts, setLoadingFacts] = useState(true);
  const [facts, setFacts] = useState({});
  const [petition, setPetition] = useState({});

  useEffect(() => {
    // Initialize Quill
    if (editorRef.current && !quillRef.current) {
      quillRef.current = new Quill(editorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['clean']
          ]
        }
      });

      // Handle changes
      quillRef.current.on('text-change', () => {
        // You can use this for auto-save if needed
      });
    }

    fetchDraftData();
  }, [id]);

  const fetchDraftData = async () => {
    const token = localStorage.getItem('token');
    try {
       const res = await fetch(`http://localhost:3000/api/hc-reply/${id}`, {
         headers: { Authorization: `Bearer ${token}` }
       });
       const json = await res.json();
       
       if (json.success) {
         if (quillRef.current) {
           quillRef.current.root.innerHTML = json.data.draft_content || '';
         }
         setPetition(json.data);

         if (json.data.linked_fir) {
           const factsRes = await fetch(`http://localhost:3000/api/hc-reply/integration/auto-fetch?fir_no=${json.data.linked_fir}`, {
             headers: { Authorization: `Bearer ${token}` }
           });
           if (factsRes.ok) {
             const factsJson = await factsRes.json();
             if (factsJson.success) {
               setFacts(factsJson.data);
             }
           }
         }
       }
    } catch (e) {
       message.error('Failed to load data');
    } finally {
       setLoadingFacts(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const content = quillRef.current ? quillRef.current.root.innerHTML : '';
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/hc-reply/${id}/draft`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ draft_content: content })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save');
      
      message.success('Draft saved');
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (type) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/hc-reply/${id}/generate/${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok && !data.success) throw new Error(data.error || 'Generation failed');
      
      const newHtml = data.data?.draft || data.draft;
      if (quillRef.current) {
        const currentHtml = quillRef.current.root.innerHTML;
        // Use a clean page break for new generations if not empty
        const breakTag = (currentHtml && currentHtml !== '<p><br></p>') ? '<div class="page-break"></div>' : '';
        quillRef.current.root.innerHTML = currentHtml + breakTag + newHtml;
      }
      message.success(`Generated ${type.replace('_', ' ')}`);
    } catch (e) {
        console.error(e);
      message.error('Failed to generate');
    }
  };

  return (
    <Layout style={{ minHeight: '80vh', padding: 24, background: 'transparent' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, width: '100%' }}>
        <Title level={2} style={{ margin: 0 }}>Formal Draft Editor</Title>
        <div>
            <Button onClick={() => navigate(`/hc-reply/${id}`)} style={{ marginRight: 8 }}>Back</Button>
            <Button onClick={() => window.print()} style={{ marginRight: 8 }}>Print Package</Button>
            <Button type="primary" onClick={handleSave} loading={saving}>Save Draft</Button>
        </div>
      </div>
      
      <Layout>
         <Sider width={300} className="no-print" style={{ background: '#141414', padding: 16, borderRight: '1px solid #303030', overflowY: 'auto' }}>
            <Title level={4} style={{ color: '#fff' }}>Petition Facts</Title>
            {loadingFacts ? <Spin /> : (
              <div style={{ color: 'rgba(255,255,255,0.85)' }}>
                <Text strong style={{ color: '#aaa' }}>PRAYER:</Text>
                <div style={{ fontSize: '11px', background: '#1d1d1d', color: '#eee', padding: 8, marginBottom: 12, borderRadius: 4, border: '1px solid #333' }}>
                  {petition.extracted_prayer || 'Not extracted yet'}
                </div>
                
                <Text strong style={{ color: '#aaa' }}>GROUNDS:</Text>
                <div style={{ fontSize: '11px', background: '#1d1d1d', color: '#eee', padding: 8, marginBottom: 12, borderRadius: 4, border: '1px solid #333' }}>
                  {petition.extracted_grounds || 'Not extracted yet'}
                </div>

                <Text strong style={{ color: '#aaa' }}>ALLEGATIONS:</Text>
                <div style={{ fontSize: '11px', background: '#1d1d1d', color: '#eee', padding: 8, marginBottom: 12, borderRadius: 4, border: '1px solid #333' }}>
                  {petition.extracted_allegations || 'Not extracted yet'}
                </div>
                
                <Divider style={{ borderColor: '#333' }} />
                
                <Title level={5} style={{ color: '#fff' }}>Linked FIR Facts</Title>
                <div style={{ marginBottom: 4, fontSize: '12px' }}><Text strong style={{ color: '#aaa' }}>Sections:</Text> <span style={{ color: '#fff' }}>{facts.sections || 'N/A'}</span></div>
                <div style={{ marginBottom: 4, fontSize: '12px' }}><Text strong style={{ color: '#aaa' }}>IO Name:</Text> <span style={{ color: '#fff' }}>{facts.io_name || 'N/A'}</span></div>
                <div style={{ marginBottom: 4, fontSize: '12px' }}><Text strong style={{ color: '#aaa' }}>Status:</Text> <span style={{ color: '#fff' }}>{facts.investigation_stage || 'N/A'}</span></div>
              </div>
            )}
         </Sider>


         <Content style={{ background: 'transparent' }}>
            <div style={containerStyle}>
               <div style={pageStyle} className="a4-page-content">
                  <div ref={editorRef} style={{ height: 'calc(100% - 42px)', border: 'none' }} />
               </div>
            </div>
         </Content>

         <Sider width={250} className="no-print" style={{ background: 'transparent' }}>
            <Card title="Generators" style={{ height: '100%' }}>
               <Button block color="primary" variant="filled" style={{ marginBottom: 8 }} onClick={() => handleGenerate('covering_letter')}>Generate Covering Letter</Button>
               <Button block style={{ marginBottom: 8 }} onClick={() => handleGenerate('status_report')}>Generate Status Report</Button>
               <Button block style={{ marginBottom: 8 }} onClick={() => handleGenerate('para_wise_reply')}>Generate Para-wise</Button>
               <Button block style={{ marginBottom: 8 }} onClick={() => handleGenerate('annexure_list')}>Generate Annexure List</Button>
               <Button block type="primary" style={{ marginBottom: 8 }} onClick={() => handleGenerate('full_reply')}>Full Package Draft</Button>
               <Divider />
               <Button block danger onClick={() => { if(quillRef.current) quillRef.current.root.innerHTML = ''; }}>Clear Editor</Button>
            </Card>
         </Sider>
      </Layout>

      <style>{`
        /* Professional Document Editor Styles */
        .a4-page-content .ql-toolbar.ql-snow {
          display: none !important;
        }
        
        .a4-page-content .ql-container.ql-snow {
          border: none !important;
          font-family: 'Times New Roman', serif;
          font-size: 16px;
          line-height: 1.6;
          color: black;
          background: white;
        }

        .a4-page-content .ql-editor {
          min-height: 297mm;
          padding: 0;
          overflow: visible;
        }

        /* Visual Page Breaks in Editor */
        .page-break {
          display: block;
          height: 50px;
          background: #121212;
          border-top: 1px dashed #333;
          border-bottom: 1px dashed #333;
          margin: 40px -25mm; /* Pull out of page padding */
          position: relative;
          z-index: 10;
        }

        .page-break::after {
          content: "— NEXT SHEET —";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 10px;
          font-weight: bold;
          color: #444;
          letter-spacing: 2px;
          background: #121212;
          padding: 0 10px;
        }

        /* Print Logic */
        @media print {
            body * { visibility: hidden; }
            .a4-page-content, .a4-page-content * { visibility: visible; }
            .a4-page-content { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 210mm; 
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
            .page-break {
              height: 0;
              margin: 0;
              border: none;
              page-break-before: always;
              break-before: page;
            }
            .page-break::after {
              display: none;
            }
            .ql-editor {
              padding: 0 !important;
            }
        }
      `}</style>
    </Layout>
  );
}

