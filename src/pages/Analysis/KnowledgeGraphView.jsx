import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Spin, Empty, Tag, Divider, Slider, Tooltip } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShareNodes, faCircleInfo, faXmark, faGear,
  faFileLines, faFilePdf, faFileContract, faLink,
  faCrosshairs, faMaximize, faBullseye,
  faUser, faUserTie, faUserCheck, faCalendarDays, faFileShield,
  faStar, faCircle,
} from '@fortawesome/free-solid-svg-icons';

const FA = ({ icon, style }) => <FontAwesomeIcon icon={icon} style={{ flexShrink: 0, ...style }} />;

// ── Dark-theme node palette ───────────────────────────────────────────────────
const NODES = {
  case:     { color: '#60a5fa', glow: 'rgba(96,165,250,0.35)',  label: 'Case',    icon: faFileShield },
  accused:  { color: '#f87171', glow: 'rgba(248,113,113,0.35)', label: 'Accused', icon: faUserTie },
  victim:   { color: '#4ade80', glow: 'rgba(74,222,128,0.35)',  label: 'Victim',  icon: faUser },
  witness:  { color: '#fbbf24', glow: 'rgba(251,191,36,0.35)',  label: 'Witness', icon: faUserCheck },
  event:    { color: '#c084fc', glow: 'rgba(192,132,252,0.35)', label: 'Event',   icon: faCalendarDays },
  evidence: { color: '#38bdf8', glow: 'rgba(56,189,248,0.35)',  label: 'Evidence',icon: faFileLines },
};

const DOC_REFS = {
  case:     { label: 'FIR / Complaint Copy',     icon: faFilePdf },
  accused:  { label: 'Accused Statement / Arrest Memo', icon: faFileContract },
  victim:   { label: 'Victim Statement',         icon: faFileContract },
  witness:  { label: 'Witness Statement',        icon: faFileContract },
  event:    { label: 'Case Diary / Evidence Log',icon: faFileLines },
  evidence: { label: 'Seizure Memo / Lab Report',icon: faFilePdf },
};

// ── Slider control row ────────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--accent-hover)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{value}</span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange}
        tooltip={{ open: false }}
        styles={{ track: { backgroundColor: 'var(--accent)' }, rail: { backgroundColor: 'var(--border)' }, handle: { borderColor: 'var(--accent)', backgroundColor: 'var(--accent)' } }}
      />
    </div>
  );
}

