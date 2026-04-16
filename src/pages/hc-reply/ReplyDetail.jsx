import React, { useEffect, useState } from 'react';
import { Card, Typography, Descriptions, Button, Spin, Tag, message, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';

const { Title } = Typography;

export default function ReplyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:3000/api/hc-reply/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        
        if (!json.success) {
          throw new Error(json.error);
        }
        
        setData(json.data);
      } catch (e) {
        message.error(e.message || 'Failed to load detail');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;
  if (!data) return <div style={{ padding: 50, textAlign: 'center' }}><h3>Reply Not Found</h3><Button onClick={() => navigate('/hc-reply')}>Back to Dashboard</Button></div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Review Matter: {data.petition_no}</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Upload 
            action={`http://localhost:3000/api/hc-reply/${id}/upload-petition`}
            headers={{ Authorization: `Bearer ${localStorage.getItem('token')}` }}
            name="petitionCode"
            showUploadList={false}
            multiple={false}
            maxCount={1}
            accept=".pdf,.docx"
            onChange={(info) => {

              if (info.file.status === 'done') {
                message.success('Petition uploaded and extracted automatically.');
                // Optionally refresh data to show completion
                window.location.reload(); 
              } else if (info.file.status === 'error') {
                const errorMsg = info.file.response?.error || 'Petition extraction failed. Please check the file and try again.';
                message.error(errorMsg, 5); // Show for 5 seconds
              }
            }}

          >
            <Button icon={<UploadOutlined />}>Upload Petition</Button>
          </Upload>
          <Button onClick={() => navigate('/hc-reply')} style={{ marginRight: 8 }}>Back</Button>
          <Button type="primary" onClick={() => navigate(`/hc-reply/${id}/review`)}>Workflow & Review</Button>
        </div>
      </div>

      <Card title="Matter Header" extra={<Tag color="blue">{data.status.toUpperCase()}</Tag>} style={{ marginBottom: 24 }}>
        <Descriptions column={3}>
          <Descriptions.Item label="Court">{data.court_name}</Descriptions.Item>
          <Descriptions.Item label="Type">{data.reply_type}</Descriptions.Item>
          <Descriptions.Item label="Next Hearing">{data.hearing_date || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Petitioner">{data.petitioner_name}</Descriptions.Item>
          <Descriptions.Item label="Respondent">{data.respondent_name}</Descriptions.Item>
          <Descriptions.Item label="Related FIR">{data.linked_fir || 'N/A'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Drafting Modules">
         <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Card hoverable style={{ width: 240 }} onClick={() => navigate(`/hc-reply/${id}/facts`)}>
               <Title level={4}>1. Structure Facts</Title>
               <p>Extract and review case facts</p>
            </Card>
            
            {data.reply_type === 'para_wise_reply' && (
              <Card hoverable style={{ width: 240 }} onClick={() => navigate(`/hc-reply/${id}/para-wise`)}>
                 <Title level={4}>2. Para-wise Builder</Title>
                 <p>Side-by-side paragraph drafting</p>
              </Card>
            )}

            <Card hoverable style={{ width: 240 }} onClick={() => navigate(`/hc-reply/${id}/annexures`)}>
               <Title level={4}>3. Annexures</Title>
               <p>Manage attached records and files</p>
            </Card>

            <Card hoverable style={{ width: 240 }} onClick={() => navigate(`/hc-reply/${id}/editor`)}>
               <Title level={4}>4. Draft Editor</Title>
               <p>Assemble formal legal document</p>
            </Card>

            <Card hoverable style={{ width: 240 }} onClick={() => navigate(`/hc-reply/${id}/export`)}>
               <Title level={4}>5. Export Output</Title>
               <p>Preview and generate PDF/DOCX</p>
            </Card>
         </div>
      </Card>
    </div>
  );
}
