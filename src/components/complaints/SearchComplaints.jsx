import React, { useState, useMemo } from 'react';
import { Table, Input, Button, Typography, Tag, Modal, Descriptions } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../hooks/useAuth';

const { Title, Text } = Typography;
const { Search } = Input;

export default function SearchComplaints({ onBack, onStartEnquiry, hideHeader }) {
  const [searchText, setSearchText] = useState('');
  const [viewComplaint, setViewComplaint] = useState(null);
  const { profile } = useAuth();

  // Compute complaints directly — no setState inside useEffect (fixes white screen)
  const complaints = useMemo(() => {
    let saved = JSON.parse(localStorage.getItem('registeredComplaints') || '[]');

    // If the user is an IO, only show complaints assigned to them
    if (profile?.role === 'io') {
      saved = saved.filter(c => String(c.assignedIoId).trim() === String(profile?.id).trim());
    }

    // Sort by newest first
    saved.sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate));
    return saved;
  }, [profile]);

  const filteredComplaints = useMemo(() => {
    if (!searchText) return complaints;
    const lower = searchText.toLowerCase();
    return complaints.filter(c =>
      (c.id && c.id.toLowerCase().includes(lower)) ||
      (c.firstName && c.firstName.toLowerCase().includes(lower)) ||
      (c.lastName && c.lastName.toLowerCase().includes(lower)) ||
      (c.mobileNumber && c.mobileNumber.includes(lower))
    );
  }, [complaints, searchText]);

  const columns = [
    {
      title: 'Complaint ID',
      dataIndex: 'id',
      key: 'id',
      width: '12%',
      render: text => <strong>{text}</strong>,
    },
    {
      title: 'Date',
      dataIndex: 'registrationDate',
      key: 'registrationDate',
      width: '10%',
      render: date => <span style={{ whiteSpace: 'nowrap' }}>{dayjs(date).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Complainant',
      key: 'name',
      width: '13%',
      render: (_, record) => <span>{`${record.firstName || ''} ${record.lastName || ''}`.trim() || 'Unknown'}</span>,
    },
    {
      title: 'Incident Class',
      dataIndex: 'classOfIncident',
      key: 'classOfIncident',
      width: '18%',
      render: text => <Tag color="blue">{text || 'N/A'}</Tag>,
    },
    {
      title: 'Status',
      key: 'status',
      width: '14%',
      render: (_, record) => {
        let color = 'green';
        let label = record.ioStatus || 'Registered';
        if (label === 'Pending') color = 'orange';
        if (label === 'Under Investigation') color = 'blue';
        if (label === 'Disposed') color = 'purple';
        if (label === 'Convert to FIR') color = 'red';
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: 'Assigned To',
      key: 'assignedIoName',
      width: '15%',
      render: (_, record) => record.assignedIoName
        ? <Tag color="cyan">{record.assignedIoName}</Tag>
        : <Text type="secondary">Unassigned</Text>,
    },
    {
      title: 'Action',
      key: 'action',
      width: '18%',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            type="default"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => setViewComplaint(record)}
          >
            View
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => { if (onStartEnquiry) onStartEnquiry(record.id); }}
          >
            Enquire
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: hideHeader ? '0' : '24px', borderRadius: '8px' }}>
      {!hideHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={3} style={{ margin: 0 }}>Search Complaints</Title>
          <Button onClick={onBack}>Back to Home</Button>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <Search
          placeholder="Search by ID, Name, or Mobile Number..."
          allowClear
          enterButton="Search"
          size="large"
          onSearch={setSearchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 500 }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredComplaints}
        rowKey="id"
        pagination={{ pageSize: 5 }}
        locale={{ emptyText: 'No complaints found.' }}
        tableLayout="fixed"
      />

      <Modal
        title={`Complaint Details — ${viewComplaint?.id}`}
        open={!!viewComplaint}
        onCancel={() => setViewComplaint(null)}
        footer={[
          <Button key="close" onClick={() => setViewComplaint(null)}>Close</Button>
        ]}
        width={800}
      >
        {viewComplaint && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Complainant Name" span={2}>
              {viewComplaint.firstName} {viewComplaint.lastName}
            </Descriptions.Item>
            <Descriptions.Item label="Mobile Number">{viewComplaint.mobileNumber}</Descriptions.Item>
            <Descriptions.Item label="Gender">{viewComplaint.gender}</Descriptions.Item>
            <Descriptions.Item label="ID Type">{viewComplaint.idType}</Descriptions.Item>
            <Descriptions.Item label="ID Number">{viewComplaint.idNumber}</Descriptions.Item>
            <Descriptions.Item label="Incident Class" span={2}>{viewComplaint.classOfIncident}</Descriptions.Item>
            <Descriptions.Item label="Place of Incident" span={2}>{viewComplaint.placeOfIncident}</Descriptions.Item>
            <Descriptions.Item label="Accused Name" span={2}>{viewComplaint.accusedName}</Descriptions.Item>
            <Descriptions.Item label="Accused Address" span={2}>{viewComplaint.accusedAddress}</Descriptions.Item>
            <Descriptions.Item label="Description" span={2}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{viewComplaint.descriptionOfComplaint}</div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
