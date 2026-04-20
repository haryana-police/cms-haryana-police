import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Select, Tabs, Tag, Space, Spin, Empty, Tooltip } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock, faShareNodes, faPhone, faLightbulb, faBuilding,
  faTriangleExclamation, faRocket, faExpand, faCompress,
  faRobot, faHashtag, faCalendarDays, faUser, faFolderOpen,
  faMicrochip, faChevronUp, faChevronDown, faCircleDot,
} from '@fortawesome/free-solid-svg-icons';
import TimelineView       from './TimelineView';
import KnowledgeGraphView from './KnowledgeGraphView';
import CDRAnalysisView    from './CDRAnalysisView';
import InsightsView       from './InsightsView';
import BankAnalysisView   from './BankAnalysisView';
import LeadsView          from './LeadsView';
import ContradictionsView from './ContradictionsView';

const { Option } = Select;

const FA = ({ icon, style, spin }) => (
  <FontAwesomeIcon icon={icon} style={{ flexShrink: 0, ...style }} spin={spin} />
);

// Tab bar + a little padding
const TAB_BAR_H  = 46;
const WRAPPER_PY = 24; // top+bottom padding of outer wrapper

/* ── Fullscreen toggle ───────────────────────────────────────────────────── */
function FullscreenBtn({ isFullscreen, onToggle }) {
  return (
    <Tooltip title={isFullscreen ? 'Exit fullscreen  [Esc]' : 'Expand to fullscreen'} placement="bottomLeft">
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 6, cursor: 'pointer', outline: 'none',
        border: `1px solid ${isFullscreen ? 'var(--accent)' : 'var(--border)'}`,
        background: isFullscreen ? 'var(--accent-bg)' : 'transparent',
        color: isFullscreen ? 'var(--accent-hover)' : 'var(--text-dim)',
        fontSize: 13, transition: 'all 0.18s', flexShrink: 0,
      }}>
        <FA icon={isFullscreen ? faCompress : faExpand} />
      </button>
    </Tooltip>
  );
}

