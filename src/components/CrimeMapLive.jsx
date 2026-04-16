import React, { useState, useEffect, useMemo } from 'react';
import { Space, Select, Button, Typography, Tag, Switch } from 'antd';
import { ReloadOutlined, EnvironmentOutlined, SyncOutlined } from '@ant-design/icons';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';
import { useTranslation } from 'react-i18next';
import { haryanaDistrictCenters } from '../data/haryanaDistrictCenters';

import BoundaryLayer from './BoundaryLayer';
import BeatClusterLayer from './BeatClusterLayer';
import TimelineControl from './TimelineControl';

const { Text } = Typography;

const defaultCenter = { lat: 29.0588, lng: 76.0856 };
const defaultZoom = 7;

function HeatmapLayerComp({ points }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    
    // Check if leaflet.heat is loaded on L
    if (!L.heatLayer) return;

    // points is an array of [lat, lng, intensity]
    const heatLayer = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: 100 // riskScore up to 100
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

function MapUpdater({ center, zoom, data, districtFilter }) {
  const map = useMap();
  useEffect(() => {
    if (districtFilter && center && zoom) {
      map.setView([center.lat, center.lng], zoom, { animate: true });
    } else if (!districtFilter && data && data.length > 0) {
      const bounds = L.latLngBounds(data.map(d => [d.latitude, d.longitude]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    } else {
      map.setView([29.0588, 76.0856], 7, { animate: true });
    }
  }, [center, zoom, data, districtFilter, map]);
  return null;
}

const getMarkerIcon = (riskScore, isTop) => {
  // Color scheme: high = orange-red glow, medium = amber, low = yellow-green
  const color  = riskScore >= 70 ? '#ff4d00' : riskScore >= 40 ? '#ffa500' : '#f0e040';
  const glow   = riskScore >= 70 ? '#ff4d0088' : riskScore >= 40 ? '#ffa50066' : '#f0e04044';
  const size   = isTop ? 22 : 16;
  const border = isTop ? '2.5px solid rgba(255,255,255,0.9)' : '2px solid rgba(255,255,255,0.7)';

  const pulseHtml = isTop ? `
    <div style="
      position: absolute;
      top: 50%; left: 50%;
      width: 52px; height: 52px;
      border: 2px solid ${color};
      transform: translate(-50%, -50%);
      border-radius: 50%;
      z-index: -1;
      animation: pulse-ring 2s ease-out infinite;
      opacity: 0;
    "></div>
    <div style="
      position: absolute;
      top: 50%; left: 50%;
      width: 34px; height: 34px;
      background: ${glow};
      transform: translate(-50%, -50%);
      border-radius: 50%;
      z-index: -1;
      animation: pulse-fill 2s ease-out infinite;
    "></div>
  ` : '';

  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: radial-gradient(circle at 35% 35%, ${color}ff, ${color}cc);
      border-radius: 50%;
      border: ${border};
      box-shadow: 0 0 ${isTop ? 14 : 8}px ${glow}, 0 0 ${isTop ? 28 : 14}px ${glow};
      position: relative;
    ">
      ${isTop ? `<div style="position: absolute; top: 50%; left: 50%; width: 5px; height: 5px; background: white; border-radius: 50%; transform: translate(-50%, -50%);"></div>` : ''}
      ${pulseHtml}
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)]
  });
};

