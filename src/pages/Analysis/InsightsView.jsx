import React, { useState, useEffect } from 'react';

const PAGE_ICONS = {
    index: 'fa-solid fa-list',
    entities: 'fa-solid fa-users',
    timeline: 'fa-regular fa-calendar-days',
    leads: 'fa-solid fa-magnifying-glass',
    contradictions: 'fa-solid fa-triangle-exclamation',
    log: 'fa-solid fa-scroll',
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

function MarkdownRenderer({ content }) {
    const lines = content.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith('## ')) {
            elements.push(
                <h4 key={i} style={{ margin: '18px 0 8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                    {renderInline(line.slice(3))}
                </h4>
            );
        } else if (line.startsWith('# ')) {
            elements.push(
                <h3 key={i} style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-h)' }}>
                    {renderInline(line.slice(2))}
                </h3>
            );
        } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
            const checked = line.startsWith('- [x]');
            elements.push(
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '6px 0' }}>
                    <i className={checked ? 'fa-solid fa-square-check' : 'fa-regular fa-square'} style={{ marginTop: 3, fontSize: '1.1rem', color: checked ? 'var(--text)' : 'var(--text)' }}></i>
                    <span style={{ fontSize: '0.9rem', color: checked ? 'var(--text)' : 'var(--text-h)', textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.6 : 1 }}>
                        {renderInline(line.slice(6))}
                    </span>
                </div>
            );
        } else if (line.startsWith('- ')) {
            elements.push(
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                    <i className="fa-solid fa-circle" style={{ color: 'var(--accent)', marginTop: 6, fontSize: '0.4rem' }}></i>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.6 }}>{renderInline(line.slice(2))}</span>
                </div>
            );
        } else if (line.startsWith('|')) {
            // Table
            elements.push(
                <div key={i} style={{ overflowX: 'auto', margin: '16px 0', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem', width: '100%', background: 'var(--code-bg)' }}>
                        <tbody>
                            {lines.slice(i).filter((l, li) => l.startsWith('|') && li === 0 || (l.startsWith('|') && !l.match(/^\|[-| ]+\|$/))).slice(0, 20).map((row, ri) => (
                                <tr key={ri} style={{ borderBottom: '1px solid var(--border)', background: ri === 0 ? 'var(--bg)' : 'transparent' }}>
                                    {row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1).map((cell, ci) => (
                                        <td key={ci} style={{ padding: '10px 14px', borderRight: '1px solid var(--border)', fontWeight: ri === 0 ? 600 : 400, color: ri === 0 ? 'var(--text-h)' : 'var(--text)' }}>
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
            elements.push(
                <p key={i} style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.7 }}>
                    {renderInline(line)}
                </p>
            );
        }
        i++;
    }

    return <div>{elements}</div>;
}

function renderInline(text) {
    const parts = text.split(/(\*\*[^*]+\*\*|\[.*?\]\(.*?\)|⚠️|✅|⬜)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ color: 'var(--text-h)' }}>{part.slice(2, -2)}</strong>;
        }
        if (part.match(/^\[.*?\]\(.*?\)$/)) {
            const label = part.match(/\[(.*?)\]/)[1];
            return <span key={i} style={{ color: 'var(--accent)', fontWeight: 600 }}>{label}</span>;
        }
        if (part === '⚠️') return <i key={i} className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b', marginRight: 6 }}></i>;
        if (part === '✅') return <i key={i} className="fa-solid fa-check" style={{ color: '#10b981', marginRight: 6 }}></i>;
        if (part === '⬜') return <i key={i} className="fa-solid fa-minus" style={{ color: 'var(--text)', marginRight: 6 }}></i>;
        return part;
    });
}

