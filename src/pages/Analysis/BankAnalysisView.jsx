import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Input, Tag, Typography, Spin, Empty, Alert, Select, Space, Tooltip } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faTriangleExclamation, faMagnifyingGlass, faArrowDown, faArrowUp,
  faCircleExclamation, faShieldHalved, faFileLines, faArrowsRotate,
} from '@fortawesome/free-solid-svg-icons';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const { Text } = Typography;
const FA = ({ icon, style }) => <FontAwesomeIcon icon={icon} style={style} />;

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SUSP_RED = '#f87171';
const CR_GREEN = '#4ade80';

export default function BankAnalysisView({ caseId, headers }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analysis/cases/${caseId}/bank`, { headers })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [caseId]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <Spin size="large" />
      <div style={{ marginTop: 14, color: 'var(--text-dim)', fontSize: 13 }}>Loading bank statement analysis...</div>
    </div>
  );
  if (error || !data?.transactions?.length) return (
    <div style={{ padding: '80px 40px' }}>
      <Empty description={<span style={{ color: 'var(--text-dim)', fontSize: 13 }}>No bank data. Upload a bank statement (CSV) via the AI Insights tab.</span>} />
    </div>
  );

  const { transactions, accounts, suspicious, totalDebit, totalCredit } = data;
  const filtered = transactions.filter(t => {
    const s = !search || (t.description || '').toLowerCase().includes(search.toLowerCase()) || (t.ref_no || '').toLowerCase().includes(search.toLowerCase());
    const a = accountFilter === 'all' || t.account_no === accountFilter;
    return s && a;
  });

  const dailyMap = {};
  transactions.forEach(t => {
    const date = t.date || 'Unknown';
    if (!dailyMap[date]) dailyMap[date] = { date, debit: 0, credit: 0 };
    dailyMap[date].debit += t.debit || 0;
    dailyMap[date].credit += t.credit || 0;
  });
  const chartData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  const accountOptions = [...new Set(transactions.map(t => t.account_no).filter(Boolean))];

  const columns = [
    { title: 'Date', dataIndex: 'date', width: 110, render: d => <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>{formatDate(d)}</span> },
    { title: 'Account', dataIndex: 'account_no', width: 110, render: (v, row) => <Tag color={row.is_suspicious ? 'error' : 'processing'} style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{v || '—'}</Tag> },
    {
      title: 'Description', dataIndex: 'description',
      render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {row.is_suspicious && <FA icon={faTriangleExclamation} style={{ color: SUSP_RED, flexShrink: 0 }} />}
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{v}</span>
        </div>
      )
    },
    { title: 'Debit', dataIndex: 'debit', width: 130, align: 'right', render: v => v ? <strong style={{ color: SUSP_RED, fontFamily: 'var(--mono)', fontSize: 13 }}>{fmt(v)}</strong> : <span style={{ color: 'var(--text-dim)' }}>—</span> },
    { title: 'Credit', dataIndex: 'credit', width: 130, align: 'right', render: v => v ? <strong style={{ color: CR_GREEN, fontFamily: 'var(--mono)', fontSize: 13 }}>{fmt(v)}</strong> : <span style={{ color: 'var(--text-dim)' }}>—</span> },
    { title: 'Balance', dataIndex: 'balance', width: 130, align: 'right', render: v => (v === null || v === undefined) ? <span style={{ color: 'var(--text-dim)' }}>—</span> : <span style={{ color: v < 0 ? SUSP_RED : 'var(--text-h)', fontFamily: 'var(--mono)', fontSize: 13 }}>{fmt(Math.abs(v))}{v < 0 ? ' OD' : ''}</span> },
    { title: 'Ref No.', dataIndex: 'ref_no', width: 160, render: v => <code style={{ fontSize: 11 }}>{v || '—'}</code> },
    { title: 'Flag', width: 60, align: 'center', render: (_, row) => row.is_suspicious ? <FA icon={faTriangleExclamation} style={{ color: SUSP_RED }} /> : <span style={{ color: CR_GREEN }}>✓</span> },
  ];

  const statStyle = { background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', borderRadius: 10 };

  return (
    <div style={{ padding: 22 }}>
      {/* Title */}
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-h)' }}>
          <FA icon={faBuilding} style={{ color: 'var(--accent)' }} />
          Bank Statement Analysis
          <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-dim)' }}>({transactions.length} transactions)</span>
        </h4>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>Financial trail — suspicious transactions flagged for investigative review</p>
      </div>

      {/* Stats */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Debited', value: totalDebit, color: SUSP_RED, icon: faArrowDown },
          { title: 'Total Credited', value: totalCredit, color: CR_GREEN, icon: faArrowUp },
          { title: 'Suspicious Txns', value: suspicious?.length || 0, color: '#fbbf24', icon: faTriangleExclamation },
          { title: 'Accounts Traced', value: accounts?.length || 0, color: '#a78bfa', icon: faBuilding },
        ].map(s => (
          <Col xs={12} sm={6} key={s.title}>
            <div style={{ ...statStyle, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FA icon={s.icon} style={{ color: s.color }} /> {s.title}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: s.title.includes('Txns') || s.title.includes('Accounts') ? 'inherit' : 'var(--mono)' }}>
                {s.title === 'Total Debited' || s.title === 'Total Credited' ? fmt(s.value) : s.value}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Suspicious Alert */}
      {suspicious?.length > 0 && (
        <Alert type="error" showIcon
          message={<span style={{ color: 'var(--text-h)', fontWeight: 600 }}><FA icon={faCircleExclamation} style={{ marginRight: 6 }} />{suspicious.length} Suspicious Transactions Detected</span>}
          description={
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {suspicious.slice(0, 3).map((t, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--text)', marginBottom: 3 }}>
                  <strong style={{ color: 'var(--text-h)' }}>{formatDate(t.date)}</strong> — {t.description} — <strong style={{ color: SUSP_RED }}>{fmt(t.debit || t.credit)}</strong> [A/C {t.account_no}]
                </li>
              ))}
              {suspicious.length > 3 && <li style={{ fontSize: 12, color: 'var(--text-dim)' }}>+{suspicious.length - 3} more…</li>}
            </ul>
          }
          style={{ marginBottom: 18 }}
        />
      )}

      {/* Chart */}
      <Card title={<span style={{ color: 'var(--text-h)', fontSize: 14 }}>Transaction Flow Timeline</span>} bordered={false} style={{ marginBottom: 20, background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="debitG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SUSP_RED} stopOpacity={0.25} />
                <stop offset="95%" stopColor={SUSP_RED} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="creditG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CR_GREEN} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CR_GREEN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
            <YAxis stroke="var(--text-dim)" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
            <RechartsTooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} formatter={(v, n) => [fmt(v), n === 'debit' ? 'Debit' : 'Credit']} />
            <Area type="monotone" dataKey="debit" stroke={SUSP_RED} fill="url(#debitG)" strokeWidth={2} />
            <Area type="monotone" dataKey="credit" stroke={CR_GREEN} fill="url(#creditG)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Table */}
      <Card
        title={<span style={{ color: 'var(--text-h)', fontSize: 14 }}>All Transactions</span>}
        bordered={false}
        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
        extra={
          <Space>
            <Select value={accountFilter} onChange={setAccountFilter} size="small" style={{ width: 130 }}>
              <Select.Option value="all">All Accounts</Select.Option>
              {accountOptions.map(a => <Select.Option key={a} value={a}>A/C {a}</Select.Option>)}
            </Select>
            <Input
              placeholder="Search..." size="small" style={{ width: 180 }}
              prefix={<FA icon={faMagnifyingGlass} style={{ color: 'var(--text-dim)', fontSize: 12 }} />}
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </Space>
        }
      >
        <Table dataSource={filtered} columns={columns} rowKey="id" size="small"
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{t} transactions</span> }}
          scroll={{ x: 'max-content' }}
          rowClassName={row => row.is_suspicious ? 'suspicious-row' : ''}
        />
      </Card>

      <Alert type="info" showIcon icon={<FA icon={faShieldHalved} />}
        style={{ marginTop: 16, fontSize: 12 }}
        message="Advisory Notice"
        description="Financial analysis is AI-assisted and advisory only. Verify all flagged transactions against original bank records before any legal proceedings."
      />
    </div>
  );
}
