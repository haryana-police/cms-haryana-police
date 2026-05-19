import React, { useState } from 'react';
import { Typography, Form, Radio, Select, Input, Checkbox, Button, Card, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function TransferComplaint({ onBack }) {
  const [form] = Form.useForm();
  const wantToTransfer = Form.useWatch('wantToTransfer', form);
  const officeType = Form.useWatch('officeType', form);
  const atrNotRequired = Form.useWatch('atrNotRequired', form);
  const [selectedDistrict, setSelectedDistrict] = useState('');

  const districts = [
    'AMBALA',
    'Anti Corruption Bureau, Haryana',
    'BHIWANI',
    'CHARKHI DADRI',
    'DABWALI',
    'FARIDABAD',
    'FATEHABAD',
    'GRP AMBALA CANTT',
    'GURUGRAM',
    'HANSI',
    'Haryana State Enforcement Bureau (HSEnB)',
    'Haryana State Narcotics Control Bureau',
    'HISAR',
    'JHAJJAR',
    'JIND',
    'KAITHAL',
    'KARNAL',
    'KURUKSHETRA',
    'MAHENDERGARH',
    'NUH',
    'PALWAL',
    'PANCHKULA',
    'PANIPAT',
    'REWARI',
    'ROHTAK',
    'SIRSA',
    'SONIPAT',
    'SPECIAL TASK FORCE (STF)',
    'State Crime Branch',
    'TRANSPORT DEPT',
    'YAMUNA NAGAR'
  ];

  const ambalaPoliceStations = [
    'AMBALA CANTT',
    'AMBALA CITY',
    'AMBALA SADAR',
    'BALDEV NAGAR',
    'BARARA',
    'MAHESH NAGAR',
    'MULLANA',
    'NAGGAL',
    'NARAINGARH',
    'PANJOKHRA',
    'PARAO AMBALA CANTT',
    'PS CYBER CRIME AMBALA',
    'RAIPUR RANI(Ambala)',
    'SAHA'
  ];

  const bhiwaniPoliceStations = [
    'BAWANI KHERA',
    'BEHAL',
    'BHIWANI CITY',
    'BHIWANI CIVIL LINES',
    'BHIWANI SADAR',
    'BOND KALAN',
    'DADRI CITY',
    'DADRI SADAR',
    'JUI KALAN PS BHIWANI',
    'LOHARU',
    'PS INDUSTRIAL AREA, BHIWANI',
    'SIWANI',
    'TOSHAM',
    'WOMEN POLICE STATION, BHIWANI'
  ];

  const dabwaliPoliceStations = [
    'BARAGUDHA',
    'CITY MANDI DABWALI',
    'DABWALI SADAR',
    'KALAN WALI',
    'ODHAN',
    'RORI',
    'Women Police Station Dabwali,Sirsa'
  ];

  const charkhiDadriPoliceStations = [
    'BADHRA',
    'BOND KALAN',
    'DADRI CITY',
    'DADRI SADAR',
    'JHOJHU KALAN',
    'Women Police Station, Charkhi Dadri'
  ];

  const faridabadPoliceStations = [
    'ADARSH NAGAR',
    'BALLABHGARH CITY',
    'BALLABHGARH SADAR',
    'BHUPANI',
    'CHHANSA',
    'DABUA',
    'DHAUJ',
    'FARIDABAD CENTRAL',
    'FARIDABAD KOTWALI',
    'FARIDABAD N.I.T.',
    'FARIDABAD OLD',
    'KHERIPUL',
    'Metro Police Station Faridabad',
    'MUJESAR',
    'PALLA',
    'Polilce Station B.P.T.P.',
    'S.G.M. NAGAR (SANJAY GANDHI MEMORIAL NAGAR)',
    'SARAI KHAWAJA',
    'SARAN',
    'SECTOR - 8',
    'SECTOR-17',
    'SECTOR-31 FARIDABAD',
    'SECTOR-58',
    'SURAJ KUND',
    'TIGAON',
    'Women Police Station Ballabgarh',
    'Women Police Station NIT,Faridabad',
    'WOMEN POLICE STATION, FARIDABAD'
  ];

  const fatehabadPoliceStations = [
    'BHATTU KALAN',
    'BHUNA',
    'CITY FATEHABAD',
    'CITY RATIA',
    'CITY TOHANA',
    'JAKHAL',
    'SADAR FATEHABAD',
    'SADAR RATTIA',
    'SADAR TOHANA',
    'WOMEN POLICE STATION, FATEHABAD'
  ];

  const hisarPoliceStations = [
    'ADAMPUR',
    'AGROHA',
    'AZAD NAGAR HISAR',
    'BARWALA',
    'Cyber Crime, Police Station Hisar',
    'HISAR CITY',
    'HISAR CIVIL LINES',
    'HISAR SADAR',
    'HTM HISAR',
    'Special Task Force Unit Hisar',
    'TRAFFIC',
    'UKLANA',
    'URBAN ESTATE HISAR',
    'WOMEN POLICE STATION, HISSAR'
  ];

  const gurugramPoliceStations = [
    'BADSHAHPUR',
    'BAJGHERA',
    'BHONDSI',
    'BILASPUR GURUGRAM',
    'CITY SOHANA',
    'CIVIL LINES GURGAON',
    'DLF',
    'DLF PH-3rd',
    'DLF PHASE-1',
    'DLF-II',
    'FURRUKH NAGAR',
    'GURGAON CITY',
    'GURGAON SADAR',
    'INDUSTRIAL SECTOR - 7, MANESAR',
    'KHEDKI DAULA',
    'MANESAR',
    'METRO',
    'NEW COLONY',
    'PALAM VIHAR',
    'PATAUDI',
    'PS Cyber Manesar',
    'PS Cyber South',
    'PS Cyber West',
    'RAJENDRA PARK',
    'SECTOR - 37',
    'SECTOR - 50',
    'SECTOR - 53',
    'SECTOR - 9A',
    'SECTOR-10',
    'SECTOR-14, Gurugram',
    'SECTOR-17 / 18',
    'SECTOR-40',
    'SECTOR-5, GURGAON',
    'SECTOR-56',
    'SECTOR-65',
    'SHIVAJI NAGAR',
    'SOHNA',
    'Special Task Force Central Unit Gurugram',
    'Special Task Force Headquarters Gurugram',
    'Special Task Force Unit Gurugram',
    'SUSHANT LOK',
    'TRAFFIC - I',
    'TRAFFIC - II',
    'TRAFFIC PS KMP, GURUGRAM',
    'UDYOG VIHAR',
    'WOMEN POLICE STATION MANESAR,GURUGRAM',
    'WOMEN POLICE STATION, GURGAON',
    'Women West Gurugram'
  ];

  const hansiPoliceStations = [
    'BASS',
    'HANSI CITY',
    'HANSI SADAR',
    'NARNAUND',
    'PS CYBER CRIME, HANSI',
    'PS Traffic Hansi',
    'Women Police Station, HANSI'
  ];

  const jhajjarPoliceStations = [
    'ASAUDA',
    'BADLI',
    'BERI',
    'CITY BAHADURGARH',
    'CITY JHAJJAR',
    'DUJANA',
    'LINE PAR BAHADURGARH',
    'MACHHROLI',
    'PS Cyber Jhajjar',
    'SADAR BAHADURGARH',
    'SADAR JHAJJAR',
    'SAHLAWAS',
    'SECTOR-06 BAHADURGRH',
    'Special Task Force Unit Bahadurgarh',
    'TRAFFIC BAHADURGARH',
    'WOMEN POLICE STATION, JHAJJAR',
    'WOMEN PS BAHADURGARH,JHAJJAR'
  ];

  const hsenbPoliceStations = [
    'HSEnB Police Station Ambala',
    'HSEnB Police Station Faridabad',
    'HSEnB Police Station Gurugram',
    'HSEnB Police Station Hisar',
    'HSEnB Police Station Jind',
    'HSEnB Police Station Karnal',
    'HSEnB Police Station Rewari',
    'HSEnB Police Station Rohtk',
    'PS HSEnB Bhiwani',
    'PS HSEnB Charkhi Dadri',
    'PS HSEnB Fatehabad',
    'PS HSEnB Jhajjar',
    'PS HSEnB Kaithal',
    'PS HSEnB Kurukshetra',
    'PS HSEnB Mahendergarh',
    'PS HSEnB Nuh',
    'PS HSEnB Palwal',
    'PS HSEnB Panchkula',
    'PS HSEnB Panipat',
    'PS HSEnB Sirsa',
    'PS HSEnB Sonipat',
    'PS HSEnB Yamunanagar'
  ];

  const jindPoliceStations = [
    'ALEWA',
    'CITY SAFIDON',
    'Civil line Jind',
    'GARHI',
    'JIND CITY',
    'JIND SADAR',
    'JULANA',
    'NARWANA CITY',
    'NARWANA SADAR',
    'PILLU KHERA',
    'PS Cyber, District Jind',
    'SAFIDON',
    'TRAFFIC',
    'UCHANA',
    'WOMEN POLICE STATION, JIND'
  ];

  const kaithalPoliceStations = [
    'Cyber Crime Police Station Kaithal',
    'CHEEKA',
    'CIVIL LINE KAITHAL',
    'Dhand',
    'GUHLA',
    'KAITHAL CITY',
    'KAITHAL SADAR',
    'KALAYAT',
    'PUNDRI',
    'RAJAUND',
    'SIWAN',
    'TITRAM',
    'TRAFFIC',
    'WOMEN POLICE STATION, KAITHAL'
  ];

  const karnalPoliceStations = [
    'ASSANDH',
    'BUTANA',
    'Cyber Crime police station karnal',
    'GHARAUNDA',
    'INDRI',
    'KARNAL CITY',
    'KARNAL CIVIL LINES',
    'KARNAL SADAR',
    'KUNJPURA',
    'MADHUBAN',
    'MUNAK, KARNAL',
    'NIGDHU KARNAL',
    'NISSING',
    'RAM NAGAR KARNAL',
    'SECTOR 32-33 KARNAL',
    'Special Task Force Unit Karnal',
    'TARAORI',
    'TRAFFIC',
    'Women Police Station Assand,Karnal',
    'WOMEN POLICE STATION, KARNAL'
  ];

  const kurukshetraPoliceStations = [
    'BABAIN',
    'CITY PEHOWA, KURUKSHETRA',
    'CYBER CRIME POLICE STATION, KURUKSHETRA',
    'ISMAILABAD',
    'JHANSA',
    'KRISHANA GATE, THANASAR KURUKSHETRA',
    'KURUKSHETRA UNIVERSITY',
    'LADWA',
    'PEHOWA',
    'SHAHABAD',
    'THANESAR CITY',
    'THANESAR SADAR',
    'TRAFFIC',
    'WOMEN POLICE STATION, KURUKSHETRA'
  ];

  const mahendergarhPoliceStations = [
    'ATELI',
    'CITY KANINA',
    'CITY MAHENDERGARH',
    'CITY NARNAUL',
    'CYBER POLICE STATION, MAHENDERGARH',
    'NANGAL CHAUDHRI',
    'NIZAMPUR',
    'SADAR KANINA',
    'SADAR MAHENDERGARH',
    'SADAR NARNAUL',
    'SATNALI',
    'TRAFFIC',
    'WOMEN POLICE STATION, NARNAUL'
  ];

  const nuhPoliceStations = [
    'BICCHOR',
    'CITY NUH',
    'CITY TAURU',
    'FEROZEPUR JHIRKA',
    'NAGINA',
    'PINANGWA',
    'PS Akera',
    'PS City Firozpur Jhirka',
    'PS City Punhana',
    'PS Cyber Crime Nuh(Mewat)',
    'PS Mohammadpur Ahir',
    'PS Traffic (KMP) Dhulawat',
    'PUNHANA',
    'ROZKA MEO',
    'SADAR NUH',
    'SADAR TAURU',
    'TRAFFIC',
    'WOMEN POLICE STATION, MEWAT'
  ];

  const palwalPoliceStations = [
    'BAHIN',
    'CAMP PALWAL',
    'CHAND HUT',
    'CITY PALWAL',
    'GADPURI',
    'HASSANPUR',
    'HATHIN',
    'HODAL',
    'MUNDKATI',
    'PS Cyber Crime, District Palwal',
    'SADAR PALWAL',
    'Special Task Force Unit Palwal',
    'TRAFFIC',
    'UTAWAR',
    'WOMEN POLICE STATION, PALWAL'
  ];

  const panchkulaPoliceStations = [
    'CHANDIMANDIR',
    'CYBER CRIME',
    'KALKA',
    'MANSA DEVI COMPLEX',
    'PANCHKULA SECTOR-5',
    'PINJORE',
    'RAIPUR RANI',
    'SECTOR-14, PANCHKULA',
    'SECTOR-20',
    'SECTOR-7, PANCHKULA',
    'TRAFFIC',
    'WOMEN POLICE STATION, PANCHKULA'
  ];

  const panipatPoliceStations = [
    'BAPOLI',
    'CHANDNIBAGH',
    'Cyber Crime Police Station Panipat',
    'Industrial Sector 29 Panipat',
    'ISRANA',
    'MATLAUDA',
    'Model Town Panipat',
    'Old Industrial Panipat',
    'PANIPAT CITY',
    'PANIPAT SADAR',
    'Quilla Panipat',
    'SAMALKHA',
    'SANOLI',
    'SECTOR 13/17 PANIPAT',
    'Tehsil Camp Panipat',
    'TRAFFIC',
    'WOMEN POLICE STATION, PANIPAT'
  ];

  const rewariPoliceStations = [
    'BAWAL',
    'DHARUHERA',
    'JATUSANA',
    'KASOLA',
    'KHOL',
    'KOSLI',
    'MODEL TOWN REWARI',
    'POLICE STATION CYBER CRIME, REWARI',
    'RAMPURA',
    'REWARI CITY',
    'REWARI SADAR',
    'ROHADAI',
    'SEC-6, DHARUHERA',
    'TRAFFIC',
    'WOMEN POLICE STATION, REWARI'
  ];

  const rohtakPoliceStations = [
    'ARYA NAGAR ROHTAK',
    'BAHUAKBARPUR',
    'Cyber Police Station Rohtak',
    'I.M.T. ROHTAK',
    'KALANAUR',
    'LAKHAN MAJRA',
    'MEHAM',
    'P.G.I.M.S. ROHTAK',
    'PURANI SABZI MANDI ROHTAK',
    'ROHTAK CITY',
    'ROHTAK CIVIL LINES',
    'ROHTAK SADAR',
    'SAMPLA',
    'SHIVAJI COLONY',
    'Special Task Force Unit Rohtak',
    'TRAFFIC',
    'URBAN ESTATE ROHTAK',
    'WOMEN POLICE STATION, ROHTAK'
  ];

  const sirsaPoliceStations = [
    'BARAGUDHA(Sirsa)',
    'CITY MANDI DABWALI(Sirsa)',
    'Cyber Crime Police Station Sirsa',
    'DABWALI SADAR(Sirsa)',
    'DING',
    'ELLENABAD',
    'KALAN WALI(Sirsa)',
    'NATHU SARAI CHOPTA',
    'ODHAN(Sirsa)',
    'Police Station,Civil Line Sirsa',
    'RANIA',
    'RORI(Sirsa)',
    'SIRSA CITY',
    'SIRSA SADAR',
    'TRAFFIC',
    'Women Police Station Dabwali(Sirsa)',
    'WOMEN POLICE STATION, SIRSA'
  ];

  const yamunanagarPoliceStations = [
    'BILASPUR',
    'BURIA',
    'CHHACHHRAULI',
    'CHHAPAR',
    'Cyber Crime Police Station, Yamunanagar',
    'FARAKPUR',
    'GANDHI NAGAR, YAMUNANAGAR',
    'JAGADDHRI SADAR',
    'JAGADHRI CITY',
    'JATHLANA',
    'PRATAP NAGAR',
    'RADAUR',
    'SADHAURA',
    'SEC.17 HUDA, JAGADHRI YAMUNANAGAR',
    'TRAFFIC',
    'WOMEN POLICE STATION, YAMUNA NAGAR',
    'YAMUNA NAGAR CITY',
    'YAMUNA NAGAR SADAR'
  ];

  const sonipatPoliceStations = [
    'BARODA',
    'BHAINSWAL KALAN',
    'CITY GOHANA',
    'CITY SONIPAT',
    'CIVIL LINE SONIPAT',
    'Cyber Crime Police Station, Sonipat',
    'GANAUR',
    'KHARKHODA',
    'KUNDLI',
    'MOHANA',
    'MURTHAL',
    'RAI',
    'SADAR GOHANA',
    'SADAR SONIPAT',
    'SECTOR 27, SONIPAT',
    'Special Task Force Unit Sonipat',
    'TRAFFIC',
    'WOMEN POLICE STATION KUNDLI',
    'WOMEN POLICE STATION, SONIPAT',
    'WOMEN PS GOHANA',
    'WOMEN PS KHANPUR KALAN'
  ];

  const stateCrimeBranchPoliceStations = [
    'Nodal Cyber Crime Police Station, Haryana'
  ];

  const acbPoliceStations = [
    'ACB Ambala',
    'ACB Faridabad',
    'ACB Gurugram',
    'ACB Hisar',
    'ACB Karnal',
    'ACB Panchkula',
    'ACB Rohtak'
  ];

  const transportDeptStations = [
    'TRANSPORT DEPT. HARYANA'
  ];

  const stfPoliceStations = [
    'STF (NDPS) UNIT SIRSA',
    'STF COBRA UNIT GURUGRAM',
    'STF HAWK (CYBER CELL) GURUGRAM',
    'STF JAGUAR UNIT HISAR',
    'STF LEOPARD UNIT SONIPAT',
    'STF PANTHER UNIT BAHADURGARH',
    'STF TEAM NARNAUL',
    'STF TEAM PANCHKULA',
    'STF TEAM ROHTAK',
    'STF UNIT AMBALA',
    'STF UNIT CENTRAL HQ GURUGRAM',
    'STF UNIT KARNAL',
    'STF UNIT PALWAL',
    'STF UNIT-2 SONIPAT'
  ];

  const grpAmbalaCanttStations = [
    'GRP AMBALA Cantt',
    'GRP BAHADURGARH',
    'GRP CHANDIGARH',
    'GRP FARIDABAD',
    'GRP GURUGRAM',
    'GRP HISAR',
    'GRP JAGADHARI',
    'GRP JIND',
    'GRP KALKA',
    'GRP KARNAL',
    'GRP KURUKSHETRA',
    'GRP PANIPAT',
    'GRP REWARI',
    'GRP ROHTAK',
    'GRP SIRSA',
    'GRP SONIPAT'
  ];

  const haryanaStateNarcoticsControlBureauStations = [
    'HSNCB Unit Ambala',
    'HSNCB Unit Bhiwani',
    'HSNCB Unit Faridabad',
    'HSNCB Unit Fatehabad',
    'HSNCB Unit Gurugram',
    'HSNCB Unit Hisar',
    'HSNCB Unit Karnal',
    'HSNCB Unit Kurukshetra',
    'HSNCB Unit Rewari',
    'HSNCB Unit Rohtak',
    'HSNCB Unit Sirsa'
  ];

  const handleFinish = (values) => {
    console.log('Transfer Complaint Form Values:', values);
    onBack();
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <Button 
        onClick={onBack}
        icon={<ArrowLeftOutlined />}
        style={{ 
          marginBottom: '20px', 
          background: '#1f1f1f', 
          color: '#177ddc', 
          borderColor: '#303030',
          borderRadius: '8px',
          padding: '4px 16px',
          fontWeight: 500
        }}
      >
        Back
      </Button>
      
      <Card 
        style={{ 
          background: '#141414', 
          borderColor: '#303030', 
          borderRadius: '12px',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ background: '#1890ff', padding: '16px 24px' }}>
          <Text style={{ color: '#ffffff', fontSize: '18px', fontWeight: 600 }}>Transfer Complaint</Text>
        </div>
        
        <div style={{ padding: '24px' }}>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{ wantToTransfer: 'Yes' }}
        >
          <Form.Item 
            name="wantToTransfer" 
            label={<span style={{ fontSize: '16px', fontWeight: 500 }}>Do You Want Transfer Complaint</span>}
            rules={[{ required: true, message: 'Please select an option' }]}
            style={{ marginBottom: '32px' }}
          >
            <Radio.Group style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
              <Radio value="Yes" style={{ fontSize: '16px' }}>Yes</Radio>
              <Radio value="No" style={{ fontSize: '16px' }}>No</Radio>
            </Radio.Group>
          </Form.Item>

          {wantToTransfer === 'Yes' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                  <Form.Item 
                    name="officeType" 
                    label="Office Type"
                    rules={[{ required: true, message: 'Please select Office Type' }]}
                  >
                    <Select placeholder="Select">
                      <Option value="Police Station">Police Station</Option>
                      <Option value="Transferred to other state">Transferred to other state</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item 
                    name="transferDistrict" 
                    label="Transfer District"
                    rules={[{ required: true, message: 'Please select Transfer District' }]}
                  >
                    <Select 
                      placeholder="Select" 
                      onChange={(value) => setSelectedDistrict(value)}
                      showSearch
                      disabled={!officeType}
                    >
                      {officeType === 'Police Station' && districts.map(d => <Option key={d} value={d}>{d}</Option>)}
                      {officeType === 'Transferred to other state' && <Option value="Other State">Other State (List not provided)</Option>}
                    </Select>
                  </Form.Item>

                  <Form.Item 
                    name="transferReason" 
                    label="Transfer Reason"
                    rules={[{ required: true, message: 'Please enter Transfer Reason' }]}
                  >
                    <TextArea rows={4} />
                  </Form.Item>
                  
                  <Form.Item name="atrNotRequired" valuePropName="checked" style={{ marginTop: '-10px' }}>
                    <Checkbox>ATR not required</Checkbox>
                  </Form.Item>
                  
                  {!atrNotRequired && (
                    <Form.Item 
                      name="actionTakenReport" 
                      label="Action Taken Report (Steps Taken)"
                      rules={[{ required: true, message: 'Please provide a written report on steps taken before transfer' }]}
                    >
                      <TextArea rows={4} placeholder="Write a report on what steps were taken during the transfer..." />
                    </Form.Item>
                  )}
              </div>

              <div>
                <Form.Item 
                  name="transferToPoliceStation" 
                  label="Transfer to Police Station / Office"
                  rules={[{ required: true, message: 'Please select Police Station' }]}
                >
                  <Select placeholder="Select" showSearch disabled={!selectedDistrict}>
                    {selectedDistrict === 'AMBALA' && ambalaPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'Anti Corruption Bureau, Haryana' && acbPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'BHIWANI' && bhiwaniPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'CHARKHI DADRI' && charkhiDadriPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'DABWALI' && dabwaliPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'FARIDABAD' && faridabadPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'FATEHABAD' && fatehabadPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'GURUGRAM' && gurugramPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'HANSI' && hansiPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'Haryana State Enforcement Bureau (HSEnB)' && hsenbPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'HISAR' && hisarPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'JHAJJAR' && jhajjarPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'JIND' && jindPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'KAITHAL' && kaithalPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'KARNAL' && karnalPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'KURUKSHETRA' && kurukshetraPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'MAHENDERGARH' && mahendergarhPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'NUH' && nuhPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'PALWAL' && palwalPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'PANCHKULA' && panchkulaPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'PANIPAT' && panipatPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'REWARI' && rewariPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'ROHTAK' && rohtakPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'SIRSA' && sirsaPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'SONIPAT' && sonipatPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'SPECIAL TASK FORCE (STF)' && stfPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'State Crime Branch' && stateCrimeBranchPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'TRANSPORT DEPT' && transportDeptStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'YAMUNA NAGAR' && yamunanagarPoliceStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'GRP AMBALA CANTT' && grpAmbalaCanttStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                    {selectedDistrict === 'Haryana State Narcotics Control Bureau' && haryanaStateNarcoticsControlBureauStations.map(ps => <Option key={ps} value={ps}>{ps}</Option>)}
                  </Select>
                </Form.Item>
              </div>
            </div>
          )}



          <div style={{ marginTop: '30px', textAlign: 'center' }}>
            <Button type="primary" htmlType="submit" size="large" style={{ width: '200px', borderRadius: '8px' }}>
              Submit
            </Button>
          </div>
        </Form>
        </div>
      </Card>
    </div>
  );
}
