import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, message,
  Popconfirm, Card, Row, Col, Typography, Badge, Tooltip, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, UserOutlined,
  SearchOutlined, ReloadOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;

const OFFICER_RANKS = [
  'DGP','ADGP','IGP','DIG','SSP','SP','ASP','DSP',
  'Inspector','Sub-Inspector (SI)','Asst. Sub-Inspector (ASI)',
  'Head Constable (HC)','Constable','Other',
];

const HARYANA_DISTRICTS = {
  'AMBALA':['AMBALA CANTT','AMBALA CITY','AMBALA SADAR','BALDEV NAGAR','BARARA','MAHESH NAGAR','MULLANA','NAGGAL','NARAINGARH','PANJOKHRA','PARAO AMBALA CANTT','SAHA','SECTOR-9 AMBALA CITY','SHAHZADPUR','WOMEN POLICE STATION NARAINGARH AMBALA','WOMEN POLICE STATION AMBALA'],
  'BHIWANI':['BAWANI KHERA','BEHAL','BHIWANI CITY','BHIWANI CIVIL LINES','BHIWANI SADAR','BOND KALAN','DADRI CITY','DADRI SADAR','JUI KALAN PS BHIWANI','LOHARU','PS INDUSTRIAL AREA BHIWANI','SIWANI','TOSHAM','WOMEN POLICE STATION BHIWANI'],
  'CHARKHI DADRI':['BADHRA','BOND KALAN','DADRI CITY','DADRI SADAR','JHOJHU KALAN','WOMEN POLICE STATION CHARKHI DADRI'],
  'FARIDABAD':['ADARSH NAGAR','BALLABHGARH CITY','BALLABHGARH SADAR','BHUPANI','CHHANSA','DABUA','DHAUJ','FARIDABAD CENTRAL','FARIDABAD KOTWALI','FARIDABAD N.I.T.','FARIDABAD OLD','KHERIPUL','METRO POLICE STATION FARIDABAD','MUJESAR','PALLA','POLICE STATION B.P.T.P.','S.G.M. NAGAR','SARAI KHAWAJA','SARAN','SECTOR-8','SECTOR-17','SECTOR-31 FARIDABAD','SECTOR-58','SURAJ KUND','TIGAON','WOMEN POLICE STATION BALLABGARH','WOMEN POLICE STATION NIT FARIDABAD','WOMEN POLICE STATION FARIDABAD'],
  'FATEHABAD':['BHATTU KALAN','BHUNA','CITY FATEHABAD','CITY RATIA','CITY TOHANA','JAKHAL','SADAR FATEHABAD','SADAR RATTIA','SADAR TOHANA','WOMEN POLICE STATION FATEHABAD'],
  'GURUGRAM':['BADSHAHPUR','BAJGHERA','BHONDSI','BILASPUR GURUGRAM','CITY SOHANA','CIVIL LINES GURGAON','DLF','DLF PH-3RD','DLF PHASE-1','DLF-II','FURRUKH NAGAR','GURGAON CITY','GURGAON SADAR','INDUSTRIAL SECTOR-7 MANESAR','KHEDKI DAULA','MANESAR','METRO','NEW COLONY','PALAM VIHAR','PATAUDI','PS CYBER MANESAR','RAJENDRA PARK','SECTOR-37','SECTOR-50','SECTOR-53','SECTOR-9A','SECTOR-10','SECTOR-14 GURUGRAM','SOHNA','SUSHANT LOK','UDYOG VIHAR','WOMEN POLICE STATION GURGAON'],
  'HANSI':['BASS','HANSI CITY','HANSI SADAR','NARNAUND','PS CYBER CRIME HANSI','WOMEN POLICE STATION HANSI'],
  'HISAR':['ADAMPUR','AGROHA','AZAD NAGAR HISAR','BARWALA','CYBER CRIME POLICE STATION HISAR','HISAR CITY','HISAR CIVIL LINES','HISAR SADAR','HTM HISAR','UKLANA','URBAN ESTATE HISAR','WOMEN POLICE STATION HISSAR'],
  'JHAJJAR':['ASAUDA','BADLI','BERI','CITY BAHADURGARH','CITY JHAJJAR','DUJANA','LINE PAR BAHADURGARH','MACHHROLI','PS CYBER JHAJJAR','SADAR BAHADURGARH','SADAR JHAJJAR','SAHLAWAS','SECTOR-06 BAHADURGARH','WOMEN POLICE STATION JHAJJAR','WOMEN PS BAHADURGARH JHAJJAR'],
  'JIND':['ALEWA','CITY SAFIDON','CIVIL LINE JIND','GARHI','JIND CITY','JIND SADAR','JULANA','NARWANA CITY','NARWANA SADAR','PILLU KHERA','SAFIDON','UCHANA','WOMEN POLICE STATION JIND'],
  'KAITHAL':['CHEEKA','CIVIL LINE KAITHAL','DHAND','GUHLA','KAITHAL CITY','KAITHAL SADAR','KALAYAT','PUNDRI','RAJAUND','SIWAN','TITRAM','WOMEN POLICE STATION KAITHAL'],
  'KARNAL':['ASSANDH','BUTANA','CYBER CRIME POLICE STATION KARNAL','GHARAUNDA','INDRI','KARNAL CITY','KARNAL CIVIL LINES','KARNAL SADAR','KUNJPURA','MADHUBAN','MUNAK KARNAL','NIGDHU KARNAL','NISSING','RAM NAGAR KARNAL','TARAORI','WOMEN POLICE STATION KARNAL'],
  'KURUKSHETRA':['BABAIN','CYBER CRIME POLICE STATION KURUKSHETRA','ISMAILABAD','JHANSA','LADWA','PEHOWA','SHAHABAD','THANESAR CITY','THANESAR SADAR','WOMEN POLICE STATION KURUKSHETRA'],
  'MAHENDERGARH':['ATELI','CITY KANINA','CITY MAHENDERGARH','CITY NARNAUL','NANGAL CHAUDHRI','NIZAMPUR','SADAR KANINA','SADAR MAHENDERGARH','SADAR NARNAUL','SATNALI','WOMEN POLICE STATION NARNAUL'],
  'NUH':['BICCHOR','CITY NUH','CITY TAURU','FEROZEPUR JHIRKA','NAGINA','PINANGWA','PS CITY PUNHANA','PS MOHAMMADPUR AHIR','PUNHANA','ROZKA MEO','SADAR NUH','SADAR TAURU','WOMEN POLICE STATION MEWAT'],
  'PALWAL':['BAHIN','CAMP PALWAL','CHAND HUT','CITY PALWAL','GADPURI','HASSANPUR','HATHIN','HODAL','MUNDKATI','SADAR PALWAL','UTAWAR','WOMEN POLICE STATION PALWAL'],
  'PANCHKULA':['CHANDIMANDIR','CYBER CRIME','KALKA','MANSA DEVI COMPLEX','PANCHKULA SECTOR-5','PINJORE','RAIPUR RANI','SECTOR-14 PANCHKULA','SECTOR-20','SECTOR-7 PANCHKULA','WOMEN POLICE STATION PANCHKULA'],
  'PANIPAT':['BAPOLI','CHANDNIBAGH','CYBER CRIME POLICE STATION PANIPAT','INDUSTRIAL SECTOR 29 PANIPAT','ISRANA','MATLAUDA','MODEL TOWN PANIPAT','OLD INDUSTRIAL PANIPAT','PANIPAT CITY','PANIPAT SADAR','QUILLA PANIPAT','SAMALKHA','SANOLI','SECTOR 13/17 PANIPAT','TEHSIL CAMP PANIPAT','WOMEN POLICE STATION PANIPAT'],
  'REWARI':['BAWAL','DHARUHERA','JATUSANA','KASOLA','KHOL','KOSLI','MODEL TOWN REWARI','RAMPURA','REWARI CITY','REWARI SADAR','ROHADAI','SEC-6 DHARUHERA','WOMEN POLICE STATION REWARI'],
  'ROHTAK':['ARYA NAGAR ROHTAK','BAHUAKBARPUR','CYBER POLICE STATION ROHTAK','I.M.T. ROHTAK','KALANAUR','LAKHAN MAJRA','MEHAM','P.G.I.M.S. ROHTAK','PURANI SABZI MANDI ROHTAK','ROHTAK CITY','ROHTAK CIVIL LINES','ROHTAK SADAR','SAMPLA','SHIVAJI COLONY','URBAN ESTATE ROHTAK','WOMEN POLICE STATION ROHTAK'],
  'SIRSA':['CITY MANDI DABWALI','CYBER CRIME POLICE STATION SIRSA','DABWALI SADAR','DING','ELLENABAD','KALAN WALI','NATHU SARAI CHOPTA','ODHAN','POLICE STATION CIVIL LINE SIRSA','RANIA','RORI','SIRSA CITY','SIRSA SADAR','WOMEN POLICE STATION SIRSA'],
  'SONIPAT':['BAHALGARH','BARAUDA','CIVIL LINE SONIPAT','GANNAUR','GOHANA CITY','GOHANA SADAR','HSIDC BARHI','KHARKHODA','KUNDLI','MOOHANA','MURTHAL','RAI','SECTOR-27 SONIPAT','SONIPAT CITY','SONIPAT SADAR','WOMEN POLICE STATION SONIPAT'],
  'YAMUNANAGAR':['BILASPUR','BURIA','CHHACHHRAULI','CHHAPAR','CYBER CRIME POLICE STATION YAMUNANAGAR','FARAKPUR','GANDHI NAGAR YAMUNANAGAR','JAGADDHRI SADAR','JAGADHRI CITY','JATHLANA','PRATAP NAGAR','RADAUR','SADHAURA','WOMEN POLICE STATION YAMUNA NAGAR','YAMUNA NAGAR CITY','YAMUNA NAGAR SADAR'],
};

