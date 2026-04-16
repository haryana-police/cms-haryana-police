import React, { useState, useEffect, useMemo } from 'react';
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
  Descriptions,
  Button,
  Modal,
  Progress
} from 'antd';
import { 
  FileSearchOutlined, 
  EnvironmentOutlined, 
  CalendarOutlined, 
  UserOutlined,
  TagOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  PhoneOutlined
} from '@ant-design/icons';
import SmartSearch from '../components/SmartSearch';
import { useAuth } from '../hooks/useAuth';
import useDebounce from '../hooks/useDebounce';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function SearchPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(null);
  const [filters, setFilters] = useState({
    caseType: null,
    district: null,
    dateAfter: null
  });
  const [selectedCase, setSelectedCase] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Use refs to always have latest values inside async callbacks
  const filtersRef = React.useRef(filters);
  const tokenRef = React.useRef(token);
  const abortControllerRef = React.useRef(null);

  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const executeSearch = React.useCallback(async (searchQuery, activeFilters) => {
    const cleanQuery = (searchQuery || '').trim();
    const { caseType, district, dateAfter } = activeFilters;

    // Only block search if EVERYTHING is empty
    if (!cleanQuery && !caseType && !district && !dateAfter) {
      setResults([]);
      return;
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setSearchError(null);

    try {
      let url = `http://localhost:3001/api/search?q=${encodeURIComponent(cleanQuery)}`;
      if (caseType)   url += `&caseType=${encodeURIComponent(caseType)}`;
      if (district)   url += `&district=${encodeURIComponent(district)}`;
      if (dateAfter)  url += `&dateAfter=${encodeURIComponent(dateAfter)}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${tokenRef.current}` },
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setResults(data.results || []);
      setLanguage(cleanQuery ? data.detected_language : null);
    } catch (err) {
      if (err.name === 'AbortError') return; // Ignore cancelled requests
      console.error('Search failed:', err);
      setSearchError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setTimeout(() => setLoading(false), 200);
    }
  }, []);

  // Trigger search when debounced query OR filters change
  useEffect(() => {
    executeSearch(debouncedQuery, filters);
  }, [debouncedQuery, filters, executeSearch]);

  // Convenience wrapper for SmartSearch component callbacks
  const handleSearch = React.useCallback((searchQuery) => {
    executeSearch(searchQuery, filtersRef.current);
  }, [executeSearch]);

  const handleCall = (number) => {
    if (number) {
      window.location.href = `tel:${number}`;
    }
  };

  const showDetail = (caseData) => {
    setSelectedCase(caseData);
    setIsModalVisible(true);
  };

  const handleOpenMap = (location, district) => {
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location}, ${district}, Haryana`)}`;
    window.open(mapUrl, '_blank');
  };

  const highlightText = (text, highlight) => {
    if (!highlight || !text) return text;
    try {
      const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.toString().split(new RegExp(`(${escapedHighlight})`, 'gi'));
      return (
        <span>
          {parts.map((part, i) => 
            part.toLowerCase() === highlight.toLowerCase() 
              ? <mark key={i} style={{ backgroundColor: '#ffec3d', padding: 0 }}>{part}</mark> 
              : part
          )}
        </span>
      );
    } catch (_) {
      return text;
    }
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
        <SmartSearch onSearch={handleSearch} onValueChange={setQuery} initialValue={query} />
        
        <Divider plain><Text type="secondary" style={{ fontSize: '12px' }}>Filters / फ़िल्टर</Text></Divider>
        
        <Space wrap size="middle" style={{ width: '100%', justifyContent: 'center' }}>
          <Select 
            placeholder="Case Type / अपराध का प्रकार" 
            style={{ width: 240 }} 
            allowClear
            showSearch
            optionFilterProp="children"
            value={filters.caseType}
            onChange={(val) => setFilters({ ...filters, caseType: val })}
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
            value={filters.district}
            onChange={(val) => setFilters({ ...filters, district: val })}
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
            value={filters.dateAfter ? dayjs(filters.dateAfter) : null}
            onChange={(date) => setFilters({ ...filters, dateAfter: date ? date.format('YYYY-MM-DD') : null })}
          />
          {(filters.caseType || filters.district || filters.dateAfter) && (
            <Button 
              type="link" 
              danger 
              onClick={() => {
                setFilters({ caseType: null, district: null, dateAfter: null });
                setResults([]);
                setQuery('');
              }}
              style={{ fontWeight: '500' }}
            >
              Clear Filters / साफ़ करें
            </Button>
          )}
        </Space>
      </Card>

      {(filters.caseType || filters.district || filters.dateAfter || (query && query.trim())) && (
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <Space wrap size="small">
            <Text type="secondary" style={{ marginRight: '8px' }}>Active Filters:</Text>
            {query && <Tag closable onClose={() => { setQuery(''); handleSearch(''); }} color="blue">{query}</Tag>}
            {filters.caseType && <Tag closable onClose={() => setFilters({ ...filters, caseType: null })} color="cyan">{filters.caseType}</Tag>}
            {filters.district && <Tag closable onClose={() => setFilters({ ...filters, district: null })} color="purple">{filters.district}</Tag>}
            {filters.dateAfter && <Tag closable onClose={() => setFilters({ ...filters, dateAfter: null })} color="gold">{dayjs(filters.dateAfter).format('DD MMM YYYY')}</Tag>}
          </Space>
        </div>
      )}

      {language && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Tag icon={<InfoCircleOutlined />} color="blue" style={{ borderRadius: '12px', padding: '4px 12px' }}>
            Detected: {language.toUpperCase()}
          </Tag>
        </div>
      )}

      {/* Smooth Loading Indicator */}
      {loading && (
        <Progress 
          percent={100} 
          status="active" 
          showInfo={false} 
          strokeColor="#1890ff" 
          style={{ position: 'sticky', top: 0, zIndex: 10, margin: '0 0 16px 0' }}
          strokeWidth={3}
        />
      )}

      <div style={{ 
        marginTop: '32px', 
        transition: 'opacity 0.3s ease', 
        opacity: loading && results.length > 0 ? 0.6 : 1,
        filter: loading && results.length > 0 ? 'grayscale(0.5)' : 'none'
      }}>
        {loading && results.length === 0 ? (
          <div style={{ padding: '20px' }}>
            {[1, 2, 3].map(i => (
              <Card key={i} style={{ marginBottom: '16px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div style={{ width: '60px', height: '60px', backgroundColor: '#f0f2f5', borderRadius: '50%' }} />
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ width: '40%', height: '20px', backgroundColor: '#f0f2f5', borderRadius: '4px', marginBottom: '12px' }} />
                    <div style={{ width: '70%', height: '14px', backgroundColor: '#f0f2f5', borderRadius: '4px' }} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : results.length > 0 ? (
          <List
            dataSource={results}
            renderItem={(item) => {
              if (!item) return null;
              return (
                <List.Item key={item.id} style={{ padding: 0, marginBottom: '20px', border: 'none' }}>
                <Card 
                  hoverable 
                  style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e8e8e8' }}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                      <Space size="middle">
                        <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>{highlightText(item.fir_number || 'N/A', query)}</Text>
                        <Tag color={item.status === 'investigating' ? 'blue' : item.status === 'pending' ? 'orange' : 'green'} style={{ borderRadius: '4px' }}>
                          {(item.status || 'pending').toUpperCase()}
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
                      <Space>
                        <Button 
                          type="primary" 
                          icon={<EyeOutlined />} 
                          key="view"
                          onClick={() => showDetail(item)}
                          style={{ borderRadius: '8px' }}
                        >
                          View Details
                        </Button>
                      </Space>,
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
                      <Text strong>{highlightText(item.complainant_name || 'Anonymous', query)}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text type="secondary"><EnvironmentOutlined /> Location</Text>}>
                      {highlightText(`${item.location || ''}, ${item.district || ''}`, query)}
                    </Descriptions.Item>
                    <Descriptions.Item label={<Text type="secondary"><TagOutlined /> Crime Type</Text>}>
                      <Tag color="volcano" style={{ margin: 0 }}>{highlightText(item.incident_type || 'Unknown', query)}</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                  
                  <Divider style={{ margin: '16px 0' }} />
                  
                  <Paragraph style={{ marginBottom: 0, background: '#f9f9f9', padding: '12px', borderRadius: '8px' }}>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>Summary / सारांश:</Text>
                    <Text type="secondary">{highlightText(item.description || 'No description provided.', query)}</Text>
                  </Paragraph>
                </Card>
              </List.Item>
            );
          }}
          />
        ) : (query || filters.caseType || filters.district || filters.dateAfter) ? (
          searchError ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ textAlign: 'center' }}>
                  <Title level={4} style={{ color: '#ff4d4f' }}>⚠️ Server Error / सर्वर त्रुटि</Title>
                  <Text type="secondary" style={{ fontSize: '15px' }}>
                    सर्वर से जानकारी प्राप्त करने में तकनीकी समस्या आ रही है। कृपया बैकएंड सर्वर (पोर्ट 3001) की जाँच करें या कुछ समय बाद पुनः प्रयास करें। 
                    <br/><br/>
                    (Technical issue fetching records from the server. Please ensure the backend is running or try again later.)
                  </Text>
                  {/* Keep technical details hidden in console or shown softly for devs */}
                  <div style={{ display: 'none' }}>Technical Info: {searchError}</div>
                </div>
              }
            />
          ) : (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ textAlign: 'center' }}>
                  <Title level={4}>कोई रिकॉर्ड नहीं मिला (No records found)</Title>
                  <Text type="secondary">
                    {filters.caseType || filters.district
                      ? `"${[filters.caseType, filters.district].filter(Boolean).join(' + ')}" के लिए कोई रिकॉर्ड नहीं मिला।`
                      : 'कृपया वर्तनी (spelling) की जाँच करें या अन्य शब्दों का उपयोग करें।'
                    }
                  </Text>
                </div>
              } 
            />
          )
        ) : null}
      </div>
      {/* FIR Detail Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSearchOutlined style={{ color: '#1890ff' }} />
            <span>FIR DETAILS: {selectedCase?.fir_number}</span>
            <Tag color={selectedCase?.status === 'investigating' ? 'blue' : selectedCase?.status === 'pending' ? 'orange' : 'green'}>
              {selectedCase?.status?.toUpperCase()}
            </Tag>
          </div>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsModalVisible(false)} style={{ borderRadius: '8px', minWidth: '120px' }}>
            Close / बंद करें
          </Button>
        ]}
        width={800}
        centered
        className="premium-modal"
      >
        {selectedCase && (
          <div style={{ padding: '20px 0' }}>
            <Card bordered={false} style={{ background: '#f0f5ff', marginBottom: '24px', borderRadius: '12px', borderLeft: '4px solid #1890ff' }}>
              <Title level={5} style={{ marginBottom: '12px' }}><InfoCircleOutlined /> Incident Description / घटना का विवरण</Title>
              <Paragraph style={{ fontSize: '16px', lineHeight: '1.6', color: '#434343' }}>
                {selectedCase.description}
              </Paragraph>
            </Card>

            <Descriptions bordered column={{ xs: 1, sm: 2 }} className="detail-descriptions">
              <Descriptions.Item label={<Text strong><UserOutlined /> Complainant (शिकायतकर्ता)</Text>} span={2}>
                <Text strong style={{ fontSize: '16px' }}>{selectedCase.complainant_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong><UserOutlined /> Accused (आरोपी)</Text>}>
                {selectedCase.accused_name || <Text type="secondary">N/A</Text>}
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong><UserOutlined /> Victim (पीड़ित)</Text>}>
                {selectedCase.victim_name || <Text type="secondary">N/A</Text>}
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong><TagOutlined /> Crime Type (अपराध का प्रकार)</Text>}>
                <Tag color="volcano">{selectedCase.incident_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong><CalendarOutlined /> Incident Date (तारीख)</Text>}>
                {dayjs(selectedCase.incident_date).format('DD MMMM YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong><EnvironmentOutlined /> District (जिला)</Text>}>
                {selectedCase.district}
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong><EnvironmentOutlined /> Location (स्थान)</Text>}>
                {selectedCase.location}
              </Descriptions.Item>
              <Descriptions.Item label={<Text strong><PhoneOutlined /> Contact (संपर्क)</Text>} span={2}>
                {selectedCase.contact_number ? (
                  <Button type="link" onClick={() => handleCall(selectedCase.contact_number)} style={{ padding: 0, height: 'auto', fontSize: '16px' }}>
                    <PhoneOutlined /> {selectedCase.contact_number}
                  </Button>
                ) : <Text type="secondary">N/A</Text>}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button 
                icon={<EnvironmentOutlined />} 
                onClick={() => handleOpenMap(selectedCase.location, selectedCase.district)}
              >
                Open in Maps
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .premium-modal .ant-modal-content {
          border-radius: 20px !important;
          overflow: hidden;
          box-shadow: 0 12px 48px rgba(0,0,0,0.15) !important;
        }
        .premium-modal .ant-modal-header {
          padding: 24px 24px 16px !important;
          border-bottom: 1px solid #f0f0f0 !important;
        }
        .detail-descriptions .ant-descriptions-item-label {
          background-color: #fafafa !important;
          width: 200px !important;
        }
        .detail-descriptions .ant-descriptions-item-content {
          background-color: #ffffff !important;
        }
      `}} />
    </div>
  );
}
