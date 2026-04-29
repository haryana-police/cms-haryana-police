import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const API = () => import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE = 'http://localhost:5000';

const CATEGORY_CONFIG = {
  laws: { label: 'Core Laws', color: '#22c55e', bg: '#052e16' },
  sop: { label: 'SOPs & Guidelines', color: '#3b82f6', bg: '#0c1a2e' },
  judgements: { label: 'Judgements', color: '#a78bfa', bg: '#150d2e' },
  'special laws': { label: 'Special Laws', color: '#f59e0b', bg: '#1c1000' },
  general: { label: 'General', color: '#9ca3af', bg: '#111827' }
};

export default function LawLibrary() {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [fileSearch, setFileSearch] = useState('');
  const [pdfViewer, setPdfViewer] = useState(null); // { url, label }
  const [activeCategory, setActiveCategory] = useState('all');

  // Load file list
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API()}/kb`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        setFiles(d.files || []);
      } catch (e) { console.error(e); }
      finally { setFilesLoading(false); }
    };
    load();
  }, [token]);

  const openPdf = (file) => {
    setPdfViewer({ url: `${BASE}/kb-files/${encodeURIComponent(file.url || file.path)}`, label: file.name });
  };

  // Grouped files
  const grouped = files.reduce((acc, f) => {
    const cat = f.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const allCats = Object.keys(grouped);
  
  const displayFiles = files.filter(f => {
    if (activeCategory !== 'all' && f.category !== activeCategory) return false;
    if (fileSearch && !f.name.toLowerCase().includes(fileSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '75vh', minHeight: 500, background: '#080c14', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", borderRadius: 12, border: '1px solid #1e2d3d', overflow: 'hidden' }}>
      
      {/* Header & Controls */}
      <div style={{ padding: '20px 24px', background: '#0d1117', borderBottom: '1px solid #1e2d3d' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
              Law Library
              <span style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 12, padding: '3px 10px', borderRadius: 12, fontWeight: 600 }}>
                {files.length} PDFs
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Access completely offline Core Laws, SOPs, and Acts for Investigations.</div>
          </div>
          
          <div style={{ flex: 1, minWidth: 250, maxWidth: 400 }}>
            <div style={{ position: 'relative' }}>
              <input
                placeholder="Search PDF names..."
                value={fileSearch}
                onChange={e => setFileSearch(e.target.value)}
                style={{ width: '100%', background: '#111827', border: '1px solid #1e3a5f', borderRadius: 10, padding: '10px 14px 10px 40px', color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            onClick={() => setActiveCategory('all')}
            style={{
              padding: '6px 16px', borderRadius: 20, border: `1px solid ${activeCategory === 'all' ? '#60a5fa' : '#1e3a5f'}`,
              background: activeCategory === 'all' ? '#1e3a5f' : '#111827', 
              color: activeCategory === 'all' ? '#fff' : '#9ca3af', 
              fontSize: 13, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}
          >
            All Files
          </button>
          {allCats.map(cat => {
            const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.general;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '6px 16px', borderRadius: 20, border: `1px solid ${isActive ? cfg.color : '#1e3a5f'}`,
                  background: isActive ? cfg.bg : '#111827', 
                  color: isActive ? cfg.color : '#9ca3af', 
                  fontSize: 13, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                {cfg.label} ({grouped[cat].length})
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#0a0f18' }}>
        {filesLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: 48, height: 48, border: '4px solid #1e3a5f', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <div style={{ color: '#4b5563', fontSize: 14 }}>Loading Library...</div>
          </div>
        ) : displayFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4b5563' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No files found matching your search.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {displayFiles.map((file, i) => {
              const cat = file.category || 'general';
              const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.general;
              const name = file.name.replace(/\.pdf$/i, '');
              
              return (
                <div 
                  key={i}
                  onClick={() => openPdf(file)}
                  style={{
                    background: '#111827', border: '1px solid #1e2d3d', borderRadius: 12, padding: '16px',
                    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 12,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = cfg.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#151f32'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = '#1e2d3d'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#111827'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      PDF
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={name}>
                        {name}
                      </div>
                      <div style={{ color: cfg.color, fontSize: 11, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {cfg.label}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {pdfViewer && (
        <div
          onClick={() => setPdfViewer(null)}
          style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '90vw', maxWidth: 1200, height: '90vh', background: '#0d1117', borderRadius: 16, border: '1px solid #1e3a5f', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
          >
            <div style={{ padding: '12px 20px', background: '#111827', borderBottom: '1px solid #1e2d3d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: '#1e3a5f', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>
                  PDF
                </div>
                <div>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>{pdfViewer.label}</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Secure Local Viewer</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <a href={pdfViewer.url} target="_blank" rel="noopener noreferrer"
                  style={{ padding: '8px 16px', background: '#1e3a5f', color: '#60a5fa', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = '#254b7a'}
                  onMouseOut={e => e.currentTarget.style.background = '#1e3a5f'}
                >
                  Open in Browser
                </a>
                <button onClick={() => setPdfViewer(null)}
                  style={{ padding: '8px 16px', background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = '#991b1b'}
                  onMouseOut={e => e.currentTarget.style.background = '#7f1d1d'}
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              src={pdfViewer.url}
              style={{ flex: 1, border: 'none', background: '#525659' }}
              title={pdfViewer.label}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; } 
        ::-webkit-scrollbar-track { background: #080c14; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
      `}</style>
    </div>
  );
}
