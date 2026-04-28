import React, { useState, useEffect } from 'react';
import { Card, Tag, Typography, Spin, Empty, Alert, Button, Space, Select, Divider, message } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt, faRocket, faPhone, faIndianRupeeSign, faUser, faDatabase,
  faQuestion, faShieldHalved, faCheckCircle, faClock, faArrowsRotate,
  faCircleExclamation, faBookOpen, faFileLines, faChartBar,
} from '@fortawesome/free-solid-svg-icons';

const { Title, Text, Paragraph } = Typography;
const FA = ({ icon, style, spin }) => <FontAwesomeIcon icon={icon} style={style} spin={spin} />;

const PRIORITY = {
  high:   { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', label: 'HIGH PRIORITY' },
  medium: { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.3)',  label: 'MEDIUM' },
  low:    { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.3)',  label: 'LOW' },
};

const CAT_ICONS = {
  telecom:   faPhone,
  financial: faIndianRupeeSign,
  digital:   faDatabase,
  witness:   faUser,
  physical:  faBookOpen,
  other:     faQuestion,
};

const STATUS = {
  active:   { color: '#4ade80', label: 'Active' },
  actioned: { color: '#fbbf24', label: 'Action Taken' },
  closed:   { color: '#6b7280', label: 'Closed' },
};

function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 85 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#4ade80';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34 }}>{pct}%</span>
    </div>
  );
}

