import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import App from './App.jsx'
import './i18n.js'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
          colorBgBase: '#0b0f19',
          colorBgContainer: '#131826',
          colorBgLayout: '#0b0f19',
          colorBgElevated: '#1f2937',
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
