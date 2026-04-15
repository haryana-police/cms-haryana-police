import React, { useState, useEffect } from 'react';
import { Layout, Menu, Input, Button, Card, Typography, Select, Tag, Spin, Space, Alert, Divider } from 'antd';
import {
    FileOutlined,
    TeamOutlined,
    CalendarOutlined,
    SearchOutlined,
    WarningOutlined,
    HistoryOutlined,
    RocketOutlined,
    RobotOutlined,
    UploadOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
    NodeIndexOutlined
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea, Search } = Input;
const { Option } = Select;

const PAGE_ICONS = {
    index: <FileOutlined />,
    entities: <TeamOutlined />,
    timeline: <CalendarOutlined />,
    leads: <SearchOutlined />,
    contradictions: <WarningOutlined />,
    log: <HistoryOutlined />,
};

const PAGE_ORDER = ['index', 'entities', 'leads', 'contradictions', 'timeline', 'log'];

function sortPages(pages) {
    return [...pages].sort((a, b) => {
        const ai = PAGE_ORDER.indexOf(a.page_slug);
        const bi = PAGE_ORDER.indexOf(b.page_slug);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

function MarkdownRenderer({ content, isDarkMode }) {
    const lines = content.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith('## ')) {
            elements.push(<Title level={4} key={i} style={{ marginTop: 24, marginBottom: 12 }}>{renderInline(line.slice(3))}</Title>);
        } else if (line.startsWith('# ')) {
            elements.push(<Title level={3} key={i} style={{ marginTop: 16, marginBottom: 16 }}>{renderInline(line.slice(2))}</Title>);
        } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
            const checked = line.startsWith('- [x]');
            elements.push(
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '8px 0' }}>
                    {checked ? <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 4 }} /> : <div style={{ width: 14, height: 14, border: '1px solid var(--text)', borderRadius: 2, marginTop: 4 }}></div>}
                    <Text {...(checked ? { delete: true, type: 'secondary' } : {})}>{renderInline(line.slice(6))}</Text>
                </div>
            );
        } else if (line.startsWith('- ')) {
            elements.push(
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '8px 0' }}>
                    <div style={{ width: 6, height: 6, backgroundColor: '#1890ff', borderRadius: '50%', marginTop: 8 }}></div>
                    <Text>{renderInline(line.slice(2))}</Text>
                </div>
            );
        } else if (line.startsWith('|')) {
            // Table
            elements.push(
                <div key={i} style={{ overflowX: 'auto', margin: '16px 0' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid var(--border)' }}>
                        <tbody>
                            {lines.slice(i).filter((l, li) => l.startsWith('|') && li === 0 || (l.startsWith('|') && !l.match(/^\|[-| ]+\|$/))).slice(0, 20).map((row, ri) => (
                                <tr key={ri} style={{ borderBottom: '1px solid var(--border)', background: ri === 0 ? 'var(--code-bg)' : 'transparent' }}>
                                    {row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1).map((cell, ci) => (
                                        <td key={ci} style={{ padding: '12px 16px', borderRight: '1px solid var(--border)', color: 'var(--text-h)', fontWeight: ri === 0 ? 600 : 'normal' }}>
                                            {renderInline(cell.trim())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            while (i < lines.length && lines[i].startsWith('|')) i++;
            continue;
        } else if (line.trim() === '') {
            // skip
        } else {
            elements.push(<Paragraph key={i} style={{ marginBottom: 16 }}>{renderInline(line)}</Paragraph>);
        }
        i++;
    }

    return <div>{elements}</div>;
}

function renderInline(text) {
    if (typeof text !== 'string') return text || '';
    const parts = text.split(/(\*\*[^*]+\*\*|\[.*?\]\(.*?\)|⚠️|✅|⬜)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.match(/^\[.*?\]\(.*?\)$/)) {
            const label = part.match(/\[(.*?)\]/)[1];
            return <Text key={i} strong style={{ color: '#1890ff' }}>{label}</Text>;
        }
        if (part === '⚠️') return <WarningOutlined key={i} style={{ color: '#faad14' }} />;
        if (part === '✅') return <CheckCircleOutlined key={i} style={{ color: '#52c41a' }} />;
        if (part === '⬜') return <InfoCircleOutlined key={i} style={{ color: '#1890ff' }} />;
        return part;
    });
}

export default function InsightsView({ caseId, headers }) {
    const [wikiData, setWikiData] = useState(null);
    const [activePage, setActivePage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [queryResult, setQueryResult] = useState(null);
    const [querying, setQuerying] = useState(false);

    const [ingestForm, setIngestForm] = useState({ type: 'FIR', text: '' });
    const [ingesting, setIngesting] = useState(false);
    const [ingestResult, setIngestResult] = useState(null);

    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const matchMedia = window.matchMedia('(prefers-color-scheme: dark)');
        setIsDarkMode(matchMedia.matches);
        const handler = (e) => setIsDarkMode(e.matches);
        matchMedia.addEventListener('change', handler);
        return () => matchMedia.removeEventListener('change', handler);
    }, []);

    const fetchWiki = () => {
        setLoading(true);
        fetch(`/api/analysis/cases/${caseId}/wiki`, { headers })
            .then(r => r.json())
            .then(data => {
                setWikiData(data);
                const sorted = sortPages(data.pages || []);
                if (sorted.length > 0 && !activePage) setActivePage(sorted[0].page_slug);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchWiki();
        setQueryResult(null);
        setIngestResult(null);
    }, [caseId]);

    const handleQuery = async (value) => {
        if (!value.trim()) return;
        setQuerying(true);
        setQueryResult(null);
        try {
            const res = await fetch(`/api/analysis/cases/${caseId}/query`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: value }),
            });
            const data = await res.json();
            setQueryResult(data);
        } catch {
            setQueryResult({ answer: 'Query failed. Please try again.', sourcedFrom: [] });
        }
        setQuerying(false);
    };

    const handleIngest = async () => {
        if (!ingestForm.text.trim()) return;
        setIngesting(true);
        setIngestResult(null);
        try {
            const res = await fetch(`/api/analysis/cases/${caseId}/ingest`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ doc_type: ingestForm.type, content: ingestForm.text }),
            });
            const data = await res.json();
            setIngestResult(data);
            setIngestForm({ ...ingestForm, text: '' });
            fetchWiki(); // Refresh wiki pages natively
        } catch {
            setIngestResult({ success: false });
        }
        setIngesting(false);
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}><Text type="secondary">Loading Case Intelligence Wiki...</Text></div>
        </div>
    );

    const pages = sortPages(wikiData?.pages || []);
    const lint = wikiData?.lint;
    const currentPageContent = pages.find(p => p.page_slug === activePage)?.content_md || '';

    return (
        <Layout style={{ height: 680, background: 'var(--bg)', borderRadius: '0 0 8px 8px' }}>

            {/* Sider Navigation */}
            <Sider width={240} theme={isDarkMode ? 'dark' : 'light'} style={{ borderRight: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
                    <Title level={5} style={{ margin: 0, fontSize: 14 }}><FileOutlined /> WIKI PAGES ({pages.length})</Title>
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={activePage ? [activePage] : []}
                    onClick={(e) => setActivePage(e.key)}
                    style={{ borderRight: 0, background: 'transparent', padding: '8px 0' }}
                    items={pages.map(p => ({
                        key: p.page_slug,
                        icon: PAGE_ICONS[p.page_slug] || <FileOutlined />,
                        label: <span style={{ textTransform: 'capitalize' }}>{p.page_slug}</span>,
                    }))}
                />

                {/* Health Check */}
                {lint && lint.missingPages?.length > 0 && (
                    <div style={{ padding: '16px' }}>
                        <Alert
                            message="Health Check"
                            description={
                                <ul style={{ paddingLeft: 16, margin: 0, fontSize: 12 }}>
                                    {lint.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            }
                            type="warning"
                            showIcon
                            style={{ fontSize: 13 }}
                        />
                    </div>
                )}
            </Sider>

            {/* Main Wiki Content */}
            <Content style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', borderRight: '1px solid var(--border)' }}>
                {/* Karpathy Banner */}
                <div style={{ padding: '16px 24px', background: isDarkMode ? '#111b26' : '#e6f4ff', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
                    <NodeIndexOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 16 }} />
                    <div>
                        <Title level={5} style={{ margin: 0, color: '#1890ff' }}>LLM WIKI — Docs-to-Knowledge-Graph</Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>Knowledge compiled once & kept current · Not re-derived on every query</Text>
                    </div>
                </div>

                {/* Wiki Reader */}
                <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
                    {currentPageContent ? (
                        <div className="markdown-body">
                            <MarkdownRenderer content={currentPageContent} isDarkMode={isDarkMode} />
                        </div>
                    ) : (
                        <div style={{ padding: '100px 0', textAlign: 'center' }}>
                            <Empty description="Select a wiki page to view contents." />
                        </div>
                    )}
                </div>

                {/* Query Bar */}
                <div style={{ padding: '20px 24px', background: 'var(--code-bg)', borderTop: '1px solid var(--border)' }}>
                    {queryResult && (
                        <Alert
                            message={
                                <Space>
                                    <RobotOutlined /> AI Response
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        (Synthesized from {queryResult.wikiPagesConsulted} pages)
                                    </Text>
                                </Space>
                            }
                            description={
                                <div>
                                    <Paragraph style={{ margin: '8px 0' }}>{queryResult.answer}</Paragraph>
                                    {queryResult.sourcedFrom?.length > 0 && (
                                        <Text type="success" style={{ fontSize: 12 }}>
                                            <CheckCircleOutlined /> Sources: {queryResult.sourcedFrom.join(', ')}
                                        </Text>
                                    )}
                                </div>
                            }
                            type="success"
                            style={{ marginBottom: 16 }}
                        />
                    )}

                    <Search
                        placeholder='e.g. "Who are the key suspects?" or "Are there any contradictions in statements?"'
                        enterButton={<Button type="primary" icon={<RocketOutlined />}>Ask AI</Button>}
                        size="large"
                        onSearch={handleQuery}
                        loading={querying}
                    />
                </div>
            </Content>

            {/* Ingest Panel */}
            <Sider width={320} theme={isDarkMode ? 'dark' : 'light'} style={{ display: 'flex', flexDirection: 'column', background: 'var(--code-bg)' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                    <Title level={5} style={{ margin: '0 0 8px' }}><UploadOutlined /> Ingest Document</Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>Extract entities, events, and update knowledge base.</Text>
                </div>

                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100% - 80px)' }}>
                    <div>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>Document Type</Text>
                        <Select
                            value={ingestForm.type}
                            onChange={v => setIngestForm({ ...ingestForm, type: v })}
                            style={{ width: '100%' }}
                        >
                            {['FIR', 'Complaint', 'Witness Statement', 'Accused Statement', 'Seizure Memo', 'Arrest Memo', 'CDR Report', 'Forensic Report', 'Court Order'].map(t => (
                                <Option key={t} value={t}>{t}</Option>
                            ))}
                        </Select>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>Document Text</Text>
                        <TextArea
                            value={ingestForm.text}
                            onChange={e => setIngestForm({ ...ingestForm, text: e.target.value })}
                            placeholder="Paste the raw text of the document here..."
                            style={{ flex: 1, resize: 'none' }}
                        />
                    </div>

                    {ingestResult && (
                        <Alert
                            type={ingestResult.success ? "success" : "error"}
                            showIcon
                            message={ingestResult.success ? "Ingested Successfully" : "Ingest Failed"}
                            description={ingestResult.success ? `Extracted ${ingestResult.extracted?.entities?.length || 0} entities, ${ingestResult.extracted?.events?.length || 0} events.` : "Could not process document."}
                            style={{ fontSize: 13 }}
                        />
                    )}

                    <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={handleIngest}
                        loading={ingesting}
                        disabled={!ingestForm.text.trim()}
                        block
                        size="large"
                    >
                        {ingesting ? 'Processing...' : 'Ingest to Wiki'}
                    </Button>
                </div>
            </Sider>

        </Layout>
    );
}
