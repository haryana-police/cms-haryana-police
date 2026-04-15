import React, { useState, useEffect } from 'react';

const CATEGORY_CONFIG = {
    registration: { color: '#10b981', bg: 'var(--bg)', label: 'Registration', icon: 'fa-solid fa-file-signature' },
    statement: { color: '#3b82f6', bg: 'var(--bg)', label: 'Statement', icon: 'fa-solid fa-comments' },
    evidence: { color: '#f59e0b', bg: 'var(--bg)', label: 'Evidence', icon: 'fa-solid fa-magnifying-glass' },
    arrest: { color: '#ef4444', bg: 'var(--bg)', label: 'Arrest', icon: 'fa-solid fa-handcuffs' },
    raid: { color: '#8b5cf6', bg: 'var(--bg)', label: 'Raid', icon: 'fa-solid fa-house-chimney-crack' },
    challan: { color: '#6366f1', bg: 'var(--bg)', label: 'Challan', icon: 'fa-solid fa-scale-balanced' },
};

const DEFAULT = { color: 'var(--text)', bg: 'var(--bg)', label: 'Event', icon: 'fa-solid fa-thumbtack' };

function formatDate(dt) {
    return new Date(dt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function TimelineView({ caseId, headers }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/analysis/cases/${caseId}/timeline`, { headers })
            .then(r => r.json())
            .then(data => { setEvents(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [caseId]);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <div style={{ textAlign: 'center', color: 'var(--text)' }}>
                <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                Loading timeline...
            </div>
        </div>
    );

    if (events.length === 0) return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text)' }}>
            <i className="fa-regular fa-calendar-xmark" style={{ fontSize: '2rem', display: 'block', marginBottom: 12 }}></i>
            No events recorded for this case yet.
        </div>
    );

    return (
        <div style={{ padding: '24px 32px' }}>
            <h3 style={{ margin: '0 0 24px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-h)', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <i className="fa-regular fa-calendar-days" style={{ marginRight: 8 }}></i>
                Case Timeline — {events.length} events
            </h3>

            <div style={{ position: 'relative' }}>
                {/* Vertical line */}
                <div style={{ position: 'absolute', left: 28, top: 0, bottom: 0, width: 2, background: 'linear-gradient(to bottom, var(--accent), var(--border))' }} />

                {events.map((evt, idx) => {
                    const cfg = CATEGORY_CONFIG[evt.category] || DEFAULT;
                    return (
                        <div key={evt.id} style={{ display: 'flex', gap: 20, marginBottom: 24, position: 'relative' }}>
                            {/* Icon dot */}
                            <div style={{
                                width: 56, height: 56, minWidth: 56,
                                borderRadius: '50%',
                                background: cfg.bg,
                                border: `2px solid ${cfg.color}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: cfg.color,
                                fontSize: 20, zIndex: 1,
                                boxShadow: `0 0 0 4px var(--bg)`,
                            }}>
                                <i className={cfg.icon}></i>
                            </div>

                            {/* Content card */}
                            <div style={{
                                flex: 1,
                                background: 'var(--code-bg)',
                                border: `1px solid var(--border)`,
                                borderLeft: `4px solid ${cfg.color}`,
                                borderRadius: 10,
                                padding: '14px 16px',
                                boxShadow: 'var(--shadow)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{
                                        padding: '3px 10px', borderRadius: 20,
                                        background: 'var(--bg)', color: cfg.color,
                                        fontSize: '0.7rem', fontWeight: 700,
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                        border: `1px solid var(--border)`,
                                    }}>
                                        {cfg.label}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text)' }}>
                                        {formatDate(evt.event_time)}
                                    </span>
                                </div>
                                <p style={{ margin: '8px 0', fontSize: '0.9rem', color: 'var(--text-h)', lineHeight: 1.5 }}>
                                    {evt.description}
                                </p>
                                {(evt.officer_name || evt.location) && (
                                    <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text)', marginTop: 8 }}>
                                        {evt.officer_name && <span><i className="fa-solid fa-user-shield" style={{ marginRight: 6 }}></i>{evt.officer_name}</span>}
                                        {evt.location && <span><i className="fa-solid fa-location-dot" style={{ marginRight: 6 }}></i>{evt.location}</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
