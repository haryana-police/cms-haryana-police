import React, { useState, useEffect } from 'react';
import { Tag, Typography, Spin, Empty, Alert, Button, Space, message } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTriangleExclamation, faCircleExclamation, faShieldHalved,
  faArrowsRotate, faCheckCircle, faCircleXmark, faCircleInfo,
  faPen, faFileLines,
} from '@fortawesome/free-solid-svg-icons';

const FA = ({ icon, style, spin }) => <FontAwesomeIcon icon={icon} style={style} spin={spin} />;

const SEV = {
  critical: { color: '#f87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.28)', label: 'CRITICAL',  icon: faCircleExclamation },
  moderate: { color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.28)',  label: 'MODERATE', icon: faTriangleExclamation },
  minor:    { color: '#38bdf8', bg: 'rgba(56,189,248,0.07)',  border: 'rgba(56,189,248,0.28)',  label: 'MINOR',    icon: faCircleInfo },
};

const CAT_LABELS = {
  location:  '📍 Location Mismatch',
  timeline:  '🕐 Timeline Mismatch',
  statement: '📢 Statement Contradiction',
  financial: '💰 Financial Discrepancy',
  identity:  '👤 Identity Mismatch',
  other:     '❓ Inconsistency',
};

function ContradictionCard({ c, onStatusChange }) {
  const [updating, setUpdating] = useState(false);
  const sev = SEV[c.severity] || SEV.moderate;
  const closed = c.status === 'closed';

  return (
    <div style={{
      border: `1px solid ${closed ? 'var(--border)' : sev.border}`,
      borderLeft: `4px solid ${closed ? '#374151' : sev.color}`,
      borderRadius: 8, background: closed ? 'var(--bg)' : sev.bg,
      opacity: closed ? 0.6 : 1, marginBottom: 16, padding: '16px 20px', transition: 'all 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ background: sev.color, color: '#0a0a0a', fontWeight: 800, fontSize: 10, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 4 }}>
            <FA icon={sev.icon} style={{ marginRight: 4 }} />{sev.label}
          </span>
          <span style={{ fontSize: 11, padding: '1px 8px', background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}>
            {CAT_LABELS[c.category] || c.category}
          </span>
          {closed
            ? <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}><FA icon={faCheckCircle} style={{ marginRight: 3 }} />Resolved</span>
            : <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}><FA icon={faCircleXmark} style={{ marginRight: 3 }} />Open</span>
          }
        </div>
        {!closed ? (
          <Button size="small" type="primary" ghost loading={updating}
            onClick={() => { setUpdating(true); onStatusChange(c.id, 'closed'); setUpdating(false); }}
            style={{ fontSize: 11, color: 'var(--accent-hover)', borderColor: 'var(--accent)' }}>
            <FA icon={faCheckCircle} style={{ marginRight: 4 }} />Mark Resolved
          </Button>
        ) : (
          <Button size="small" ghost loading={updating}
            onClick={() => onStatusChange(c.id, 'open')}
            style={{ fontSize: 11, color: 'var(--text)', borderColor: 'var(--border)' }}>Reopen</Button>
        )}
      </div>

      <h5 style={{ margin: '0 0 10px', color: 'var(--text-h)', fontSize: 14, lineHeight: 1.45 }}>{c.title}</h5>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text)', lineHeight: 1.65 }}>{c.description}</p>

      {/* Side-by-side comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#f87171', display: 'block', marginBottom: 6, letterSpacing: '0.06em' }}>
            <FA icon={faFileLines} style={{ marginRight: 4 }} />CLAIMS (A)
          </span>
          <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.55 }}>{c.document_a}</span>
        </div>
        <div style={{ textAlign: 'center', minWidth: 40 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: sev.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 900, fontSize: 11, margin: '0 auto' }}>
            VS
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.25)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: 6, letterSpacing: '0.06em' }}>
            <FA icon={faFileLines} style={{ marginRight: 4 }} />CONTRADICTS (B)
          </span>
          <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.55 }}>{c.document_b}</span>
        </div>
      </div>

      {c.significance && (
        <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--code-bg)', border: '1px solid var(--border)', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: 4, letterSpacing: '0.06em' }}>WHY THIS MATTERS</span>
          <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{c.significance}</span>
        </div>
      )}
      {c.recommended_action && (
        <div style={{ padding: '10px 14px', borderRadius: 6, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.25)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-hover)', display: 'block', marginBottom: 4, letterSpacing: '0.06em' }}>
            <FA icon={faPen} style={{ marginRight: 5 }} />RECOMMENDED ACTION
          </span>
          <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{c.recommended_action}</span>
        </div>
      )}
    </div>
  );
}

export default function ContradictionsView({ caseId, headers }) {
  const [raw, setRaw] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [sevFilter, setSevFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');

  const load = () => {
    setLoading(true);
    fetch(`/api/analysis/cases/${caseId}/contradictions`, { headers })
      .then(r => r.json())
      .then(d => { setData(d); setRaw(d.contradictions || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, [caseId]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const r = await (await fetch(`/api/analysis/cases/${caseId}/scan`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } })).json();
      message.success(`AI scan — ${r.contradictions?.length || 0} contradictions detected`);
      load();
    } catch { message.error('Scan failed.'); }
    setScanning(false);
  };

  const onStatusChange = (id, status) => setRaw(prev => prev.map(c => c.id === id ? { ...c, status } : c));

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /><div style={{ marginTop: 14, color: 'var(--text-dim)', fontSize: 13 }}>Loading contradiction analysis...</div></div>;

  const filtered = raw.filter(c =>
    (sevFilter === 'all' || c.severity === sevFilter) &&
    (statusFilter === 'all' || c.status === statusFilter)
  );

  const critOpen = raw.filter(c => c.severity === 'critical' && c.status !== 'closed').length;
  const resolved = raw.filter(c => c.status === 'closed').length;

  return (
    <div style={{ padding: 22 }}>
      <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-h)' }}>
            <FA icon={faTriangleExclamation} style={{ color: '#f87171' }} />
            Contradiction Detector
            <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-dim)' }}>({data?.total || 0} detected, {data?.critical || 0} critical)</span>
          </h4>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>Cross-document inconsistencies — requires IO review before use in court</p>
        </div>
        <Button danger loading={scanning} onClick={handleScan}
          style={{ color: '#fff', background: '#dc2626', border: 'none', fontWeight: 600 }}>
          <FA icon={faArrowsRotate} style={{ marginRight: 6 }} spin={scanning} />
          Re-Scan Documents
        </Button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Critical', value: critOpen, color: '#f87171' },
          { label: 'Moderate', value: raw.filter(c => c.severity === 'moderate' && c.status !== 'closed').length, color: '#fbbf24' },
          { label: 'Resolved', value: resolved, color: '#4ade80' },
          { label: 'Total', value: raw.length, color: '#60a5fa' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {critOpen > 0 && (
        <Alert type="error" showIcon icon={<FA icon={faCircleExclamation} />}
          message={`${critOpen} Critical Contradiction${critOpen > 1 ? 's' : ''} — Immediate Review Required`}
          description="Critical contradictions indicate direct provable alibi failures or lies by accused/witnesses. Use in next interrogation."
          style={{ marginBottom: 16 }}
        />
      )}
      <Alert type="info" showIcon icon={<FA icon={faShieldHalved} />}
        message="AI-Detected Contradictions — Advisory Only"
        description="Verify each contradiction against original source documents before use in any legal proceeding."
        style={{ marginBottom: 18 }}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Severity:</span>
        {['all', 'critical', 'moderate', 'minor'].map(s => (
          <button key={s} onClick={() => setSevFilter(s)} style={{
            padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${sevFilter === s ? (SEV[s]?.color || 'var(--accent)') : 'var(--border)'}`,
            background: sevFilter === s ? (SEV[s] ? SEV[s].bg : 'var(--accent-bg)') : 'transparent',
            color: sevFilter === s ? (SEV[s]?.color || 'var(--accent-hover)') : 'var(--text)',
            textTransform: 'capitalize', transition: 'all 0.15s',
          }}>{s}</button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Status:</span>
        {['all', 'open', 'closed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${statusFilter === s ? 'var(--accent)' : 'var(--border)'}`,
            background: statusFilter === s ? 'var(--accent-bg)' : 'transparent',
            color: statusFilter === s ? 'var(--accent-hover)' : 'var(--text)',
            textTransform: 'capitalize', transition: 'all 0.15s',
          }}>{s}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty description={
          raw.length === 0
            ? <span style={{ color: 'var(--text-dim)' }}>No contradictions yet. Upload documents and click "Re-Scan".</span>
            : <span style={{ color: 'var(--text-dim)' }}>No contradictions match current filters.</span>
        } />
      ) : filtered.map(c => <ContradictionCard key={c.id} c={c} onStatusChange={onStatusChange} />)}
    </div>
  );
}
