import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, AutoComplete, Tooltip, message, Upload, Dropdown, Space, Modal, Steps, Typography, Card } from 'antd';
import { 
  AudioOutlined, 
  AudioMutedOutlined, 
  CameraOutlined, 
  SearchOutlined,
  LoadingOutlined,
  DeleteOutlined,
  DownOutlined,
  GlobalOutlined,
  TranslationOutlined,
  QuestionCircleOutlined,
  InfoCircleOutlined,
  PhoneOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { useAuth } from '../hooks/useAuth';

const { Text, Title } = Typography;

// Configure PDF.js worker using CDN to avoid bundling issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;


const { Search } = Input;

export default function SmartSearch({ onSearch, initialValue = "" }) {
  const { token } = useAuth();
  const [value, setValue] = useState(initialValue);
  const [options, setOptions] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState(sessionStorage.getItem('voiceSearchLang') || 'hi-IN');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-IN'; // Default to Indian English/Hindi mix

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        const newText = finalTranscript || interimTranscript;
        if (newText) {
          setValue(newText);
        }
      };

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        message.info('Hindi ya English me bol sakte hain...');
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          message.error('Microphone access denied. Please allow it in settings.');
        } else {
          message.error('Voice samajh nahi aayi, dubara try kare');
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        message.warning('Voice search is not supported in this browser.');
        return;
      }
      
      // Dynamically set language from state
      recognitionRef.current.lang = voiceLang;
      recognitionRef.current.start();
    }
  };

  const handleLangChange = (lang) => {
    setVoiceLang(lang);
    sessionStorage.setItem('voiceSearchLang', lang);
    message.success(`Voice search language set to ${lang === 'hi-IN' ? 'Hindi' : 'English'}`);
    
    // If currently listening, we need to restart with new language
    if (isListening) {
      recognitionRef.current?.stop();
      setTimeout(() => {
        recognitionRef.current.lang = lang;
        recognitionRef.current.start();
      }, 500);
    }
  };


  const handleSearchSuggestions = async (searchText) => {
    if (!searchText || searchText.length < 2) {
      setOptions([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:3001/api/search/suggestions?q=${encodeURIComponent(searchText)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setOptions(data.map(val => ({ value: val })));
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    }
  };

  // ----- Helper: render one PDF page to canvas and return dataURL -----
  const renderPdfPageToCanvas = (page, scale = 2.0) => {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    return page.render({ canvasContext: ctx, viewport }).promise.then(() => canvas);
  };

  // ----- Helper: OCR one canvas element -----
  const ocrCanvas = (canvas, pageNum, total) => {
    message.loading({
      content: `OCR: Page ${pageNum}/${total} processing...`,
      key: 'ocr',
      duration: 0
    });
    return Tesseract.recognize(canvas, 'eng+hin', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`Page ${pageNum} OCR: ${Math.round(m.progress * 100)}%`);
        }
      }
    }).then(r => r.data.text.trim());
  };

  // ----- Main OCR handler -----
  const handleOcr = async (file) => {
    setIsOcrLoading(true);

    // --- PDF handling ---
    if (file.type === 'application/pdf') {
      message.loading({ content: 'Loading PDF, please wait...', key: 'ocr', duration: 0 });
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdfDoc.numPages;
        const allText = [];

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const canvas = await renderPdfPageToCanvas(page);
          const pageText = await ocrCanvas(canvas, pageNum, totalPages);
          if (pageText) allText.push(`[Page ${pageNum}]\n${pageText}`);
        }

        const combined = allText.join('\n\n');
        if (!combined.trim()) {
          message.warning({ content: 'No readable text found in the PDF.', key: 'ocr', duration: 5 });
        } else {
          setValue(combined);
          message.success({ content: `PDF processed successfully!`, key: 'ocr', duration: 4 });
        }
      } catch (err) {
        console.error('PDF OCR Error:', err);
        message.error({ content: 'Failed to process the PDF.', key: 'ocr', duration: 6 });
      } finally {
        setIsOcrLoading(false);
      }
      return false;
    }

    // --- Image handling ---
    if (!file.type.startsWith('image/')) {
      message.error({ content: 'Only image files or PDF files supported.', key: 'ocr', duration: 4 });
      setIsOcrLoading(false);
      return false;
    }

    message.loading({ content: 'Extracting text, please wait...', key: 'ocr', duration: 0 });
    try {
      const result = await Tesseract.recognize(file, 'eng+hin', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      const extractedText = result.data.text.trim();
      if (!extractedText) {
        message.warning({ content: 'No readable text found.', key: 'ocr', duration: 4 });
      } else {
        setValue(extractedText);
        message.success({ content: `Text extracted!`, key: 'ocr', duration: 3 });
      }
    } catch (err) {
      console.error('OCR Error:', err);
      message.error({ content: 'OCR processing failed.', key: 'ocr', duration: 4 });
    } finally {
      setIsOcrLoading(false);
    }
    return false;
  };

  return (
    <div className="smart-search-container" style={{ width: '100%', marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f0f2f5', padding: '16px', borderRadius: '16px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
        <AutoComplete
          options={options}
          onSearch={handleSearchSuggestions}
          onSelect={(val) => { setValue(val); onSearch(val); }}
          value={value}
          onChange={setValue}
          style={{ flexGrow: 1 }}
        >
          <Search
            placeholder="Search by FIR No, Name, Mobile, or Vehicle Number..."
            enterButton={
              <Button type="primary" size="large" icon={<SearchOutlined />} style={{ borderRadius: '0 12px 12px 0', height: '50px', background: '#1890ff' }}>
                खोजें (Search)
              </Button>
            }
            size="large"
            onSearch={(val) => onSearch(val)}
            allowClear={{ clearIcon: <DeleteOutlined /> }}
            style={{ borderRadius: '12px' }}
          />
        </AutoComplete>

        <Space size="middle">
          <Tooltip title={isListening ? "सुनना बंद करें (Stop Listening)" : "आवाज़ से खोजें (Voice Search)"}>
            <Button 
              shape="circle" 
              size="large"
              type="primary"
              icon={isListening ? <AudioMutedOutlined /> : <AudioOutlined />}
              onClick={toggleListening}
              danger={isListening}
              style={{ 
                height: '50px',
                width: '50px',
                backgroundColor: isListening ? '#ff4d4f' : '#1890ff',
                borderColor: isListening ? '#ff4d4f' : '#1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                color: '#fff',
                boxShadow: '0 4px 10px rgba(24, 144, 255, 0.3)'
              }}
            />
          </Tooltip>

          <Dropdown
            menu={{
              items: [
                { label: '🇮🇳 Hindi', key: 'hi-IN', icon: <TranslationOutlined /> },
                { label: '🌐 English', key: 'en-US', icon: <GlobalOutlined /> }
              ],
              onClick: ({ key }) => handleLangChange(key),
              selectable: true,
              selectedKeys: [voiceLang]
            }}
            trigger={['click']}
          >
            <Button size="large" style={{ borderRadius: '12px', height: '50px', minWidth: '100px', fontWeight: 500 }}>
              <Space>
                {voiceLang === 'hi-IN' ? 'हिन्दी' : 'English'}
                <DownOutlined style={{ fontSize: '10px' }} />
              </Space>
            </Button>
          </Dropdown>

          <Tooltip title="Help Guide / सहायता">
            <Button 
              shape="circle" 
              size="large" 
              icon={<QuestionCircleOutlined style={{ color: '#1890ff', fontSize: '22px' }} />} 
              onClick={() => setShowHelp(true)}
              style={{ 
                height: '50px', 
                width: '50px', 
                background: '#fff', 
                border: '2px solid #1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </Tooltip>
        </Space>
      </div>

      {isListening && (
        <div style={{ marginTop: '12px', padding: '12px', background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: '8px', textAlign: 'center' }}>
          <Space direction="vertical" size={2}>
            <Text strong style={{ color: '#f5222d', fontSize: '16px' }}>
              <LoadingOutlined /> सुन रहे हैं... ({voiceLang === 'hi-IN' ? 'हिंदी' : 'English'})
            </Text>
            <Text type="secondary" style={{ color: '#8c8c8c' }}>आप हिंदी या अंग्रेजी में बोल सकते हैं</Text>
            {value && <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '6px', border: '1px dashed #d9d9d9' }}>
              <Text italic>"{value}"</Text>
            </div>}
          </Space>
        </div>
      )}

      {/* Training Mode / Help Modal */}
      <Modal
        title={<Title level={4} style={{ margin: 0 }}><InfoCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }} /> How to search? / खोज कैसे करें?</Title>}
        open={showHelp}
        onOk={() => setShowHelp(false)}
        onCancel={() => setShowHelp(false)}
        footer={[
          <Button key="ok" type="primary" size="large" onClick={() => setShowHelp(false)} style={{ borderRadius: '8px', minWidth: '150px' }}>
            I Understand / समझ गया
          </Button>
        ]}
        width={600}
      >
        <Steps
          direction="vertical"
          size="small"
          current={-1}
          items={[
            {
              title: 'लिखकर खोजें (Type & Search)',
              description: 'सर्च बार में FIR नंबर, नाम, मोबाइल या गाड़ी नंबर लिखें।',
              icon: <SearchOutlined />
            },
            {
              title: 'आवाज़ से खोजें (Voice Search)',
              description: 'माइक आइकन पर क्लिक करें और हिंदी या अंग्रेजी में बोलें।',
              icon: <AudioOutlined />
            },
            {
              title: 'दस्तावेज़ स्कैन (OCR Scan)',
              description: 'कैमरा आइकन से FIR की फोटो या PDF अपलोड करके खोजें।',
              icon: <CameraOutlined />
            },
            {
              title: 'फिल्टर का उपयोग (Filters)',
              description: 'जिला या अपराध का प्रकार चुनकर सटीक परिणाम पाएँ।',
              icon: <DownOutlined />
            }
          ]}
        />
        <Card size="small" style={{ marginTop: '16px', background: '#e6f7ff' }}>
          <Text strong>उदाहरण (Examples):</Text>
          <ul>
            <li>"FIR-2026-001 खोजें"</li>
            <li>"गुरुग्राम में चोरी के मामले दिखाओ"</li>
            <li>"संदीप नाम से सर्च करें"</li>
          </ul>
        </Card>
      </Modal>
    </div>
  );
}
