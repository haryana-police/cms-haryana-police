import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Card, Descriptions, Tag, Button, Spin, message,
  Tabs, Modal, Form, Input, Select, Tooltip, Space,
} from 'antd';
import {
  ArrowLeftOutlined, EyeOutlined, BuildOutlined, PrinterOutlined,
  UserSwitchOutlined, SwapOutlined, EditOutlined,
  PlusOutlined, DeleteOutlined, AuditOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';

// Investigation Components
import CDRManagement from './investigation/CDRManagement';
import ArrestManagement from './investigation/ArrestManagement';
import EvidenceManagement from './investigation/EvidenceManagement';
import ChallanGeneration from './investigation/ChallanGeneration';
import CaseDiaryManagement from './investigation/CaseDiaryManagement';
import FIRPrintDocument from './FIRPrintDocument';

const { Title, Text } = Typography;
const { Option } = Select;

const OFFICER_RANKS = [
  'DGP', 'ADGP', 'IGP', 'DIG', 'SSP', 'SP', 'ASP', 'DSP',
  'Inspector', 'Sub-Inspector (SI)', 'Asst. Sub-Inspector (ASI)',
  'Head Constable (HC)', 'Constable', 'Other',
];

const ACTS_LIST = [
  'THE BHARATIYA NYAYA SANHITA (BNS), 2023',
  'THE BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS), 2023',
  'THE BHARATIYA SAKSHYA ADHINIYAM (BSA), 2023',
  'ARMS ACT, 1959',
  'NARCOTIC DRUGS AND PSYCHOTROPIC SUBSTANCES ACT, 1985 (NDPS)',
  'INFORMATION TECHNOLOGY ACT, 2000',
  'MOTOR VEHICLES ACT, 1988',
  'PROTECTION OF CHILDREN FROM SEXUAL OFFENCES ACT, 2012 (POCSO)',
  'PREVENTION OF CORRUPTION ACT, 1988',
  'SC/ST (PREVENTION OF ATROCITIES) ACT, 1989',
  'EXPLOSIVES ACT, 1884',
  'EXCISE ACT',
  'GAMBLING ACT',
  'FOREST ACT',
  'OTHER',
];

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
  'HSENB': ['HSENB POLICE STATION AMBALA','HSENB POLICE STATION FARIDABAD','HSENB POLICE STATION GURUGRAM','HSENB POLICE STATION HISAR','HSENB POLICE STATION JIND','HSENB POLICE STATION KARNAL','HSENB POLICE STATION REWARI','HSENB POLICE STATION ROHTAK'],
};

