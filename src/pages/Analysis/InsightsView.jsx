import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Input, Button, Typography, Select, Tag, Spin, Alert, Empty, Progress } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFile, faUsers, faCalendarDays, faMagnifyingGlass, faTriangleExclamation,
  faClockRotateLeft, faRocket, faRobot, faUpload, faCheckCircle,
  faCircleInfo, faDiagramProject, faInbox, faFileLines, faFilePdf,
  faFileExcel, faFileWord, faBolt, faLightbulb, faTrash, faCircleXmark,
  faBrain, faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const FA = ({ icon, style, spin }) => <FontAwesomeIcon icon={icon} style={style} spin={spin} />;

const PAGE_ICONS = {
  index:         faFile,
  entities:      faUsers,
  timeline:      faCalendarDays,
  leads:         faMagnifyingGlass,
  contradictions:faTriangleExclamation,
  log:           faClockRotateLeft,
};
const PAGE_ORDER = ['index', 'entities', 'leads', 'contradictions', 'timeline', 'log'];

const DOC_TYPES = [
  'FIR', 'Complaint', 'Witness Statement', 'Accused Statement',
  'Seizure Memo', 'Arrest Memo', 'CDR Report', 'Bank Statement',
  'Forensic Report', 'IPDR Report', 'OSINT Report', 'Court Order', 'Case Diary', 'Other',
];

function getFileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf')                   return <FA icon={faFilePdf}   style={{ color: '#f87171' }} />;
  if (['xlsx','xls','csv'].includes(ext)) return <FA icon={faFileExcel} style={{ color: '#4ade80' }} />;
  if (['docx','doc'].includes(ext))    return <FA icon={faFileWord}  style={{ color: '#60a5fa' }} />;
  return <FA icon={faFileLines} style={{ color: '#fbbf24' }} />;
}

function sortPages(pages) {
  return [...pages].sort((a, b) => {
    const ai = PAGE_ORDER.indexOf(a.page_slug), bi = PAGE_ORDER.indexOf(b.page_slug);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });
}

function renderInline(text) {
  if (typeof text !== 'string') return text || '';
  const parts = text.split(/(\*\*[^*]+\*\*|\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: 'var(--text-h)' }}>{part.slice(2, -2)}</strong>;
    if (part.match(/^\[.*?\]\(.*?\)$/)) {
      const label = part.match(/\[(.*?)\]/)[1];
      return <span key={i} style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>{label}</span>;
    }
    return part;
  });
}

