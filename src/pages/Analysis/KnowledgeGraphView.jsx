import React, { useState, useEffect, useCallback } from 'react';

const NODE_COLORS = {
    case: '#6366f1',
    accused: '#ef4444',
    victim: '#10b981',
    witness: '#f59e0b',
    event: '#3b82f6',
};

const NODE_LABELS = {
    case: 'Case',
    accused: 'Accused',
    victim: 'Victim',
    witness: 'Witness',
    event: 'Event',
};

let ForceGraph2D;

export default function KnowledgeGraphView({ caseId, headers }) {
    const [graphData, setGraphData] = useState(null);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ForceGraphComp, setForceGraphComp] = useState(null);

    useEffect(() => {
        import('react-force-graph-2d').then(mod => {
            setForceGraphComp(() => mod.default);
        });
    }, []);

    useEffect(() => {
        setLoading(true);
        setSelected(null);
        fetch(`/api/analysis/cases/${caseId}/graph`, { headers })
            .then(r => r.json())
            .then(data => { setGraphData(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [caseId]);

    const handleNodeClick = useCallback((node) => {
        setSelected(node);
    }, []);

    if (loading || !ForceGraphComp) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400, color: 'var(--text)', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Rendering knowledge graph...
        </div>
    );

    if (!graphData || graphData.nodes?.length === 0) return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text)' }}>
            <i className="fa-solid fa-project-diagram" style={{ fontSize: '2rem', display: 'block', marginBottom: 12 }}></i>
            No graph data for this case. Add persons and events to see relationships.
        </div>
    );

    return (
        <div style={{ display: 'flex', height: 560 }}>
            {/* Graph */}
            <div style={{ flex: 1, position: 'relative' }}>
                <div style={{
                    position: 'absolute', top: 12, left: 12, zIndex: 10,
                    background: 'var(--bg)', borderRadius: 10,
                    padding: '10px 14px', border: '1px solid var(--border)',
                    fontSize: '0.78rem', boxShadow: 'var(--shadow)',
                }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-h)', marginBottom: 8 }}>
                        <i className="fa-solid fa-layer-group" style={{ marginRight: 6 }}></i>Legend
                    </div>
                    {Object.entries(NODE_COLORS).map(([type, color]) => (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                            <span style={{ color: 'var(--text)' }}>{NODE_LABELS[type]}</span>
                        </div>
                    ))}
                    <div style={{ marginTop: 10, color: 'var(--text)', fontSize: '0.7rem', opacity: 0.8 }}>
                        <i className="fa-solid fa-info-circle" style={{ marginRight: 4 }}></i>Click a node for details
                    </div>
                </div>

                <ForceGraphComp
                    graphData={graphData}
                    width={selected ? undefined : undefined}
                    nodeLabel="label"
                    nodeColor={node => NODE_COLORS[node.type] || '#94a3b8'}
                    nodeVal={node => node.val || 5}
                    linkLabel="label"
                    linkDirectionalArrowLength={4}
                    linkDirectionalArrowRelPos={1}
                    linkColor={() => 'var(--text)'}
                    onNodeClick={handleNodeClick}
                    nodeCanvasObjectMode={() => 'after'}
                    nodeCanvasObject={(node, ctx, globalScale) => {
                        const label = node.label?.length > 18 ? node.label.slice(0, 18) + '…' : node.label;
                        const fontSize = Math.max(10 / globalScale, 3);
                        ctx.font = `${fontSize}px Inter, sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'top';
                        ctx.fillStyle = '#1e293b';
                        ctx.fillText(label, node.x, node.y + (node.val || 5) / 1.5 + 2);
                    }}
                    backgroundColor="var(--code-bg)"
                />
            </div>

            {/* Side panel */}
            {selected && (
                <div style={{
                    width: 260,
                    background: 'var(--bg)',
                    borderLeft: '1px solid var(--border)',
                    padding: 20,
                    overflowY: 'auto',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)' }}>
                            Node Details
                        </h4>
                        <button
                            onClick={() => setSelected(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 18, lineHeight: 1 }}
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: 'var(--code-bg)',
                        border: `1px solid ${NODE_COLORS[selected.type] || 'var(--border)'}`,
                        color: NODE_COLORS[selected.type] || 'var(--text)',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 16,
                    }}>
                        {NODE_LABELS[selected.type] || selected.type}
                    </div>

                    <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-h)', margin: '0 0 16px' }}>
                        {selected.label}
                    </p>

                    {selected.details && Object.entries(selected.details).map(([k, v]) => v && (
                        <div key={k} style={{ marginBottom: 12, fontSize: '0.85rem' }}>
                            <div style={{ color: 'var(--text)', textTransform: 'capitalize', marginBottom: 2, opacity: 0.8 }}>{k}</div>
                            <div style={{ color: 'var(--text-h)', fontWeight: 500, wordBreak: 'break-all' }}>{v}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