function LeadCard({ lead, headers, caseId, onStatusChange }) {
  const [updating, setUpdating] = useState(false);
  const p = PRIORITY[lead.priority] || PRIORITY.medium;
  const closed = lead.status === 'closed';

  const handleStatus = async (status) => {
    setUpdating(true);
    try {
      await fetch(`/api/analysis/cases/${caseId}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      onStatusChange(lead.id, status);
    } catch { message.error('Failed to update lead status'); }
    setUpdating(false);
  };

  return (
    <div style={{
      border: `1px solid ${closed ? 'var(--border)' : p.border}`,
      borderLeft: `4px solid ${closed ? '#374151' : p.color}`,
      borderRadius: 8, background: closed ? 'var(--bg)' : p.bg,
      opacity: closed ? 0.6 : 1, transition: 'all 0.2s', marginBottom: 12, padding: '16px 18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ background: p.color, color: '#0a0a0a', fontWeight: 800, fontSize: 10, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 4 }}>
            {p.label}
          </span>
          <Tag style={{ background: 'var(--code-bg)', color: 'var(--text)', borderColor: 'var(--border)', margin: 0, fontSize: 11 }}>
            <FA icon={CAT_ICONS[lead.category] || faQuestion} style={{ marginRight: 4 }} />
            {lead.category}
          </Tag>
          <span style={{ fontSize: 11, color: STATUS[lead.status]?.color || 'var(--text-dim)', fontWeight: 600 }}>
            ● {STATUS[lead.status]?.label || lead.status}
          </span>
        </div>
        <Space size={6}>
          {lead.status === 'active' && (
            <Button size="small" type="primary" ghost loading={updating} onClick={() => handleStatus('actioned')} style={{ fontSize: 11, color: 'var(--accent-hover)', borderColor: 'var(--accent)' }}>
              <FA icon={faCheckCircle} style={{ marginRight: 4 }} />Mark Actioned
            </Button>
          )}
          {lead.status !== 'closed' && (
            <Button size="small" danger ghost loading={updating} onClick={() => handleStatus('closed')} style={{ fontSize: 11 }}>
              Close
            </Button>
          )}
          {lead.status === 'closed' && (
            <Button size="small" ghost loading={updating} onClick={() => handleStatus('active')} style={{ fontSize: 11, color: 'var(--text)', borderColor: 'var(--border)' }}>
              Reopen
            </Button>
          )}
        </Space>
      </div>

      <h5 style={{ margin: '0 0 8px', color: 'var(--text-h)', fontSize: 14, lineHeight: 1.45 }}>{lead.title}</h5>

      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text)', lineHeight: 1.65 }}>{lead.description}</p>

      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: '0.06em' }}>AI CONFIDENCE</span>
        <ConfidenceBar value={lead.confidence} />
      </div>

      {lead.action && (
        <div style={{ padding: '10px 12px', borderRadius: 6, marginBottom: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-hover)', display: 'block', marginBottom: 4, letterSpacing: '0.04em' }}>
            <FA icon={faRocket} style={{ marginRight: 6 }} />RECOMMENDED ACTION
          </span>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{lead.action}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        {lead.sources?.length > 0 && (
          <div>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: '0.06em' }}>SOURCES</span>
            <Space size={[4, 4]} wrap>
              {lead.sources.map((s, i) => (
                <span key={i} style={{ fontSize: 11, padding: '1px 8px', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}>{s}</span>
              ))}
            </Space>
          </div>
        )}
        {lead.legal_basis && (
          <div>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, display: 'block', marginBottom: 4, letterSpacing: '0.06em' }}>LEGAL BASIS</span>
            <Tag color="purple" style={{ fontSize: 11 }}>{lead.legal_basis}</Tag>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadsView({ caseId, headers }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const fetchLeads = () => {
    setLoading(true);
    fetch(`/api/analysis/cases/${caseId}/leads`, { headers })
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchLeads(); }, [caseId]);

  const handleStatusChange = (id, status) => {
    setData(prev => ({ ...prev, leads: prev.leads.map(l => l.id === id ? { ...l, status } : l) }));
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/analysis/cases/${caseId}/scan`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } });
      const r = await res.json();
      message.success(`AI scan complete — ${r.newLeads || 0} new leads, ${r.contradictions?.length || 0} contradictions`);
      fetchLeads();
    } catch { message.error('AI scan failed.'); }
    setScanning(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /><div style={{ marginTop: 14, color: 'var(--text-dim)', fontSize: 13 }}>Loading leads...</div></div>;

  const leads = data?.leads || [];
  const filtered = leads.filter(l => (filter === 'all' || l.status === filter) && (catFilter === 'all' || l.category === catFilter));
  const highActive = leads.filter(l => l.priority === 'high' && l.status === 'active').length;
  const cats = [...new Set(leads.map(l => l.category))];

  return (
    <div style={{ padding: 22 }}>
      {/* Header */}
      <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-h)' }}>
            <FA icon={faBolt} style={{ color: '#fbbf24' }} />
            AI Investigative Leads
            <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-dim)' }}>({data?.total || 0} total, {data?.active || 0} active)</span>
          </h4>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
            <FA icon={faChartBar} style={{ marginRight: 5 }} />
            AI-generated leads with confidence scores — click "Mark Actioned" when pursuing a lead
          </p>
        </div>
        <Button type="primary" onClick={handleScan} loading={scanning}
          style={{ background: 'linear-gradient(135deg, #3b82f6, #7c3aed)', border: 'none', color: '#fff', fontWeight: 600 }}>
          <FA icon={faArrowsRotate} style={{ marginRight: 6 }} spin={scanning} />
          Run AI Scan
        </Button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total Leads', value: data?.total || 0, color: 'var(--accent-hover)' },
          { label: 'Active', value: data?.active || 0, color: '#4ade80' },
          { label: 'High Priority', value: highActive, color: '#f87171' },
          { label: 'Actioned', value: leads.filter(l => l.status === 'actioned').length, color: '#fbbf24' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Alert type="warning" showIcon icon={<FA icon={faShieldHalved} />}
        message="AI Advisory — Leads are suggestions derived from evidence analysis"
        description="The IO must independently verify all leads. No automatic accusations are made."
        style={{ marginBottom: 18 }}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Status:</span>
        {['all', 'active', 'actioned', 'closed'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${filter === s ? 'var(--accent)' : 'var(--border)'}`,
            background: filter === s ? 'var(--accent-bg)' : 'transparent',
            color: filter === s ? 'var(--accent-hover)' : 'var(--text)',
            transition: 'all 0.15s',
          }}>
            {s === 'all' ? 'All' : STATUS[s]?.label || s}
          </button>
        ))}
        {cats.length > 1 && (
          <>
            <Select value={catFilter} onChange={setCatFilter} size="small" style={{ width: 140 }}>
              <Select.Option value="all">All Categories</Select.Option>
              {cats.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
            </Select>
          </>
        )}
      </div>

      {/* Leads */}
      {filtered.length === 0 ? (
        <Empty description={
          leads.length === 0
            ? <span style={{ color: 'var(--text-dim)' }}>No leads yet. Upload documents or click "Run AI Scan".</span>
            : <span style={{ color: 'var(--text-dim)' }}>No leads match the selected filters.</span>
        } />
      ) : filtered.map(lead => (
        <LeadCard key={lead.id} lead={lead} headers={headers} caseId={caseId} onStatusChange={handleStatusChange} />
      ))}
    </div>
  );
}