function MarkdownRenderer({ content }) {
  const lines = content.split('\n');
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('## '))      elements.push(<h4 key={i} style={{ color: 'var(--text-h)', marginTop: 20, marginBottom: 10 }}>{renderInline(line.slice(3))}</h4>);
    else if (line.startsWith('# ')) elements.push(<h3 key={i} style={{ color: 'var(--text-h)', marginTop: 16, marginBottom: 12 }}>{renderInline(line.slice(2))}</h3>);
    else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      const checked = line.startsWith('- [x]');
      elements.push(
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '7px 0' }}>
          {checked ? <FA icon={faCheckCircle} style={{ color: '#4ade80', marginTop: 3, flexShrink: 0 }} /> : <div style={{ width: 13, height: 13, border: '1px solid var(--border)', borderRadius: 2, marginTop: 3, flexShrink: 0 }} />}
          <span style={{ color: checked ? 'var(--text-dim)' : 'var(--text)', textDecoration: checked ? 'line-through' : 'none', fontSize: 13 }}>{renderInline(line.slice(6))}</span>
        </div>
      );
    } else if (line.startsWith('- ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '7px 0' }}>
          <div style={{ width: 5, height: 5, background: 'var(--accent)', borderRadius: '50%', marginTop: 8, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith('|')) { tableLines.push(lines[i]); i++; }
      const nonSep = tableLines.filter(l => !l.match(/^\|[-| ]+\|$/));
      elements.push(
        <div key={`t${i}`} style={{ overflowX: 'auto', margin: '14px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <tbody>
              {nonSep.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid var(--border)', background: ri === 0 ? 'var(--code-bg)' : 'transparent' }}>
                  {row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1).map((cell, ci) => (
                    <td key={ci} style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', color: ri === 0 ? 'var(--text-h)' : 'var(--text)', fontWeight: ri === 0 ? 600 : 400 }}>
                      {renderInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    } else if (line.trim() !== '') {
      elements.push(<p key={i} style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text)', lineHeight: 1.65 }}>{renderInline(line)}</p>);
    }
    i++;
  }
  return <div>{elements}</div>;
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
  const [ingestTab, setIngestTab] = useState('upload');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const fetchWiki = () => {
    setLoading(true);
    fetch(`/api/analysis/cases/${caseId}/wiki`, { headers })
      .then(r => r.json())
      .then(d => {
        setWikiData(d);
        const sorted = sortPages(d.pages || []);
        if (sorted.length > 0 && !activePage) setActivePage(sorted[0].page_slug);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchWiki(); setQueryResult(null); setIngestResult(null); setActivePage(null); }, [caseId]);

  const handleQuery = async (value) => {
    if (!value.trim()) return;
    setQuerying(true); setQueryResult(null);
    try {
      const res = await fetch(`/api/analysis/cases/${caseId}/query`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: value }),
      });
      setQueryResult(await res.json());
    } catch { setQueryResult({ answer: 'Query failed. Please try again.', sourcedFrom: [] }); }
    setQuerying(false);
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    setUploadedFile({ name: file.name, size: file.size, file });
    const reader = new FileReader();
    reader.onload = e => { if (typeof e.target.result === 'string' && e.target.result.length < 200000) setIngestForm(p => ({ ...p, text: e.target.result })); };
    reader.readAsText(file, 'utf-8');
  };

  const handleIngestFile = async () => {
    if (!uploadedFile?.file) return;
    setIngesting(true); setIngestResult(null); setUploadProgress(10);
    try {
      const fd = new FormData();
      fd.append('file', uploadedFile.file);
      fd.append('doc_type', ingestForm.type);
      const pt = setInterval(() => setUploadProgress(p => Math.min(p + 15, 85)), 800);
      const res = await fetch(`/api/analysis/cases/${caseId}/upload`, { method: 'POST', headers: { Authorization: headers.Authorization }, body: fd });
      clearInterval(pt); setUploadProgress(100);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Upload failed');
      setIngestResult({ success: true, ...d });
      setUploadedFile(null); setIngestForm(p => ({ ...p, text: '' }));
      fetchWiki();
    } catch (e) { setIngestResult({ success: false, error: e.message }); }
    setIngesting(false);
    setTimeout(() => setUploadProgress(0), 1500);
  };

  const handleIngestText = async () => {
    if (!ingestForm.text.trim()) return;
    setIngesting(true); setIngestResult(null);
    try {
      const res = await fetch(`/api/analysis/cases/${caseId}/ingest`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: ingestForm.type, content: ingestForm.text }),
      });
      const d = await res.json();
      setIngestResult(d.success ? { success: true, extracted: d.extracted } : { success: false });
      if (d.success) { setIngestForm(p => ({ ...p, text: '' })); fetchWiki(); }
    } catch { setIngestResult({ success: false }); }
    setIngesting(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /><div style={{ marginTop: 14, color: 'var(--text-dim)', fontSize: 13 }}>Loading Case Intelligence Wiki...</div></div>;

  const pages = sortPages(wikiData?.pages || []);
  const currentContent = pages.find(p => p.page_slug === activePage)?.content_md || '';

  const isFileMode = ingestTab === 'upload';
  const canIngest = isFileMode ? !!uploadedFile?.file : !!ingestForm.text.trim();

  return (
    <Layout style={{ height: '100%', minHeight: 560, background: 'var(--bg)', borderRadius: '0 0 8px 8px' }}>

      {/* ── Wiki nav sider ────────────────────────────────────────────────── */}
      <Sider width={210} style={{ background: 'var(--code-bg)', borderRight: '1px solid var(--border)', overflow: 'auto' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            <FA icon={faFileLines} style={{ marginRight: 5, color: 'var(--accent)' }} />
            WIKI ({pages.length})
          </span>
        </div>
        <Menu mode="inline" selectedKeys={activePage ? [activePage] : []} onClick={e => setActivePage(e.key)}
          style={{ borderRight: 0, background: 'transparent', padding: '6px 0' }}
          items={pages.map(p => ({
            key: p.page_slug,
            icon: <FA icon={PAGE_ICONS[p.page_slug] || faFile} style={{ fontSize: 12 }} />,
            label: <span style={{ fontSize: 13, textTransform: 'capitalize', color: 'var(--text)' }}>{p.page_slug}</span>,
          }))}
        />
      </Sider>

      {/* ── Wiki content ─────────────────────────────────────────────────── */}
      <Content style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
        {/* AI banner */}
        <div style={{ padding: '10px 18px', background: 'rgba(59,130,246,0.08)', borderBottom: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <FA icon={faDiagramProject} style={{ fontSize: 18, color: 'var(--accent)' }} />
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-hover)', display: 'block' }}>LLM WIKI — AI Knowledge Graph</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Gemini 1.5 Flash (extraction) · Groq LLaMA 3.3 70B (queries)</span>
          </div>
        </div>

        {/* Wiki reader */}
        <div style={{ flex: 1, padding: '18px 24px', overflowY: 'auto' }}>
          {currentContent ? <MarkdownRenderer content={currentContent} /> : (
            <div style={{ padding: '80px 0', textAlign: 'center' }}>
              <Empty description={<span style={{ color: 'var(--text-dim)' }}>Select a wiki page from the left panel.</span>} />
            </div>
          )}
        </div>

        {/* Query bar */}
        <div style={{ padding: '14px 18px', background: 'var(--code-bg)', borderTop: '1px solid var(--border)' }}>
          {queryResult && (
            <div style={{ marginBottom: 12, padding: '12px 16px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <FA icon={faRobot} style={{ color: '#4ade80' }} />
                <span style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 13 }}>AI Response</span>
                {queryResult.method && (
                  <span style={{ fontSize: 10, background: queryResult.method === 'groq' ? 'rgba(167,139,250,0.2)' : 'rgba(59,130,246,0.2)', color: queryResult.method === 'groq' ? '#a78bfa' : '#60a5fa', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>
                    {queryResult.method === 'groq' ? '⚡ Groq LLaMA' : queryResult.method === 'gemini' ? '✨ Gemini' : 'Rule-based'}
                  </span>
                )}
                <button onClick={() => setQueryResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 14 }}>
                  <FA icon={faCircleXmark} />
                </button>
              </div>
              <p style={{ margin: '0 0 6px', whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text)', lineHeight: 1.65 }}>{queryResult.answer}</p>
              {queryResult.sourcedFrom?.length > 0 && (
                <span style={{ fontSize: 11, color: '#4ade80' }}>
                  <FA icon={faCheckCircle} style={{ marginRight: 4 }} />
                  Sources: {queryResult.sourcedFrom.join(', ')}
                </span>
              )}
            </div>
          )}
          <Input.Search
            placeholder='Ask AI: "Who are the suspects?" or "Any financial leads?"'
            enterButton={
              <Button type="primary" style={{ background: 'var(--accent)', border: 'none', color: '#fff', fontWeight: 600 }}>
                <FA icon={faRocket} style={{ marginRight: 6 }} />Ask AI
              </Button>
            }
            size="large"
            onSearch={handleQuery}
            loading={querying}
            style={{ '--ant-input-bg': 'var(--bg)' }}
          />
        </div>
      </Content>

      {/* ── Ingest panel ─────────────────────────────────────────────────── */}
      <Sider width={300} style={{ background: 'var(--code-bg)', borderLeft: '1px solid var(--border)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
          <h5 style={{ margin: '0 0 2px', color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <FA icon={faUpload} style={{ color: 'var(--accent)' }} />Ingest Document
          </h5>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>AI auto-extracts entities, leads & contradictions.</span>
        </div>

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
          {/* Doc type */}
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Document Type</span>
            <Select value={ingestForm.type} onChange={v => setIngestForm({ ...ingestForm, type: v })} style={{ width: '100%' }} size="small">
              {DOC_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
          </div>

          {/* Upload / Paste toggle */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {[{ key: 'upload', label: 'Upload File' }, { key: 'paste', label: 'Paste Text' }].map(t => (
              <button key={t.key} onClick={() => setIngestTab(t.key)} style={{
                flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: ingestTab === t.key ? 700 : 400,
                background: ingestTab === t.key ? 'var(--accent)' : 'transparent',
                color: ingestTab === t.key ? '#fff' : 'var(--text-dim)',
                transition: 'all 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          {/* File drop zone */}
          {ingestTab === 'upload' && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '20px 10px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'var(--accent-bg)' : 'transparent', transition: 'all 0.2s',
                }}
              >
                <FA icon={faInbox} style={{ fontSize: 28, color: dragOver ? 'var(--accent)' : 'var(--text-dim)', marginBottom: 6, display: 'block', margin: '0 auto 6px' }} />
                <span style={{ fontSize: 12, color: 'var(--text)' }}>Drop file here or <span style={{ color: 'var(--accent-hover)', textDecoration: 'underline' }}>browse</span></span>
                <br />
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>.pdf · .docx · .txt · .csv · .xlsx · .mp3 · .wav · .mp4 · .jpg</span>
              </div>
              <input ref={fileInputRef} type="file" accept=".txt,.pdf,.docx,.doc,.csv,.xlsx,.mp3,.wav,.mp4,.png,.jpg,.jpeg" style={{ display: 'none' }}
                onChange={e => handleFileSelect(e.target.files[0])} />

              {uploadedFile && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(59,130,246,0.06)', border: '1px solid var(--accent-border)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    {getFileIcon(uploadedFile.name)}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedFile.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{Math.round(uploadedFile.size / 1024)} KB</div>
                    </div>
                  </div>
                  <button onClick={() => { setUploadedFile(null); setIngestForm(p => ({ ...p, text: '' })); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 14 }}>
                    <FA icon={faTrash} />
                  </button>
                </div>
              )}

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div style={{ marginTop: 8 }}>
                  <Progress percent={uploadProgress} size="small" status="active" strokeColor="var(--accent)" />
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {uploadProgress < 50 ? 'Parsing document...' : uploadProgress < 80 ? 'AI extracting entities...' : 'Updating wiki...'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Paste text */}
          {ingestTab === 'paste' && (
            <TextArea
              value={ingestForm.text}
              onChange={e => setIngestForm({ ...ingestForm, text: e.target.value })}
              placeholder="Paste document text (Hindi or English)..."
              style={{ resize: 'none', minHeight: 140, fontSize: 12, background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          )}

          {/* Ingest result */}
          {ingestResult && (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: ingestResult.success ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)',
              border: `1px solid ${ingestResult.success ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: ingestResult.success ? '#4ade80' : '#f87171', display: 'block', marginBottom: 6 }}>
                <FA icon={ingestResult.success ? faCheckCircle : faCircleXmark} style={{ marginRight: 5 }} />
                {ingestResult.success ? 'Ingested Successfully' : 'Ingest Failed'}
              </span>
              {ingestResult.success ? (
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {ingestResult.extracted?.classification && <div>Classified as: <strong style={{ color: 'var(--text)' }}>{ingestResult.extracted.classification.doc_type}</strong></div>}
                  <div>Persons extracted: <strong style={{ color: 'var(--text)' }}>{ingestResult.extracted?.newPersons?.length || 0}</strong></div>
                  {(ingestResult.extracted?.contradictions?.length > 0) && <div style={{ color: '#fbbf24', marginTop: 3 }}>⚠ {ingestResult.extracted.contradictions.length} contradictions found</div>}
                  <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, background: 'var(--accent-bg)', color: 'var(--accent-hover)', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>
                    <FA icon={faBolt} style={{ marginRight: 4 }} />Gemini + Groq
                  </span>
                </div>
              ) : <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{ingestResult.error || 'Processing failed.'}</span>}
            </div>
          )}

          <button
            onClick={isFileMode ? handleIngestFile : handleIngestText}
            disabled={!canIngest || ingesting}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', cursor: canIngest ? 'pointer' : 'not-allowed',
              background: canIngest ? 'linear-gradient(135deg, var(--accent), #7c3aed)' : 'var(--border)',
              color: canIngest ? '#fff' : 'var(--text-dim)', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.15s', opacity: canIngest ? 1 : 0.5,
            }}
          >
            <FA icon={ingesting ? faBrain : faUpload} spin={ingesting} />
            {ingesting ? 'AI Processing...' : 'Ingest to Wiki'}
          </button>

          <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', display: 'block' }}>
            <FA icon={faLightbulb} style={{ marginRight: 4, color: 'var(--warning)' }} />
            Gemini extracts entities · Groq generates leads
          </span>
        </div>
      </Sider>
    </Layout>
  );
}
