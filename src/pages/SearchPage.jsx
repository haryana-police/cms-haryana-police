import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Card, 
  Tag, 
  List, 
  Select, 
  DatePicker, 
  Space, 
  Empty, 
  Divider, 
  Badge,
  Descriptions
} from 'antd';
import { 
  FileSearchOutlined, 
  EnvironmentOutlined, 
  CalendarOutlined, 
  UserOutlined,
  TagOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import SmartSearch from '../components/SmartSearch';
import { useAuth } from '../hooks/useAuth';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function SearchPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(null);
  const [filters, setFilters] = useState({
    type: null,
    location: null,
    dateAfter: null
  });

  const handleSearch = async (searchQuery = query) => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      let url = `http://localhost:3001/api/search?q=${encodeURIComponent(searchQuery)}`;
      if (filters.type) url += `&type=${filters.type}`;
      if (filters.location) url += `&location=${filters.location}`;
      if (filters.dateAfter) url += `&dateAfter=${filters.dateAfter}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setResults(data.results || []);
      setLanguage(data.detected_language);
      setQuery(searchQuery);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (number) => {
    if (number) {
      window.location.href = `tel:${number}`;
    }
  };

  const handleOpenMap = (location, district) => {
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location}, ${district}, Haryana`)}`;
    window.open(mapUrl, '_blank');
  };

  const highlightText = (text, highlight) => {
    if (!highlight || !text) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() 
            ? <mark key={i} style={{ backgroundColor: '#ffec3d', padding: 0 }}>{part}</mark> 
            : part
        )}
      </span>
    );
  };

  return (
    <div className="search-page-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <Title level={1} style={{ color: '#fff', fontSize: '36px', fontWeight: '700', textShadow: '0 2px 10px rgba(0,0,0,0.3)', marginBottom: '8px' }}>
          <FileSearchOutlined style={{ color: '#1890ff', marginRight: '12px' }} /> 
          Police Smart Search
        </Title>
        <Paragraph style={{ fontSize: '18px', color: '#a6adb4' }}>
          Securely search across all FIRs, Complaints, and Police Records
          <br />
          <Text style={{ fontSize: '15px', color: '#1890ff', fontWeight: '500' }}>सभी FIR, शिकायत और पुलिस रिकॉर्ड को आसानी से खोजें</Text>
        </Paragraph>
      </div>

      <Card bordered={false} className="search-control-card" style={{ borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', marginBottom: '32px' }}>
        <SmartSearch onSearch={handleSearch} initialValue={query} />
        
        <Divider plain><Text type="secondary" style={{ fontSize: '12px' }}>Filters / फ़िल्टर</Text></Divider>
        
        <Space wrap size="middle" style={{ width: '100%', justifyContent: 'center' }}>
          <Select 
            placeholder="Case Type / अपराध का प्रकार" 
            style={{ width: 240 }} 
            allowClear
            showSearch
            optionFilterProp="children"
            onChange={(val) => setFilters({ ...filters, type: val })}
            size="large"
          >
            <Option value="Theft">Theft / चोरी</Option>
            <Option value="Assault">Assault / मारपीट</Option>
            <Option value="Fraud">Fraud / धोखाधड़ी</Option>
            <Option value="Burglary">Burglary / सेंधमारी</Option>
            <Option value="Murder">Murder / हत्या</Option>
            <Option value="Attempt to Murder">Attempt to Murder / हत्या का प्रयास</Option>
            <Option value="Robbery">Robbery / डकैती</Option>
            <Option value="Kidnapping">Kidnapping / अपहरण</Option>
            <Option value="Rape">Rape / बलात्कार</Option>
            <Option value="Eve Teasing">Eve Teasing / छेड़छाड़</Option>
            <Option value="Domestic Violence">Domestic Violence / घरेलू हिंसा</Option>
            <Option value="Dowry Case">Dowry Case / दहेज प्रताड़ना</Option>
            <Option value="Acid Attack">Acid Attack / तेजाब हमला</Option>
            <Option value="Cybercrime">Cybercrime / साइबर अपराध</Option>
            <Option value="Drug Trafficking">Drug Trafficking / नशा तस्करी</Option>
            <Option value="Land Dispute">Land Dispute / जमीन विवाद</Option>
            <Option value="Missing Person">Missing Person / गुमशुदा</Option>
            <Option value="Traffic Accident">Traffic Accident / एक्सीडेंट</Option>
            <Option value="Extortion">Extortion / रंगदारी (वसूली)</Option>
            <Option value="Arson">Arson / आगजनी</Option>
            <Option value="Arms Act">Arms Act / हथियार अधिनियम</Option>
            <Option value="Corruption">Corruption / भ्रष्टाचार</Option>
            <Option value="Smuggling">Smuggling / तस्करी</Option>
            <Option value="Child Abuse">Child Abuse / बाल शोषण</Option>
            <Option value="Other">Other / अन्य</Option>
          </Select>

          <Select 
            placeholder="District / जिला चुनें" 
            style={{ width: 220 }} 
            allowClear
            showSearch
            optionFilterProp="children"
            onChange={(val) => setFilters({ ...filters, location: val })}
            size="large"
          >
            <Option value="Ambala">Ambala / अंबाला</Option>
            <Option value="Bhiwani">Bhiwani / भिवानी</Option>
            <Option value="Charkhi Dadri">Charkhi Dadri / चरखी दादरी</Option>
            <Option value="Faridabad">Faridabad / फरीदाबाद</Option>
            <Option value="Fatehabad">Fatehabad / फतेहाबाद</Option>
            <Option value="Gurugram">Gurugram / गुरुग्राम</Option>
            <Option value="Hisar">Hisar / हिसार</Option>
            <Option value="Hansi">Hansi / हांसी</Option>
            <Option value="Jhajjar">Jhajjar / झज्जर</Option>
            <Option value="Jind">Jind / जींद</Option>
            <Option value="Kaithal">Kaithal / कैथल</Option>
            <Option value="Karnal">Karnal / करनाल</Option>
            <Option value="Kurukshetra">Kurukshetra / कुरुक्षेत्र</Option>
            <Option value="Mahendragarh">Mahendragarh / महेंद्रगढ़</Option>
            <Option value="Mewat">Mewat / मेवात (नूहं)</Option>
            <Option value="Palwal">Palwal / पलवल</Option>
            <Option value="Panchkula">Panchkula / पंचकुला</Option>
            <Option value="Panipat">Panipat / पानीपत</Option>
            <Option value="Rewari">Rewari / रेवाड़ी</Option>
            <Option value="Rohtak">Rohtak / रोहतक</Option>
            <Option value="Sirsa">Sirsa / सिरसा</Option>
            <Option value="Sonipat">Sonipat / सोनीपत</Option>
            <Option value="Yamunanagar">Yamunanagar / यमुनानगर</Option>
          </Select>

          <DatePicker 
            placeholder="From Date / इस तारीख से" 
            size="large"
            format="DD/MM/YYYY"
            onChange={(date) => setFilters({ ...filters, dateAfter: date ? date.toISOString() : null })}
          />
        </Space>
      </Card>

      {language && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Tag icon={<InfoCircleOutlined />} color="blue" style={{ borderRadius: '12px', padding: '4px 12px' }}>
            Detected: {language.toUpperCase()}
          </Tag>
        </div>
      )}

      <div style={{ marginTop: '32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <Badge status="processing" text={<Text strong style={{ fontSize: '18px', marginLeft: '12px' }}>रिकॉर्ड खोजे जा रहे हैं, कृपया प्रतीक्षा करें... (Searching for records...)</Text>} />
          </div>
        ) : results.length > 0 ? (
          <List
            dataSource={results}
            renderItem={(item) => (
              <List.Item key={item.id} style={{ padding: 0, marginBottom: '20px', border: 'none' }}>
                <Card 
                  hoverable 
                  style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e8e8e8' }}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                      <Space size="middle">
                        <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>{highlightText(item.fir_number, query)}</Text>
                        <Tag color={item.status === 'investigating' ? 'blue' : item.status === 'pending' ? 'orange' : 'green'} style={{ borderRadius: '4px' }}>
                          {item.status.toUpperCase()}
                        </Tag>
                      </Space>
                      <Space>
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                          <CalendarOutlined /> {dayjs(item.incident_date).format('DD MMM YYYY')}
                        </Text>
                      </Space>
                    </div>
                  }
                  actions={[
                    <Button type="link" icon={<EyeOutlined />} key="view">View Details</Button>,
                    <Button 
                      type="link" 
                      icon={<PhoneOutlined />} 
                      key="call" 
                      disabled={!item.contact_number}
                      onClick={() => handleCall(item.contact_number)}
                    >
                      Call
                    </Button>,
                    <Button 
                      type="link" 
                      icon={<EnvironmentOutlined />} 
                      key="map"
                      onClick={() => handleOpenMap(item.location, item.district)}
                    >
                      Location
                    </Button>
                  ]}
                >
                  <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered={false}>
                    <Descriptions.Item label={<Text type="secondary"><UserOutlined /> Complainant</Text>}>
                      <Text strong>{highlightText(item.complainant_name, query)}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text type="secondary"><EnvironmentOutlined /> Location</Text>}>
                      {highlightText(`${item.location}, ${item.district}`, query)}
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text type="secondary"><TagOutlined /> Crime Type</Text>}>
                      <Tag color="volcano" style={{ margin: 0 }}>{highlightText(item.incident_type, query)}</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                  
                  <Divider style={{ margin: '16px 0' }} />
                  
                  <Paragraph style={{ marginBottom: 0, background: '#f9f9f9', padding: '12px', borderRadius: '8px' }}>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>Summary / सारांश:</Text>
                    <Text type="secondary">{highlightText(item.description, query)}</Text>
                  </Paragraph>
                </Card>
              </List.Item>
            )}
          />
        ) : query && (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div style={{ textAlign: 'center' }}>
                <Title level={4}>कोई रिकॉर्ड नहीं मिला (No records found)</Title>
                <Text type="secondary">कृपया वर्तनी (spelling) की जाँच करें या अन्य शब्दों का उपयोग करें।</Text>
              </div>
            } 
          />
        )}
      </div>
    </div>
  );
}
