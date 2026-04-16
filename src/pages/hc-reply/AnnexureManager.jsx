import React, { useState } from 'react';
import { Card, Typography, Button, Table, message, Upload, Empty, Space } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { UploadOutlined, LinkOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function AnnexureManager() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [annexures, setAnnexures] = useState([]);

  // Mock initial state since we don't have the API fully wired for annexure tracking in our quick mockup,
  // but we can simulate the UI interaction for uploading/linking records.
  
  const columns = [
    { title: 'Annexure No.', dataIndex: 'annexure_no', key: 'no' },
    { title: 'Document Title', dataIndex: 'title', key: 'title' },
    { title: 'Source', dataIndex: 'source_type', key: 'source' },
    { title: 'Actions', key: 'actions', render: (_, record) => (
       <Space>
         <Button type="text" icon={<EyeOutlined />} onClick={() => {
           if (record.fileUrl) {
             window.open(record.fileUrl, '_blank');
           } else {
             message.info(`Opening viewer for ${record.title}`);
           }
         }} />
         <Button type="text" danger icon={<DeleteOutlined />} onClick={() => {
           setAnnexures(prev => prev.filter(a => a.id !== record.id));
           message.success('Annexure removed');
         }}/>
       </Space>
    )}
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Manage Annexures</Title>
        <Button onClick={() => navigate(`/hc-reply/${id}`)}>Back</Button>
      </div>

      <Card title="Attached Documents" extra={
         <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={<LinkOutlined />} onClick={() => message.info('Opens modal to link FIR documents')}>Link from FIR</Button>
            <Upload 
              showUploadList={false} 
              multiple={true}
              beforeUpload={(file, fileList) => {
                 // Check if it's the first file in the batch to show a single message
                 const isFirst = fileList[0] === file;
                 
                 setAnnexures(prev => {
                    const newIndex = prev.length + 1;
                    return [...prev, {
                       id: Date.now() + Math.random(), // Unique ID even for batch
                       annexure_no: `Annexure A-${newIndex}`,
                       title: file.name,
                       source_type: 'Manual Upload',
                       fileUrl: URL.createObjectURL(file)
                    }];
                 });

                 if (isFirst) {
                    message.success(`${fileList.length} file(s) attached as Annexures`);
                 }
                 return false;
              }}>
               <Button type="primary" icon={<UploadOutlined />}>Upload Documents</Button>
            </Upload>


         </div>
      }>
        {annexures.length > 0 ? (
           <Table columns={columns} dataSource={annexures} rowKey="id" pagination={false} />
        ) : (
           <Empty description="No annexures attached yet" />
        )}
      </Card>
      
      <div style={{ marginTop: 24, textAlign: 'right' }}>
         <Button type="primary" onClick={() => navigate(`/hc-reply/${id}/editor`)}>Continue to Editor</Button>
      </div>
    </div>
  );
}
