import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';

export default function BeatClusterLayer({ clusters, districtFilter }) {
  const { t } = useTranslation();

  const getClusterIcon = (score, count) => {
    const size = Math.min(40, 20 + count * 2);
    const color = score >= 70 ? 'rgba(245, 34, 45, 0.85)' : score >= 40 ? 'rgba(250, 140, 22, 0.85)' : 'rgba(82, 196, 26, 0.85)';
    
    const html = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.8);
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 11px;
      ">
        ${count}
      </div>
    `;
    
    return L.divIcon({
      html,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2]
    });
  };

  return (
    <>
      {clusters.map((c, i) => {
        if (districtFilter && c.district !== districtFilter) return null;
        
        return (
          <Marker 
            key={`cluster-${i}`} 
            position={[c.latitude, c.longitude]}
            icon={getClusterIcon(c.avgRiskScore, c.signalCount)}
          >
            <Popup>
              <div style={{ color: '#000', minWidth: 150 }}>
                <strong style={{ fontSize: 13, display: 'block', borderBottom: '1px solid #ddd', paddingBottom: 4, marginBottom: 4 }}>
                  {c.district} &#8594; {c.policeStation}
                </strong>
                <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span><b>Beat Area:</b> {c.beatArea}</span>
                  <span><b>Avg Risk:</b> {Math.round(c.avgRiskScore)}</span>
                  <span><b>Total Signals:</b> {c.signalCount}</span>
                  <span><b>Type:</b> {c.clusterType}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
