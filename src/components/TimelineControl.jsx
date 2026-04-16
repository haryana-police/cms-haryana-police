import React, { useState, useEffect } from 'react';
import { Space, Button, Slider, Typography } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function TimelineControl({ timelineData, onDateChange }) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!timelineData || timelineData.length === 0) return;
    onDateChange(timelineData[currentIndex]);
  }, [currentIndex, timelineData, onDateChange]);

  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= timelineData.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500); // 1.5 seconds per day frame
    }
    return () => clearInterval(interval);
  }, [isPlaying, timelineData]);

  if (!timelineData || timelineData.length === 0) return null;

  const marks = {};
  timelineData.forEach((d, i) => {
    // Only label first and last for compactness, or all if short
    if (i === 0 || i === timelineData.length - 1) {
      marks[i] = { style: { color: '#aaa', fontSize: 10 }, label: d.date.split('-').slice(1).join('/') };
    }
  });

  return (
    <div style={{
      position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      width: '80%', maxWidth: 400, background: 'rgba(20,20,20,0.85)', padding: '10px 20px',
      borderRadius: 12, backdropFilter: 'blur(5px)', boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', gap: 16
    }}>
      <Button 
        type="primary" 
        shape="circle" 
        icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />} 
        onClick={() => {
          if (!isPlaying && currentIndex === timelineData.length - 1) {
             setCurrentIndex(0);
          }
          setIsPlaying(!isPlaying);
        }}
      />
      
      <div style={{ flex: 1, paddingTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: -6 }}>
          <Text style={{ color: '#fff', fontSize: 11 }}>{t('map.timeline') || 'Timeline'}</Text>
          <Text style={{ color: '#1890ff', fontSize: 11, fontWeight: 'bold' }}>{timelineData[currentIndex].date}</Text>
        </div>
        <Slider 
          min={0}
          max={timelineData.length - 1}
          value={currentIndex}
          onChange={(val) => {
            setIsPlaying(false);
            setCurrentIndex(val);
          }}
          tooltip={{ open: false }}
          marks={marks}
        />
      </div>
    </div>
  );
}
