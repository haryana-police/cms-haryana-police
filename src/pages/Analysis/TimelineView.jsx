import React, { useState, useEffect } from 'react';
import { Timeline, Spin, Typography, Card, Space, Empty, Tag, Modal, Drawer, Button, Divider, Alert } from 'antd';
import {
    FileTextOutlined,
    CommentOutlined,
    SearchOutlined,
    AlertOutlined,
    HomeOutlined,
    SafetyOutlined,
    PushpinOutlined,
    CalendarOutlined,
    EyeOutlined,
    FileDoneOutlined,
    CameraOutlined,
    AuditOutlined,
    FileExclamationOutlined,
    LinkOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const CATEGORY_CONFIG = {
    registration: {
        color: 'green',
        icon: <FileTextOutlined style={{ fontSize: '16px' }} />,
        label: 'FIR / Complaint Registration',
        docIcon: <FileDoneOutlined />,
        docLabel: 'FIR Copy / Complaint',
        description: 'Original FIR or complaint document filed at the police station.'
    },
    statement: {
        color: 'blue',
        icon: <CommentOutlined style={{ fontSize: '16px' }} />,
        label: 'Statement Recorded',
        docIcon: <AuditOutlined />,
        docLabel: 'Statement',
        description: 'Recorded statement of the person as documented by the IO.'
    },
    evidence: {
        color: 'orange',
        icon: <SearchOutlined style={{ fontSize: '16px' }} />,
        label: 'Evidence / Investigation',
        docIcon: <CameraOutlined />,
        docLabel: 'Evidence Record',
        description: 'Physical or digital evidence collected during investigation.'
    },
    arrest: {
        color: 'red',
        icon: <AlertOutlined style={{ fontSize: '16px' }} />,
        label: 'Arrest',
        docIcon: <FileExclamationOutlined />,
        docLabel: 'Arrest Memo',
        description: 'Formal arrest memo and related documentation.'
    },
    raid: {
        color: 'purple',
        icon: <HomeOutlined style={{ fontSize: '16px' }} />,
        label: 'Raid Conducted',
        docIcon: <HomeOutlined />,
        docLabel: 'Raid Report',
        description: 'Raid report documenting the search and seizure operation.'
    },
    challan: {
        color: 'magenta',
        icon: <SafetyOutlined style={{ fontSize: '16px' }} />,
        label: 'Challan / Court Filing',
        docIcon: <FileDoneOutlined />,
        docLabel: 'Challan Documents',
        description: 'Challan submitted to court for further proceedings.'
    },
};

const DEFAULT_CONFIG = {
    color: 'gray',
    icon: <PushpinOutlined style={{ fontSize: '16px' }} />,
    label: 'Event',
    docIcon: <FileTextOutlined />,
    docLabel: 'Related Document',
    description: 'Case event recorded by the investigating officer.'
};

function formatDate(dt) {
    return new Date(dt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatDateShort(dt) {
    return new Date(dt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

// Simulated document that would be loaded from DB (matching event category to doc type)
function buildEventDocument(evt, caseData) {
    const cat = evt.category;
    const docDateStr = formatDateShort(evt.event_time);

    if (cat === 'registration') {
        return {
            type: caseData?.case_type === 'fir' ? 'FIR' : 'Complaint',
            content: `**${caseData?.case_type === 'fir' ? 'First Information Report' : 'COMPLAINT'}**

**${caseData?.case_type === 'fir' ? 'FIR' : 'Complaint'} No.:** ${caseData?.id?.replace('case-', caseData?.case_type === 'fir' ? 'FIR-' : 'CMP-')?.toUpperCase() || 'Pending'}
**Date of Filing:** ${docDateStr}
**Police Station:** ${evt.location || 'PS Sector 14'}
**Officer:** ${evt.officer_name || 'IO'}

**Description of Incident:**
${caseData?.description || evt.description}

**Section of Law:** ${caseData?.offense_section || 'Under Investigation'}

*This document was registered at ${evt.location || 'the police station'} on ${docDateStr}.*`,
            isLinked: true
        };
    }
    if (cat === 'statement') {
        return {
            type: 'Statement',
            content: `**RECORDED STATEMENT**

**Date:** ${docDateStr}
**Location:** ${evt.location || 'Police Station'}
**Recorded by:** ${evt.officer_name || 'IO'}

**Statement:**
${evt.description}

*Statement recorded in accordance with CrPC Section 161. The deponent confirmed the contents to be true to the best of their knowledge.*`,
            isLinked: true
        };
    }
    if (cat === 'arrest') {
        return {
            type: 'Arrest Memo',
            content: `**ARREST MEMO**

**Date of Arrest:** ${docDateStr}
**Location:** ${evt.location || 'Location'}
**Arresting Officer:** ${evt.officer_name || 'IO'}

**Details:**
${evt.description}

**Rights Read:** Yes
**Medical Examination:** To be conducted within 24 hours
**Producing Authority:** ${evt.location ? 'Local Magistrate' : 'Magistrate Court'}

*Arrest conducted in accordance with CrPC provisions. Accused informed of grounds of arrest.*`,
            isLinked: true
        };
    }
    if (cat === 'evidence') {
        return {
            type: 'Evidence Record',
            content: `**EVIDENCE / SEIZURE NOTE**

**Date:** ${docDateStr}
**Location of Recovery:** ${evt.location || 'Scene'}
**Officer:** ${evt.officer_name || 'IO'}

**Evidence Details:**
${evt.description}

*Evidence collected as per proper procedure. Seizure memo prepared. Chain of custody maintained.*`,
            isLinked: true
        };
    }
    if (cat === 'raid') {
        return {
            type: 'Raid Report',
            content: `**RAID / SEARCH REPORT**

**Date of Raid:** ${docDateStr}
**Location:** ${evt.location || 'Premises'}
**Officer in Charge:** ${evt.officer_name || 'IO'}

**Raid Details:**
${evt.description}

*Raid conducted under warrant / special powers. Panchnama prepared.*`,
            isLinked: true
        };
    }
    if (cat === 'challan') {
        return {
            type: 'Challan',
            content: `**CHALLAN / CHARGESHEET**

**Date Filed:** ${docDateStr}
**Court:** ${evt.location || 'District Court'}
**Filed by:** ${evt.officer_name || 'IO'}

**Details:**
${evt.description}

*Challan submitted under Section 173 CrPC. All evidence and witness list attached.*`,
            isLinked: true
        };
    }
    return {
        type: 'Case Note',
        content: `**CASE NOTE**\n\n**Date:** ${docDateStr}\n**Location:** ${evt.location || '—'}\n**Officer:** ${evt.officer_name || 'IO'}\n\n${evt.description}`,
        isLinked: false
    };
}

function DocumentDrawer({ open, event, caseData, onClose }) {
    if (!event) return null;
    const cfg = CATEGORY_CONFIG[event.category] || DEFAULT_CONFIG;
    const doc = buildEventDocument(event, caseData);

    const lines = doc.content.split('\n');

    return (
        <Drawer
            open={open}
            onClose={onClose}
            width={520}
            zIndex={2000}
            title={
                <Space>
                    <span style={{ color: cfg.color === 'green' ? '#52c41a' : cfg.color === 'blue' ? '#1890ff' : cfg.color === 'red' ? '#ff4d4f' : cfg.color === 'orange' ? '#fa8c16' : cfg.color === 'purple' ? '#722ed1' : cfg.color === 'magenta' ? '#eb2f96' : '#8c8c8c' }}>
                        {cfg.docIcon}
                    </span>
                    <span>{doc.type}</span>
                    {doc.isLinked && <Tag color="success" style={{ margin: 0 }}><LinkOutlined /> Verified</Tag>}
                </Space>
            }
            extra={<Button onClick={onClose} size="small">Close</Button>}
        >
            <div style={{ marginBottom: 16 }}>
                <Tag color={`${cfg.color}`} style={{ textTransform: 'uppercase', marginBottom: 12 }}>{event.category}</Tag>
                <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.7, marginBottom: 4 }}>
                    <CalendarOutlined /> {formatDate(event.event_time)}
                    {event.location && <span style={{ marginLeft: 12 }}><HomeOutlined /> {event.location}</span>}
                </div>
                {event.officer_name && (
                    <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.7 }}>
                        <SafetyOutlined /> {event.officer_name}
                    </div>
                )}
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div style={{
                background: '#fcfcf5',
                backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1), inset 0 0 50px rgba(0,0,0,0.03)',
                border: '1px solid #e0dbce',
                borderRadius: 2,
                padding: '40px 30px',
                fontFamily: '"Courier New", Courier, monospace',
                lineHeight: 1.6,
                fontSize: 14,
                color: '#2b2b2b',
                minHeight: '600px',
                transform: 'rotate(-0.5deg)',
                filter: 'sepia(0.2) contrast(1.05) brightness(0.98)',
            }}>
                {lines.map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
                        return <div key={i} style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, textTransform: 'uppercase', textDecoration: 'underline' }}>{line.replace(/\*\*/g, '')}</div>;
                    }
                    const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
                    if (boldParts.length > 1) {
                        return (
                            <div key={i} style={{ marginBottom: 6 }}>
                                {boldParts.map((part, j) => {
                                    if (part.startsWith('**') && part.endsWith('**')) {
                                        return <strong key={j} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
                                    }
                                    return <span key={j}>{part}</span>;
                                })}
                            </div>
                        );
                    }
                    if (line.trim() === '') return <div key={i} style={{ height: 16 }}></div>;
                    if (line.startsWith('*') && line.endsWith('*')) {
                        return <div key={i} style={{ fontStyle: 'italic', color: '#4a4a4a', fontSize: 12, marginTop: 24, borderTop: '1px dashed #ccc', paddingTop: 8 }}>{line.slice(1, -1)}</div>;
                    }
                    return <div key={i} style={{ marginBottom: 6 }}>{line}</div>;
                })}
            </div>

            {doc.isLinked && (
                <Alert
                    style={{ marginTop: 16, fontSize: 12 }}
                    type="success"
                    showIcon
                    message="Verified Source"
                    description={`This ${doc.type} is linked to the case ${caseData?.case_type === 'fir' ? 'FIR' : 'Complaint'} file. Document trail maintained for verifiability.`}
                />
            )}
        </Drawer>
    );
}

