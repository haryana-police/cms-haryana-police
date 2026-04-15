import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

function formatTime(dt) {
    return new Date(dt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

function formatDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const COLORS = ['#ef4444', '#f59e0b', '#6366f1', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function CDRAnalysisView({ caseId, headers }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch(`/api/analysis/cases/${caseId}/cdr`, { headers })
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [caseId]);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: 'var(--text)', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Loading CDR records...
        </div>
    );

    if (!data || data.records?.length === 0) return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text)' }}>
            <i className="fa-solid fa-file-invoice" style={{ fontSize: '2rem', display: 'block', marginBottom: 16 }}></i>
            No CDR records for this case. Upload CDR data via the Ingest tab.
        </div>
    );

    const filtered = data.records.filter(r =>
        !search ||
        r.caller.includes(search) ||
        r.receiver.includes(search) ||
        r.tower_location?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-h)', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <i className="fa-solid fa-tower-broadcast" style={{ marginRight: 8 }}></i>
                CDR Analysis — {data.records.length} records
            </h3>

            {/* Call Frequency Chart */}
            <div style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-h)', marginBottom: 4 }}>
                    <i className="fa-solid fa-chart-column" style={{ marginRight: 8 }}></i>Call Frequency per Number (Top 10)
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: 16, opacity: 0.8 }}>
                    Higher bars indicate more frequent communication — key indicator of network relationships
                </div>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.frequency} margin={{ top: 5, right: 10, bottom: 40, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                            dataKey="number"
                            tick={{ fontSize: 11, fill: 'var(--text)' }}
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                            stroke="var(--border)"
                        />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text)' }} allowDecimals={false} stroke="var(--border)" />
                        <Tooltip
                            formatter={(val) => [val, 'Total Calls']}
                            labelFormatter={(label) => `Number: ${label}`}
                            contentStyle={{ fontSize: '0.85rem', borderRadius: 8, background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-h)' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {data.frequency.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Total Calls', value: data.records.length, icon: 'fa-solid fa-phone-flip' },
                    { label: 'Unique Numbers', value: new Set([...data.records.map(r => r.caller), ...data.records.map(r => r.receiver)]).size, icon: 'fa-solid fa-mobile-screen' },
                    { label: 'Towers', value: new Set(data.records.map(r => r.tower_id).filter(Boolean)).size, icon: 'fa-solid fa-tower-cell' },
                    { label: 'Avg Duration', value: Math.round(data.records.reduce((s, r) => s + (r.duration_sec || 0), 0) / data.records.length) + 's', icon: 'fa-solid fa-stopwatch' },
                ].map(stat => (
                    <div key={stat.label} style={{
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '16px', textAlign: 'center',
                        boxShadow: 'var(--shadow)'
                    }}>
                        <div style={{ fontSize: '1.4rem', marginBottom: 8, color: 'var(--accent)' }}>
                            <i className={stat.icon}></i>
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-h)' }}>{stat.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* CDR Table */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-h)' }}>
                        <i className="fa-solid fa-table" style={{ marginRight: 8 }}></i>Call Records
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            type="text"
                            placeholder="Search number or tower..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: 240, padding: '8px 12px',
                                border: '1.5px solid var(--border)', borderRadius: 8,
                                fontSize: '0.85rem', outline: 'none', background: 'var(--code-bg)', color: 'var(--text-h)'
                            }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text)', opacity: 0.8 }}>{filtered.length} shown</span>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--code-bg)' }}>
                                {['#', 'Caller', 'Receiver', 'Duration', 'Date & Time', 'Tower', 'Location'].map(h => (
                                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-h)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r, i) => (
                                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'var(--code-bg)' : 'var(--bg)' }}>
                                    <td style={{ padding: '10px 14px', color: 'var(--text)', opacity: 0.7 }}>{i + 1}</td>
                                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#ef4444', fontFamily: 'var(--mono)' }}>{r.caller}</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', color: 'var(--text-h)' }}>{r.receiver}</td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{formatDuration(r.duration_sec)}</td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{formatTime(r.call_time)}</td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>{r.tower_id || '—'}</td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{r.tower_location || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