export default function FIRDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, profile } = useAuth();
  const [fir, setFir] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFIR = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch FIR');
        const data = await res.json();
        
        // Parse JSON arrays back to arrays
        if (typeof data.accused_details === 'string') data.accused_details = JSON.parse(data.accused_details);
        if (typeof data.acts_sections === 'string') data.acts_sections = JSON.parse(data.acts_sections);
        
        setFir(data);
      } catch (err) {
        message.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFIR();
  }, [id, token]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  }

  if (!fir) {
    return <div>FIR not found</div>;
  }

  const isIO   = profile?.role === 'io'  || profile?.role === 'sho' || profile?.role === 'admin';
  const isSHO  = profile?.role === 'sho' || profile?.role === 'admin';
  const isAdmin = profile?.role === 'admin';

  // IO Change Modal state
  const [ioModalOpen, setIoModalOpen] = useState(false);
  const [ioSaving, setIoSaving] = useState(false);
  const [ioUsers, setIoUsers] = useState([]);
  const [ioUsersLoading, setIoUsersLoading] = useState(false);
  const [ioForm] = Form.useForm();
  // Transfer FIR Modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferDistrict, setTransferDistrict] = useState(null);
  const [transferReason, setTransferReason] = useState('');
  const [transferForm] = Form.useForm();
  const fetchFIR = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch FIR');
      const data = await res.json();
      // Parse JSON arrays back to arrays
      if (typeof data.accused_details === 'string') data.accused_details = JSON.parse(data.accused_details);
      if (typeof data.acts_sections === 'string') data.acts_sections = JSON.parse(data.acts_sections);
      setFir(data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };
  // ── Change IO Handler ────────────────────────────────────────────────────────
  const handleOpenIoModal = async () => {
    ioForm.resetFields();
    setIoUsersLoading(true);
    setIoModalOpen(true);
    try {
      // Only fetch IOs from the same police station as this FIR
      const station = fir?.police_station ? encodeURIComponent(fir.police_station) : '';
      const url = `${import.meta.env.VITE_API_URL}/users?role=io${station ? `&station_id=${station}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setIoUsers(data);
      if (data.length === 0) message.info(`Is thane (${fir?.police_station}) mein koi IO nahi mila`);
    } catch {
      message.warning('IO list load nahi hui');
    } finally {
      setIoUsersLoading(false);
    }
  };
  const handleSaveIO = async (values) => {
    setIoSaving(true);
    try {
      const selectedUser = ioUsers.find(u => u.id === values.io_user_id);
      const payload = selectedUser
        ? { io_id: selectedUser.id, io_name: selectedUser.full_name, io_rank: selectedUser.rank || '', io_no: selectedUser.badge_number || '' }
        : { io_id: null, io_name: values.io_user_id, io_rank: '', io_no: '' };
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${id}/assign-io`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update IO');
      message.success('Investigating Officer assign ho gaya!');
      setIoModalOpen(false);
      await fetchFIR();
    } catch (err) {
      message.error(err.message);
    } finally {
      setIoSaving(false);
    }
  };
  // ── Transfer FIR Handler ─────────────────────────────────────────────────────
  const handleOpenTransferModal = () => {
    transferForm.resetFields();
    setTransferDistrict(null);
    setTransferReason('');
    setTransferModalOpen(true);
  };
  const handleTransferFIR = async (values) => {
    setTransferSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${id}/transfer`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');
      message.success(`FIR transfer ho gayi — ${values.district}, ${values.police_station}`);
      setTransferModalOpen(false);
      await fetchFIR();
    } catch (err) {
      message.error(err.message);
    } finally {
      setTransferSaving(false);
    }
  };
  // ── Status Change Handler ────────────────────────────────────────────────────
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusSaving, setStatusSaving]       = useState(false);
  const [selectedStatus, setSelectedStatus]   = useState('');
  const handleOpenStatusModal = () => {
    setSelectedStatus(fir.status);
    setStatusModalOpen(true);
  };
  const handleSaveStatus = async () => {
    if (selectedStatus === fir.status) {
      setStatusModalOpen(false);
      return;
    }
    setStatusSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: selectedStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status update failed');
      message.success(`FIR status update ho gaya: ${selectedStatus.replace('_', ' ').toUpperCase()}`);
      setStatusModalOpen(false);
      await fetchFIR();
    } catch (err) {
      message.error(err.message);
    } finally {
      setStatusSaving(false);
    }
  };
  // ── Edit Sections Handler ─────────────────────────────────────────────────
  const [sectionsModalOpen, setSectionsModalOpen]   = useState(false);
  const [sectionsSaving, setSectionsSaving]         = useState(false);
  const [editActsSections, setEditActsSections]     = useState([{ act: '', sections: '' }]);
  const handleOpenSectionsModal = () => {
    // Deep-clone current acts to avoid mutating FIR state
    const current = fir.acts_sections?.length
      ? fir.acts_sections.map(r => ({ ...r }))
      : [{ act: '', sections: '' }];
    setEditActsSections(current);
    setSectionsModalOpen(true);
  };
  const updateActRow = (i, field, val) =>
    setEditActsSections(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n; });
  const removeActRow = (i) =>
    setEditActsSections(prev => prev.filter((_, idx) => idx !== i));
  const handleSaveSections = async () => {
    const valid = editActsSections.filter(r => r.act && r.act.trim());
    if (valid.length === 0) {
      message.error('Kam se kam ek Act zaroori hai');
      return;
    }
    setSectionsSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/firs/${id}/sections`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ acts_sections: valid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update sections');
      message.success('Acts & Sections update ho gaye!');
      setSectionsModalOpen(false);
      await fetchFIR();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSectionsSaving(false);
    }
  };
  // ── Print Handler ────────────────────────────────────────────────────────────
  const handlePrintFIR = () => {
    const el = document.getElementById('fir-print-root');
    if (!el) return;
    const html = el.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=800');
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>FIR ${fir.fir_number}/${fir.year} — Haryana Police</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Serif:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 12mm 10mm; }
          body { margin:0; padding:20px; font-family:'Noto Serif','Times New Roman',Georgia,serif; font-size:11.5px; color:#000; background:#fff; }
          table { width:100%; border-collapse:collapse; }
          @media print { body { padding:0; } }
        </style>
      </head><body>${html}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 800);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/fir')} shape="circle" />
        <Title level={2} style={{ margin: 0 }}>FIR {fir.fir_number} / {fir.year}</Title>
        <Tag color={fir.status === 'closed' ? 'green' : fir.status === 'chargesheeted' ? 'purple' : fir.status === 'under_investigation' ? 'orange' : 'blue'}>
          {fir.status.toUpperCase().replace('_', ' ')}
        </Tag>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isSHO && (
            <Tooltip title="SHO: IO badlein is FIR ke liye">
              <Button
                icon={<UserSwitchOutlined />}
                onClick={handleOpenIoModal}
                style={{
                  background: 'linear-gradient(135deg,#f7931e,#e65c00)',
                  border: 'none', color: '#fff', fontWeight: 600,
                }}
              >
                Change IO
              </Button>
            </Tooltip>
          )}
          {isSHO && (
            <Tooltip title="SHO: FIR ka status badlein">
              <Button
                icon={<EditOutlined />}
                onClick={handleOpenStatusModal}
                style={{
                  background: 'linear-gradient(135deg,#13c2c2,#006d75)',
                  border: 'none', color: '#fff', fontWeight: 600,
                }}
              >
                Change Status
              </Button>
            </Tooltip>
          )}
          {isSHO && (
            <Tooltip title="SHO: Acts & Sections edit karein">
              <Button
                icon={<AuditOutlined />}
                onClick={handleOpenSectionsModal}
                style={{
                  background: 'linear-gradient(135deg,#eb2f96,#9e1068)',
                  border: 'none', color: '#fff', fontWeight: 600,
                }}
              >
                Edit Sections
              </Button>
            </Tooltip>
          )}
          {isAdmin && (
            <Tooltip title="Admin: FIR ko dusre thane mein transfer karein">
              <Button
                icon={<SwapOutlined />}
                onClick={handleOpenTransferModal}
                style={{
                  background: 'linear-gradient(135deg,#722ed1,#531dab)',
                  border: 'none', color: '#fff', fontWeight: 600,
                }}
              >
                Transfer FIR
              </Button>
            </Tooltip>
          )}
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrintFIR}
            style={{ background: 'linear-gradient(135deg,#1565c0,#0d47a1)', border: 'none' }}
          >
            Print FIR / Save PDF
          </Button>
        </div>
      </div>

      {/* Hidden print-ready document */}
      <div style={{ display: 'none' }}>
        <FIRPrintDocument fir={fir} />
      </div>

      {/* ── Change IO Modal ── */}
      <Modal
        open={ioModalOpen}
        onCancel={() => setIoModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserSwitchOutlined style={{ color: '#f7931e', fontSize: 18 }} />
            <span>IO Assign Karein — Investigating Officer</span>
          </div>
        }
        footer={null}
        width={480}
      >
        {/* Current IO display */}
        <div style={{
          background: 'rgba(247,147,30,0.08)',
          border: '1px solid rgba(247,147,30,0.3)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 13,
          color: '#d9d9d9',
        }}>
          <strong style={{ color: '#f7931e' }}>Current IO:</strong>{' '}
          {fir.io_name ? `${fir.io_name} (${fir.io_rank}${fir.io_no ? ', #' + fir.io_no : ''})` : 'Unassigned'}
        </div>

        <Form form={ioForm} layout="vertical" onFinish={handleSaveIO}>
          <Form.Item
            name="io_user_id"
            label="System IO Officer Chunein"
            rules={[{ required: true, message: 'Koi IO officer chunein' }]}
          >
            <Select
              showSearch
              loading={ioUsersLoading}
              placeholder={ioUsersLoading ? 'IO list load ho rahi hai...' : 'IO officer chunein'}
              optionFilterProp="children"
              notFoundContent={ioUsersLoading ? 'Loading...' : 'Koi IO officer register nahi hai'}
              size="large"
            >
              {ioUsers.map(u => (
                <Option key={u.id} value={u.id}>
                  {u.full_name}{u.rank ? ` — ${u.rank}` : ''}{u.badge_number ? ` (#${u.badge_number})` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <div style={{ fontSize: 12, color: '#888', marginBottom: 16, marginTop: -8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
            💡 Is IO ko yeh FIR assign ho jayegi. IO apne login se sirf apni assigned FIRs dekh sakta hai.
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => setIoModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={ioSaving}
              icon={<UserSwitchOutlined />}
              style={{ background: 'linear-gradient(135deg,#f7931e,#e65c00)', border: 'none' }}
            >
              IO Assign Karo
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Transfer FIR Modal ── */}
      <Modal
        open={transferModalOpen}
        onCancel={() => setTransferModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SwapOutlined style={{ color: '#722ed1', fontSize: 18 }} />
            <span>FIR Transfer — Dusre Thane Mein Bhejen</span>
          </div>
        }
        footer={null}
        width={520}
      >
        {/* Current location display */}
        <div style={{
          background: 'rgba(114,46,209,0.08)',
          border: '1px solid rgba(114,46,209,0.3)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 13,
          color: '#d9d9d9',
        }}>
          <strong style={{ color: '#722ed1' }}>Current Location:</strong>{' '}
          {fir.police_station}, {fir.district}
        </div>

        <Form form={transferForm} layout="vertical" onFinish={handleTransferFIR}>
          <Form.Item
            name="district"
            label="Naya District"
            rules={[{ required: true, message: 'District chunein' }]}
          >
            <Select
              showSearch
              placeholder="District chunein"
              optionFilterProp="children"
              onChange={(val) => {
                setTransferDistrict(val);
                transferForm.setFieldValue('police_station', undefined);
              }}
            >
              {Object.keys(HARYANA_DISTRICTS).sort().map(d => (
                <Option key={d} value={d}>{d}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="police_station"
            label="Naya Police Thana"
            rules={[{ required: true, message: 'Police station chunein' }]}
          >
            <Select
              showSearch
              placeholder={transferDistrict ? 'Thana chunein' : 'Pehle district chunein'}
              disabled={!transferDistrict}
              optionFilterProp="children"
            >
              {(HARYANA_DISTRICTS[transferDistrict] || []).map(ps => (
                <Option key={ps} value={ps}>{ps}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="transfer_reason"
            label="Transfer Ka Karan (optional)"
          >
            <Input.TextArea
              rows={3}
              placeholder="e.g. Jurisdiction issue, accused belongs to another area..."
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => setTransferModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={transferSaving}
              icon={<SwapOutlined />}
              style={{ background: 'linear-gradient(135deg,#722ed1,#531dab)', border: 'none' }}
            >
              Transfer Karo
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Change Status Modal ── */}
      <Modal
        open={statusModalOpen}
        onCancel={() => setStatusModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <EditOutlined style={{ color: '#13c2c2', fontSize: 18 }} />
            <span>FIR Status Badlein</span>
          </div>
        }
        footer={null}
        width={440}
      >
        <p style={{ color: '#aaa', marginBottom: 16, fontSize: 13 }}>
          Naya status chunein. Yeh change FIR record mein save ho jayega.
        </p>

        {/* Status Radio Cards */}
        {[
          { value: 'under_investigation', label: 'Under Investigation', desc: 'IO investigation kar raha hai',                    color: '#faad14', bg: 'rgba(250,173,20,0.08)'  },
          { value: 'chargesheeted',       label: 'Chargesheeted',       desc: 'Challan court mein submit ho gaya',                color: '#722ed1', bg: 'rgba(114,46,209,0.08)' },
          { value: 'closed',              label: 'Closed',              desc: 'Mamla band / Final report submit ho gayi',         color: '#52c41a', bg: 'rgba(82,196,26,0.08)'  },
        ].map(opt => (
          <div
            key={opt.value}
            onClick={() => setSelectedStatus(opt.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 16px', marginBottom: 10, borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${selectedStatus === opt.value ? opt.color : 'rgba(255,255,255,0.1)'}`,
              background: selectedStatus === opt.value ? opt.bg : 'rgba(255,255,255,0.03)',
              transition: 'all 0.2s',
            }}
          >
            {/* Radio circle */}
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${opt.color}`,
              background: selectedStatus === opt.value ? opt.color : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selectedStatus === opt.value && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: opt.color, fontSize: 14 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{opt.desc}</div>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button onClick={() => setStatusModalOpen(false)}>Cancel</Button>
          <Button
            type="primary"
            loading={statusSaving}
            onClick={handleSaveStatus}
            disabled={selectedStatus === fir.status}
            icon={<EditOutlined />}
            style={{ background: 'linear-gradient(135deg,#13c2c2,#006d75)', border: 'none' }}
          >
            Status Update Karo
          </Button>
        </div>
      </Modal>

      {/* ── Edit Acts & Sections Modal ── */}
      <Modal
        open={sectionsModalOpen}
        onCancel={() => setSectionsModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AuditOutlined style={{ color: '#eb2f96', fontSize: 18 }} />
            <span>Acts &amp; Sections Edit Karein</span>
          </div>
        }
        footer={null}
        width={640}
      >
        <p style={{ color: '#aaa', marginBottom: 16, fontSize: 13 }}>
          FIR mein darj Acts aur Sections ko yahan se edit kar sakte hain.
        </p>

        {/* Dynamic rows */}
        {editActsSections.map((row, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 160px 36px',
            gap: 8, marginBottom: 10, alignItems: 'center',
          }}>
            {/* Act dropdown */}
            <Select
              showSearch
              placeholder="Act chunein"
              value={row.act || undefined}
              onChange={val => updateActRow(i, 'act', val)}
              optionFilterProp="children"
              style={{ width: '100%' }}
            >
              {ACTS_LIST.map(a => (
                <Option key={a} value={a}>{a}</Option>
              ))}
            </Select>

            {/* Sections input */}
            <Input
              placeholder="e.g. 302, 34"
              value={row.sections}
              onChange={e => updateActRow(i, 'sections', e.target.value)}
            />

            {/* Remove row */}
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => removeActRow(i)}
              disabled={editActsSections.length === 1}
              style={{ flexShrink: 0 }}
            />
          </div>
        ))}

        {/* Add row button */}
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setEditActsSections(prev => [...prev, { act: '', sections: '' }])}
          style={{ width: '100%', marginTop: 4, marginBottom: 20 }}
        >
          Aur Act / Section Add Karein
        </Button>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button onClick={() => setSectionsModalOpen(false)}>Cancel</Button>
          <Button
            type="primary"
            loading={sectionsSaving}
            onClick={handleSaveSections}
            icon={<AuditOutlined />}
            style={{ background: 'linear-gradient(135deg,#eb2f96,#9e1068)', border: 'none' }}
          >
            Save Sections
          </Button>
        </div>
      </Modal>

      {/* ── Tabs ── */}
      <Tabs
        defaultActiveKey="1"
        size="large"
        items={[
          {
            key: '1',
            label: <span><EyeOutlined /> Basic Information</span>,
            children: (
              <Card bordered={false} className="fir-card">
                <Descriptions bordered column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}>
                  <Descriptions.Item label="Police Station">{fir.police_station}, {fir.district}</Descriptions.Item>
                  <Descriptions.Item label="Date of Registration">{new Date(fir.date_time_of_fir).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="Complainant">{fir.complainant_name}</Descriptions.Item>
                  <Descriptions.Item label="Place of Occurrence">{fir.place_address || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Registered By">{fir.registered_by_name}</Descriptions.Item>
                  
                  <Descriptions.Item label="Investigating Officer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span>
                        {fir.io_name
                          ? `${fir.io_name} (${fir.io_rank}${fir.io_no ? ', #' + fir.io_no : ''})`
                          : <Tag color="orange">Unassigned</Tag>}
                      </span>
                      {isSHO && (
                        <Button
                          size="small"
                          icon={<UserSwitchOutlined />}
                          onClick={handleOpenIoModal}
                          style={{ fontSize: 11, padding: '0 8px', height: 22, lineHeight: '20px' }}
                        >
                          Change
                        </Button>
                      )}
                    </div>
                  </Descriptions.Item>
                  {fir.transferred_from_ps && (
                    <Descriptions.Item label="Transfer History" span={3}>
                      <Tag icon={<SwapOutlined />} color="purple">
                        Transferred from: {fir.transferred_from_ps}, {fir.transferred_from_district}
                      </Tag>
                      {fir.transfer_reason && (
                        <span style={{ marginLeft: 8, color: '#aaa', fontSize: 12 }}>
                          Reason: {fir.transfer_reason}
                        </span>
                      )}
                    </Descriptions.Item>
                  )}

                  <Descriptions.Item label="Acts &amp; Sections" span={3}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        {fir.acts_sections?.map((act, i) => (
                          <Tag key={i} color="geekblue" style={{ marginBottom: 4 }}>
                            {act.act} - Sec {act.sections}
                          </Tag>
                        ))}
                      </div>
                      {isSHO && (
                        <Button
                          size="small"
                          icon={<AuditOutlined />}
                          onClick={handleOpenSectionsModal}
                          style={{ fontSize: 11, padding: '0 8px', height: 22, lineHeight: '20px', flexShrink: 0 }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </Descriptions.Item>

                  <Descriptions.Item label="Accused Details" span={3}>
                    {fir.accused_details && fir.accused_details.length > 0 ? (
                      fir.accused_details.map((accused, i) => (
                        <Tag key={i}>{accused.name} {accused.phone ? `(${accused.phone})` : ''}</Tag>
                      ))
                    ) : (
                      <Text type="secondary">Unknown/None mentioned</Text>
                    )}
                  </Descriptions.Item>

                  <Descriptions.Item label="FIR Narrative" span={3}>
                    <div style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', color: '#d9d9d9', padding: '16px', borderRadius: '8px' }}>
                      {fir.fir_content}
                    </div>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )
          },
          ...(isIO ? [
            {
              key: '2',
              label: <span><BuildOutlined /> Investigation Actions</span>,
              children: (
                <Tabs tabPosition="left" style={{ background: '#0f1b2d', padding: '24px 0', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.07)' }}>
                  <Tabs.TabPane tab="CDR Requests" key="inv-1">
                    <div style={{ padding: '0 24px' }}>
                      <CDRManagement firId={fir.id} accusedList={fir.accused_details || []} />
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane tab="Arrests" key="inv-2">
                    <div style={{ padding: '0 24px' }}>
                      <ArrestManagement firId={fir.id} firData={fir} accusedList={fir.accused_details || []} />
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane tab="Evidences & Notices" key="inv-3">
                    <div style={{ padding: '0 24px' }}>
                      <EvidenceManagement firId={fir.id} firData={fir} />
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane tab="Case Diary" key="inv-4">
                    <div style={{ padding: '0 24px' }}>
                      <CaseDiaryManagement firId={fir.id} />
                    </div>
                  </Tabs.TabPane>
                  <Tabs.TabPane tab="Final Report (Challan)" key="inv-5">
                    <div style={{ padding: '0 24px' }}>
                      <ChallanGeneration firId={fir.id} />
                    </div>
                  </Tabs.TabPane>
                </Tabs>
              )
            }
          ] : [])
        ]}
      />
    </div>
  );
}
