import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Row, Col, Card, Statistic, Table, Button, Tag,
  Space, message, Divider, Tooltip, Empty, Badge, Progress, List, Alert, Tabs
} from 'antd';
import {
  EnvironmentOutlined, AlertOutlined, SafetyCertificateOutlined,
  LineChartOutlined, SyncOutlined, CheckCircleOutlined,
  WarningOutlined, FireOutlined, UserOutlined, CarOutlined,
  ClockCircleOutlined, PhoneOutlined, LinkOutlined, ThunderboltOutlined,
  EyeOutlined, ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useTranslation } from 'react-i18next';

import CrimeMapLive from '../components/CrimeMapLive';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const API = 'http://localhost:3000/api/preventive';

const PRIORITY_COLOR    = { HIGH: 'red', MEDIUM: 'orange', LOW: 'green' };
const RISK_COLOR = (score) => score >= 70 ? '#f5222d' : score >= 40 ? '#fa8c16' : '#52c41a';

const PATTERN_ICON = {
  REPEATED_LOCATION: <EnvironmentOutlined style={{ color: '#1890ff' }} />,
  REPEATED_MOBILE:   <PhoneOutlined      style={{ color: '#722ed1' }} />,
  REPEATED_VEHICLE:  <CarOutlined        style={{ color: '#13c2c2' }} />,
  REPEATED_PERSON:   <UserOutlined       style={{ color: '#fa8c16' }} />,
};

const HOTSPOT_TYPE_COLOR = {
  'Theft Prone':    'orange',
  'Assault Prone':  'red',
  'Vehicle Crime':  'cyan',
  'Repeated Area':  'purple',
  'High Activity':  'volcano',
};

