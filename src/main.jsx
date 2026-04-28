import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import App from './App.jsx'
import './styles/global.css'
import './index.css'

// Register all FA icons globally once
library.add(fas, far)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,   // ← Always dark
        token: {
          // Brand
          colorPrimary:        '#3b82f6',
          colorLink:           '#60a5fa',
          colorSuccess:        '#4ade80',
          colorWarning:        '#fbbf24',
          colorError:          '#f87171',
          colorInfo:           '#38bdf8',

          // Typography
          fontFamily:          "'Inter', 'Segoe UI', system-ui, sans-serif",
          fontSize:            14,
          fontSizeLG:          15,
          fontSizeSM:          12,
          lineHeight:          1.55,

          // Borders
          borderRadius:        8,
          borderRadiusLG:      10,
          borderRadiusSM:      6,

          // Backgrounds
          colorBgContainer:    '#1e2130',
          colorBgLayout:       '#161923',
          colorBgElevated:     '#252839',
          colorBorder:         '#374151',
          colorBorderSecondary:'#2d3748',
          colorFillAlter:      '#252839',
          colorFill:           '#2d3748',
          colorFillSecondary:  '#374151',

          // Text
          colorText:           '#d1d5db',
          colorTextSecondary:  '#9ca3af',
          colorTextTertiary:   '#6b7280',
          colorTextHeading:    '#f9fafb',
          colorTextDescription:'#9ca3af',
          colorTextDisabled:   '#4b5563',

          // Shadows
          boxShadow:    '0 1px 3px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)',
          boxShadowSecondary: '0 6px 16px rgba(0,0,0,0.5)',

          // Motion
          motionDurationSlow: '0.22s',
          motionDurationMid:  '0.15s',
          motionDurationFast: '0.1s',
        },
        components: {
          Table: {
            headerBg:         '#252839',
            headerColor:      '#f9fafb',
            rowHoverBg:       '#2d3748',
            cellFontSize:     13,
            borderColor:      '#374151',
          },
          Card: {
            headerFontSize:   14,
            colorBgContainer: '#1e2130',
            colorBorderSecondary: '#374151',
          },
          Tabs: {
            inkBarColor:      '#3b82f6',
            itemActiveColor:  '#60a5fa',
            itemSelectedColor:'#60a5fa',
            itemColor:        '#9ca3af',
            itemHoverColor:   '#d1d5db',
            titleFontSize:    13,
            cardBg:           '#252839',
          },
          Tag: { fontSize: 11 },
          Button: {
            fontSize: 13,
            colorText: '#d1d5db',
            defaultColor: '#d1d5db',
            defaultBg: '#1e2130',
            defaultBorderColor: '#374151',
          },
          Menu: {
            itemBg:           'transparent',
            subMenuItemBg:    'transparent',
            itemSelectedBg:   'rgba(59,130,246,0.15)',
            itemSelectedColor:'#60a5fa',
            itemHoverBg:      'rgba(59,130,246,0.08)',
            itemColor:        '#d1d5db',
            itemHoverColor:   '#f9fafb',
          },
          Select: {
            optionSelectedBg: 'rgba(59,130,246,0.15)',
            colorBgContainer: '#1e2130',
          },
          Input: {
            colorBgContainer: '#1e2130',
            colorBorder:      '#374151',
            colorText:        '#d1d5db',
          },
          Alert: {
            colorText:        '#d1d5db',
            colorTextHeading: '#f9fafb',
          },
          Progress: {
            colorText: '#d1d5db',
          },
          Statistic: {
            contentFontSize: 22,
          },
          Layout: {
            colorBgHeader:  '#0d1b2a',
            colorBgBody:    '#161923',
            colorBgSider:   '#0d1b2a',
          },
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
