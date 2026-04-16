import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Row, Col, Card, Form, Input, Button, Table,
  Select, DatePicker, TimePicker, Badge, message, Statistic, Tag,
  Space, Switch, Drawer, Tooltip, Divider, Alert, Modal
} from 'antd';
import {
  WarningOutlined, FileDoneOutlined, UploadOutlined,
  SearchOutlined, RetweetOutlined, EyeOutlined, EditOutlined,
  LinkOutlined, PlusOutlined, SyncOutlined, BookOutlined,
  AlertOutlined, ClockCircleOutlined, EnvironmentOutlined,
  PhoneOutlined, CarOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
import { haryanaPoliceHierarchy } from '../data/haryanaPoliceHierarchy';

dayjs.extend(relativeTime);

const HARYANA_DISTRICTS = Object.keys(haryanaPoliceHierarchy).sort();

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const API = 'http://localhost:3000/api/gd';

// Replaced by haryanaPoliceHierarchy — see state: selectedDistrict, selectedStation

const ENTRY_CATEGORIES = [
  { value: 'ARRIVAL', label: 'Arrival' },
  { value: 'DEPARTURE', label: 'Departure' },
  { value: 'ARREST', label: 'Arrest' },
  { value: 'SEIZURE', label: 'Seizure' },
  { value: 'INFORMATION', label: 'Information' },
  { value: 'PATROL', label: 'Patrol' },
];

const DUTY_TYPES = [
  { value: 'PATROL', label: 'Patrol' },
  { value: 'INVESTIGATION', label: 'Investigation' },
  { value: 'EMERGENCY', label: 'Emergency' },
];

const RANKS = ['CONSTABLE', 'HEAD_CONSTABLE', 'ASI', 'SI', 'INSPECTOR', 'SHO'];

const PRIORITY_COLORS = { HIGH: 'red', NORMAL: 'blue', LOW: 'default' };
const ENTRY_CATEGORY_COLORS = {
  ARRIVAL: 'green', DEPARTURE: 'orange', ARREST: 'red',
  SEIZURE: 'volcano', INFORMATION: 'cyan', PATROL: 'blue'
};

export default function SmartGD() {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [drawerForm] = Form.useForm();

  const [entries, setEntries] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [stats, setStats] = useState({ total: 0, flagged: 0, highPriority: 0, todayCount: 0 });
  const [flaggedEntries, setFlaggedEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualFlag, setManualFlag] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeSearch, setActiveSearch] = useState({});

  // Hierarchical location cascade
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedStation, setSelectedStation]   = useState(null);

  // Drawer
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);

  // Search filter UI state
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  // ── Fetch stats ────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* silent */ }
  }, []);

  // ── Fetch entries list ─────────────────────────────────────
  const fetchEntries = useCallback(async (page = 1, size = 10, searchParams = {}) => {
    setLoading(true);
    try {
      const hasSearch = Object.keys(searchParams).length > 0;
      const params = new URLSearchParams({ page, limit: size });
      if (hasSearch) {
        Object.keys(searchParams).forEach(key => {
          if (searchParams[key] !== undefined && searchParams[key] !== '') {
            params.append(key, searchParams[key]);
          }
        });
      }

      const endpoint = hasSearch
        ? `${API}/search?${params}`
        : `${API}?${params}`;

      const res = await fetch(endpoint);
      const data = await res.json();

      setEntries(data.data || []);
      setTotalEntries(data.total || (data.data?.length) || 0);
    } catch {
      message.error('Failed to fetch GD entries');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch flagged feed ─────────────────────────────────────
  const fetchFlagged = useCallback(async () => {
    try {
      const res = await fetch(`${API}/flagged`);
      if (res.ok) {
        const data = await res.json();
        setFlaggedEntries(data || []);
      }
    } catch { /* silent */ }
  }, []);

  const refreshAll = useCallback(() => {
    fetchStats();
    fetchEntries(currentPage, pageSize, activeSearch);
    fetchFlagged();
  }, [fetchStats, fetchEntries, fetchFlagged, currentPage, pageSize, activeSearch]);

  useEffect(() => {
    fetchStats();
    fetchFlagged();
  }, [fetchStats, fetchFlagged]);

  useEffect(() => {
    fetchEntries(currentPage, pageSize, activeSearch);
  }, [fetchEntries, currentPage, pageSize, activeSearch]);

  // ── Search ─────────────────────────────────────────────────
  const handleSearch = (values) => {
    const searchValues = { ...values };
    if (values.dateRange?.length === 2) {
      searchValues.startDate = values.dateRange[0].toISOString();
      searchValues.endDate = values.dateRange[1].toISOString();
      delete searchValues.dateRange;
    }
    // Remove empty values
    Object.keys(searchValues).forEach(k => {
      if (!searchValues[k]) delete searchValues[k];
    });
    setCurrentPage(1);
    setActiveSearch(searchValues);
  };

  const handleReset = () => {
    searchForm.resetFields();
    setCurrentPage(1);
    setActiveSearch({});
  };

  // ── Submit new entry ───────────────────────────────────────
  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        gdDate: values.gdDate.toISOString(),
        gdTime: values.gdTime ? values.gdTime.format('HH:mm') : dayjs().format('HH:mm'),
        manualOverrideFlag: manualFlag,
      };

      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.intelligenceFlag) {
          message.warning({
            content: (
              <span>
                <strong>{t('messages.flagWarning')}</strong> {t('feed.score')}: {Math.round(data.confidenceScore || 0)}/100
                <br /><small>{data.intelligenceReason}</small>
              </span>
            ),
            duration: 6,
          });
        } else {
          message.success(t('messages.successCreate'));
        }
        form.resetFields();
        setManualFlag(false);
        setSelectedDistrict(null);
        setSelectedStation(null);
        refreshAll();
      } else {
        message.error(data.error || t('messages.errorCreate'));
      }
    } catch {
      message.error(t('messages.errorCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── View / Edit Entry ─────────────────────────────────────
  const openView = (record) => {
    setEditingRecord(record);
    setViewMode(true);
    setDrawerVisible(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setViewMode(false);
    setDrawerVisible(true);
    drawerForm.setFieldsValue({
      ...record,
      gdDate: dayjs(record.gdDate),
      gdTime: record.gdTime ? dayjs(record.gdTime, 'HH:mm') : null,
    });
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setEditingRecord(null);
    setViewMode(false);
    drawerForm.resetFields();
  };

  const onUpdateEntry = async (values) => {
    setSaveLoading(true);
    try {
      const payload = {
        ...values,
        gdDate: values.gdDate.toISOString(),
        gdTime: values.gdTime.format('HH:mm'),
      };
      const res = await fetch(`${API}/${editingRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        message.success(t('messages.successUpdate'));
        closeDrawer();
        refreshAll();
      } else {
        const data = await res.json();
        message.error(data.error || t('messages.errorUpdate'));
      }
    } catch {
      message.error(t('messages.errorUpdate'));
    } finally {
      setSaveLoading(false);
    }
  };

  // ── Table columns ─────────────────────────────────────────
  const columns = [
    {
      title: t('table.gdNo'),
      dataIndex: 'gdNumber',
      key: 'gdNumber',
      width: 160,
      render: text => <Text strong style={{ fontSize: 12, fontFamily: 'monospace', color: '#1890ff' }}>{text}</Text>,
    },
    {
      title: t('table.dateTime'),
      key: 'dateTime',
      width: 110,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{dayjs(record.gdDate).format('DD MMM YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}><ClockCircleOutlined /> {record.gdTime}</Text>
        </Space>
      ),
    },
    {
      title: t('table.typePriority'),
      key: 'type',
      width: 130,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Tag color={ENTRY_CATEGORY_COLORS[record.entryCategory] || 'default'} style={{ fontSize: 10, margin: 0 }}>
            {t(`enums.category.${record.entryCategory}`)}
          </Tag>
          <Tag color={PRIORITY_COLORS[record.priority] || 'default'} style={{ fontSize: 10, margin: 0 }}>
            {t(`enums.priority.${record.priority}`)}
          </Tag>
        </Space>
      ),
    },
    {
      title: t('table.personContact'),
      key: 'person',
      width: 140,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.personName && <Text style={{ fontSize: 12 }}>{record.personName}</Text>}
          {record.mobileNumber && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              <PhoneOutlined /> {record.mobileNumber}
            </Text>
          )}
          {record.vehicleNumber && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              <CarOutlined /> {record.vehicleNumber}
            </Text>
          )}
          {!record.personName && !record.mobileNumber && !record.vehicleNumber && (
            <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
          )}
        </Space>
      ),
    },
    {
      title: t('table.place'),
      key: 'location',
      ellipsis: true,
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tooltip title={record.location}>
            <Text style={{ fontSize: 12 }}>
              <EnvironmentOutlined style={{ color: '#52c41a', marginRight: 4 }} />
              {record.location}
            </Text>
          </Tooltip>
          {record.district && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              {record.district}{record.policeStation ? ` › ${record.policeStation}` : ''}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('table.linkages'),
      key: 'links',
      width: 90,
      render: (_, record) => (
        <Space size={4} direction="vertical">
          {record.complaintId && (
            <Tooltip title={`Complaint #${record.complaintId}`}>
              <Tag icon={<LinkOutlined />} color="purple" style={{ margin: 0, fontSize: 10 }}>CMP</Tag>
            </Tooltip>
          )}
          {record.firId && (
            <Tooltip title={`FIR #${record.firId}`}>
              <Tag icon={<LinkOutlined />} color="magenta" style={{ margin: 0, fontSize: 10 }}>FIR</Tag>
            </Tooltip>
          )}
          {!record.complaintId && !record.firId && (
            <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
          )}
        </Space>
      ),
    },
    {
      title: t('table.intel'),
      key: 'intel',
      width: 110,
      render: (_, record) => record.intelligenceFlag ? (
        <Tooltip title={record.intelligenceReason}>
          <Space direction="vertical" size={2}>
            <Tag color="red" icon={<WarningOutlined />} style={{ margin: 0, fontSize: 10 }}>
              {t('table.flagged')}
            </Tag>
            <Text style={{ fontSize: 10, color: '#faad14' }}>
              {t('feed.score')}: {Math.round(record.confidenceScore || 0)}/100
            </Text>
          </Space>
        </Tooltip>
      ) : (
        <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontSize: 10 }}>
          {t('table.clear')}
        </Tag>
      ),
    },
    {
      title: t('table.actions'),
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title={t('drawer.viewMode')}>
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openView(record)} />
          </Tooltip>
          <Tooltip title={t('drawer.editMode')}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];


  return (
    <div className="dashboard-container">
      {/* ── Page header ───────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 4 }}>
          <BookOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          {t('title')}
        </Title>
        <Text type="secondary">
          {t('subtitle')}
        </Text>
      </div>

      {/* ── Stats Cards ──────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderTop: '3px solid #1890ff' }}>
            <Statistic
              title={t('stats.totalGdEntries')}
              value={stats.total}
              prefix={<FileDoneOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderTop: '3px solid #f5222d' }}>
            <Statistic
              title={t('stats.flaggedSuspicious')}
              value={stats.flagged}
              prefix={<WarningOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: stats.flagged > 0 ? '#f5222d' : 'inherit' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderTop: '3px solid #fa8c16' }}>
            <Statistic
              title={t('stats.highPriority')}
              value={stats.highPriority}
              prefix={<AlertOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderTop: '3px solid #52c41a' }}>
            <Statistic
              title={t('stats.todaysEntries')}
              value={stats.todayCount}
              prefix={<ClockCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Main content: Form + Preventive Feed ─────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* ── GD Entry Form ──────────────────────────────── */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <PlusOutlined style={{ color: '#1890ff' }} />
                {t('form.newEntry')}
              </Space>
            }
            bordered={false}
            extra={
              <Tag color="geekblue" icon={<CheckCircleOutlined />}>{t('form.cctnsReady')}</Tag>
            }
          >
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ priority: 'NORMAL', gdDate: dayjs(), gdTime: dayjs() }}>
              {/* Row 1: GD Number, Date, Time */}
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name="gdNumber"
                    label={t('form.gdNumber')}
                  >
                    <Input placeholder={t('form.gdNumberPlaceholder')} readOnly disabled />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="gdDate" label={t('form.date')} rules={[{ required: true, message: t('validation.required') }]}>
                    <DatePicker style={{ width: '100%' }} disabledDate={d => d && d.isAfter(dayjs())} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="gdTime" label={t('form.time')} rules={[{ required: true, message: t('validation.required') }]}>
                    <TimePicker format="HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 2: Officer Name & Rank */}
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="officerName" label={t('form.officerName')} rules={[{ required: true, message: t('validation.required') }]}>
                    <Input placeholder={t('form.officerNamePlaceholder')} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="officerRank" label={t('form.officerRank')} rules={[{ required: true, message: t('validation.required') }]}>
                    <Select placeholder={t('form.officerRankPlaceholder')}>
                      {RANKS.map(r => <Option key={r} value={r}>{t(`enums.rank.${r}`)}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 3a: District → Police Station → Beat Area */}
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name="district"
                    label={t('form.district')}
                    rules={[{ required: true, message: t('validation.required') }]}
                  >
                    <Select
                      showSearch
                      placeholder={t('form.districtPlaceholder')}
                      onChange={(val) => {
                        setSelectedDistrict(val);
                        setSelectedStation(null);
                        form.setFieldsValue({ policeStation: undefined, beatArea: undefined });
                      }}
                    >
                      {HARYANA_DISTRICTS.map(d => (
                        <Option key={d} value={d}>{d}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="policeStation"
                    label={t('form.station')}
                    rules={[{ required: true, message: t('validation.required') }]}
                  >
                    <Select
                      showSearch
                      placeholder={t('form.stationPlaceholder')}
                      disabled={!selectedDistrict}
                      onChange={(val) => {
                        setSelectedStation(val);
                        form.setFieldsValue({ beatArea: undefined });
                      }}
                    >
                      {selectedDistrict &&
                        Object.keys(haryanaPoliceHierarchy[selectedDistrict].policeStations).map(ps => (
                          <Option key={ps} value={ps}>{ps}</Option>
                        ))
                      }
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="beatArea" label={t('form.beat')}>
                    <Select
                      showSearch
                      placeholder={t('form.beatPlaceholder')}
                      disabled={!selectedStation}
                      allowClear
                    >
                      {selectedDistrict && selectedStation &&
                        haryanaPoliceHierarchy[selectedDistrict].policeStations[selectedStation]?.map(beat => (
                          <Option key={beat} value={beat}>{beat}</Option>
                        ))
                      }
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 3b: Entry Category, Duty Type, Priority */}
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="entryCategory" label={t('form.entryCategory')} rules={[{ required: true, message: t('validation.required') }]}>
                    <Select placeholder={t('form.categoryPlaceholder')}>
                      {ENTRY_CATEGORIES.map(tOption => <Option key={tOption.value} value={tOption.value}>{t(`enums.category.${tOption.value}`)}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="dutyType" label={t('form.dutyType')} rules={[{ required: true, message: t('validation.required') }]}>
                    <Select placeholder={t('form.dutyPlaceholder')}>
                      {DUTY_TYPES.map(tOption => <Option key={tOption.value} value={tOption.value}>{t(`enums.duty.${tOption.value}`)}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="priority" label={t('form.priority')} rules={[{ required: true, message: t('validation.required') }]}>
                    <Select placeholder={t('form.priorityPlaceholder')}>
                      <Option value="LOW">{t('enums.priority.LOW')}</Option>
                      <Option value="NORMAL">{t('enums.priority.NORMAL')}</Option>
                      <Option value="HIGH">{t('enums.priority.HIGH')}</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 4: Person Name, Father Name, Mobile, Vehicle */}
              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="personName" label={t('form.personName')}>
                    <Input placeholder={t('form.personName')} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="fatherName" label={t('form.fatherName')}>
                    <Input placeholder={t('form.fatherName')} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name="mobileNumber"
                    label={t('form.mobileNumber')}
                    rules={[{ pattern: /^\d{10}$/, message: t('validation.invalidMobile') }]}
                  >
                    <Input placeholder={t('form.mobileNumberPlaceholder')} maxLength={10} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="vehicleNumber" label={t('form.vehicleNumber')}>
                    <Input placeholder={t('form.vehiclePlaceholder')} style={{ textTransform: 'uppercase' }} />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 4: Location, Linked IDs */}
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="location" label={t('form.location')} rules={[{ required: true, message: t('validation.required') }]}>
                    <Input placeholder={t('form.locationPlaceholder')} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="complaintId" label={t('form.linkComplaint')}>
                    <Input placeholder={t('form.linkComplaint')} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="firId" label={t('form.linkFir')}>
                    <Input placeholder={t('form.linkFir')} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="summaryEn" label={t('form.summaryEn')} rules={[{ required: true, message: t('validation.required') }]}>
                    <TextArea
                      rows={3}
                      placeholder={t('form.summaryEnPlaceholder')}
                      showCount
                      maxLength={1000}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="summaryHi" label={t('form.summaryHi')}>
                    <TextArea
                      rows={3}
                      placeholder={t('form.summaryHiPlaceholder')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="remarksEn" label={t('form.remarks')}>
                <TextArea rows={2} placeholder={t('form.remarks')} maxLength={500} />
              </Form.Item>

              {/* Manual Override */}
              <Row gutter={12} align="bottom">
                <Col span={6}>
                  <Form.Item label={t('form.manualFlag')}>
                    <Switch
                      checked={manualFlag}
                      onChange={v => setManualFlag(v)}
                      checkedChildren="FLAGGED"
                      unCheckedChildren="Auto"
                    />
                  </Form.Item>
                </Col>
                <Col span={18}>
                  <Form.Item name="overrideReason" label={t('form.overrideReason')}>
                    <Input
                      placeholder={t('form.overrideReason')}
                      disabled={!manualFlag}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  style={{ width: '100%', height: 40 }}
                  icon={<FileDoneOutlined />}
                >
                  {submitting ? t('form.submitting') : t('form.submit')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* ── Preventive Intelligence Feed ───────────────── */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <AlertOutlined style={{ color: '#f5222d' }} />
                {t('feed.title')}
                {flaggedEntries.length > 0 && (
                  <Badge count={flaggedEntries.length} style={{ backgroundColor: '#f5222d' }} />
                )}
              </Space>
            }
            bordered={false}
            extra={
              <Button
                size="small"
                icon={<SyncOutlined />}
                onClick={refreshAll}
              >
                {t('feed.refresh')}
              </Button>
            }
            styles={{ body: { maxHeight: 640, overflowY: 'auto', padding: '12px 16px' } }}
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
              {t('feed.subtitle')}
            </Text>

            {flaggedEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a', display: 'block', marginBottom: 8 }} />
                <Text type="secondary">{t('feed.noPatterns')}</Text>
              </div>
            ) : (
              flaggedEntries.map((fe, idx) => (
                <div
                  key={fe.id || idx}
                  style={{
                    marginBottom: 10,
                    padding: '10px 12px',
                    background: '#1a0a08',
                    border: '1px solid #5c1010',
                    borderLeft: `3px solid ${fe.confidenceScore >= 70 ? '#f5222d' : '#fa8c16'}`,
                    borderRadius: 6,
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 12, color: '#1890ff' }}>{fe.gdNumber}</Text>
                    <Tag
                      color={fe.confidenceScore >= 70 ? 'red' : 'orange'}
                      style={{ fontSize: 10, margin: 0 }}
                    >
                      {t('feed.score')}: {Math.round(fe.confidenceScore || 0)}
                    </Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                    <ClockCircleOutlined /> {dayjs(fe.gdDate).format('DD MMM YYYY')} {fe.gdTime}
                  </Text>
                  <Text style={{ fontSize: 11, display: 'block', marginBottom: 4, color: '#faad14' }}>
                    <WarningOutlined /> {fe.intelligenceReason}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', fontStyle: 'italic', marginBottom: 4 }}>
                    "{i18n.language === 'en'
                      ? (fe.summaryEn || fe.summaryHi)?.substring(0, 50)
                      : (fe.summaryHi || fe.summaryEn)?.substring(0, 50)}..."
                  </Text>
                  <Text style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                    <EnvironmentOutlined style={{ color: '#52c41a' }} /> {fe.location}
                  </Text>
                  {fe.personName && (
                    <Text style={{ fontSize: 11, display: 'block' }}>{t('feed.person')}: {fe.personName}</Text>
                  )}
                  {fe.vehicleNumber && (
                    <Text style={{ fontSize: 11, display: 'block' }}>
                      <CarOutlined /> {fe.vehicleNumber}
                    </Text>
                  )}
                  <div style={{ marginTop: 4 }}>
                    {fe.complaintId && (
                      <Tag icon={<LinkOutlined />} color="purple" style={{ fontSize: 10 }}>CMP</Tag>
                    )}
                    {fe.firId && (
                      <Tag icon={<LinkOutlined />} color="magenta" style={{ fontSize: 10 }}>FIR</Tag>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Search & Filter ───────────────────────────────── */}
      <Card
        title={<Space><SearchOutlined />{t('search.title')}</Space>}
        bordered={false}
        style={{ marginBottom: 16 }}
        extra={
          <Space size={8}>
            {Object.keys(activeSearch).length > 0 && (
              <Tag color="blue">{t('search.activeFilter')}</Tag>
            )}
            <Button
              size="small"
              type={showAdvancedSearch ? 'primary' : 'default'}
              ghost={showAdvancedSearch}
              onClick={() => setShowAdvancedSearch(v => !v)}
            >
              {showAdvancedSearch ? 'Hide Advanced' : 'Advanced Filters'}
            </Button>
          </Space>
        }
      >
        <Form form={searchForm} layout="vertical" onFinish={handleSearch}>
          {/* ── Basic Filters ─────────────────────────────── */}
          <Row gutter={[12, 0]}>
            <Col xs={24} sm={12} md={5}>
              <Form.Item name="q" label={t('search.global')} style={{ marginBottom: 12 }}>
                <Input placeholder={t('search.globalPlaceholder')} prefix={<SearchOutlined />} allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="gdNumber" label={t('search.gdNo')} style={{ marginBottom: 12 }}>
                <Input placeholder={t('search.gdNo')} allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="personName" label={t('form.personName')} style={{ marginBottom: 12 }}>
                <Input placeholder={t('form.personName')} allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="mobileNumber" label={t('form.mobileNumber')} style={{ marginBottom: 12 }}>
                <Input placeholder={t('form.mobileNumber')} allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item name="dateRange" label={t('search.dateRange')} style={{ marginBottom: 12 }}>
                <RangePicker style={{ width: '100%' }} allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={3}>
              <Form.Item name="flagged" label={t('search.flag')} style={{ marginBottom: 12 }}>
                <Select placeholder="All" allowClear>
                  <Option value="true">{t('search.flaggedOnly')}</Option>
                  <Option value="false">{t('search.clearOnly')}</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* ── Advanced Filters (collapsible) ────────────── */}
          {showAdvancedSearch && (
            <>
              <Divider style={{ margin: '4px 0 12px' }} orientation="left">
                <Text type="secondary" style={{ fontSize: 11 }}>Advanced Filters</Text>
              </Divider>
              <Row gutter={[12, 0]}>
                <Col xs={24} sm={12} md={4}>
                  <Form.Item name="vehicleNumber" label={t('form.vehicleNumber')} style={{ marginBottom: 12 }}>
                    <Input placeholder={t('form.vehicleNumber')} allowClear />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Form.Item name="location" label={t('form.location')} style={{ marginBottom: 12 }}>
                    <Input placeholder={t('search.placePlaceholder')} allowClear />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Form.Item name="entryCategory" label={t('form.entryCategory')} style={{ marginBottom: 12 }}>
                    <Select placeholder={t('form.categoryPlaceholder')} allowClear>
                      {ENTRY_CATEGORIES.map(tOption => <Option key={tOption.value} value={tOption.value}>{t(`enums.category.${tOption.value}`)}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Form.Item name="dutyType" label={t('form.dutyType')} style={{ marginBottom: 12 }}>
                    <Select placeholder={t('form.dutyPlaceholder')} allowClear>
                      {DUTY_TYPES.map(tOption => <Option key={tOption.value} value={tOption.value}>{t(`enums.duty.${tOption.value}`)}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Form.Item name="priority" label={t('form.priority')} style={{ marginBottom: 12 }}>
                    <Select placeholder={t('form.priorityPlaceholder')} allowClear>
                      <Option value="LOW">{t('enums.priority.LOW')}</Option>
                      <Option value="NORMAL">{t('enums.priority.NORMAL')}</Option>
                      <Option value="HIGH">{t('enums.priority.HIGH')}</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Form.Item name="district" label={t('form.district')} style={{ marginBottom: 12 }}>
                    <Select
                      showSearch
                      placeholder={t('form.districtPlaceholder')}
                      allowClear
                      onChange={() => searchForm.setFieldsValue({ policeStation: undefined, beatArea: undefined })}
                    >
                      {HARYANA_DISTRICTS.map(d => <Option key={d} value={d}>{d}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Form.Item noStyle shouldUpdate={(prev, cur) => prev.district !== cur.district}>
                    {({ getFieldValue }) => {
                      const d = getFieldValue('district');
                      const stations = d ? Object.keys(haryanaPoliceHierarchy[d].policeStations) : [];
                      return (
                        <Form.Item name="policeStation" label={t('form.station')} style={{ marginBottom: 12 }}>
                          <Select showSearch placeholder={t('form.stationPlaceholder')} allowClear disabled={!d}>
                            {stations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                          </Select>
                        </Form.Item>
                      );
                    }}
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Form.Item noStyle shouldUpdate={(prev, cur) => prev.district !== cur.district || prev.policeStation !== cur.policeStation}>
                    {({ getFieldValue }) => {
                      const d = getFieldValue('district');
                      const ps = getFieldValue('policeStation');
                      const beats = d && ps ? (haryanaPoliceHierarchy[d]?.policeStations[ps] || []) : [];
                      return (
                        <Form.Item name="beatArea" label={t('form.beat')} style={{ marginBottom: 12 }}>
                          <Select showSearch placeholder={t('form.beatPlaceholder')} allowClear disabled={!ps}>
                            {beats.map(b => <Option key={b} value={b}>{b}</Option>)}
                          </Select>
                        </Form.Item>
                      );
                    }}
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Row>
            <Col span={24} style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>{t('search.searchBtn')}</Button>
              <Button onClick={handleReset} icon={<RetweetOutlined />}>{t('search.resetBtn')}</Button>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* ── Recent Entries Table ─────────────────────────── */}
      <Card
        title={
          <Space>
            <BookOutlined />
            {t('table.title')}
            <Badge count={totalEntries} style={{ backgroundColor: '#1890ff' }} overflowCount={9999} />
          </Space>
        }
        bordered={false}
        extra={
          <Button size="small" icon={<SyncOutlined />} onClick={refreshAll}>
            {t('form.submit') === 'Submit Smart GD Entry' ? 'Refresh' : 'रिफ्रेश'}
          </Button>
        }
      >
        <Table
          size="small"
          dataSource={entries}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          rowClassName={record => record.intelligenceFlag ? 'flagged-row' : ''}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: totalEntries,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} entries`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
        />
      </Card>

      {/* ── View/Edit Drawer ─────────────────────────────── */}
      <Drawer
        title={
          <Space>
            {viewMode ? <EyeOutlined /> : <EditOutlined />}
            {viewMode ? t('drawer.viewMode') : t('drawer.editMode')}:{' '}
            <Text style={{ color: '#1890ff' }}>{editingRecord?.gdNumber}</Text>
          </Space>
        }
        placement="right"
        width={560}
        onClose={closeDrawer}
        open={drawerVisible}
        extra={
          viewMode && (
            <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => {
              setViewMode(false);
              drawerForm.setFieldsValue({
                ...editingRecord,
                gdDate: dayjs(editingRecord.gdDate),
                gdTime: editingRecord.gdTime ? dayjs(editingRecord.gdTime, 'HH:mm') : null,
              });
            }}>
              Edit
            </Button>
          )
        }
      >
        {editingRecord && viewMode ? (
          /* ── View mode ──────────────────────────────── */
          <Space direction="vertical" style={{ width: '100%' }} size={0}>
            {editingRecord.preventiveFlag && (
              <Alert
                type="error"
                message={`${t('messages.flagWarning')} — ${t('feed.score')}: ${Math.round(editingRecord.confidenceScore || 0)}/100`}
                description={editingRecord.intelligenceReason}
                icon={<WarningOutlined />}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c' }}>{t('drawer.basicInfo')}</Divider>
            <Row gutter={[12, 8]}>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.gdNumber')}</Text><br /><Text strong>{editingRecord.gdNumber}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('table.dateTime')}</Text><br /><Text>{dayjs(editingRecord.gdDate).format('DD MMM YYYY')} {editingRecord.gdTime}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.district')}</Text><br /><Text>{editingRecord.district || '—'}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.station')}</Text><br /><Text>{editingRecord.policeStation}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.beat')}</Text><br /><Text>{editingRecord.beatArea || '—'}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.entryCategory')}</Text><br />
                <Tag color={ENTRY_CATEGORY_COLORS[editingRecord.entryCategory] || 'default'}>{t(`enums.category.${editingRecord.entryCategory}`)}</Tag>
              </Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.priority')}</Text><br />
                <Tag color={PRIORITY_COLORS[editingRecord.priority] || 'default'}>{t(`enums.priority.${editingRecord.priority}`)}</Tag>
              </Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.dutyType')}</Text><br /><Text>{t(`enums.duty.${editingRecord.dutyType}`) || '—'}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.officerName')}</Text><br /><Text>{t(`enums.rank.${editingRecord.officerRank}`)} {editingRecord.officerName}</Text></Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c' }}>{t('drawer.personVehicle')}</Divider>
            <Row gutter={[12, 8]}>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.personName')}</Text><br /><Text>{editingRecord.personName || '—'}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.fatherName')}</Text><br /><Text>{editingRecord.fatherName || '—'}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.mobileNumber')}</Text><br /><Text>{editingRecord.mobileNumber || '—'}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.vehicleNumber')}</Text><br /><Text>{editingRecord.vehicleNumber || '—'}</Text></Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c' }}>{t('drawer.locationLinkages')}</Divider>
            <Row gutter={[12, 8]}>
              <Col span={24}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.location')}</Text><br /><Text>{editingRecord.location}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.linkComplaint')}</Text><br /><Text>{editingRecord.complaintId || '—'}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('form.linkFir')}</Text><br /><Text>{editingRecord.firId || '—'}</Text></Col>
            </Row>

            <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c' }}>{t('drawer.summaryRemarks')}</Divider>
            <Paragraph style={{ fontSize: 13, background: '#131826', padding: 12, borderRadius: 6, whiteSpace: 'pre-wrap', marginBottom: 4 }}>
              {i18n.language === 'en' 
                ? (editingRecord.summaryEn || editingRecord.summaryHi) 
                : (editingRecord.summaryHi || editingRecord.summaryEn)}
            </Paragraph>
            {editingRecord.remarksEn && (
              <Paragraph type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                <strong>{t('form.remarks')}:</strong> {editingRecord.remarksEn}
              </Paragraph>
            )}

            <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c' }}>{t('drawer.metadata')}</Divider>
            <Row gutter={[12, 8]}>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('drawer.created')}</Text><br /><Text style={{ fontSize: 12 }}>{dayjs(editingRecord.createdAt).format('DD MMM YYYY HH:mm')}</Text></Col>
              <Col span={12}><Text type="secondary" style={{ fontSize: 12 }}>{t('drawer.lastUpdated')}</Text><br /><Text style={{ fontSize: 12 }}>{dayjs(editingRecord.updatedAt).format('DD MMM YYYY HH:mm')}</Text></Col>
            </Row>
          </Space>
        ) : (
          /* ── Edit mode ─────────────────────────────── */
          editingRecord && (
            <Form form={drawerForm} layout="vertical" onFinish={onUpdateEntry}>
              <Form.Item name="gdNumber" label={t('form.gdNumber')}>
                <Input disabled />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="gdDate" label={t('form.date')} rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="gdTime" label={t('form.time')} rules={[{ required: true }]}>
                    <TimePicker format="HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              {/* District → Station → Beat in edit drawer */}
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="district" label={t('form.district')} rules={[{ required: true }]}>
                    <Select
                      showSearch
                      onChange={(val) => {
                        drawerForm.setFieldsValue({ policeStation: undefined, beatArea: undefined });
                      }}
                    >
                      {HARYANA_DISTRICTS.map(d => <Option key={d} value={d}>{d}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="policeStation" label={t('form.station')} rules={[{ required: true }]}>
                    <Select showSearch>
                      {(drawerForm.getFieldValue('district') ? Object.keys(haryanaPoliceHierarchy[drawerForm.getFieldValue('district')]?.policeStations || {}) : [editingRecord?.policeStation]).filter(Boolean).map(ps => (
                        <Option key={ps} value={ps}>{ps}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="beatArea" label={t('form.beat')}>
                    <Select showSearch allowClear>
                      {(() => {
                        const d = drawerForm.getFieldValue('district');
                        const ps = drawerForm.getFieldValue('policeStation');
                        return d && ps ? (haryanaPoliceHierarchy[d]?.policeStations[ps] || []) : [editingRecord?.beatArea].filter(Boolean);
                      })().map(b => <Option key={b} value={b}>{b}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="location" label={t('form.location')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="entryCategory" label={t('form.entryCategory')}>
                    <Select>
                      {ENTRY_CATEGORIES.map(tOption => <Option key={tOption.value} value={tOption.value}>{t(`enums.category.${tOption.value}`)}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="dutyType" label={t('form.dutyType')}>
                    <Select>
                      {DUTY_TYPES.map(tOption => <Option key={tOption.value} value={tOption.value}>{t(`enums.duty.${tOption.value}`)}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="priority" label={t('form.priority')}>
                    <Select>
                      <Option value="LOW">{t('enums.priority.LOW')}</Option>
                      <Option value="NORMAL">{t('enums.priority.NORMAL')}</Option>
                      <Option value="HIGH">{t('enums.priority.HIGH')}</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="officerName" label={t('form.officerName')}><Input /></Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="officerRank" label={t('form.officerRank')}>
                    <Select>
                      {RANKS.map(r => <Option key={r} value={r}>{t(`enums.rank.${r}`)}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="personName" label={t('form.personName')}><Input /></Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="mobileNumber" label={t('form.mobileNumber')}><Input /></Form.Item>
                </Col>
              </Row>
              <Form.Item name="vehicleNumber" label={t('form.vehicleNumber')}><Input /></Form.Item>
              <Form.Item name="summaryEn" label={t('form.summaryEn')} rules={[{ required: true }]}>
                <TextArea rows={3} />
              </Form.Item>
              <Form.Item name="summaryHi" label={t('form.summaryHi')}>
                <TextArea rows={2} />
              </Form.Item>
              <Form.Item name="remarksEn" label={t('form.remarks')}><TextArea rows={2} /></Form.Item>
              <Form.Item name="intelligenceFlag" label={t('search.flag')} valuePropName="checked">
                <Switch checkedChildren={t('table.flagged')} unCheckedChildren={t('table.clear')} />
              </Form.Item>
              <Form.Item name="intelligenceReason" label={t('form.overrideReason')}>
                <TextArea rows={2} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={saveLoading} style={{ width: '100%' }}>
                {t('drawer.saveChanges')}
              </Button>
            </Form>
          )
        )}
      </Drawer>

      <style>{`
        .flagged-row td {
          background: rgba(245, 34, 45, 0.04) !important;
        }
        .flagged-row:hover td {
          background: rgba(245, 34, 45, 0.08) !important;
        }
      `}</style>
    </div>
  );
}
