import React, { useEffect, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import boundaryData from '../data/haryanaBoundary.geojson?raw';

export default function BoundaryLayer({ selectedDistrict }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    try {
      setData(JSON.parse(boundaryData));
    } catch(e) {
      console.error('Failed to parse boundary geojson', e);
    }
  }, []);

  if (!data) return null;

  return (
    <GeoJSON
      data={data}
      style={() => ({
        // Soft cyan line — readable against any dark base tile
        color:       selectedDistrict ? '#00b8ff' : '#00e5ff',
        weight:      selectedDistrict ? 3 : 2,
        opacity:     selectedDistrict ? 0.95 : 0.7,
        fillColor:   selectedDistrict ? '#00b8ff' : '#00e5ff',
        fillOpacity: selectedDistrict ? 0.07 : 0.02,
        dashArray:   selectedDistrict ? '' : '6, 4',
        lineCap:     'round',
        lineJoin:    'round',
      })}
    />
  );
}
