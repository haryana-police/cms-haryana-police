import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form, Input, Button, Card, Typography, Alert, message,
  Divider, Space, Select, Tabs,
} from 'antd';
import {
  UserOutlined, LockOutlined, SafetyCertificateOutlined,
  SearchOutlined, BankOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import '../styles/login.css';

const { Title, Text } = Typography;
const { Option } = Select;

const HARYANA_DISTRICTS = {
  'AMBALA': ['AMBALA CANTT','AMBALA CITY','AMBALA SADAR','BALDEV NAGAR','BARARA','MAHESH NAGAR','MULLANA','NAGGAL','NARAINGARH','PANJOKHRA','PARAO AMBALA CANTT','SAHA','SECTOR-9 AMBALA CITY','SHAHZADPUR','WOMEN POLICE STATION NARAINGARH AMBALA','WOMEN POLICE STATION AMBALA'],
  'BHIWANI': ['BAWANI KHERA','BEHAL','BHIWANI CITY','BHIWANI CIVIL LINES','BHIWANI SADAR','BOND KALAN','DADRI CITY','DADRI SADAR','JUI KALAN PS BHIWANI','LOHARU','PS INDUSTRIAL AREA BHIWANI','SIWANI','TOSHAM','WOMEN POLICE STATION BHIWANI'],
  'CHARKHI DADRI': ['BADHRA','BOND KALAN','DADRI CITY','DADRI SADAR','JHOJHU KALAN','WOMEN POLICE STATION CHARKHI DADRI'],
  'FARIDABAD': ['ADARSH NAGAR','BALLABHGARH CITY','BALLABHGARH SADAR','BHUPANI','CHHANSA','DABUA','DHAUJ','FARIDABAD CENTRAL','FARIDABAD KOTWALI','FARIDABAD N.I.T.','FARIDABAD OLD','KHERIPUL','METRO POLICE STATION FARIDABAD','MUJESAR','PALLA','POLICE STATION B.P.T.P.','S.G.M. NAGAR','SARAI KHAWAJA','SARAN','SECTOR-8','SECTOR-17','SECTOR-31 FARIDABAD','SECTOR-58','SURAJ KUND','TIGAON','WOMEN POLICE STATION BALLABGARH','WOMEN POLICE STATION NIT FARIDABAD','WOMEN POLICE STATION FARIDABAD'],
  'FATEHABAD': ['BHATTU KALAN','BHUNA','CITY FATEHABAD','CITY RATIA','CITY TOHANA','JAKHAL','SADAR FATEHABAD','SADAR RATTIA','SADAR TOHANA','WOMEN POLICE STATION FATEHABAD'],
  'GURUGRAM': ['BADSHAHPUR','BAJGHERA','BHONDSI','BILASPUR GURUGRAM','CITY SOHANA','CIVIL LINES GURGAON','DLF','DLF PH-3RD','DLF PHASE-1','DLF-II','FURRUKH NAGAR','GURGAON CITY','GURGAON SADAR','INDUSTRIAL SECTOR-7 MANESAR','KHEDKI DAULA','MANESAR','METRO','NEW COLONY','PALAM VIHAR','PATAUDI','PS CYBER MANESAR','RAJENDRA PARK','SECTOR-37','SECTOR-50','SECTOR-53','SECTOR-9A','SECTOR-10','SECTOR-14 GURUGRAM','SOHNA','SUSHANT LOK','UDYOG VIHAR','WOMEN POLICE STATION GURGAON'],
  'HANSI': ['BASS','HANSI CITY','HANSI SADAR','NARNAUND','PS CYBER CRIME HANSI','WOMEN POLICE STATION HANSI'],
  'HISAR': ['ADAMPUR','AGROHA','AZAD NAGAR HISAR','BARWALA','CYBER CRIME POLICE STATION HISAR','HISAR CITY','HISAR CIVIL LINES','HISAR SADAR','HTM HISAR','UKLANA','URBAN ESTATE HISAR','WOMEN POLICE STATION HISSAR'],
  'JHAJJAR': ['ASAUDA','BADLI','BERI','CITY BAHADURGARH','CITY JHAJJAR','DUJANA','LINE PAR BAHADURGARH','MACHHROLI','PS CYBER JHAJJAR','SADAR BAHADURGARH','SADAR JHAJJAR','SAHLAWAS','SECTOR-06 BAHADURGARH','WOMEN POLICE STATION JHAJJAR','WOMEN PS BAHADURGARH JHAJJAR'],
  'JIND': ['ALEWA','CITY SAFIDON','CIVIL LINE JIND','GARHI','JIND CITY','JIND SADAR','JULANA','NARWANA CITY','NARWANA SADAR','PILLU KHERA','SAFIDON','UCHANA','WOMEN POLICE STATION JIND'],
  'KAITHAL': ['CHEEKA','CIVIL LINE KAITHAL','DHAND','GUHLA','KAITHAL CITY','KAITHAL SADAR','KALAYAT','PUNDRI','RAJAUND','SIWAN','TITRAM','WOMEN POLICE STATION KAITHAL'],
  'KARNAL': ['ASSANDH','BUTANA','CYBER CRIME POLICE STATION KARNAL','GHARAUNDA','INDRI','KARNAL CITY','KARNAL CIVIL LINES','KARNAL SADAR','KUNJPURA','MADHUBAN','MUNAK KARNAL','NIGDHU KARNAL','NISSING','RAM NAGAR KARNAL','TARAORI','WOMEN POLICE STATION KARNAL'],
  'KURUKSHETRA': ['BABAIN','CYBER CRIME POLICE STATION KURUKSHETRA','ISMAILABAD','JHANSA','LADWA','PEHOWA','SHAHABAD','THANESAR CITY','THANESAR SADAR','WOMEN POLICE STATION KURUKSHETRA'],
  'MAHENDERGARH': ['ATELI','CITY KANINA','CITY MAHENDERGARH','CITY NARNAUL','NANGAL CHAUDHRI','NIZAMPUR','SADAR KANINA','SADAR MAHENDERGARH','SADAR NARNAUL','SATNALI','WOMEN POLICE STATION NARNAUL'],
  'NUH': ['BICCHOR','CITY NUH','CITY TAURU','FEROZEPUR JHIRKA','NAGINA','PINANGWA','PS CITY PUNHANA','PS MOHAMMADPUR AHIR','PUNHANA','ROZKA MEO','SADAR NUH','SADAR TAURU','WOMEN POLICE STATION MEWAT'],
  'PALWAL': ['BAHIN','CAMP PALWAL','CHAND HUT','CITY PALWAL','GADPURI','HASSANPUR','HATHIN','HODAL','MUNDKATI','SADAR PALWAL','UTAWAR','WOMEN POLICE STATION PALWAL'],
  'PANCHKULA': ['CHANDIMANDIR','CYBER CRIME','KALKA','MANSA DEVI COMPLEX','PANCHKULA SECTOR-5','PINJORE','RAIPUR RANI','SECTOR-14 PANCHKULA','SECTOR-20','SECTOR-7 PANCHKULA','WOMEN POLICE STATION PANCHKULA'],
  'PANIPAT': ['BAPOLI','CHANDNIBAGH','CYBER CRIME POLICE STATION PANIPAT','INDUSTRIAL SECTOR 29 PANIPAT','ISRANA','MATLAUDA','MODEL TOWN PANIPAT','OLD INDUSTRIAL PANIPAT','PANIPAT CITY','PANIPAT SADAR','QUILLA PANIPAT','SAMALKHA','SANOLI','SECTOR 13/17 PANIPAT','TEHSIL CAMP PANIPAT','WOMEN POLICE STATION PANIPAT'],
  'REWARI': ['BAWAL','DHARUHERA','JATUSANA','KASOLA','KHOL','KOSLI','MODEL TOWN REWARI','RAMPURA','REWARI CITY','REWARI SADAR','ROHADAI','SEC-6 DHARUHERA','WOMEN POLICE STATION REWARI'],
  'ROHTAK': ['ARYA NAGAR ROHTAK','BAHUAKBARPUR','CYBER POLICE STATION ROHTAK','I.M.T. ROHTAK','KALANAUR','LAKHAN MAJRA','MEHAM','P.G.I.M.S. ROHTAK','PURANI SABZI MANDI ROHTAK','ROHTAK CITY','ROHTAK CIVIL LINES','ROHTAK SADAR','SAMPLA','SHIVAJI COLONY','URBAN ESTATE ROHTAK','WOMEN POLICE STATION ROHTAK'],
  'SIRSA': ['CITY MANDI DABWALI','CYBER CRIME POLICE STATION SIRSA','DABWALI SADAR','DING','ELLENABAD','KALAN WALI','NATHU SARAI CHOPTA','ODHAN','POLICE STATION CIVIL LINE SIRSA','RANIA','RORI','SIRSA CITY','SIRSA SADAR','WOMEN POLICE STATION SIRSA'],
  'SONIPAT': ['BAHALGARH','BARAUDA','CIVIL LINE SONIPAT','GANNAUR','GOHANA CITY','GOHANA SADAR','HSIDC BARHI','KHARKHODA','KUNDLI','MOOHANA','MURTHAL','RAI','SECTOR-27 SONIPAT','SONIPAT CITY','SONIPAT SADAR','WOMEN POLICE STATION SONIPAT'],
  'YAMUNANAGAR': ['BILASPUR','BURIA','CHHACHHRAULI','CHHAPAR','CYBER CRIME POLICE STATION YAMUNANAGAR','FARAKPUR','GANDHI NAGAR YAMUNANAGAR','JAGADDHRI SADAR','JAGADHRI CITY','JATHLANA','PRATAP NAGAR','RADAUR','SADHAURA','WOMEN POLICE STATION YAMUNA NAGAR','YAMUNA NAGAR CITY','YAMUNA NAGAR SADAR'],
  'DABWALI': ['BARAGUDHA','CITY MANDI DABWALI','DABWALI SADAR','KALAN WALI','ODHAN','RORI','WOMEN POLICE STATION DABWALI SIRSA'],
  'STATE CRIME BRANCH': ['NODAL CYBER CRIME POLICE STATION HARYANA'],
  'HSENB': [
    'HSENB POLICE STATION AMBALA', 'HSENB POLICE STATION FARIDABAD',
    'HSENB POLICE STATION GURUGRAM', 'HSENB POLICE STATION HISAR',
    'HSENB POLICE STATION JIND', 'HSENB POLICE STATION KARNAL',
    'HSENB POLICE STATION REWARI', 'HSENB POLICE STATION ROHTAK',
    'PS HSENB BHIWANI', 'PS HSENB CHARKHI DADRI', 'PS HSENB FATEHABAD',
    'PS HSENB JHAJJAR', 'PS HSENB KAITHAL', 'PS HSENB KURUKSHETRA',
    'PS HSENB MAHENDERGARH', 'PS HSENB NUH', 'PS HSENB PALWAL',
    'PS HSENB PANCHKULA', 'PS HSENB PANIPAT', 'PS HSENB SIRSA',
    'PS HSENB SONIPAT', 'PS HSENB YAMUNANAGAR',
  ],
  'HSNCB': [
    'HSNCB UNIT AMBALA', 'HSNCB UNIT BHIWANI', 'HSNCB UNIT FARIDABAD',
    'HSNCB UNIT FATEHABAD', 'HSNCB UNIT GURUGRAM', 'HSNCB UNIT HISAR',
    'HSNCB UNIT KARNAL', 'HSNCB UNIT KURUKSHETRA', 'HSNCB UNIT REWARI',
    'HSNCB UNIT ROHTAK', 'HSNCB UNIT SIRSA',
  ],
};

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form] = Form.useForm();

  // SHO Finder states
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [shoInfo, setShoInfo] = useState(null);
  const [shoLookupLoading, setShoLookupLoading] = useState(false);

  const handleLogin = async (values) => {
    setLoading(true);
    setError(null);
    try {
      await login(values.username, values.password);
      message.success('Login successful!');
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (username, password) => {
    form.setFieldsValue({ username, password });
    handleLogin({ username, password });
  };

  // Lookup SHO username for a police station
  const handleStationSelect = async (station) => {
    setSelectedStation(station);
    setShoInfo(null);
    if (!station) return;
    setShoLookupLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3000/api/users/lookup-sho?station=${encodeURIComponent(station)}`
      );
      const data = await res.json();
      if (res.ok && data.username) {
        setShoInfo(data);
      } else {
        setShoInfo(null);
        message.warning('Is station ka SHO account nahi mila');
      }
    } catch {
      message.error('Server se connect nahi ho pa raha');
    } finally {
      setShoLookupLoading(false);
    }
  };

  const handleUseShoCredentials = () => {
    if (!shoInfo) return;
    form.setFieldsValue({ username: shoInfo.username, password: 'sho123' });
    message.info(`Username fill ho gaya: ${shoInfo.username}`);
  };

  return (
    <div className="login-container">
      <div className="login-background" />
      <Card className="login-card" bordered={false} style={{ maxWidth: 460, width: '100%' }}>
        {/* Header */}
        <div className="login-header">
          <div className="police-emblem">
            <SafetyCertificateOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          </div>
          <Title level={2} style={{ margin: '16px 0 4px' }}>Haryana Police</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: '8px' }}>
            Smart Case Management System
          </Text>
        </div>

        {/* Tabs: Login + SHO Finder */}
        <Tabs
          defaultActiveKey="login"
          centered
          items={[
            {
              key: 'login',
              label: <span><UserOutlined /> Login</span>,
              children: (
                <>
                  {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

                  <Form form={form} name="login" layout="vertical" onFinish={handleLogin} size="large">
                    <Form.Item name="username" rules={[{ required: true, message: 'Username daalen' }]}>
                      <Input prefix={<UserOutlined />} placeholder="Username" autoComplete="username" />
                    </Form.Item>

                    <Form.Item name="password" rules={[{ required: true, message: 'Password daalen' }]}>
                      <Input.Password prefix={<LockOutlined />} placeholder="Password" autoComplete="current-password" />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 8 }}>
                      <Button type="primary" htmlType="submit" className="login-btn" loading={loading} block size="large">
                        Log In
                      </Button>
                    </Form.Item>
                  </Form>

                  <Divider plain style={{ fontSize: 12, color: '#555' }}>Dev: Quick Login</Divider>
                  <Space style={{ width: '100%', justifyContent: 'center' }} size="small" wrap>
                    <Button size="small" onClick={() => quickLogin('admin', 'admin123')}>Admin</Button>
                    <Button size="small" onClick={() => quickLogin('io_1', 'io123')}>IO</Button>
                    <Button size="small" onClick={() => quickLogin('sho_1', 'sho123')}>SHO (old)</Button>
                  </Space>
                </>
              ),
            },
            {
              key: 'sho',
              label: <span><BankOutlined /> SHO Login Helper</span>,
              children: (
                <div>
                  <div style={{
                    background: 'rgba(24,144,255,0.07)',
                    border: '1px solid rgba(24,144,255,0.2)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 16,
                    fontSize: 13,
                    color: '#69c0ff',
                  }}>
                    <TeamOutlined style={{ marginRight: 8 }} />
                    Apna <strong>District</strong> aur <strong>Police Station</strong> chunein — username auto-fill ho jayega.
                  </div>

                  {/* District */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>District Chunein</div>
                    <Select
                      showSearch
                      placeholder="District chunein..."
                      style={{ width: '100%' }}
                      optionFilterProp="children"
                      onChange={(val) => {
                        setSelectedDistrict(val);
                        setSelectedStation(null);
                        setShoInfo(null);
                      }}
                    >
                      {Object.keys(HARYANA_DISTRICTS).sort().map(d => (
                        <Option key={d} value={d}>{d}</Option>
                      ))}
                    </Select>
                  </div>

                  {/* Police Station */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Police Station Chunein</div>
                    <Select
                      showSearch
                      placeholder={selectedDistrict ? 'Station chunein...' : 'Pehle district chunein'}
                      disabled={!selectedDistrict}
                      style={{ width: '100%' }}
                      optionFilterProp="children"
                      loading={shoLookupLoading}
                      onChange={handleStationSelect}
                      value={selectedStation}
                    >
                      {(HARYANA_DISTRICTS[selectedDistrict] || []).map(ps => (
                        <Option key={ps} value={ps}>{ps}</Option>
                      ))}
                    </Select>
                  </div>

                  {/* Result card */}
                  {shoInfo && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(82,196,26,0.1), rgba(82,196,26,0.05))',
                      border: '1px solid rgba(82,196,26,0.3)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 12, color: '#73d13d', fontWeight: 600, marginBottom: 8 }}>
                        ✅ SHO Account Mila — {selectedStation}
                      </div>
                      <div style={{ fontSize: 13, color: '#d9d9d9', marginBottom: 4 }}>
                        <strong style={{ color: '#aaa' }}>Username:</strong>{' '}
                        <span style={{ fontFamily: 'monospace', color: '#73d13d', fontSize: 14 }}>{shoInfo.username}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#d9d9d9', marginBottom: 12 }}>
                        <strong style={{ color: '#aaa' }}>Full Name:</strong> {shoInfo.full_name}
                      </div>
                      <Button
                        type="primary"
                        block
                        icon={<UserOutlined />}
                        onClick={handleUseShoCredentials}
                        style={{ background: 'linear-gradient(135deg,#52c41a,#237804)', border: 'none' }}
                      >
                        Login Form mein Fill Karein
                      </Button>
                    </div>
                  )}

                  {selectedStation && !shoInfo && !shoLookupLoading && (
                    <div style={{
                      background: 'rgba(255,77,79,0.08)',
                      border: '1px solid rgba(255,77,79,0.2)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: '#ff7875',
                    }}>
                      ❌ Is station ka SHO account nahi mila. Admin se contact karein.
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: '#555', marginTop: 12, textAlign: 'center' }}>
                    Default password: <code style={{ color: '#888' }}>sho123</code>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
