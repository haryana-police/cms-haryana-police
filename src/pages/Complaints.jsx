import React from 'react';
import { Typography } from 'antd';
import ComplaintWizard from '../components/complaints/ComplaintWizard';

const { Title } = Typography;

export default function Complaints() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <Title level={2}>Complaints Registration</Title>
      </div>
      
      <ComplaintWizard />
    </div>
  );
}