export default function InsightsView({ caseId, headers }) {
    const [wikiData, setWikiData] = useState(null);
    const [activePage, setActivePage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [queryResult, setQueryResult] = useState(null);
    const [querying, setQuerying] = useState(false);
    const [ingestText, setIngestText] = useState('');
    const [ingestType, setIngestType] = useState('FIR');
    const [ingesting, setIngesting] = useState(false);
    const [ingestResult, setIngestResult] = useState(null);

    const fetchWiki = () => {
        setLoading(true);
        fetch(`/api/analysis/cases/${caseId}/wiki`, { headers })
            .then(r => r.json())
            .then(data => {
                setWikiData(data);
                const sorted = sortPages(data.pages || []);
                setActivePage(sorted[0]?.page_slug || null);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchWiki();
        setQueryResult(null);
        setIngestResult(null);
    }, [caseId]);

    const handleQuery = async () => {
        if (!query.trim()) return;
        setQuerying(true);
        setQueryResult(null);
        try {
            const res = await fetch(`/api/analysis/cases/${caseId}/query`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: query }),
            });
            const data = await res.json();
            setQueryResult(data);
        } catch {
            setQueryResult({ answer: 'Query failed. Please try again.', sourcedFrom: [] });
        }
        setQuerying(false);
    };

    const handleIngest = async () => {
        if (!ingestText.trim()) return;
        setIngesting(true);
        setIngestResult(null);
        try {
            const res = await fetch(`/api/analysis/cases/${caseId}/ingest`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ doc_type: ingestType, content: ingestText }),
            });
            const data = await res.json();
            setIngestResult(data);
            setIngestText('');
            fetchWiki(); // Refresh wiki
        } catch {
            setIngestResult({ success: false });
        }
        setIngesting(false);
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: 'var(--text)', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Loading case intelligence wiki...
        </div>
    );

    const pages = sortPages(wikiData?.pages || []);
    const lint = wikiData?.lint;
    const currentPageContent = pages.find(p => p.page_slug === activePage)?.content_md || '';

    return (
        <div style={{ display: 'flex', height: 640, overflow: 'hidden' }}>

            {/* Left: Wiki Navigation */}
            <div style={{ width: 220, background: 'var(--code-bg)', borderRight: '1px solid var(--border)', padding: '20px 0', overflowY: 'auto', flexShrink: 0 }}>
                <div style={{ padding: '0 18px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <i className="fa-solid fa-folder-tree" style={{ marginRight: 8 }}></i>Wiki Pages
                </div>
                {pages.map(p => (
                    <button
                        key={p.page_slug}
                        onClick={() => setActivePage(p.page_slug)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '12px 18px', border: 'none', cursor: 'pointer',
                            background: activePage === p.page_slug ? 'var(--accent-bg)' : 'transparent',
                            borderRight: activePage === p.page_slug ? '3px solid var(--accent)' : '3px solid transparent',
                            color: activePage === p.page_slug ? 'var(--accent)' : 'var(--text)',
                            fontWeight: activePage === p.page_slug ? 600 : 400,
                            fontSize: '0.9rem',
                            transition: 'all 0.15s',
                        }}
                    >
                        <i className={PAGE_ICONS[p.page_slug] || 'fa-solid fa-file-lines'} style={{ width: 16, textAlign: 'center' }}></i>
                        <span style={{ textTransform: 'capitalize' }}>{p.page_slug}</span>
                    </button>
                ))}
                {pages.length === 0 && (
                    <div style={{ padding: '16px 18px', fontSize: '0.8rem', color: 'var(--text)', opacity: 0.7 }}>
                        No wiki pages yet.<br /><br />Ingest a document to start building the knowledge base.
                    </div>
                )}

                {/* Lint / Health check */}
                {lint && lint.missingPages?.length > 0 && (
                    <div style={{ margin: '20px 14px 0', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: '12px 14px', fontSize: '0.8rem', color: '#b45309' }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>
                            <i className="fa-solid fa-heart-pulse" style={{ marginRight: 6 }}></i>Health Check
                        </div>
                        {lint.suggestions.map((s, i) => <div key={i} style={{ marginBottom: 4 }}>• {s}</div>)}
                    </div>
                )}
            </div>

            {/* Centre: Wiki Page Viewer */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
                {/* Karpathy attribution banner */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(124, 58, 237, 0.05))',
                    padding: '12px 24px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
                }}>
                    <i className="fa-solid fa-dna" style={{ fontSize: '1.4rem', color: 'var(--accent)' }}></i>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-h)', letterSpacing: '0.05em' }}>
                            LLM WIKI — Karpathy Docs-to-Knowledge-Graph Pattern
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text)', marginTop: 2 }}>
                            Knowledge compiled once & kept current · Not re-derived on every query
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <span style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', color: 'var(--text)', fontWeight: 600 }}>
                            <i className="fa-solid fa-file-invoice" style={{ marginRight: 6 }}></i>{pages.length} wiki pages
                        </span>
                    </div>
                </div>

                {/* Wiki page content */}
                <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
                    {currentPageContent
                        ? <MarkdownRenderer content={currentPageContent} />
                        : <div style={{ color: 'var(--text)', textAlign: 'center', paddingTop: 60, opacity: 0.6 }}>
                            <i className="fa-solid fa-file-circle-question" style={{ fontSize: '2rem', display: 'block', marginBottom: 12 }}></i>
                            Select a wiki page
                        </div>
                    }
                </div>

                {/* AI Query Bar */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', flexShrink: 0, background: 'var(--code-bg)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 8 }}></i>Query the Wiki
                    </div>
                    {queryResult && (
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10,
                            padding: '16px', marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-h)',
                            lineHeight: 1.6,
                        }}>
                            <div style={{ fontWeight: 700, marginBottom: 8, color: '#10b981', display: 'flex', alignItems: 'center' }}>
                                <i className="fa-solid fa-robot" style={{ marginRight: 8, fontSize: '1.1rem' }}></i>
                                AI Response
                                <span style={{ fontWeight: 500, color: 'var(--text)', fontSize: '0.8rem', marginLeft: 8 }}>
                                    (synthesized from {queryResult.wikiPagesConsulted} wiki pages)
                                </span>
                            </div>
                            <p style={{ margin: 0 }}>{queryResult.answer}</p>
                            {queryResult.sourcedFrom?.length > 0 && (
                                <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                    <i className="fa-solid fa-book-open" style={{ marginRight: 6 }}></i>
                                    Sources: {queryResult.sourcedFrom.map(s => `[${s}]`).join(' ')}
                                </div>
                            )}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <input
                            type="text"
                            placeholder='e.g. "Who are the key suspects?" or "Any contradictions in statements?"'
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleQuery()}
                            style={{
                                flex: 1, padding: '12px 16px', border: '1.5px solid var(--border)',
                                borderRadius: 8, fontSize: '0.9rem', outline: 'none',
                                background: 'var(--bg)', color: 'var(--text-h)'
                            }}
                        />
                        <button
                            onClick={handleQuery}
                            disabled={querying || !query.trim()}
                            style={{
                                padding: '0 24px', background: querying ? 'var(--border)' : 'var(--accent)',
                                color: querying ? 'var(--text)' : '#fff', border: 'none', borderRadius: 8,
                                fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8
                            }}
                        >
                            {querying ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                            {querying ? 'Thinking...' : 'Ask AI'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right: Ingest Panel */}
            <div style={{ width: 300, borderLeft: '1px solid var(--border)', background: 'var(--code-bg)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        <i className="fa-solid fa-inbox" style={{ marginRight: 8 }}></i>Ingest Document
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5, opacity: 0.9 }}>
                        Paste case documents here. The wiki engine will extract entities, events, and update knowledge pages.
                    </div>
                </div>

                <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <i className="fa-solid fa-file-lines"></i> Document Type
                        </label>
                        <select
                            value={ingestType}
                            onChange={e => setIngestType(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-h)' }}
                        >
                            {['FIR', 'Complaint', 'Witness Statement', 'Accused Statement', 'Seizure Memo', 'Arrest Memo', 'CDR Report', 'Forensic Report', 'Court Order'].map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <i className="fa-solid fa-align-left"></i> Document Text
                        </label>
                        <textarea
                            value={ingestText}
                            onChange={e => setIngestText(e.target.value)}
                            placeholder="Paste the full text of the document here..."
                            style={{
                                flex: 1, minHeight: 180,
                                padding: '12px', border: '1.5px solid var(--border)',
                                borderRadius: 8, fontSize: '0.85rem', resize: 'vertical',
                                outline: 'none', lineHeight: 1.6, color: 'var(--text-h)',
                                background: 'var(--bg)'
                            }}
                        />
                    </div>

                    {ingestResult && (
                        <div style={{
                            background: ingestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${ingestResult.success ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                            borderRadius: 8, padding: '12px 14px', fontSize: '0.85rem',
                            color: ingestResult.success ? '#10b981' : '#ef4444',
                        }}>
                            {ingestResult.success ? (
                                <>
                                    <div style={{ fontWeight: 700, marginBottom: 4 }}><i className="fa-solid fa-circle-check" style={{ marginRight: 6 }}></i>Ingested successfully</div>
                                    <div style={{ color: 'var(--text)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                                        Extracted {ingestResult.extracted?.entities?.length || 0} entities, {ingestResult.extracted?.events?.length || 0} events, {ingestResult.extracted?.contradictions?.length || 0} contradictions.
                                    </div>
                                </>
                            ) : <><i className="fa-solid fa-circle-xmark" style={{ marginRight: 6 }}></i>Ingest failed. Try again.</>}
                        </div>
                    )}

                    <button
                        onClick={handleIngest}
                        disabled={ingesting || !ingestText.trim()}
                        style={{
                            padding: '14px', background: ingesting ? 'var(--border)' : 'var(--accent)',
                            color: ingesting ? 'var(--text)' : '#fff', border: 'none', borderRadius: 8,
                            fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                        }}
                    >
                        {ingesting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                        {ingesting ? 'Processing...' : 'Ingest & Update Wiki'}
                    </button>
                </div>
            </div>
        </div>
    );
}
