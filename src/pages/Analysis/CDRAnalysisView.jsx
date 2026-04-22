import React, { useState, useEffect } from 'react';
import { Table, Input, Card, Row, Col, Tag, Typography, Spin, Empty, Alert, Badge, Tooltip, Tabs } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPhone, faMobileScreen, faNetworkWired, faHourglass, faSignal,
  faTriangleExclamation, faCircleExclamation, faMagnifyingGlass,
  faArrowRight, faLocationDot,
} from '@fortawesome/free-solid-svg-icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

const { Text } = Typography;
const FA = ({ icon, style }) => <FontAwesomeIcon icon={icon} style={style} />;

function formatTime(dt) {
  try { return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return dt || '—'; }
}
function formatDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const ROLE_COLORS = { accused: '#f87171', victim: '#4ade80', witness: '#fbbf24', default: '#60a5fa' };
const BAR_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#38bdf8', '#818cf8'];

export default function CDRAnalysisView({ caseId, headers }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('records');

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/analysis/cases/${caseId}/cdr`, { headers })
      .then(r => { if (!r.ok) throw new Error(`Server error ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setData(null); setLoading(false); });
  }, [caseId]);

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /><div style={{ marginTop: 14, color: 'var(--text-dim)', fontSize: 13 }}>Loading CDR records...</div></div>;
  if (error || !data?.records?.length) return (
    <div style={{ padding: '80px 40px' }}>
      <Empty description={<span style={{ color: 'var(--text-dim)', fontSize: 13 }}>No CDR data. Upload CDR records (CSV) via AI Insights tab.{error ? <><br /><code style={{ fontSize: 11 }}>{error}</code></> : null}</span>} />
    </div>
  );

  const { records, frequency = [], suspiciousPatterns = [], phoneToPersonMap = {} } = data;
  const filtered = records.filter(r => !search || (r.caller || '').includes(search) || (r.receiver || '').includes(search) || (r.tower_location || '').toLowerCase().includes(search.toLowerCase()));

  const uniqueNums = new Set([...records.map(r => r.caller), ...records.map(r => r.receiver)]).size;
  const uniqueTowers = new Set(records.map(r => r.tower_id).filter(Boolean)).size;
  const avgDur = records.length ? Math.round(records.reduce((s, r) => s + (r.duration_sec || 0), 0) / records.length) : 0;

  // Tower movements
  const towerMov = {};
  records.forEach(r => {
    if (!r.tower_id) return;
    if (!towerMov[r.caller]) towerMov[r.caller] = [];
    const last = towerMov[r.caller][towerMov[r.caller].length - 1];
    if (!last || last.tower_id !== r.tower_id) towerMov[r.caller].push({ tower_id: r.tower_id, location: r.tower_location, time: r.call_time });
  });

  function PersonTag({ number }) {
    const p = phoneToPersonMap[number];
    if (!p) return null;
    return <Tag color="default" style={{ fontSize: 10, background: 'var(--code-bg)', border: '1px solid var(--border)', color: ROLE_COLORS[p.role] || 'var(--text)', marginTop: 2 }}>{p.name}</Tag>;
  }

  const callCols = [
    { title: '#', render: (_, __, i) => <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{i + 1}</span>, width: 44 },
    {
      title: 'Caller', dataIndex: 'caller', width: 160,
      render: t => <div><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#f87171' }}>{t}</span><br /><PersonTag number={t} /></div>
    },
    {
      title: 'Receiver', dataIndex: 'receiver', width: 160,
      render: t => <div><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>{t}</span><br /><PersonTag number={t} /></div>
    },
    { title: 'Duration', dataIndex: 'duration_sec', width: 90, render: s => <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>{formatDuration(s)}</span> },
    { title: 'Date & Time', dataIndex: 'call_time', width: 160, render: t => <span style={{ fontSize: 12, color: 'var(--text)' }}>{formatTime(t)}</span> },
    {
      title: 'Tower', dataIndex: 'tower_id', width: 140,
      render: (v, row) => v ? <Tooltip title={row.tower_location}><Tag style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent-hover)', fontSize: 11 }}><FA icon={faLocationDot} style={{ marginRight: 4 }} />{v}</Tag></Tooltip> : <span style={{ color: 'var(--text-dim)' }}>—</span>
    },
    { title: 'Location', dataIndex: 'tower_location', render: t => <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t || '—'}</span> },
  ];

  const tabItems = [
    {
      key: 'records',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><FA icon={faPhone} />Call Records</span>,
      children: (
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <Input placeholder="Search number or tower..." size="small" style={{ width: 240 }}
              prefix={<FA icon={faMagnifyingGlass} style={{ color: 'var(--text-dim)', fontSize: 11 }} />}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Table dataSource={filtered} columns={callCols} rowKey="id" size="small"
            pagination={{ pageSize: 12, showSizeChanger: true, showTotal: t => <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{t} records</span> }}
            scroll={{ x: 'max-content' }}
          />
        </div>
      ),
    },
    {
      key: 'frequency',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><FA icon={faSignal} />Frequency</span>,
      children: (
        <div style={{ padding: 16 }}>
          <h5 style={{ color: 'var(--text-h)', marginBottom: 16 }}>Call Frequency per Number (Top 15)</h5>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={frequency} margin={{ top: 10, right: 20, left: 0, bottom: 65 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="number" stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} angle={-35} textAnchor="end" height={70} />
              <YAxis stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} allowDecimals={false} />
              <RechartsTooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                formatter={(v, _, p) => {
                  const person = phoneToPersonMap[p.payload.number];
                  return [v + ' calls' + (person ? ` (${person.name})` : ''), ''];
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={52}>
                {frequency.map((e, i) => {
                  const p = phoneToPersonMap[e.number];
                  return <Cell key={i} fill={p ? (ROLE_COLORS[p.role] || '#60a5fa') : BAR_COLORS[i % BAR_COLORS.length]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            {[['#f87171', 'Accused'], ['#4ade80', 'Victim'], ['#fbbf24', 'Witness'], ['#60a5fa', 'Unknown']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'patterns',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <FA icon={faTriangleExclamation} style={{ color: suspiciousPatterns.length ? '#f87171' : 'inherit' }} />
          Suspicious Patterns
          {suspiciousPatterns.length > 0 && <span style={{ background: '#f87171', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '0 5px', lineHeight: '16px', marginLeft: 3 }}>{suspiciousPatterns.length}</span>}
        </span>
      ),
      children: (
        <div style={{ padding: 16 }}>
          {suspiciousPatterns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>No suspicious patterns detected in current CDR data.</div>
          ) : (
            <>
              <Alert type="warning" showIcon icon={<FA icon={faTriangleExclamation} />}
                message={`${suspiciousPatterns.length} Suspicious Pattern${suspiciousPatterns.length > 1 ? 's' : ''} Detected`}
                description="Patterns are algorithmically detected. IO must verify before use."
                style={{ marginBottom: 16 }}
              />
              {suspiciousPatterns.map((p, i) => (
                <div key={i} style={{
                  marginBottom: 12, padding: '14px 16px', borderRadius: 8,
                  border: `1px solid ${p.severity === 'high' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)'}`,
                  borderLeft: `4px solid ${p.severity === 'high' ? '#f87171' : '#fbbf24'}`,
                  background: p.severity === 'high' ? 'rgba(248,113,113,0.06)' : 'rgba(251,191,36,0.06)',
                }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ background: p.severity === 'high' ? '#f87171' : '#fbbf24', color: '#0a0a0a', fontWeight: 800, fontSize: 10, padding: '2px 8px', borderRadius: 4 }}>
                      <FA icon={p.severity === 'high' ? faCircleExclamation : faTriangleExclamation} style={{ marginRight: 4 }} />
                      {p.severity === 'high' ? 'HIGH RISK' : 'MEDIUM'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize' }}>{(p.type || '').replace(/_/g, ' ')}</span>
                    {p.time && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{formatTime(p.time)}</span>}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{p.description}</span>
                  {p.numbers?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700 }}>NUMBERS: </span>
                      {p.numbers.map(n => {
                        const person = phoneToPersonMap[n];
                        return <span key={n} style={{ fontFamily: 'var(--mono)', fontSize: 11, marginRight: 6, color: person?.role === 'accused' ? '#f87171' : 'var(--text)' }}>{n}{person ? ` (${person.name})` : ''}</span>;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      ),
    },
    {
      key: 'movement',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><FA icon={faLocationDot} />Tower Movement</span>,
      children: (
        <div style={{ padding: 16 }}>
          <h5 style={{ color: 'var(--text-h)', marginBottom: 16 }}>Cell Tower Movement (Location Tracking)</h5>
          {Object.keys(towerMov).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>No tower data available.</div>
          ) : Object.entries(towerMov).map(([number, towers]) => {
            const person = phoneToPersonMap[number];
            return (
              <div key={number} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-h)' }}>{number}</span>
                  {person && <Tag style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', color: ROLE_COLORS[person.role] || 'var(--text)', fontSize: 11 }}>{person.name} · {person.role}</Tag>}
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{towers.length} hop{towers.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {towers.map((t, i) => (
                    <React.Fragment key={i}>
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--code-bg)', border: '1px solid var(--border)', textAlign: 'center', minWidth: 100 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-hover)', marginBottom: 3 }}>{t.tower_id}</div>
                        <div style={{ fontSize: 11, color: 'var(--text)' }}>{t.location}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{formatTime(t.time)}</div>
                      </div>
                      {i < towers.length - 1 && <FA icon={faArrowRight} style={{ color: 'var(--text-dim)', fontSize: 14 }} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ),
    },
  ];

  const stat = (icon, label, value, color) => (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <FA icon={icon} style={{ color }} /> {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding: 22 }}>
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-h)' }}>
          <FA icon={faSignal} style={{ color: 'var(--accent)' }} />
          CDR Analysis
          <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-dim)' }}>({records.length} records)</span>
          {suspiciousPatterns.length > 0 && <span style={{ background: '#f87171', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 8, padding: '1px 8px' }}><FA icon={faTriangleExclamation} style={{ marginRight: 4 }} />{suspiciousPatterns.length} suspicious</span>}
        </h4>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {stat(faPhone, 'Total Calls', records.length, '#60a5fa')}
        {stat(faMobileScreen, 'Unique Numbers', uniqueNums, '#4ade80')}
        {stat(faNetworkWired, 'Cell Towers', uniqueTowers, '#fbbf24')}
        {stat(faHourglass, 'Avg Duration', `${avgDur}s`, '#a78bfa')}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="small"
        tabBarStyle={{ background: 'var(--code-bg)', borderBottom: '1px solid var(--border)', borderRadius: '8px 8px 0 0', paddingLeft: 8 }}
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}
      />
    </div>
  );
}
