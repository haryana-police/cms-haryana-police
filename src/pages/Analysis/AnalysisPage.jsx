import React, { useState, useEffect } from 'react';
import styles from './Analysis.module.css';
import TimelineView from './TimelineView';
import KnowledgeGraphView from './KnowledgeGraphView';
import CDRAnalysisView from './CDRAnalysisView';
import InsightsView from './InsightsView';

const TABS = [
    { id: 'timeline', label: 'Timeline', icon: 'fa-regular fa-calendar-days' },
    { id: 'graph', label: 'Knowledge Graph', icon: 'fa-solid fa-project-diagram' },
    { id: 'cdr', label: 'CDR Analysis', icon: 'fa-solid fa-phone-flip' },
    { id: 'insights', label: 'AI Insights', icon: 'fa-solid fa-brain' },
];

export default function AnalysisPage() {
    const [cases, setCases] = useState([]);
    const [selectedCaseId, setSelectedCaseId] = useState('');
    const [selectedCase, setSelectedCase] = useState(null);
    const [activeTab, setActiveTab] = useState('timeline');
    const [loading, setLoading] = useState(true);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetch('/api/analysis/cases', { headers })
            .then(r => r.json())
            .then(data => {
                setCases(data);
                if (data.length > 0) {
                    setSelectedCaseId(data[0].id);
                    setSelectedCase(data[0]);
                }
                setLoading(false);
            })
            .catch((e) => {
                console.error(e);
                setLoading(false);
            });
    }, []);

    const handleCaseChange = (id) => {
        setSelectedCaseId(id);
        setSelectedCase(cases.find(c => c.id === id) || null);
        setActiveTab('timeline');
    };

    const statusColor = (status) => {
        const map = { open: '#f59e0b', investigation: '#3b82f6', challan: '#8b5cf6', closed: '#10b981' };
        return map[status] || '#6b7280';
    };

    const typeColor = (type) => type === 'fir' ? '#ef4444' : '#f59e0b';

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        <span className={styles.titleIcon}>
                            <i className="fa-solid fa-chart-pie"></i>
                        </span>
                        Case Analytics & Visualization
                    </h1>
                    <p className={styles.subtitle}>
                        LLM Wiki Graph · Entity Relationship · CDR Analysis · Investigation Insights
                    </p>
                </div>
            </div>

            {/* Case Selector */}
            <div className={styles.selectorCard}>
                <label className={styles.selectorLabel}>
                    <i className="fa-solid fa-folder-open" style={{ marginRight: 6 }}></i>
                    Select Case
                </label>
                <div className={styles.selectorRow}>
                    <select
                        className={styles.caseSelect}
                        value={selectedCaseId}
                        onChange={e => handleCaseChange(e.target.value)}
                    >
                        {cases.map(c => (
                            <option key={c.id} value={c.id}>
                                [{c.case_type.toUpperCase()}] {c.title} — {c.status}
                            </option>
                        ))}
                    </select>
                    {selectedCase && (
                        <div className={styles.caseMeta}>
                            <span className={styles.badge} style={{ background: typeColor(selectedCase.case_type) }}>
                                {selectedCase.case_type.toUpperCase()}
                            </span>
                            <span className={styles.badge} style={{ background: statusColor(selectedCase.status) }}>
                                {selectedCase.status}
                            </span>
                            <span className={styles.metaText}>
                                IO: {selectedCase.io_name || '—'} · {selectedCase.offense_section || 'No section'}
                            </span>
                        </div>
                    )}
                </div>
                {selectedCase && (
                    <p className={styles.caseDesc}>{selectedCase.description}</p>
                )}
            </div>

            {/* Tab Navigation */}
            <div className={styles.tabBar}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <i className={tab.icon}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className={styles.tabContent}>
                {loading ? (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner} />
                        <p>Loading case data...</p>
                    </div>
                ) : !selectedCaseId ? (
                    <div className={styles.emptyState}>
                        <i className="fa-regular fa-folder-open" style={{ fontSize: '2rem' }}></i>
                        No cases found. Register a complaint to begin.
                    </div>
                ) : (
                    <>
                        {activeTab === 'timeline' && <TimelineView caseId={selectedCaseId} headers={headers} />}
                        {activeTab === 'graph' && <KnowledgeGraphView caseId={selectedCaseId} headers={headers} />}
                        {activeTab === 'cdr' && <CDRAnalysisView caseId={selectedCaseId} headers={headers} />}
                        {activeTab === 'insights' && <InsightsView caseId={selectedCaseId} headers={headers} />}
                    </>
                )}
            </div>
        </div>
    );
}