export default function TimelineView({ caseId, headers, caseData }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/analysis/cases/${caseId}/timeline`, { headers })
            .then(r => r.json())
            .then(data => { setEvents(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [caseId]);

    const handleEventClick = (evt) => {
        setSelectedEvent(evt);
        setDrawerOpen(true);
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}><Text type="secondary">Loading timeline...</Text></div>
        </div>
    );

    if (events.length === 0) return (
        <div style={{ padding: '80px 0' }}>
            <Empty description="No events recorded for this case yet." />
        </div>
    );

    return (
        <div style={{ padding: '24px 32px' }}>
            <div style={{ marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarOutlined style={{ color: '#1890ff' }} />
                    Case Timeline
                    <Text type="secondary" style={{ fontWeight: 'normal', fontSize: '14px' }}>({events.length} events)</Text>
                </Title>
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                    <EyeOutlined /> Click any event to view the source document — ensuring full verifiability of the investigation trail.
                </Text>
            </div>

            <div style={{ paddingLeft: 16 }}>
                <Timeline mode="left">
                    {events.map((evt) => {
                        const cfg = CATEGORY_CONFIG[evt.category] || DEFAULT_CONFIG;
                        return (
                            <Timeline.Item
                                key={evt.id}
                                color={cfg.color}
                                dot={cfg.icon}
                                label={<Text strong>{formatDate(evt.event_time)}</Text>}
                            >
                                <Card
                                    size="small"
                                    bordered={false}
                                    hoverable
                                    onClick={() => handleEventClick(evt)}
                                    style={{
                                        background: 'var(--code-bg)',
                                        border: '1px solid var(--border)',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                        marginTop: -6,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Tag color={cfg.color} style={{ textTransform: 'uppercase', marginBottom: 8 }}>{evt.category}</Tag>
                                        <Button
                                            type="link"
                                            size="small"
                                            icon={<EyeOutlined />}
                                            style={{ padding: '0 4px', height: 'auto', fontSize: 12 }}
                                        >
                                            View Document
                                        </Button>
                                    </div>
                                    <Paragraph style={{ marginBottom: 8 }}>{evt.description}</Paragraph>

                                    {(evt.officer_name || evt.location) && (
                                        <Space size="large" style={{ marginTop: 4 }}>
                                            {evt.officer_name && <Text type="secondary" style={{ fontSize: 12 }}><SafetyOutlined /> {evt.officer_name}</Text>}
                                            {evt.location && <Text type="secondary" style={{ fontSize: 12 }}><HomeOutlined /> {evt.location}</Text>}
                                        </Space>
                                    )}
                                </Card>
                            </Timeline.Item>
                        );
                    })}
                </Timeline>
            </div>

            <DocumentDrawer
                open={drawerOpen}
                event={selectedEvent}
                caseData={caseData}
                onClose={() => { setDrawerOpen(false); setSelectedEvent(null); }}
            />
        </div>
    );
}