const ROLE_COLORS = { admin: 'red', sho: 'blue', io: 'green' };

export default function UserManagement() {
  const { token, profile } = useAuth();
  const navigate = useNavigate();
  const API = import.meta.env.VITE_API_URL;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [modalDistrict, setModalDistrict] = useState(null);

  // Redirect non-admins
  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/'); }
  }, [profile, navigate]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRole) params.set('role', filterRole);
      if (filterSearch) params.set('search', filterSearch);
      const res = await fetch(`${API}/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [token, API, filterRole, filterSearch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setModalDistrict(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    // find district from station_id
    let dist = null;
    for (const [d, stations] of Object.entries(HARYANA_DISTRICTS)) {
      if (stations.includes(user.station_id)) { dist = d; break; }
    }
    setModalDistrict(dist);
    form.setFieldsValue({ ...user, password: '', district: dist });
    setModalOpen(true);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const payload = { ...values };
      delete payload.district;
      if (!payload.password) delete payload.password;

      const url = editingUser ? `${API}/admin/users/${editingUser.id}` : `${API}/admin/users`;
      const method = editingUser ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      message.success(editingUser ? 'User update ho gaya!' : 'Naya user create ho gaya!');
      setModalOpen(false);
      fetchUsers();
    } catch (err) { message.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (id) => {
    try {
      const res = await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      message.success('User deactivate ho gaya');
      fetchUsers();
    } catch (err) { message.error(err.message); }
  };

  const handleActivate = async (id) => {
    try {
      const res = await fetch(`${API}/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'active' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      message.success('User activate ho gaya');
      fetchUsers();
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Username', dataIndex: 'username', key: 'username', render: (v) => <code style={{ fontSize: 12, color: '#69b1ff' }}>{v}</code>, width: 220 },
    { title: 'Full Name', dataIndex: 'full_name', key: 'full_name', width: 180 },
    { title: 'Role', dataIndex: 'role', key: 'role', width: 80, render: (r) => <Tag color={ROLE_COLORS[r] || 'default'}>{r?.toUpperCase()}</Tag> },
    { title: 'Rank', dataIndex: 'rank', key: 'rank', width: 160, render: (v) => v || '—' },
    { title: 'Badge No.', dataIndex: 'badge_number', key: 'badge_number', width: 120, render: (v) => v || '—' },
    { title: 'Police Station', dataIndex: 'station_id', key: 'station_id', width: 200, render: (v) => v || '—' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: (s) => <Badge status={s === 'active' ? 'success' : 'error'} text={s === 'active' ? 'Active' : 'Inactive'} />,
    },
    {
      title: 'Actions', key: 'actions', width: 130, fixed: 'right',
      render: (_, rec) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} /></Tooltip>
          {rec.status === 'active'
            ? <Popconfirm title="Is user ko deactivate karein?" onConfirm={() => handleDeactivate(rec.id)} okText="Haan" cancelText="Nahi">
                <Tooltip title="Deactivate"><Button size="small" danger icon={<StopOutlined />} /></Tooltip>
              </Popconfirm>
            : <Tooltip title="Activate"><Button size="small" icon={<ReloadOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }} onClick={() => handleActivate(rec.id)} /></Tooltip>
          }
        </Space>
      ),
    },
  ];

  const counts = { total: users.length, sho: users.filter(u => u.role === 'sho').length, io: users.filter(u => u.role === 'io').length, active: users.filter(u => u.status === 'active').length };

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <TeamOutlined style={{ color: '#1890ff' }} /> User Management
          </Title>
          <Text type="secondary">SHO aur IO accounts manage karein — create, edit, activate/deactivate</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreate}
          style={{ background: 'linear-gradient(135deg,#1890ff,#096dd9)', border: 'none' }}>
          Naya User Banayein
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Users', value: counts.total, color: '#1890ff' },
          { label: 'SHO', value: counts.sho, color: '#096dd9' },
          { label: 'IO', value: counts.io, color: '#52c41a' },
          { label: 'Active', value: counts.active, color: '#73d13d' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <Card size="small" bordered={false} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card size="small" bordered={false} style={{ marginBottom: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
        <Row gutter={12} align="middle">
          <Col xs={24} sm={8}>
            <Input prefix={<SearchOutlined />} placeholder="Username, naam, ya station se search..." value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)} allowClear onPressEnter={fetchUsers} />
          </Col>
          <Col xs={12} sm={4}>
            <Select value={filterRole} onChange={setFilterRole} style={{ width: '100%' }} placeholder="Role filter">
              <Option value="">Sabhi roles</Option>
              <Option value="sho">SHO</Option>
              <Option value="io">IO</Option>
              <Option value="admin">Admin</Option>
            </Select>
          </Col>
          <Col xs={12} sm={4}>
            <Button icon={<SearchOutlined />} onClick={fetchUsers} type="primary">Search</Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card bordered={false} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `Total ${t} users` }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserOutlined style={{ color: '#1890ff' }} />
            <span>{editingUser ? `Edit: ${editingUser.full_name}` : 'Naya User Banayein'}</span>
          </div>
        }
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Rajesh Kumar" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                <Select placeholder="Role chunein">
                  <Option value="sho">SHO</Option>
                  <Option value="io">IO</Option>
                  <Option value="admin">Admin</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="username" label="Username" rules={[{ required: !editingUser }]}>
                <Input placeholder="e.g. sho_ambala_cantt" disabled={!!editingUser} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="password" label={editingUser ? 'New Password (khali chhod sakte hain)' : 'Password'} rules={[{ required: !editingUser }]}>
                <Input.Password placeholder={editingUser ? 'Change nahi karna to khali chhoden' : 'Password daalen'} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="rank" label="Rank">
                <Select placeholder="Rank chunein" showSearch optionFilterProp="children">
                  {OFFICER_RANKS.map(r => <Option key={r} value={r}>{r}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="badge_number" label="Badge / Employee No.">
                <Input placeholder="e.g. HP-2045" />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain style={{ fontSize: 12, color: '#555' }}>Police Station</Divider>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="district" label="District">
                <Select showSearch placeholder="District chunein" optionFilterProp="children"
                  onChange={(val) => { setModalDistrict(val); form.setFieldValue('station_id', undefined); }}>
                  {Object.keys(HARYANA_DISTRICTS).sort().map(d => <Option key={d} value={d}>{d}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="station_id" label="Police Station">
                <Select showSearch placeholder={modalDistrict ? 'Station chunein' : 'Pehle district'} optionFilterProp="children"
                  disabled={!modalDistrict}>
                  {(HARYANA_DISTRICTS[modalDistrict] || []).map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving} icon={<UserOutlined />}>
              {editingUser ? 'Update Karein' : 'Create Karein'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