/* ── Single metadata chip ────────────────────────────────────────────────── */
function MetaItem({ icon, label, value, mono, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <span style={{ marginTop: 3, color: accent || 'var(--accent)', fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-h)', fontFamily: mono ? 'var(--mono)' : 'inherit' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

/* ── Collapsed mini-bar ──────────────────────────────────────────────────── */
function MiniBar({ selectedCase, cases, selectedCaseId, onCaseChange, isFullscreen, onToggleFullscreen, onExpand }) {
  const statusColor = (s) => ({ open: '#fbbf24', investigation: '#60a5fa', challan: '#a78bfa', closed: '#4ade80' }[s] || '#94a3b8');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '8px 14px',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 10,
      boxShadow: 'var(--shadow)',
    }}>
      {/* Robot icon */}
      <FA icon={faRobot} style={{ color: 'var(--accent)', fontSize: 16 }} />

      {/* Case title pill */}
      {selectedCase ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedCase.title}
          </span>
          <span style={{ fontSize: 11, color: statusColor(selectedCase.status), fontWeight: 700, flexShrink: 0 }}>
            ● {selectedCase.status?.toUpperCase()}
          </span>
          {selectedCase.case_type && (
            <Tag color={selectedCase.case_type === 'fir' ? 'error' : 'warning'} style={{ fontSize: 11, padding: '0 7px', margin: 0, flexShrink: 0 }}>
              {selectedCase.case_type.toUpperCase()}
            </Tag>
          )}
          {/* Quick meta chips */}
          {selectedCase.complaint_number && (
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
              {selectedCase.complaint_number || selectedCase.fir_number}
            </span>
          )}
        </div>
      ) : (
        <Select showSearch style={{ flex: 1, minWidth: 180 }} size="small" placeholder="Select case…"
          value={selectedCaseId} onChange={onCaseChange} optionFilterProp="children"
          getPopupContainer={trigger => trigger.parentNode}>
          {cases.map(c => <Option key={c.id} value={c.id}>[{c.case_type.toUpperCase()}] {c.title}</Option>)}
        </Select>
      )}

      {/* Spacer */}
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto' }}>
        <Tooltip title="Show case details">
          <button onClick={onExpand} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
            borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--accent-bg)', color: 'var(--accent-hover)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <FA icon={faChevronDown} style={{ fontSize: 10 }} />
            Case Info
          </button>
        </Tooltip>
        <FullscreenBtn isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function AnalysisPage() {
  const [cases, setCases]                   = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedCase, setSelectedCase]     = useState(null);
  const [activeTab, setActiveTab]           = useState('timeline');
  const [loading, setLoading]               = useState(true);
  const [isFullscreen, setIsFullscreen]     = useState(false);

  // "collapsed" = top section hidden, only the mini-bar shows
  const [headerCollapsed, setHeaderCollapsed] = useState(true);

  const headerRef   = useRef(null);
  const selectorRef = useRef(null);
  const wrapperRef  = useRef(null);

  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const toggleFullscreen = useCallback(() => setIsFullscreen(f => !f), []);

  /* Auto-collapse on small screens */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    if (mq.matches) setHeaderCollapsed(true);
    const cb = (e) => { if (e.matches) setHeaderCollapsed(true); };
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }, []);

  /* Esc exits fullscreen */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  /* Lock scroll in fullscreen */
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  /* ── Fetch cases ──────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/analysis/cases', { headers })
      .then(r => r.json())
      .then(data => {
        setCases(data);
        if (data.length > 0) { setSelectedCaseId(data[0].id); setSelectedCase(data[0]); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCaseChange = (id) => {
    setSelectedCaseId(id);
    setSelectedCase(cases.find(c => c.id === id) || null);
    setActiveTab('timeline');
  };

  const statusColor = (s) => ({ open: 'warning', investigation: 'processing', challan: 'purple', closed: 'success' }[s] || 'default');
  const typeColor   = (t) => t === 'fir' ? 'error' : 'gold';

  /* ── Tab definitions ─────────────────────────────────────────────────── */
  const tabItems = [
    { key: 'timeline',        label: <span style={{ display:'flex', alignItems:'center', gap:6 }}><FA icon={faClock} />Timeline</span>,              children: selectedCaseId ? <TimelineView       caseId={selectedCaseId} headers={headers} caseData={selectedCase} /> : null },
    { key: 'graph',           label: <span style={{ display:'flex', alignItems:'center', gap:6 }}><FA icon={faShareNodes} />Knowledge Graph</span>,   children: selectedCaseId ? <KnowledgeGraphView  caseId={selectedCaseId} headers={headers} caseData={selectedCase} /> : null },
    { key: 'cdr',             label: <span style={{ display:'flex', alignItems:'center', gap:6 }}><FA icon={faPhone} />CDR Analysis</span>,           children: selectedCaseId ? <CDRAnalysisView    caseId={selectedCaseId} headers={headers} /> : null },
    { key: 'bank',            label: <span style={{ display:'flex', alignItems:'center', gap:6 }}><FA icon={faBuilding} />Bank Analysis</span>,       children: selectedCaseId ? <BankAnalysisView   caseId={selectedCaseId} headers={headers} /> : null },
    { key: 'leads',           label: <span style={{ display:'flex', alignItems:'center', gap:6 }}><FA icon={faRocket} />AI Leads</span>,              children: selectedCaseId ? <LeadsView          caseId={selectedCaseId} headers={headers} /> : null },
    { key: 'contradictions',  label: <span style={{ display:'flex', alignItems:'center', gap:6 }}><FA icon={faTriangleExclamation} />Contradictions</span>, children: selectedCaseId ? <ContradictionsView caseId={selectedCaseId} headers={headers} /> : null },
    { key: 'insights',        label: <span style={{ display:'flex', alignItems:'center', gap:6 }}><FA icon={faLightbulb} />AI Insights</span>,        children: selectedCaseId ? <InsightsView       caseId={selectedCaseId} headers={headers} /> : null },
  ];

  /* ── Outer wrapper ───────────────────────────────────────────────────── */
  const wrapperStyle = isFullscreen ? {
    position: 'fixed', inset: 0, zIndex: 900,
    background: 'var(--bg-subtle)',
    padding: '10px 14px 0',
    display: 'flex', flexDirection: 'column',
  } : {
    height: 'calc(100vh - 32px)', // accounts for .app-content 16px margin on top and bottom
    padding: '0 4px',
    display: 'flex', flexDirection: 'column',
  };

  return (
    <div ref={wrapperRef} style={wrapperStyle} className={isFullscreen ? 'analysis-fullscreen' : ''}>

      {/* ══════════════════════════════════════════════════════════════════
          TOP SECTION — collapsible with smooth animation
          ════════════════════════════════════════════════════════════════ */}

      {/* When EXPANDED → Full header + case selector */}
      <div style={{
        overflow: 'hidden',
        maxHeight: headerCollapsed ? 0 : 400,
        opacity:   headerCollapsed ? 0 : 1,
        transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
        pointerEvents: headerCollapsed ? 'none' : 'auto',
      }}>
        {/* Page title row */}
        <div ref={headerRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.1rem', color: 'var(--text-h)', fontWeight: 700 }}>
              <FA icon={faRobot} style={{ color: 'var(--accent)', fontSize: 18 }} />
              AI Digital Investigator
            </h2>
            <p style={{ margin: '1px 0 0', color: 'var(--text-dim)', fontSize: 11 }}>
              <FA icon={faMicrochip} style={{ marginRight: 4 }} />
              Gemini 1.5 Flash · Groq LLaMA 3.3 70B · Timeline · CDR · Bank · Leads · Contradictions
            </p>
          </div>
          {/* Collapse + fullscreen buttons */}
          <div style={{ display: 'flex', gap: 7 }}>
            <Tooltip title="Collapse case info to maximise analysis view">
              <button onClick={() => setHeaderCollapsed(true)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-dim)', fontSize: 12, fontWeight: 600,
                transition: 'all 0.15s',
              }}>
                <FA icon={faChevronUp} style={{ fontSize: 10 }} />
                Collapse
              </button>
            </Tooltip>
            <FullscreenBtn isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
          </div>
        </div>

        {/* Case selector card */}
        <div ref={selectorRef} style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 10,
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <FA icon={faFolderOpen} style={{ marginRight: 5, color: 'var(--accent)' }} />Active Case
            </span>

            {/* Dropdown + status tags */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 9 }}>
              <Select showSearch style={{ flex: 1, minWidth: 220 }} placeholder="Select a case…"
                value={selectedCaseId} onChange={handleCaseChange} size="large"
                loading={loading} optionFilterProp="children" getPopupContainer={trigger => trigger.parentNode}>
                {cases.map(c => (
                  <Option key={c.id} value={c.id}>[{c.case_type.toUpperCase()}] {c.title} — {c.status}</Option>
                ))}
              </Select>
              {selectedCase && (
                <Space wrap size={5}>
                  <Tag color={typeColor(selectedCase.case_type)} style={{ fontSize: 12, padding: '2px 9px' }}>
                    {selectedCase.case_type.toUpperCase()}
                  </Tag>
                  <Tag color={statusColor(selectedCase.status)} style={{ fontSize: 12, padding: '2px 9px' }}>
                    {selectedCase.status.toUpperCase()}
                  </Tag>
                  {selectedCase.offense_section && <code style={{ fontSize: 12 }}>{selectedCase.offense_section}</code>}
                </Space>
              )}
            </div>

            {/* Meta strip - Clean simple design */}
            {selectedCase && (
              <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '12px 24px', fontSize: 13, color: 'var(--text)' }}>
                  <span><strong>FIR:</strong> {selectedCase.case_type === 'fir' ? (selectedCase.fir_number || selectedCase.id.replace('case-', 'FIR-').toUpperCase()) : (selectedCase.complaint_number || selectedCase.id.replace('case-', 'CMP-').toUpperCase())}</span>
                  <span><strong>Date:</strong> {selectedCase.registered_at ? new Date(selectedCase.registered_at).toLocaleDateString() : '—'}</span>
                  {selectedCase.offense_section && <span><strong>U/S:</strong> {selectedCase.offense_section}</span>}
                  <span><strong>PS:</strong> {selectedCase.station_id ? selectedCase.station_id.replace('stn-', 'PS ').replace('hq', 'HQ') : 'PS 1'}</span>
                  {selectedCase.io_name && <span><strong>IO:</strong> {selectedCase.io_name}</span>}
              </div>
            )}

            {selectedCase?.description && (
              <p style={{ margin: 0, paddingTop: 8, borderTop: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, lineHeight: 1.6 }}>
                {selectedCase.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* When COLLAPSED → compact mini-bar */}
      {headerCollapsed && (
        <MiniBar
          selectedCase={selectedCase}
          cases={cases}
          selectedCaseId={selectedCaseId}
          onCaseChange={handleCaseChange}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onExpand={() => setHeaderCollapsed(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ANALYSIS TABS — fills all remaining space
          ════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,          // take remaining height in fullscreen flex column
        marginBottom: 14, // footer breathing room
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 360, gap: 14 }}>
            <Spin size="large" />
            <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading case data…</span>
          </div>
        ) : !selectedCaseId ? (
          <div style={{ padding: '80px 0' }}>
            <Empty description={<span style={{ color: 'var(--text-dim)' }}>No cases found. Register a complaint to begin analysis.</span>} />
          </div>
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="middle"
            style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            tabBarStyle={{ padding: '0 12px', marginBottom: 0, backgroundColor: 'var(--code-bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
            items={tabItems.map(item => ({
              ...item,
              children: (
                <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
                  {item.children}
                </div>
              ),
            }))}
          />
        )}
      </div>

    </div>
  );
}