export default function KnowledgeGraphView({ caseId, headers, caseData }) {
  const [graphData, setGraphData]   = useState(null);
  const [selected, setSelected]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [ForceGraph, setForceGraph] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  // Slider state
  const [nodeSize,      setNodeSize]      = useState(6);
  const [linkDistance,  setLinkDistance]  = useState(100);
  const [linkThickness, setLinkThickness] = useState(1.5);
  const [centerForce,   setCenterForce]   = useState(0.35);
  const [repelForce,    setRepelForce]    = useState(160);

  const graphRef    = useRef(null);
  const containerRef = useRef(null);
  const graphContainerRef = useRef(null);
  const hasCentered = useRef(false);

  // Lazy-load ForceGraph2d
  useEffect(() => {
    import('react-force-graph-2d').then(m => setForceGraph(() => m.default));
  }, []);

  // Track container dimensions for responsive sizing
  useEffect(() => {
    if (!graphContainerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        // Avoid setting size to 0 if tab is hidden
        if (width > 0 && height > 0) {
          setContainerSize({ w: Math.floor(width), h: Math.floor(height) });
        }
      }
    });
    ro.observe(graphContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Fetch graph data
  useEffect(() => {
    setLoading(true); setSelected(null); hasCentered.current = false;
    fetch(`/api/analysis/cases/${caseId}/graph`, { headers })
      .then(r => r.json())
      .then(d => { setGraphData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [caseId]);

  // Apply slider forces imperatively
  useEffect(() => {
    if (!graphRef.current) return;
    const fg = graphRef.current;
    fg.d3Force('charge')?.strength(-repelForce);
    fg.d3Force('link')?.distance(linkDistance);
    fg.d3Force('center')?.strength(centerForce);
    fg.d3ReheatSimulation();
  }, [repelForce, linkDistance, centerForce]);

  // Auto-center after simulation stabilises, but ONLY ONCE
  const handleEngineStop = useCallback(() => {
    if (!hasCentered.current && graphRef.current) {
      graphRef.current.zoomToFit(500, 80);
      hasCentered.current = true;
    }
  }, []);

  const handleNodeClick = useCallback((node) => {
    setSelected(node);
    // Smooth pan to clicked node
    graphRef.current?.centerAt(node.x, node.y, 600);
    graphRef.current?.zoom(2.5, 600);
  }, []);

  // ── Canvas node renderer (label below node) ───────────────────────────────
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const cfg = NODES[node.type] || NODES.event;
    const r   = ((node.val || 5) * (nodeSize / 5));

    // Glow ring when selected
    if (selected?.id === node.id) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 5 / globalScale, 0, 2 * Math.PI);
      ctx.fillStyle = cfg.glow;
      ctx.fill();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = cfg.color;
    ctx.fill();

    // Subtle inner highlight
    ctx.beginPath();
    ctx.arc(node.x, node.y - r * 0.25, r * 0.4, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();

    // Label
    const label = node.label?.length > 20 ? node.label.slice(0, 20) + '…' : (node.label || '');
    const fontSize = Math.max(10 / globalScale, 2.5);
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // outline for readability on dark bg
    ctx.lineWidth = 3 / globalScale;
    ctx.strokeStyle = '#161923';
    ctx.strokeText(label, node.x, node.y + r + 3 / globalScale);
    ctx.fillStyle = '#f0f6fc';
    ctx.fillText(label, node.x, node.y + r + 3 / globalScale);
  }, [nodeSize, selected]);

  // ── Link color: accent for case-linked, dim for others ───────────────────
  const getLinkColor = useCallback((link) => {
    const src = typeof link.source === 'object' ? link.source.type : '';
    if (src === 'case') return 'rgba(96,165,250,0.45)';
    return 'rgba(100,116,139,0.3)';
  }, []);

  // ── Particle (directional arrow) only on meaningful links ───────────────
  const getArrowLength = useCallback((link) => {
    const src = typeof link.source === 'object' ? link.source.type : '';
    return (link.directed || src === 'case') ? 6 : 0;
  }, []);

  if (loading || !ForceGraph) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 520 }}>
      <Spin size="large" />
      <div style={{ marginTop: 16, color: 'var(--text-dim)', fontSize: 13 }}>Rendering knowledge graph…</div>
    </div>
  );

  if (!graphData?.nodes?.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 520 }}>
      <Empty description={<span style={{ color: 'var(--text-dim)' }}>No graph data. Add persons and events to see relationships.</span>} />
    </div>
  );

  const GRAPH_BG = '#0f1319';

  // Sidebar controls take width, but graphContainerRef exacts the canvas container size
  const canvasW = containerSize.w || 400;

  return (
    <div ref={containerRef} style={{ display: 'flex', width: '100%', height: '100%', minHeight: 580, overflow: 'hidden', background: GRAPH_BG }}>

      {/* ── Controls sidebar ──────────────────────────────────────────────── */}
      {showControls && (
        <div style={{
          width: 210, flexShrink: 0, borderRight: '1px solid #1f2d3d',
          background: '#0d1520', padding: '16px 14px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Legend */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6272', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              <FA icon={faCircleInfo} style={{ marginRight: 5 }} />Legend
            </div>
            {Object.entries(NODES).map(([type, cfg]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, flexShrink: 0, boxShadow: `0 0 5px ${cfg.glow}` }} />
                <FA icon={cfg.icon} style={{ color: cfg.color, fontSize: 11 }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{cfg.label}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 11, color: '#4a6272' }}>
              <FA icon={faCircleInfo} style={{ marginRight: 4 }} />Click node for details
            </div>
          </div>

          <div style={{ height: 1, background: '#1f2d3d', marginBottom: 18 }} />

          {/* Display sliders */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6272', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Display</div>
          <SliderRow label="Node size"      value={nodeSize}      min={2}   max={14}  step={1}    onChange={setNodeSize} />
          <SliderRow label="Link thickness" value={linkThickness} min={0.5} max={5}   step={0.5}  onChange={setLinkThickness} />
          <SliderRow label="Link distance"  value={linkDistance}  min={30}  max={300} step={10}   onChange={setLinkDistance} />

          <div style={{ height: 1, background: '#1f2d3d', marginBottom: 18 }} />

          {/* Force sliders */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6272', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Forces</div>
          <SliderRow label="Center force"   value={centerForce}   min={0}   max={1}   step={0.05} onChange={setCenterForce} />
          <SliderRow label="Repel force"    value={repelForce}    min={30}  max={500} step={10}   onChange={setRepelForce} />

          {/* Re-center button */}
          <button
            onClick={() => graphRef.current?.zoomToFit(400, 60)}
            style={{
              marginTop: 8, width: '100%', padding: '9px 0', borderRadius: 7,
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
              color: '#60a5fa', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <FA icon={faCrosshairs} />Re-center Graph
          </button>
        </div>
      )}

      {/* ── Graph canvas ──────────────────────────────────────────────────── */}
      <div ref={graphContainerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 200 }}>

        {/* Toggle controls button */}
        <Tooltip title={showControls ? 'Hide controls' : 'Show controls'}>
          <button
            onClick={() => setShowControls(p => !p)}
            style={{
              position: 'absolute', top: 10, left: 10, zIndex: 10,
              width: 30, height: 30, borderRadius: 6, border: '1px solid #1f2d3d',
              background: showControls ? 'rgba(59,130,246,0.2)' : '#0d1520',
              color: showControls ? '#60a5fa' : '#4a6272',
              cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <FA icon={faGear} />
          </button>
        </Tooltip>

        {/* Case info chip */}
        {caseData && (
          <div style={{
            position: 'absolute', top: 10, left: 50, zIndex: 10,
            background: 'rgba(13,21,32,0.92)', border: '1px solid #1f2d3d',
            borderRadius: 6, padding: '4px 10px',
            fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <FA icon={faFileShield} style={{ color: '#60a5fa' }} />
            <strong style={{ color: '#f0f6fc' }}>{caseData.title?.slice(0, 40)}</strong>
            <span>·</span>
            <span style={{ color: '#38bdf8' }}>{caseData.case_type?.toUpperCase()}</span>
          </div>
        )}

        <ForceGraph
          ref={graphRef}
          width={canvasW}
          height={containerSize.h || 580}
          graphData={graphData}
          backgroundColor={GRAPH_BG}
          nodeLabel={node => `${NODES[node.type]?.label || node.type}: ${node.label}`}
          nodeColor={node => NODES[node.type]?.color || '#94a3b8'}
          nodeVal={node => (node.val || 5) * (nodeSize / 5)}
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          linkWidth={linkThickness}
          linkColor={getLinkColor}
          linkDirectionalArrowLength={getArrowLength}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={link => {
            const src = typeof link.source === 'object' ? link.source.type : '';
            return src === 'case' ? '#60a5fa' : '#4a6272';
          }}
          linkLabel={link => link.label || ''}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          cooldownTicks={150}
          onEngineStop={handleEngineStop}
          onNodeClick={handleNodeClick}
          onBackgroundClick={() => setSelected(null)}
        />
      </div>

      {/* ── Node detail panel ─────────────────────────────────────────────── */}
      {selected && (
        <div style={{
          width: 290, flexShrink: 0,
          borderLeft: '1px solid #1f2d3d',
          background: '#0d1520',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f2d3d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a1120', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <FA icon={faCircleInfo} style={{ marginRight: 6, color: NODES[selected.type]?.color || '#60a5fa' }} />Node Details
            </span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a6272', fontSize: 14, padding: 4, borderRadius: 4 }}>
              <FA icon={faXmark} />
            </button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
            {/* Type badge */}
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                background: `${NODES[selected.type]?.color}22`,
                border: `1px solid ${NODES[selected.type]?.color}55`,
                color: NODES[selected.type]?.color || '#60a5fa',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <FA icon={NODES[selected.type]?.icon || faStar} style={{ fontSize: 11 }} />
                {NODES[selected.type]?.label || selected.type}
              </span>
            </div>

            {/* Name */}
            <h4 style={{ margin: '0 0 14px', color: '#f0f6fc', fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
              {selected.label}
            </h4>

            {/* Description / content */}
            {selected.content && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6272', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Description</div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.65, background: '#111827', border: '1px solid #1f2d3d', borderRadius: 6, padding: '10px 12px' }}>
                  {selected.content}
                </div>
              </div>
            )}

            {/* Details grid */}
            {selected.details && Object.keys(selected.details).filter(k => selected.details[k]).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6272', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Details</div>
                {Object.entries(selected.details).map(([k, v]) => v ? (
                  <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 12 }}>
                    <span style={{ color: '#4a6272', minWidth: 80, flexShrink: 0, textTransform: 'capitalize' }}>{k}:</span>
                    <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{v}</span>
                  </div>
                ) : null)}
              </div>
            )}

            {/* Source references */}
            {selected.sourceRefs?.length > 0 && (
              <>
                <div style={{ height: 1, background: '#1f2d3d', margin: '14px 0' }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6272', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                  Source References
                </div>
                {selected.sourceRefs.map((ref, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, padding: '8px 10px', marginBottom: 6,
                    background: '#111827', border: '1px solid #1f2d3d', borderRadius: 6,
                  }}>
                    <FA icon={faLink} style={{ color: '#60a5fa', marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa' }}>{ref.docType}</div>
                      {ref.date && <div style={{ fontSize: 11, color: '#4a6272', marginTop: 2 }}>{ref.date}</div>}
                      {ref.detail && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{ref.detail}</div>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Verify via doc type */}
            {DOC_REFS[selected.type] && (
              <>
                <div style={{ height: 1, background: '#1f2d3d', margin: '14px 0' }} />
                <div style={{
                  padding: '10px 12px', borderRadius: 6,
                  background: `${NODES[selected.type]?.color}0f`,
                  border: `1px solid ${NODES[selected.type]?.color}30`,
                  borderLeft: `3px solid ${NODES[selected.type]?.color}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6272', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                    <FA icon={faFileShield} style={{ marginRight: 5 }} />Verify via
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#94a3b8' }}>
                    <FA icon={DOC_REFS[selected.type].icon} style={{ color: NODES[selected.type]?.color }} />
                    {DOC_REFS[selected.type].label}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