export default function CrimeMapLive({ mapData, fetching, beatClusters = [], timelineData = [] }) {
  const { t } = useTranslation();
  
  const [districtMapFilter, setDistrictMapFilter] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  
  const [showBeatClusters, setShowBeatClusters] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [activeTimelineData, setActiveTimelineData] = useState(null);

  const [districts, setDistricts] = useState([]);
  
  useEffect(() => {
    const distSet = new Set(mapData.map(d => d.district).filter(Boolean));
    setDistricts(Array.from(distSet).sort());
  }, [mapData]);

  const baseData = (showTimeline && activeTimelineData && activeTimelineData.hotspots) ? activeTimelineData.hotspots : mapData;

  const filteredData = useMemo(() => {
    if (!districtMapFilter) return baseData;
    return baseData.filter(d => d.district === districtMapFilter);
  }, [baseData, districtMapFilter]);

  const topHotspot = useMemo(() => {
    if (filteredData.length === 0) return null;
    return [...filteredData].sort((a, b) => b.riskScore - a.riskScore)[0];
  }, [filteredData]);

  const heatmapPoints = useMemo(() => {
    return filteredData.map(d => [d.latitude, d.longitude, d.riskScore]);
  }, [filteredData]);

  const currentCenter = useMemo(() => {
    if (districtMapFilter && haryanaDistrictCenters[districtMapFilter]) {
      return haryanaDistrictCenters[districtMapFilter];
    }
    return defaultCenter;
  }, [districtMapFilter]);

  const currentZoom = useMemo(() => {
    return districtMapFilter ? 10 : defaultZoom;
  }, [districtMapFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      
      {/* ── Controls Overlay Inside Map Container ───────────────── */}
      <div style={{ position: 'absolute', top: 10, left: 50, right: 10, zIndex: 1000, display: 'flex', flexWrap: 'wrap', gap: 10, background: 'rgba(20, 20, 20, 0.85)', padding: '8px 12px', borderRadius: 8, backdropFilter: 'blur(4px)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', alignItems: 'center' }}>
        <Select
          allowClear
          placeholder={t('map.districtFilter') || 'Filter District'}
          value={districtMapFilter}
          onChange={setDistrictMapFilter}
          style={{ width: 140 }}
          size="small"
        >
          {districts.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
        </Select>

        <Button size="small" icon={<ReloadOutlined />} onClick={() => setDistrictMapFilter(null)}>
          {t('map.resetView') || 'Reset'}
        </Button>

        <Space size={16} style={{ marginLeft: 'auto', flexWrap: 'wrap' }}>
          <Space size={6}>
            <Text style={{ fontSize: 11, color: '#fff' }}>{t('map.haryanaBoundary') || 'Boundary'}</Text>
            <Switch size="small" checked={showBoundary} onChange={setShowBoundary} />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 11, color: '#fff' }}>{t('map.beatClusters') || 'Clusters'}</Text>
            <Switch size="small" checked={showBeatClusters} onChange={setShowBeatClusters} />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 11, color: '#fff' }}>{t('map.timeline') || 'Timeline'}</Text>
            <Switch size="small" checked={showTimeline} onChange={setShowTimeline} />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 11, color: '#fff' }}>Heatmap</Text>
            <Switch size="small" checked={showHeatmap} onChange={setShowHeatmap} />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 11, color: '#fff' }}>Markers</Text>
            <Switch size="small" checked={showMarkers} onChange={setShowMarkers} />
          </Space>
        </Space>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer 
          center={[defaultCenter.lat, defaultCenter.lng]} 
          zoom={defaultZoom} 
          style={{ height: '100%', width: '100%', background: '#1c2128' }}
          zoomControl={true}
          maxBounds={[[26, 72], [32, 80]]}
          maxBoundsViscosity={1.0}
        >
          {/* CARTO Dark All — confirmed working dark tile.
              Provides grey-blue roads, district labels, and clear spatial context
              on a near-black background. Valid slug: dark_all (not dark_matter). */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            maxZoom={19}
          />
          
          <MapUpdater center={currentCenter} zoom={currentZoom} data={filteredData} districtFilter={districtMapFilter} />

          {showBoundary && <BoundaryLayer selectedDistrict={districtMapFilter} />}
          {showBeatClusters && <BeatClusterLayer clusters={beatClusters} districtFilter={districtMapFilter} />}

          {showHeatmap && heatmapPoints.length > 0 && (
            <HeatmapLayerComp points={heatmapPoints} />
          )}

          {showMarkers && filteredData.map((hotspot) => {
            const isTop = topHotspot && topHotspot.id === hotspot.id;
            const icon = getMarkerIcon(hotspot.riskScore, isTop);

            return (
              <Marker 
                key={hotspot.id} 
                position={[hotspot.latitude, hotspot.longitude]} 
                icon={icon}
              >
                <Popup>
                  <div style={{ color: '#000', padding: 0, margin: 0, minWidth: 160 }}>
                    <strong style={{ display: 'block', fontSize: 13, borderBottom: '1px solid #eee', paddingBottom: 4, marginBottom: 4 }}>
                      {hotspot.areaName}
                    </strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
                      <span><b>District:</b> {hotspot.district}</span>
                      <span><b>PS:</b> {hotspot.policeStation}</span>
                      <span><b>Score:</b> <span style={{ color: hotspot.riskScore >= 70 ? 'red' : 'orange', fontWeight: 'bold' }}>{Math.round(hotspot.riskScore)}</span></span>
                      <span><b>Signals:</b> {hotspot.signalCount}</span>
                      <span><b>Type:</b> {hotspot.hotspotType}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        
        {showTimeline && timelineData.length > 0 && (
          <TimelineControl timelineData={timelineData} onDateChange={setActiveTimelineData} />
        )}

        {fetching && (
          <div style={{ position: 'absolute', bottom: 20, right: 10, background: 'rgba(0,0,0,0.8)', padding: '6px 12px', borderRadius: 20, color: '#fff', zIndex: 1000, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <SyncOutlined spin /> <span style={{ fontSize: 12, marginLeft: 6 }}>Syncing...</span>
          </div>
        )}

        {!fetching && filteredData.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.18)', pointerEvents: 'none', zIndex: 900 }}>
            <div style={{ textAlign: 'center', color: '#ccc', background: 'rgba(15,20,30,0.82)', padding: '16px 28px', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
               <EnvironmentOutlined style={{ fontSize: 30, marginBottom: 8, color: '#4a9eff' }} /><br/>
               <Text style={{ color: '#aaa', fontSize: 13 }}>{t('map.noData') || 'No hotspot data available for selected district.'}</Text>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* Top hotspot pulse ring — expands outward and fades */
        @keyframes pulse-ring {
          0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0.9; }
          70%  { transform: translate(-50%, -50%) scale(1.4); opacity: 0.3; }
          100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
        }
        /* Inner fill glow */
        @keyframes pulse-fill {
          0%   { opacity: 0.7; transform: translate(-50%, -50%) scale(0.9); }
          50%  { opacity: 0.3; transform: translate(-50%, -50%) scale(1.15); }
          100% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.9); }
        }

        /* Popup styling */
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
          padding: 4px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .leaflet-popup-content {
          margin: 8px 10px;
        }
        .leaflet-container {
          font-family: inherit;
        }
        /* Leaflet zoom controls */
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
        }
        .leaflet-control-zoom a {
          background-color: #1a2035 !important;
          color: #a0aec0 !important;
          border-color: #2d3748 !important;
          font-size: 16px !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: #2d3748 !important;
          color: #fff !important;
        }
        /* Attribution stays visible but subtle */
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.45) !important;
          color: #666 !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: #888 !important; }
      `}</style>
    </div>
  );
}
