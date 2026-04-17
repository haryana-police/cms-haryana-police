import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import AiChat from './AiChat';
import LawLibrary from './LawLibrary';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import './SmartAnalyzer.css';

// Use local worker (not CDN) to avoid CORS/network issues in Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ children, className = '' }) => (
  <span className={`icon ${className}`}>{children}</span>
);

// ─── Priority Badge ────────────────────────────────────────────────────────────
const PriorityBadge = ({ level }) => {
  const map = {
    CRITICAL: { color: '#ff1744', bg: '#ff174415', label: '🚨 CRITICAL' },
    URGENT: { color: '#ff6d00', bg: '#ff6d0015', label: '⚡ URGENT' },
    HIGH: { color: '#ff9100', bg: '#ff910015', label: '🔥 HIGH' },
    MEDIUM: { color: '#ffd600', bg: '#ffd60020', label: '⚠️ MEDIUM' },
    LOW: { color: '#00c853', bg: '#00c85315', label: '✅ LOW' },
    PRIMARY: { color: '#d32f2f', bg: '#d32f2f15', label: '⚖️ PRIMARY' },
    SECONDARY: { color: '#1565c0', bg: '#1565c015', label: '📋 SECONDARY' },
  };
  const cfg = map[level?.toUpperCase()] || map.MEDIUM;
  return (
    <span className="priority-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40` }}>
      {cfg.label}
    </span>
  );
};