export default function CrimeMap() {
  const { t } = useTranslation();
  const [summary,     setSummary]     = useState({ totalHotspots: 0, highRiskAreas: 0, pendingActions: 0, weeklySignals: 0, patternCount: 0, totalGD: 0, flaggedGD: 0 });
  const [hotspots,    setHotspots]    = useState([]);
  const [patterns,    setPatterns]    = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [signals,     setSignals]     = useState([]);
  const [mapData,     setMapData]     = useState([]);
  const [trends,      setTrends]      = useState({ daily: [], timeBands: [] });
  const [offenders,   setOffenders]   = useState([]);
  const [shoAlerts,   setShoAlerts]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [syncing,     setSyncing]     = useState(false);
  const [activeTab,   setActiveTab]   = useState('hotspots');
  const [lastSync,    setLastSync]    = useState(null);
  
  const [predictions, setPredictions] = useState([]);
  const [beatClusters, setBeatClusters] = useState([]);
  const [timelineData, setTimelineData] = useState([]);

  // ── Fetch all data ─────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const ts = new Date().getTime();
      const fetchOpts = { cache: 'no-store', headers: { 'Pragma': 'no-cache' } };
      
      const [sumR, hotR, patR, sugR, sigR, mapR, tR, offR, alertR, pR, cR, tlR] = await Promise.all([
        fetch(`${API}/dashboard-summary?t=${ts}`, fetchOpts),
        fetch(`${API}/hotspots?t=${ts}`, fetchOpts),
        fetch(`${API}/patterns?t=${ts}`, fetchOpts),
        fetch(`${API}/suggestions?t=${ts}`, fetchOpts),
        fetch(`${API}/signals?t=${ts}`, fetchOpts),
        fetch(`${API}/map-data?t=${ts}`, fetchOpts),
        fetch(`${API}/trends?t=${ts}`, fetchOpts),
        fetch(`${API}/repeat-offenders?t=${ts}`, fetchOpts),
        fetch(`${API}/sho-alerts?t=${ts}`, fetchOpts),
        fetch(`${API}/predictions?t=${ts}`, fetchOpts),
        fetch(`${API}/beat-clusters?t=${ts}`, fetchOpts),
        fetch(`${API}/timeline-data?t=${ts}`, fetchOpts),
      ]);
      const [sum, hot, pat, sug, sig, map, trendsData, off, alerts, preds, clusters, tline] = await Promise.all([
        sumR.json(), hotR.json(), patR.json(), sugR.json(), sigR.json(), mapR.json(), tR.json(), offR.json(), alertR.json(),
        pR.json(), cR.json(), tlR.json()
      ]);

      setSummary(sum || {});
      setHotspots(Array.isArray(hot) ? hot : []);
      setPatterns(Array.isArray(pat) ? pat : []);
      setSuggestions(Array.isArray(sug) ? sug : []);
      setSignals(Array.isArray(sig) ? sig : []);
      setMapData(Array.isArray(map) ? map : []);
      setTrends(trendsData || { daily: [], timeBands: [] });
      setOffenders(Array.isArray(off) ? off : []);
      setShoAlerts(Array.isArray(alerts) ? alerts : []);
      setPredictions(Array.isArray(preds) ? preds : []);
      setBeatClusters(Array.isArray(clusters) ? clusters : []);
      setTimelineData(Array.isArray(tline) ? tline : []);
    } catch {
      message.info('No data available yet. Click Sync Intelligence.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Sync Intelligence ──────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API}/sync`, { method: 'POST' });
      
      let data = {};
      try {
        data = await res.json();
      } catch (err) {
        throw new Error("Invalid response from server");
      }
      
      if (!res.ok || !data.success) {
        console.error("SYNC ERROR:", data.error, "\nStack:", data?.stack);
        message.error("Sync failed: " + (data.error || 'Unknown server error'));
        return;
      }
      
      // Auto-generate AI predictions after sync
      await fetch(`${API}/generate-predictions`, { method: 'POST' });

      message.success('Intelligence synced successfully');
      setLastSync(new Date());
      await fetchAll(); // Immediate UI re-fetch state update

    } catch (err) {
      console.error("SYNC FATAL ERROR:", err);
      message.error("Sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // ── Mark suggestion done ──────────────────────────────────
  const markDone = async (id) => {
    try {
      const res = await fetch(`${API}/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE' }),
      });
      if (res.ok) {
        message.success('Action marked as done');
        setSuggestions(prev => prev.filter(s => s.id !== id));
        setSummary(prev => ({ ...prev, pendingActions: Math.max(0, prev.pendingActions - 1) }));
      }
    } catch {
      message.error('Failed to update action');
    }
  };

  // ── Hotspot table columns ─────────────────────────────────
  const hotspotCols = [
    {
      title: 'Area / Location',
      dataIndex: 'area',
      key: 'area',
      render: text => (
        <Space>
          <EnvironmentOutlined style={{ color: '#1890ff' }} />
          <div style={{ fontSize: 12, fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {text}
          </div>
        </Space>
      ),
    },
    {
      title: 'Sources',
      dataIndex: 'source',
      key: 'source',
      render: raw => {
        // source is a comma-separated string like "INCIDENT, ROUTINE"
        const types = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
        return (
          <Space size={4} wrap>
            {types.map(t => <Tag key={t} color="geekblue" style={{ fontSize: 10 }}>{t}</Tag>)}
          </Space>
        );
      },
    },
    {
      title: 'Signals',
      dataIndex: 'totalSignals',
      key: 'totalSignals',
      sorter: (a, b) => a.totalSignals - b.totalSignals,
      render: count => <Badge count={count} style={{ backgroundColor: '#1890ff' }} overflowCount={999} />,
    },
    {
      title: 'Risk Score',
      dataIndex: 'riskScore',
      key: 'riskScore',
      sorter: (a, b) => a.riskScore - b.riskScore,
      defaultSortOrder: 'descend',
      render: score => (
        <Space direction="vertical" size={2} style={{ width: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: RISK_COLOR(score) }}>
              {Math.round(score)} / 100
            </Text>
          </div>
          <Progress
            percent={Math.round(score)}
            size="small"
            showInfo={false}
            strokeWidth={4}
            strokeColor={RISK_COLOR(score)}
          />
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: t => <Tag color={HOTSPOT_TYPE_COLOR[t] || 'purple'}>{t}</Tag>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => <Badge status="success" text={<Text style={{ fontSize: 11 }}>Active</Text>} />,
    },
    {
      title: 'Updated',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      render: d => (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {dayjs(d).format('DD MMM, HH:mm')}
        </Text>
      ),
    },
  ];

  // ── Signal feed table columns ─────────────────────────────
  const signalCols = [
    {
      title: 'GD No.',
      dataIndex: 'gdNumber',
      key: 'gdNumber',
      width: 140,
      render: t => <Text strong style={{ fontSize: 11, color: '#1890ff', fontFamily: 'monospace' }}>{t}</Text>,
    },
    {
      title: 'Date/Time',
      key: 'dt',
      width: 90,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11 }}>{dayjs(r.gdDate).format('DD MMM')}</Text>
          <Text type="secondary" style={{ fontSize: 10 }}>{r.gdTime}</Text>
        </Space>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      ellipsis: true,
    },
    {
      title: 'Score',
      dataIndex: 'confidenceScore',
      key: 'confidenceScore',
      width: 70,
      sorter: (a, b) => a.confidenceScore - b.confidenceScore,
      defaultSortOrder: 'descend',
      render: s => (
        <Tag
          color={s >= 70 ? 'red' : s >= 40 ? 'orange' : 'gold'}
          style={{ fontSize: 10 }}
        >
          {Math.round(s)}
        </Tag>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'intelligenceReason',
      key: 'intelligenceReason',
      ellipsis: true,
      render: r => r ? (
        <Tooltip title={r}>
          <Text style={{ fontSize: 11, color: '#faad14' }}>
            <WarningOutlined /> {r.length > 50 ? r.slice(0, 50) + '…' : r}
          </Text>
        </Tooltip>
      ) : '—',
    },
    {
      title: 'Links',
      key: 'links',
      width: 70,
      render: (_, r) => (
        <Space size={2}>
          {r.complaintId && <Tag color="purple" style={{ fontSize: 9, margin: 0 }}>CMP</Tag>}
          {r.firId && <Tag color="magenta" style={{ fontSize: 9, margin: 0 }}>FIR</Tag>}
        </Space>
      ),
    },
  ];

  // ── Offender table columns ────────────────────────────────
  const offenderCols = [
    { title: 'Person/Details', dataIndex: 'personName', key: 'personName', render: (t, r) => <Space><UserOutlined style={{ color: '#1890ff' }}/><Text strong>{t || 'Unknown Person'}</Text></Space> },
    { title: 'Mobile', dataIndex: 'mobileNumber', key: 'mobile', render: t => t ? <Tag color="blue">{t}</Tag> : '—' },
    { title: 'Area', dataIndex: 'linkedArea', key: 'area' },
    { title: 'Frequency', dataIndex: 'frequency', key: 'freq', render: t => <Badge count={t} overflowCount={99} style={{ backgroundColor: '#fa8c16' }} /> },
    { title: 'Score', dataIndex: 'confidenceScore', key: 'score', render: s => <Text style={{ color: RISK_COLOR(s), fontWeight: 'bold' }}>{Math.round(s)}</Text> },
    { title: 'Summary', dataIndex: 'summary', key: 'summary', ellipsis: true },
  ];

  const hasData = hotspots.length > 0 || patterns.length > 0 || signals.length > 0 || offenders.length > 0;

  return (
    <div className="dashboard-container">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            <EnvironmentOutlined style={{ marginRight: 8, color: '#f5222d' }} />
            Preventive Policing & Crime Intelligence
          </Title>
          <Text type="secondary">
            Automated intelligence from Smart GD signals, pattern analysis, and hotspot generation
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchAll}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<SyncOutlined spin={syncing} />}
            onClick={handleSync}
            loading={syncing}
            style={{ background: 'linear-gradient(135deg, #f5222d, #fa541c)' }}
          >
            Sync Intelligence
          </Button>
        </Space>
      </div>

      {/* ── No data alert ────────────────────────────────────── */}
      {!loading && !hasData && (
        <Alert
          type="info"
          showIcon
          icon={<ThunderboltOutlined />}
          message="No Intelligence Data Yet"
          description='Submit Smart GD entries at /gd, then click "Sync Intelligence" to generate hotspots, patterns, and suggestions.'
          style={{ marginBottom: 24 }}
          action={
            <Button type="primary" onClick={handleSync}>
              Run Sync Now
            </Button>
          }
        />
      )}

      {/* ── 1. Summary Cards ─────────────────────────────────── */}
      <div className="summary-grid">
        <Card bordered={false} className="summary-card" style={{ borderTop: '3px solid #1890ff' }}>
          <Statistic
            title="Active Hotspots"
            value={summary.activeHotspots ?? 0}
            prefix={<EnvironmentOutlined style={{ color: '#1890ff' }} />}
          />
        </Card>
        <Card bordered={false} className="summary-card" style={{ borderTop: '3px solid #f5222d' }}>
          <Statistic
            title="High Risk Zones"
            value={summary.highRiskZones ?? 0}
            prefix={<FireOutlined style={{ color: '#f5222d' }} />}
            valueStyle={{ color: (summary.highRiskZones ?? 0) > 0 ? '#f5222d' : 'inherit' }}
          />
        </Card>
        <Card bordered={false} className="summary-card" style={{ borderTop: '3px solid #722ed1' }}>
          <Statistic
            title="Weekly Signals"
            value={summary.weeklySignals ?? 0}
            prefix={<LineChartOutlined style={{ color: '#722ed1' }} />}
          />
        </Card>
        <Card bordered={false} className="summary-card" style={{ borderTop: '3px solid #13c2c2' }}>
          <Statistic
            title="Patterns Detected"
            value={summary.patternsDetected ?? 0}
            prefix={<AlertOutlined style={{ color: '#13c2c2' }} />}
          />
        </Card>
        <Card bordered={false} className="summary-card" style={{ borderTop: '3px solid #faad14' }}>
          <Statistic
            title="Pending Actions"
            value={summary.pendingActions ?? 0}
            prefix={<SafetyCertificateOutlined style={{ color: '#faad14' }} />}
            valueStyle={{ color: (summary.pendingActions ?? 0) > 0 ? '#faad14' : 'inherit' }}
          />
        </Card>
        <Card bordered={false} className="summary-card" style={{ borderTop: '3px solid #52c41a' }}>
          <Statistic
            title="GD Flagged"
            value={summary.gdFlagged ?? 0}
            suffix={`/ ${summary.gdTotal ?? 0}`}
            prefix={<WarningOutlined style={{ color: '#52c41a' }} />}
          />
        </Card>
      </div>

      {/* ── 2. SHO Alerts ────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <AlertOutlined style={{ color: '#f5222d' }} />
                SHO Dashboard Alerts
                {shoAlerts.length > 0 && (
                  <Badge count={shoAlerts.length} style={{ backgroundColor: '#f5222d' }} />
                )}
              </Space>
            }
            bordered={false}
            styles={{ body: { padding: '10px 14px' } }}
          >
            {shoAlerts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px' }}>
                <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>No active alerts. All units operating normally.</Text>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                {shoAlerts.map(alert => (
                  <div
                    key={alert.id}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 5,
                      background: alert.severity === 'HIGH' ? 'rgba(245,34,45,0.06)' : 'rgba(250,173,20,0.06)',
                      border: '1px solid #1f2937',
                      borderLeft: `3px solid ${alert.severity === 'HIGH' ? '#f5222d' : '#faad14'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 12, color: alert.severity === 'HIGH' ? '#ff4d4f' : '#ffc53d', lineHeight: '18px' }}>
                        {alert.title}
                      </Text>
                      <Tag color={alert.severity === 'HIGH' ? 'red' : 'gold'} style={{ fontSize: 10, margin: 0, lineHeight: '16px', padding: '0 5px' }}>
                        {alert.severity}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                      {alert.description}
                    </Text>
                    {alert.linkedArea && (
                      <Tag color="cyan" style={{ fontSize: 10, marginTop: 4 }}>📍 {alert.linkedArea}</Tag>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── 3. Area Hotspot Map (full width) ─────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card
            title={<Space><EnvironmentOutlined style={{ color: '#1890ff' }} />{t('map.areaMap') || 'Area Hotspot Map'}</Space>}
            bordered={false}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ height: 420, borderTop: '1px solid #1f2937', boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <CrimeMapLive
                mapData={mapData}
                fetching={loading}
                beatClusters={beatClusters}
                timelineData={timelineData}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── 4. Hotspot Table / Tabbed Intelligence ───────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card bordered={false} styles={{ body: { padding: '0 0 16px' } }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              style={{ padding: '0 16px' }}
              items={[
                {
                  key: 'hotspots',
                  label: <Space><FireOutlined style={{ color: '#f5222d' }} />Hotspots ({hotspots.length})</Space>,
                  children: (
                    hotspots.length === 0 ? (
                      <Empty
                        description={
                          <span>
                            No hotspots yet. Submit flagged GD entries at <strong>/gd</strong> then click <strong>Sync Intelligence</strong>.
                          </span>
                        }
                        style={{ padding: '40px 0' }}
                      />
                    ) : (
                      <Table
                        size="small"
                        dataSource={hotspots}
                        columns={hotspotCols}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 8, size: 'small' }}
                        rowClassName={r => r.riskScore >= 70 ? 'high-risk-row' : ''}
                      />
                    )
                  ),
                },
                {
                  key: 'patterns',
                  label: <Space><AlertOutlined style={{ color: '#13c2c2' }} />Patterns ({patterns.length})</Space>,
                  children: (
                    patterns.length === 0 ? (
                      <Empty
                        description="No patterns detected yet. Add more GD entries to generate patterns."
                        style={{ padding: '40px 0' }}
                      />
                    ) : (
                      <List
                        dataSource={patterns}
                        renderItem={p => (
                          <List.Item style={{ padding: '10px 16px', borderBottom: '1px solid #1f2937' }}>
                            <Space style={{ width: '100%' }} direction="vertical" size={4}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space>
                                  {PATTERN_ICON[p.patternType] || <ClockCircleOutlined />}
                                  <Text strong style={{ fontSize: 13 }}>{p.linkedValue}</Text>
                                  <Tag color="cyan" style={{ fontSize: 10 }}>
                                    {p.patternType.replace(/_/g, ' ')}
                                  </Tag>
                                </Space>
                                <Space>
                                  <Badge
                                    count={p.count}
                                    style={{ backgroundColor: '#1890ff' }}
                                    overflowCount={99}
                                  />
                                </Space>
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>{p.description}</Text>
                            </Space>
                          </List.Item>
                        )}
                        pagination={{ pageSize: 6, size: 'small' }}
                      />
                    )
                  ),
                },
                {
                  key: 'signals',
                  label: <Space><WarningOutlined style={{ color: '#faad14' }} />GD Signals ({signals.length})</Space>,
                  children: (
                    signals.length === 0 ? (
                      <Empty
                        description="No intelligence signals yet. Submit GD entries with suspicious details to generate signals."
                        style={{ padding: '40px 0' }}
                      />
                    ) : (
                      <Table
                        size="small"
                        dataSource={signals}
                        columns={signalCols}
                        rowKey="id"
                        loading={loading}
                        scroll={{ x: 600 }}
                        pagination={{ pageSize: 8, size: 'small' }}
                      />
                    )
                  ),
                },
                {
                  key: 'offenders',
                  label: <Space><UserOutlined style={{ color: '#eb2f96' }} />Repeat Offenders ({offenders.length})</Space>,
                  children: (
                    offenders.length === 0 ? (
                      <Empty
                        description="No repeat suspects identified. Auto-detection is monitoring live signals."
                        style={{ padding: '40px 0' }}
                      />
                    ) : (
                      <Table
                        size="small"
                        dataSource={offenders}
                        columns={offenderCols}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 8, size: 'small' }}
                      />
                    )
                  ),
                },
                {
                  key: 'predictions',
                  label: <Space><ThunderboltOutlined style={{ color: '#eb2f96' }} />{t('map.predictions') || 'Predictions'} ({predictions.length})</Space>,
                  children: (
                    predictions.length === 0 ? (
                      <Empty
                        description="No crime predictions generated."
                        style={{ padding: '40px 0' }}
                      />
                    ) : (
                      <List
                        dataSource={predictions}
                        renderItem={p => (
                          <List.Item style={{ padding: '10px 16px', borderBottom: '1px solid #1f2937' }}>
                            <Space style={{ width: '100%' }} direction="vertical" size={4}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space>
                                  <AlertOutlined style={{ color: p.predictedRisk >= 80 ? '#f5222d' : '#fa8c16' }} />
                                  <Text strong style={{ fontSize: 13 }}>{p.areaName}</Text>
                                  <Tag color={p.predictedRisk >= 80 ? 'red' : 'orange'} style={{ fontSize: 10 }}>
                                    Risk: {p.predictedRisk}%
                                  </Tag>
                                </Space>
                                <Tag color={p.confidence >= 80 ? 'green' : 'gold'} style={{ fontSize: 10 }}>
                                  {(t('map.confidence') || 'Confidence')}: {p.confidence}%
                                </Tag>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                <Text type="secondary">{(t('map.likelyTimeBand') || 'Likely Time Band')}: <b>{p.likelyTimeBand}</b></Text>
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>{p.reason}</Text>
                            </Space>
                          </List.Item>
                        )}
                        pagination={{ pageSize: 6, size: 'small' }}
                      />
                    )
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* ── 5. Intelligence Trends  +  6. Suggested Actions ──────── */}
      <Row gutter={[16, 16]}>
        {/* Trends */}
        <Col xs={24} lg={14}>
          <Card
            title={<Space><LineChartOutlined style={{ color: '#13c2c2' }} />Intelligence Trends</Space>}
            bordered={false}
            styles={{ body: { padding: '16px' } }}
          >
            <Tabs defaultActiveKey="daily">
              <TabPane tab="Daily Suspicious Activity" key="daily">
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#888" fontSize={11} />
                      <YAxis stroke="#888" fontSize={11} width={30} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                      <Line type="monotone" dataKey="count" stroke="#1890ff" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabPane>
              <TabPane tab="Time Band Risk Profile" key="time">
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends.timeBands}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#888" fontSize={11} />
                      <YAxis stroke="#888" fontSize={11} width={30} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Bar dataKey="value" fill="#fa8c16" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabPane>
            </Tabs>
          </Card>
        </Col>

        {/* Suggested Actions */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#faad14' }} />
                Suggested Actions
                {suggestions.length > 0 && (
                  <Badge count={suggestions.length} style={{ backgroundColor: '#faad14' }} />
                )}
              </Space>
            }
            bordered={false}
            styles={{ body: { padding: '8px 12px', maxHeight: 380, overflowY: 'auto' } }}
          >
            {suggestions.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 4px' }}>
                <CheckCircleOutlined style={{ fontSize: 16, color: '#52c41a' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>No pending actions. Sync Intelligence to generate patrol recommendations.</Text>
              </div>
            ) : (
              suggestions.map(sug => (
                <div
                  key={sug.id}
                  style={{
                    marginBottom: 6,
                    padding: '6px 10px',
                    borderRadius: 5,
                    borderLeft: `3px solid ${PRIORITY_COLOR[sug.priority] || '#1890ff'}`,
                    background: '#131826',
                    border: '1px solid #1f2937',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {sug.action}
                    </Text>
                    <Space size={3} style={{ flexShrink: 0 }}>
                      <Tag color={PRIORITY_COLOR[sug.priority]} style={{ fontSize: 10, margin: 0, padding: '0 5px' }}>
                        {sug.priority}
                      </Tag>
                      <Tooltip title="Mark as done">
                        <Button
                          size="small"
                          type="text"
                          icon={<CheckCircleOutlined />}
                          onClick={() => markDone(sug.id)}
                          style={{ color: '#52c41a', padding: '0 4px' }}
                        />
                      </Tooltip>
                    </Space>
                  </div>
                  {sug.area && sug.area !== 'Citywide' && (
                    <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>📍 {sug.area}</Text>
                  )}
                </div>
              ))
            )}
          </Card>

          {/* ── Last Sync / Operational Info Panel ────────────── */}
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#722ed1' }} />
                Operational Status
              </Space>
            }
            bordered={false}
            style={{ marginTop: 16 }}
            styles={{ body: { padding: '12px' } }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ background: '#131826', padding: '8px 10px', borderRadius: '5px', border: '1px solid #1f2937' }}>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Total GD</Text>
                  <Text strong style={{ fontSize: 16, color: '#1890ff' }}>{summary.gdTotal ?? 0}</Text>
                </div>
                <div style={{ background: '#131826', padding: '8px 10px', borderRadius: '5px', border: '1px solid #1f2937' }}>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Flagged GD</Text>
                  <Text strong style={{ fontSize: 16, color: (summary.gdFlagged ?? 0) > 0 ? '#ff4d4f' : '#595959' }}>{summary.gdFlagged ?? 0}</Text>
                </div>
                <div style={{ background: '#131826', padding: '8px 10px', borderRadius: '5px', border: '1px solid #1f2937' }}>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Hotspots</Text>
                  <Text strong style={{ fontSize: 16, color: '#fa8c16' }}>{summary.activeHotspots ?? 0}</Text>
                </div>
                <div style={{ background: '#131826', padding: '8px 10px', borderRadius: '5px', border: '1px solid #1f2937' }}>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Patterns</Text>
                  <Text strong style={{ fontSize: 16, color: '#13c2c2' }}>{summary.patternsDetected ?? 0}</Text>
                </div>
              </div>
              <div style={{ background: '#131826', padding: '8px 10px', borderRadius: '5px', border: '1px solid #1f2937' }}>
                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>Last Intelligence Sync</Text>
                <Text style={{ fontSize: 12, color: lastSync ? '#52c41a' : '#8c8c8c' }}>
                  {lastSync ? dayjs(lastSync).format('DD MMM YYYY, HH:mm:ss') : 'Not synced this session'}
                </Text>
              </div>
              <Divider style={{ margin: '2px 0' }} />
              <Button
                block
                icon={<SyncOutlined spin={syncing} />}
                onClick={handleSync}
                loading={syncing}
                type="dashed"
              >
                Sync Intelligence
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <style>{`
        .summary-grid {
          display: grid;
          gap: 16px;
          margin-bottom: 24px;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 768px) {
          .summary-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 992px) {
          .summary-grid { grid-template-columns: repeat(6, 1fr); }
        }
        .summary-card .ant-card-body {
          padding: 12px;
          text-align: center;
        }
        .summary-card .ant-statistic-title {
          font-size: 12px;
          font-weight: 300;
        }
        .summary-card .ant-statistic-content {
          font-size: 24px;
          font-weight: bold;
        }
        .summary-card .anticon {
          font-size: 14px;
          margin-right: 4px;
        }
        .high-risk-row td {
          background: rgba(245, 34, 45, 0.04) !important;
        }
        .high-risk-row:hover td {
          background: rgba(245, 34, 45, 0.08) !important;
        }
      `}</style>
    </div>
  );
}