// ─── Law Detail Drawer ────────────────────────────────────────────────────────
const LawDetailDrawer = ({ visible, onClose, sectionCode, token, lang = 'en' }) => {
  const [loading, setLoading] = useState(false);
  const [detailEn, setDetailEn] = useState('');
  const [detailHi, setDetailHi] = useState('');
  const [drawerLang, setDrawerLang] = useState(lang);

  React.useEffect(() => {
    setDrawerLang(lang);
  }, [lang]);

  React.useEffect(() => {
    if (visible && sectionCode) {
      setLoading(true);
      setDetailEn('');
      setDetailHi('');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      fetch(`${apiUrl}/ai/law-detail`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionCode })
      })
        .then(r => r.json())
        .then(d => setDetailEn(d.detail || 'No detail found'))
        .catch(() => setDetailEn('Failed to load legal reference.'))
        .finally(() => setLoading(false));
    }
  }, [visible, sectionCode]);

  const fetchHindiDetail = async () => {
    if (detailHi) { setDrawerLang('hi'); return; }
    setLoading(true);
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    try {
      const r = await fetch(`${apiUrl}/ai/law-detail-hindi`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionCode, englishText: detailEn })
      });
      const d = await r.json();
      setDetailHi(d.detail || detailEn);
      setDrawerLang('hi');
    } catch {
      setDetailHi(detailEn);
      setDrawerLang('hi');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const formatMarkdown = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm, '<div class="md-heading">$1</div>')
      .replace(/^(\d+)\. (.+)$/gm, '<div class="md-ol"><span class="md-num">$1</span>$2</div>')
      .replace(/^- (.+)$/gm, '<div class="md-li">→ $1</div>')
      .replace(/\n/g, '<br/>');
  };

  const currentDetail = drawerLang === 'hi' ? (detailHi || detailEn) : detailEn;

  return (
    <div className="law-drawer-overlay" onClick={onClose}>
      <div className="law-drawer" onClick={e => e.stopPropagation()}>
        <div className="law-drawer-header">
          <div>
            <div className="law-drawer-title">⚖️ Legal Reference</div>
            <div className="law-drawer-subtitle">{sectionCode}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {detailEn && (
              <div className="drawer-lang-toggle">
                <button
                  className={`dlang-btn ${drawerLang === 'en' ? 'active' : ''}`}
                  onClick={() => setDrawerLang('en')}
                >EN</button>
                <button
                  className={`dlang-btn ${drawerLang === 'hi' ? 'active' : ''}`}
                  onClick={fetchHindiDetail}
                  disabled={loading}
                >हिंदी</button>
              </div>
            )}
            <button className="drawer-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="law-drawer-body">
          {loading ? (
            <div className="law-loading">
              <div className="spinner" />
              <p>{drawerLang === 'hi' ? 'हिंदी में अनुवाद हो रहा है...' : 'Fetching official legal text...'}</p>
            </div>
          ) : (
            <div className="law-content" dangerouslySetInnerHTML={{ __html: formatMarkdown(currentDetail) }} />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── File Upload Zone ─────────────────────────────────────────────────────────
const FileUploadZone = ({ files, onFilesAdded, onFileRemove }) => {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    onFilesAdded(droppedFiles);
  };

  const handleFileInput = (e) => {
    onFilesAdded(Array.from(e.target.files));
    e.target.value = '';
  };

  const getFileIcon = (type) => {
    if (type === 'application/pdf') return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('audio/') || type.startsWith('video/')) return '🎵';
    return '📎';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="upload-section">
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,audio/*"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <div className="upload-icon">📤</div>
        <div className="upload-title">Drop files here or click to upload</div>
        <div className="upload-subtitle">
          Supports: JPG, PNG, PDF, Audio (MP3/WAV), Handwritten Applications • Max 20MB per file
        </div>
        <div className="upload-formats">
          <span className="format-chip">📸 Photo</span>
          <span className="format-chip">📄 PDF</span>
          <span className="format-chip">🎵 Audio Note</span>
          <span className="format-chip">✍️ Handwritten</span>
          <span className="format-chip">🖼️ Scanned Doc</span>
        </div>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, idx) => (
            <div key={idx} className="file-item">
              <span className="file-icon">{getFileIcon(file.type)}</span>
              <div className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-size">{formatSize(file.size)}</div>
              </div>
              <div className="file-status">
                {file.type === 'application/pdf' ? (
                  <span className="file-badge pdf">OCR Ready</span>
                ) : file.type.startsWith('audio/') || file.type.startsWith('video/') ? (
                  <span className="file-badge image" style={{background: '#8b5cf6', color: 'white'}}>AI Speech</span>
                ) : (
                  <span className="file-badge image">Vision OCR</span>
                )}
              </div>
              <button className="file-remove" onClick={() => onFileRemove(idx)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Folder SOP Content Renderer ────────────────────────────────────────────
const FolderSOPContent = ({ paragraphs }) => {
  const [expanded, setExpanded] = React.useState(false);
  const preview = expanded ? paragraphs : paragraphs.slice(0, 12);

  return (
    <div style={{ padding: '14px 16px' }}>
      {preview.map((para, i) => (
        <div key={i} style={{
          fontSize: 12.5, color: '#9ca3af', lineHeight: 1.75,
          marginBottom: 8, paddingLeft: 10,
          borderLeft: i === 0 ? '2px solid #1890ff44' : '1px solid #1f2937',
        }}>
          {para}
        </div>
      ))}
      {paragraphs.length > 12 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 8, background: 'none', border: '1px solid #1f2937',
            color: '#1890ff', cursor: 'pointer', fontSize: 12,
            borderRadius: 6, padding: '5px 14px', width: '100%'
          }}
        >
          {expanded
            ? `▲ कम दिखाएं (Show Less)`
            : `▼ और देखें — ${paragraphs.length - 12} more paragraphs from official document`}
        </button>
      )}
    </div>
  );
};

// ─── Analysis Results ─────────────────────────────────────────────────────────
const AnalysisResults = ({ result, hindiResult, lang, onLawClick, folderSOPs, folderSOPsLoading }) => {
  const [activeTab, setActiveTab] = useState('sections');
  // Use Hindi data if lang is 'hi' and hindiResult exists, otherwise use original
  const activeResult = (lang === 'hi' && hindiResult) ? { ...result, ...hindiResult, _meta: result._meta } : result;
  const { sections, sop, sc_judgments, hc_judgments, special_laws, deadlines, evidence_checklist, io_warnings, case_summary, crime_type, severity, _meta } = activeResult;

  const today = new Date();
  const getDeadlineDate = (days, hours) => {
    const d = new Date(today);
    if (days) d.setDate(d.getDate() + days);
    if (hours && !days) d.setHours(d.getHours() + hours);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isHindi = lang === 'hi';

  const tabs = [
    { key: 'sections', label: isHindi ? '⚖️ धाराएं' : '⚖️ Sections', count: sections?.length || 0 },
    { key: 'sop', label: isHindi ? '📋 एसओपी' : '📋 SOP', count: sop?.length || 0 },
    { key: 'judgments', label: isHindi ? '🏛️ निर्णय' : '🏛️ Judgments', count: (sc_judgments?.length || 0) + (hc_judgments?.length || 0) },
    { key: 'deadlines', label: isHindi ? '⏰ समय-सीमा' : '⏰ Deadlines', count: deadlines?.length || 0 },
    { key: 'evidence', label: isHindi ? '🔍 साक्ष्य' : '🔍 Evidence', count: evidence_checklist?.length || 0 },
    { key: 'special', label: isHindi ? '🛡️ विशेष कानून' : '🛡️ Special Laws', count: special_laws?.length || 0 },
  ];

  return (
    <div className="analysis-results">
      {/* Case Header */}
      <div className="case-header">
        <div className="case-meta">
          <div className="case-crime-type">🚔 {crime_type || (isHindi ? 'आपराधिक मामला' : 'Criminal Case')}</div>
          <PriorityBadge level={severity || 'HIGH'} />
        </div>
        <div className="case-summary">{case_summary}</div>
        {_meta && (
          <div className="meta-info">
            📁 {_meta.filesProcessed} file(s) analyzed • 
            {_meta.fileResults?.map((f, i) => (
              <span key={i} className="meta-file">
                {' '}{f.filename} ({f.method === 'image-ocr' ? `OCR ${f.confidence}%` : f.method})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* IO Warnings */}
      {io_warnings && io_warnings.length > 0 && (
        <div className="io-warnings">
          <div className="warnings-title">⚠️ IO Alerts & Mandatory Requirements</div>
          {io_warnings.map((w, i) => (
            <div key={i} className="warning-item">🔔 {w}</div>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-nav">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab: Sections */}
      {activeTab === 'sections' && (
        <div className="tab-content">
          {/* BNS Law Badge */}
          <div className="bns-law-notice">
            ✅ {isHindi
              ? <>सभी धाराएं <strong>BNS (भारतीय न्याय संहिता)</strong> के तहत हैं — 1 जुलाई 2024 से लागू नया भारतीय कानून</>
              : <>All sections are under <strong>BNS (Bharatiya Nyaya Sanhita)</strong> — New Indian Law effective July 1, 2024</>
            }
          </div>
          {sections?.map((sec, i) => {
            const isBNS = String(sec.code || '').toUpperCase().startsWith('BNS');
            const isBNSS = String(sec.code || '').toUpperCase().startsWith('BNSS');
            const isValidNewLaw = isBNS || isBNSS || String(sec.code || '').toUpperCase().startsWith('BSA');
            return (
              <div
                key={i}
                className={`section-card ${sec.relevance?.toUpperCase() === 'PRIMARY' || sec.relevance?.toUpperCase() === 'प्राथमिक' ? 'primary' : 'secondary'}`}
                onClick={() => onLawClick(sec.code)}
              >
                <div className="section-header">
                  <div className="section-codes">
                    <span className={`section-code ${isValidNewLaw ? 'bns-valid' : 'bns-invalid'}`}>
                      {isValidNewLaw ? '✅ ' : '⚠️ '}{sec.code}
                    </span>
                    {sec.old_code && (
                      <span className="section-old-code">{isHindi ? 'पुरानी IPC:' : 'Old IPC:'} {sec.old_code}</span>
                    )}
                  </div>
                  <PriorityBadge level={sec.relevance} />
                </div>
                <div className="section-title">{sec.title}</div>
                <div className="section-desc">{sec.description}</div>
                {sec.punishment && (
                  <div className="section-punishment">
                    ⚡ {isHindi ? 'सज़ा:' : 'Punishment:'} <strong>{sec.punishment}</strong>
                  </div>
                )}
                <div className="section-click-hint">👆 {isHindi ? 'पूरी कानूनी जानकारी के लिए क्लिक करें' : 'Click for full legal reference'}</div>
              </div>
            );
          })}
        </div>
      )}


      {/* Tab: SOP */}
      {activeTab === 'sop' && (
        <div className="tab-content">
          {/* ── AI Generated Steps ── */}
          <div className="sop-section-title" style={{
            fontSize: 12, color: '#595959', textTransform: 'uppercase',
            letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6
          }}>
            🤖 {isHindi ? 'AI द्वारा निर्धारित SOP Steps' : 'AI Generated SOP Steps'}
          </div>
          <div className="sop-timeline">
            {sop?.map((step, i) => (
              <div key={i} className="sop-step">
                <div className="sop-step-num">{step.step || i + 1}</div>
                <div className="sop-step-content">
                  <div className="sop-step-header">
                    <div className="sop-step-action">{step.action || step}</div>
                    {step.priority && <PriorityBadge level={step.priority} />}
                  </div>
                  {step.time_limit && (
                    <div className="sop-meta">
                      <span className="sop-time">⏱️ {isHindi ? 'समय:' : ''} {step.time_limit}</span>
                      {step.authority && <span className="sop-auth">👮 {step.authority}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Folder SOP Documents ── */}
          {folderSOPs && folderSOPs.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{
                fontSize: 12, color: '#1890ff', textTransform: 'uppercase',
                letterSpacing: 1, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
                borderTop: '1px solid #1f1f1f', paddingTop: 20
              }}>
                📂 {isHindi ? 'आपके Folder के Official SOP Documents' : 'Official SOPs from Your Folder'}
                <span style={{ background: '#1890ff22', color: '#1890ff', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>
                  {folderSOPs.length} {isHindi ? 'दस्तावेज़' : 'Documents'}
                </span>
              </div>

              {folderSOPs.map((sopDoc, di) => (
                <div key={di} style={{
                  background: '#0f1117', border: '1px solid #1890ff22',
                  borderRadius: 12, marginBottom: 16, overflow: 'hidden'
                }}>
                  {/* Document Header */}
                  <div style={{
                    background: '#111827', borderBottom: '1px solid #1f2937',
                    padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ color: '#60a5fa', fontWeight: 600, fontSize: 13, marginBottom: 3 }}>
                        📋 {sopDoc.label}
                      </div>
                      <div style={{ color: '#4b5563', fontSize: 11 }}>
                        📄 {sopDoc.fileName} • {sopDoc.totalPages || '?'} pages
                        {sopDoc.keywords?.length > 0 && (
                          <span style={{ marginLeft: 8, color: '#374151' }}>
                            • Matched: {sopDoc.keywords.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={`http://localhost:5000${sopDoc.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: '#1890ff22', color: '#60a5fa', border: '1px solid #1890ff33',
                        borderRadius: 6, padding: '5px 12px', fontSize: 12, textDecoration: 'none',
                        display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap'
                      }}
                    >
                      🔗 {isHindi ? 'PDF खोलें' : 'Open PDF'}
                    </a>
                  </div>

                  {/* Document Content */}
                  {sopDoc.error ? (
                    <div style={{ padding: '12px 16px', color: '#6b7280', fontSize: 12, fontStyle: 'italic' }}>
                      ⚠️ {sopDoc.error}
                    </div>
                  ) : (
                    <FolderSOPContent paragraphs={sopDoc.paragraphs} />
                  )}
                </div>
              ))}
            </div>
          )}

          {folderSOPsLoading && (
            <div style={{ marginTop: 20, textAlign: 'center', padding: 20 }}>
              <div className="spinner" style={{ margin: '0 auto 10px' }} />
              <div style={{ color: '#595959', fontSize: 13 }}>
                📂 {isHindi ? 'Folder से Official SOP load हो रही है...' : 'Loading official SOPs from folder...'}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'judgments' && (
        <div className="tab-content">
          {sc_judgments && sc_judgments.length > 0 && (
            <>
              <div className="judgment-group-title">🏛️ {isHindi ? 'सर्वोच्च न्यायालय के निर्णय' : 'Supreme Court Judgments'}</div>
              {sc_judgments.map((judg, i) => (
                <div key={i} className="judgment-card sc">
                  <div className="judgment-header">
                    <div className="judgment-name">{judg.case_name}</div>
                    <div className="judgment-badges">
                      <span className="court-badge sc">{isHindi ? 'सर्वोच्च न्यायालय' : 'Supreme Court'}</span>
                      {judg.year && <span className="year-badge">{judg.year}</span>}
                    </div>
                  </div>
                  {judg.citation && (
                    <div className="judgment-citation">📜 {isHindi ? 'उद्धरण:' : 'Citation:'} <strong>{judg.citation}</strong></div>
                  )}
                  <div className="judgment-guideline">💡 <strong>{isHindi ? 'मुख्य दिशानिर्देश:' : 'Key Guideline:'}</strong> {judg.guideline}</div>
                  {judg.holding && (
                    <div className="judgment-holding">
                      <div className="judgment-section-label">⚖️ {isHindi ? 'न्यायालय का निर्णय:' : 'Court Holding:'}</div>
                      <div className="judgment-holding-text">{judg.holding}</div>
                    </div>
                  )}
                  {judg.key_points && judg.key_points.length > 0 && (
                    <div className="judgment-keypoints">
                      <div className="judgment-section-label">📌 {isHindi ? 'मुख्य बिंदु:' : 'Key Points:'}</div>
                      <ul className="judgment-points-list">
                        {judg.key_points.map((pt, j) => (
                          <li key={j} className="judgment-point-item">→ {pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {judg.io_duty && (
                    <div className="judgment-io-duty">
                      <span>👮 {isHindi ? 'IO का कर्तव्य:' : "IO's Duty:"}</span> {judg.io_duty}
                    </div>
                  )}
                  {judg.relevance && <div className="judgment-relevance">📌 {judg.relevance}</div>}
                </div>
              ))}
            </>
          )}

          {hc_judgments && hc_judgments.length > 0 && (
            <>
              <div className="judgment-group-title" style={{ marginTop: '20px' }}>⚖️ {isHindi ? 'उच्च न्यायालय के निर्णय' : 'High Court Judgments'}</div>
              {hc_judgments.map((judg, i) => (
                <div key={i} className="judgment-card hc">
                  <div className="judgment-header">
                    <div className="judgment-name">{judg.case_name}</div>
                    <div className="judgment-badges">
                      <span className="court-badge hc">{judg.court || 'P&H HC'}</span>
                      {judg.year && <span className="year-badge">{judg.year}</span>}
                    </div>
                  </div>
                  {judg.citation && (
                    <div className="judgment-citation">📜 {isHindi ? 'उद्धरण:' : 'Citation:'} <strong>{judg.citation}</strong></div>
                  )}
                  <div className="judgment-guideline">💡 <strong>{isHindi ? 'मुख्य दिशानिर्देश:' : 'Key Guideline:'}</strong> {judg.guideline}</div>
                  {judg.holding && (
                    <div className="judgment-holding">
                      <div className="judgment-section-label">⚖️ {isHindi ? 'न्यायालय का निर्णय:' : 'Court Holding:'}</div>
                      <div className="judgment-holding-text">{judg.holding}</div>
                    </div>
                  )}
                  {judg.key_points && judg.key_points.length > 0 && (
                    <div className="judgment-keypoints">
                      <div className="judgment-section-label">📌 {isHindi ? 'मुख्य बिंदु:' : 'Key Points:'}</div>
                      <ul className="judgment-points-list">
                        {judg.key_points.map((pt, j) => (
                          <li key={j} className="judgment-point-item">→ {pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {judg.io_duty && (
                    <div className="judgment-io-duty">
                      <span>👮 {isHindi ? 'IO का कर्तव्य:' : "IO's Duty:"}</span> {judg.io_duty}
                    </div>
                  )}
                  {judg.relevance && <div className="judgment-relevance">📌 {judg.relevance}</div>}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Tab: Deadlines */}
      {activeTab === 'deadlines' && (
        <div className="tab-content">
          <div className="deadlines-header">
            📅 {isHindi ? 'आज:' : 'Today:'} {today.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <div className="deadlines-grid">
            {deadlines?.map((dl, i) => {
              const daysLeft = dl.days || 0;
              const isUrgent = daysLeft === 0 || dl.priority === 'CRITICAL';
              return (
                <div key={i} className={`deadline-card ${isUrgent ? 'urgent' : ''}`}>
                  <div className="deadline-header">
                    <PriorityBadge level={dl.priority || (daysLeft === 0 ? 'CRITICAL' : 'HIGH')} />
                    {daysLeft === 0 && <span className="deadline-now">{isHindi ? 'अभी' : 'NOW'}</span>}
                  </div>
                  <div className="deadline-task">{dl.task}</div>
                  <div className="deadline-time">
                    {daysLeft === 0 && dl.hours ? (
                      <span className="deadline-hours">{isHindi ? `${dl.hours} घंटे के भीतर` : `Within ${dl.hours} Hours`}</span>
                    ) : (
                      <span className="deadline-days">{daysLeft} {isHindi ? 'दिन' : 'Days'}</span>
                    )}
                  </div>
                  <div className="deadline-date">📅 {isHindi ? 'तक:' : 'By:'} {getDeadlineDate(dl.days, dl.hours)}</div>
                  {dl.legal_basis && <div className="deadline-basis">📜 {dl.legal_basis}</div>}
                  {dl.authority && <div className="deadline-auth">👮 {dl.authority}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Evidence */}
      {activeTab === 'evidence' && (
        <div className="tab-content">
          <div className="evidence-list">
            {evidence_checklist?.map((item, i) => (
              <EvidenceItem key={i} text={item} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Tab: Special Laws */}
      {activeTab === 'special' && (
        <div className="tab-content">
          {(!special_laws || special_laws.length === 0) ? (
            <div className="empty-state">✅ {isHindi ? 'इस मामले पर कोई विशेष कानून लागू नहीं।' : 'No special laws applicable for this case type.'}</div>
          ) : (
            special_laws.map((law, i) => (
              <div key={i} className="special-law-card">
                <div className="special-law-header">
                  <div className="special-law-name">{law.act_name}</div>
                  {law.priority && <PriorityBadge level={law.priority} />}
                </div>
                {law.sections && law.sections.length > 0 && (
                  <div className="special-law-sections">
                    {law.sections.map((s, j) => (
                      <span
                        key={j}
                        className="law-section-tag"
                        onClick={() => onLawClick(`${law.act_name} Section ${s}`)}
                      >
                        {isHindi ? 'धारा' : 'Sec'} {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="special-law-action">{law.action}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── Evidence Item with Checkbox ───────────────────────────────────────────────
const EvidenceItem = ({ text, index }) => {
  const [checked, setChecked] = useState(false);
  return (
    <div className={`evidence-item ${checked ? 'checked' : ''}`} onClick={() => setChecked(!checked)}>
      <div className={`evidence-checkbox ${checked ? 'checked' : ''}`}>
        {checked ? '✓' : ''}
      </div>
      <div className="evidence-text">
        <span className="evidence-num">{index + 1}.</span> {text}
      </div>
    </div>
  );
};

// ─── Main Investigation Component ─────────────────────────────────────────────
export default function Investigation() {
  const { token, user } = useAuth();
  const [activeView, setActiveView] = useState('analyzer');
  const [files, setFiles] = useState([]);
  const [complaintText, setComplaintText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzeProgress, setAnalyzeProgress] = useState('');
  const [lawDrawer, setLawDrawer] = useState({ visible: false, code: '' });
  const [errorMsg, setErrorMsg] = useState('');
  // ─── Bilingual State ──────────────────────────────────────────────────────
  const [lang, setLang] = useState('en');          // 'en' or 'hi'
  const [hindiResult, setHindiResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  // ─── Folder SOP State ─────────────────────────────────────────────────────
  const [folderSOPs, setFolderSOPs] = useState([]);
  const [folderSOPsLoading, setFolderSOPsLoading] = useState(false);

  // ─── Dictation State ──────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const toggleDictation = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg(lang === 'hi' ? 'आपका ब्राउज़र वॉयस डिक्टेशन का समर्थन नहीं करता है।' : 'Your browser does not support Voice Dictation.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
         if (event.results[i].isFinal) {
           finalTranscript += event.results[i][0].transcript + ' ';
         }
      }
      if (finalTranscript) {
         setComplaintText(prev => (prev ? prev + ' ' : '') + finalTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'not-allowed') {
         setErrorMsg('Microphone error: ' + event.error);
         setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      setErrorMsg('');
    } catch (e) {
      console.warn("Speech API error:", e);
    }
  };

  // Auto-fetch folder SOPs whenever analysisResult arrives
  React.useEffect(() => {
    if (!analysisResult) return;
    const fetchFolderSOPs = async () => {
      setFolderSOPsLoading(true);
      setFolderSOPs([]);
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const resp = await fetch(`${apiUrl}/sop/for-case`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            crimeContext: analysisResult.case_summary || '',
            crimeType: analysisResult.crime_type || ''
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          setFolderSOPs(data.sops || []);
          if (data.count > 0) console.log(`📂 ${data.count} folder SOP(s) loaded for display`);
        }
      } catch (e) {
        console.warn('Folder SOP fetch failed:', e.message);
      } finally {
        setFolderSOPsLoading(false);
      }
    };
    fetchFolderSOPs();
  }, [analysisResult]);

  const handleLangToggle = async (newLang) => {
    if (newLang === lang) return;
    if (newLang === 'hi' && !hindiResult && analysisResult) {
      setIsTranslating(true);
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        // Send only the translatable fields (exclude _meta)
        const { _meta, ...translatable } = analysisResult;
        const resp = await fetch(`${apiUrl}/ai/translate-hindi`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisData: translatable })
        });
        const data = await resp.json();
        if (data.translated) setHindiResult(data.translated);
      } catch (e) {
        console.error('Translation failed:', e);
      } finally {
        setIsTranslating(false);
      }
    }
    setLang(newLang);
  };

  const handleFilesAdded = (newFiles) => {
    const valid = newFiles.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('audio/') || f.type.startsWith('video/') || f.type === 'application/pdf'
    );
    setFiles(prev => [...prev, ...valid]);
    if (valid.length !== newFiles.length) {
      setErrorMsg('Some files were skipped (only images, audio, and PDFs are supported).');
    }
  };

  const handleFileRemove = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const convertPdfToCanvas = async (file) => {
    try {
      console.log('[Frontend] Converting PDF to canvas for OCR:', file.name);
      const arrayBuf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) }).promise;
      const totalPages = pdf.numPages;
      console.log('[Frontend] PDF has', totalPages, 'pages');

      // Render first 2 pages and stitch them vertically (JPEG for smaller payload)
      const maxPages = Math.min(totalPages, 2);
      const canvases = [];

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // scale 1.5 — good OCR, smaller size
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        canvases.push(canvas);
      }

      // Stitch canvases into one tall image
      const totalHeight = canvases.reduce((sum, c) => sum + c.height, 0);
      const maxWidth = Math.max(...canvases.map(c => c.width));
      const stitched = document.createElement('canvas');
      stitched.width = maxWidth;
      stitched.height = totalHeight;
      const stitchedCtx = stitched.getContext('2d');
      let yOffset = 0;
      for (const c of canvases) {
        stitchedCtx.drawImage(c, 0, yOffset);
        yOffset += c.height;
      }

      // Use JPEG at 70% quality — ~4x smaller than PNG, still good for OCR
      const base64 = stitched.toDataURL('image/jpeg', 0.7);
      console.log('[Frontend] Canvas generated (JPEG), size:', Math.round(base64.length / 1024), 'KB');
      return base64;
    } catch (e) {
      console.error('[Frontend] PDF canvas error:', e.message);
      return null;
    }
  };


  const handleAnalyze = async () => {
    if (files.length === 0 && !complaintText.trim()) {
      setErrorMsg('Please upload at least one file or enter complaint text.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setErrorMsg('');
    const imageFallbacks = {};
    const formData = new FormData();

    try {
      // ── Step 1: Pre-process each file ────────────────────────────────────
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        formData.append('files', file);

        if (file.type === 'application/pdf') {
          setAnalyzeProgress(`📄 Converting PDF "${file.name}" to image for OCR... (${i+1}/${files.length})`);
          const canvasBase64 = await convertPdfToCanvas(file);
          if (canvasBase64) {
            imageFallbacks[i] = canvasBase64;
            const sizeKB = Math.round(canvasBase64.length / 1024);
            console.log(`PDF canvas ready: ${sizeKB}KB for "${file.name}"`);
            setAnalyzeProgress(`✅ PDF "${file.name}" ready for OCR (${sizeKB}KB canvas)`);
          } else {
            setAnalyzeProgress(`⚠️ PDF canvas failed for "${file.name}" — will try direct text extraction`);
          }
          // Small delay so user can see the progress
          await new Promise(r => setTimeout(r, 400));
        } else {
          setAnalyzeProgress(`🖼️ Queuing image "${file.name}" for OCR... (${i+1}/${files.length})`);
          await new Promise(r => setTimeout(r, 200));
        }
      }

      // ── Step 2: Attach fallbacks and text ────────────────────────────────
      if (Object.keys(imageFallbacks).length > 0) {
        formData.append('imageFallbacks', JSON.stringify(imageFallbacks));
        console.log(`Sending ${Object.keys(imageFallbacks).length} PDF canvas(es) to server`);
      }
      formData.append('text', complaintText);

      // ── Step 3: Send to backend ───────────────────────────────────────────
      setAnalyzeProgress('🤖 AI is reading and analyzing documents...');

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/ai/analyze-complaint`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server analysis failed');
      }

      // ── Step 4: Show results ──────────────────────────────────────────────
      setAnalysisResult(data);
      setAnalyzeProgress('');

    } catch (error) {
      console.error('Analysis error:', error);
      setErrorMsg(`❌ ${error.message || 'Analysis failed. Please try again.'}`);
      setAnalyzeProgress('');
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleExportReport = () => {
    if (!analysisResult) return;
    const exportData = (lang === 'hi' && hindiResult) ? { ...analysisResult, ...hindiResult, _meta: analysisResult._meta } : analysisResult;
    const report = generateTextReport(exportData);
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Case_Analysis_${lang === 'hi' ? 'Hindi_' : ''}${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateTextReport = (data) => {
    const today = new Date().toLocaleDateString('en-IN');
    return `
================================================================================
              HARYANA POLICE – AI CASE ANALYSIS REPORT
================================================================================
Date: ${today}
Crime Type: ${data.crime_type || 'N/A'}
Severity: ${data.severity || 'N/A'}

CASE SUMMARY:
${data.case_summary || 'N/A'}

────────────────────────────────────────────────────────────────────────────────
APPLICABLE SECTIONS (BNS / BNSS / BSA):
────────────────────────────────────────────────────────────────────────────────
${data.sections?.map(s => `• ${s.code} (${s.old_code || ''}) - ${s.title} [${s.relevance}]\n  ${s.description}\n  Punishment: ${s.punishment || 'N/A'}`).join('\n\n') || 'N/A'}

────────────────────────────────────────────────────────────────────────────────
STANDARD OPERATING PROCEDURE (SOP):
────────────────────────────────────────────────────────────────────────────────
${data.sop?.map((s, i) => `${i + 1}. ${s.action || s}\n   Time: ${s.time_limit || 'N/A'} | Authority: ${s.authority || 'N/A'}`).join('\n\n') || 'N/A'}

────────────────────────────────────────────────────────────────────────────────
SUPREME COURT JUDGMENTS:
────────────────────────────────────────────────────────────────────────────────
${data.sc_judgments?.map(j => `• ${j.case_name} (${j.year || 'N/A'})\n  ${j.guideline}`).join('\n\n') || 'N/A'}

────────────────────────────────────────────────────────────────────────────────
HIGH COURT JUDGMENTS:
────────────────────────────────────────────────────────────────────────────────
${data.hc_judgments?.map(j => `• ${j.case_name} (${j.year || 'N/A'}) - ${j.court || 'N/A'}\n  ${j.guideline}`).join('\n\n') || 'None'}

────────────────────────────────────────────────────────────────────────────────
DEADLINES:
────────────────────────────────────────────────────────────────────────────────
${data.deadlines?.map(d => `• ${d.task}: ${d.days ? d.days + ' days' : d.hours + ' hours'} | ${d.legal_basis || ''} | Authority: ${d.authority || 'N/A'}`).join('\n') || 'N/A'}

────────────────────────────────────────────────────────────────────────────────
EVIDENCE CHECKLIST:
────────────────────────────────────────────────────────────────────────────────
${data.evidence_checklist?.map((e, i) => `☐ ${i + 1}. ${e}`).join('\n') || 'N/A'}

────────────────────────────────────────────────────────────────────────────────
IO ALERTS:
────────────────────────────────────────────────────────────────────────────────
${data.io_warnings?.map(w => `⚠️ ${w}`).join('\n') || 'N/A'}

================================================================================
Generated by Haryana Police CMS – Smart AI Analyzer
================================================================================
    `.trim();
  };

  const navItems = [
    { key: 'analyzer', icon: '🔍', label: lang === 'hi' ? 'स्मार्ट विश्लेषक' : 'Smart Analyzer' },
    { key: 'library', icon: '📖', label: lang === 'hi' ? 'कानून पुस्तकालय' : 'Law Library' },
    { key: 'chat', icon: '🤖', label: lang === 'hi' ? 'AI सहायक' : 'AI Chat' },
  ];

  return (
    <div className="investigation-page">
      {/* Header */}
      <div className="inv-header">
        <div className="inv-header-left">
          <div className="inv-header-icon">🚔</div>
          <div>
            <h1 className="inv-title">{lang === 'hi' ? 'स्मार्ट दस्तावेज़ विश्लेषक' : 'Smart Document Analyzer'}</h1>
            <p className="inv-subtitle">{lang === 'hi' ? 'AI OCR • फोटो / PDF / हस्तलिखित पाठ • कानूनी विश्लेषण' : 'AI-Powered OCR • Photo / PDF / Handwritten Text • Legal Analysis'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* ── Language Toggle ── */}
          <div className="lang-toggle-wrapper">
            <button
              id="lang-en-btn"
              className={`lang-toggle-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => handleLangToggle('en')}
            >
              🇬🇧 English
            </button>
            <button
              id="lang-hi-btn"
              className={`lang-toggle-btn ${lang === 'hi' ? 'active' : ''}`}
              onClick={() => handleLangToggle('hi')}
              disabled={isTranslating}
            >
              {isTranslating ? <><span className="btn-spinner" style={{width:'12px',height:'12px',marginRight:'4px'}} /> अनुवाद...</> : '🇮🇳 हिंदी'}
            </button>
          </div>
          {analysisResult && activeView === 'analyzer' && (
            <button className="export-btn" onClick={handleExportReport}>
              📥 {lang === 'hi' ? 'रिपोर्ट डाउनलोड' : 'Export Report'}
            </button>
          )}
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="inv-nav">
        {navItems.map(item => (
          <button
            key={item.key}
            className={`inv-nav-btn ${activeView === item.key ? 'active' : ''}`}
            onClick={() => setActiveView(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Sub-pages */}
      {activeView === 'library' && <LawLibrary />}
      {activeView === 'chat' && <AiChat />}

      {/* Smart Analyzer */}
      {activeView === 'analyzer' && (
        <div className="analyzer-container">
          {/* Upload Panel */}
          <div className="upload-panel">
            <div className="panel-title">
              <span>📎 Upload Documents</span>
              <span className="panel-hint">OCR reads photos, PDFs & handwriting</span>
            </div>
            
            <FileUploadZone
              files={files}
              onFilesAdded={handleFilesAdded}
              onFileRemove={handleFileRemove}
            />

            <div className="divider">
              <span>OR TYPE COMPLAINT TEXT</span>
            </div>

            <div className="textarea-wrapper" style={{ position: 'relative' }}>
              <textarea
                className="complaint-textarea"
                placeholder={lang === 'hi' ? 'मुझे कहना है कि...' : 'Enter your complaint text here in Hindi or English...'}
                value={complaintText}
                onChange={e => setComplaintText(e.target.value)}
                rows={5}
                style={{ width: '100%', paddingRight: '50px' }}
              />
              <button 
                type="button"
                className={`dictation-btn ${isListening ? 'listening' : ''}`}
                onClick={toggleDictation}
                title={lang === 'hi' ? 'बोलकर बताएं (Voice Dictation)' : 'Speak (Voice Dictation)'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  bottom: '15px',
                  background: isListening ? '#f44336' : '#1f2937',
                  color: isListening ? 'white' : '#60a5fa',
                  border: `1px solid ${isListening ? '#f44336' : '#374151'}`,
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  transition: 'all 0.3s ease',
                  fontSize: '18px'
                }}
              >
                {isListening ? (
                  <span className="pulsing-mic" style={{ animation: 'pulse 1.5s infinite' }}>🛑</span>
                ) : (
                  <span>🎤</span>
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="error-banner">⚠️ {errorMsg}</div>
            )}

            <button
              className={`analyze-btn ${isAnalyzing ? 'loading' : ''}`}
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <><span className="btn-spinner" /> Processing...</>
              ) : (
                <>🧠 Analyze with AI</>
              )}
            </button>

            {/* Process Steps */}
            <div className="process-steps">
              <div className="process-step">
                <div className="step-icon">📄</div>
                <div className="step-text">PDF / Photo</div>
              </div>
              <div className="process-arrow">→</div>
              <div className="process-step">
                <div className="step-icon">🔤</div>
                <div className="step-text">OCR Text</div>
              </div>
              <div className="process-arrow">→</div>
              <div className="process-step">
                <div className="step-icon">🤖</div>
                <div className="step-text">AI Analysis</div>
              </div>
              <div className="process-arrow">→</div>
              <div className="process-step">
                <div className="step-icon">⚖️</div>
                <div className="step-text">BNS + SOP</div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="results-panel">
            {!analysisResult && !isAnalyzing && (
              <div className="results-empty">
                <div className="empty-icon">🔎</div>
                <div className="empty-title">Upload a Document to Analyze</div>
                <div className="empty-subtitle">
                  AI will extract text using OCR and provide:<br />
                  ⚖️ BNS/BNSS Sections • 📋 SOP Steps • 🏛️ SC & HC Judgments • ⏰ Deadlines • 🔍 Evidence Checklist
                </div>
                <div className="supported-types">
                  <div className="supported-item">📸 <strong>Photo JPG/PNG</strong> – Crime scene, victim photo, documents</div>
                  <div className="supported-item">📄 <strong>PDF</strong> – Digital or scanned PDFs (text + scanned both)</div>
                  <div className="supported-item">✍️ <strong>Handwritten</strong> – Application, complaint letter in Hindi/English</div>
                  <div className="supported-item">📝 <strong>Text</strong> – Type or paste complaint directly</div>
                </div>
              </div>
            )}

            {isAnalyzing && (
              <div className="analyzing-state">
                <div className="analyzing-spinner" />
                <div className="analyzing-title">Processing your documents...</div>
                <div className="analyzing-step">{analyzeProgress}</div>
                <div className="analyzing-steps">
                  <div className={`a-step ${analyzeProgress ? 'active' : ''}`}>📄 Preparing files</div>
                  <div className={`a-step ${analyzeProgress.includes('ready') || analyzeProgress.includes('OCR') ? 'active' : ''}`}>🔤 OCR reading</div>
                  <div className={`a-step ${analyzeProgress.includes('AI') || analyzeProgress.includes('analyzing') ? 'active' : ''}`}>🤖 AI analyzing</div>
                  <div className="a-step">📋 BNS Report</div>
                </div>
              </div>
            )}

            {analysisResult && (
              <AnalysisResults
                result={analysisResult}
                hindiResult={hindiResult}
                lang={lang}
                onLawClick={(code) => setLawDrawer({ visible: true, code })}
                folderSOPs={folderSOPs}
                folderSOPsLoading={folderSOPsLoading}
              />
            )}
          </div>
        </div>
      )}

      {/* Law Detail Drawer */}
      <LawDetailDrawer
        visible={lawDrawer.visible}
        sectionCode={lawDrawer.code}
        token={token}
        lang={lang}
        onClose={() => setLawDrawer({ visible: false, code: '' })}
      />
    </div>
  );
}
