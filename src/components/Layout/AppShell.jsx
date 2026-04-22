import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Typography, Grid } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  FileTextOutlined,
  FileDoneOutlined,
  SearchOutlined,
  BlockOutlined,
  LineChartOutlined,
  EnvironmentOutlined,
  BookOutlined,
  DashboardOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuOutlined
} from '@ant-design/icons';
import '../../styles/appshell.css';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function AppShell() {
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const userMenu = {
    items: [
      {
        key: 'profile',
        label: `Profile (${profile?.role})`,
        icon: <UserOutlined />,
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        label: 'Logout',
        icon: <LogoutOutlined />,
        danger: true,
        onClick: handleLogout,
      },
    ],
  };

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/complaints', icon: <FileTextOutlined />, label: 'Complaints' },
    { key: '/fir', icon: <FileDoneOutlined />, label: 'FIRs' },
    { key: '/investigation', icon: <SearchOutlined />, label: 'Guide' },
    { key: '/hc-reply', icon: <BlockOutlined />, label: 'HC Reply' },
    { key: '/analysis', icon: <LineChartOutlined />, label: 'Analysis' },
    { key: '/search', icon: <SearchOutlined />, label: 'Smart Search' },
    { key: '/crime-map', icon: <EnvironmentOutlined />, label: 'Crime Map' },
    { key: '/gd', icon: <FileTextOutlined />, label: 'Smart GD' },
  ];

  return (
    <Layout className="app-layout">
      {/* Sidebar for Desktop (Auto-hide overlay) */}
      {screens.md && (
        <div 
          onMouseEnter={() => setCollapsed(false)}
          onMouseLeave={() => setCollapsed(true)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 1000,
            width: collapsed ? '15px' : '240px',
            background: collapsed ? 'transparent' : '#001529',
            transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)'
          }}
        >
          <Sider 
            theme="dark" 
            trigger={null}
            collapsed={collapsed}
            collapsedWidth={0}
            width={240}
            style={{ 
              height: '100%', 
              boxShadow: collapsed ? 'none' : '4px 0 15px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="logo-container" style={{ padding: '16px 24px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <div className="logo-text" style={{ fontSize: 20 }}>HP CMS</div>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                <Menu 
                  theme="dark" 
                  mode="inline" 
                  selectedKeys={[location.pathname]} 
                  items={menuItems}
                  onClick={({ key }) => navigate(key)}
                />
              </div>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px', display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: 'auto' }}>
                <Dropdown menu={userMenu} placement="topRight" trigger={['click']}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                    <Avatar style={{ backgroundColor: '#1890ff', flexShrink: 0 }} icon={<UserOutlined />} />
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ color: '#fff', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{profile?.full_name}</div>
                    </div>
                  </div>
                </Dropdown>
              </div>
            </div>
          </Sider>
        </div>
      )}

      {/* Main Content Layout needs left margin if it's absolute?
          Actually, the user says 'remove the top bar as it is taking space unnecessarily' and 'make left panel auto hide'.
          This means we want maximizing screen space. */}
      <Layout style={{ paddingLeft: screens.md ? 15 : 0 }}>
        {/* Header (Mobile Only) */}
        {!screens.md && (
          <Header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px' }}>
            <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button 
                type="text" 
                icon={<MenuOutlined style={{ color: '#fff' }} />} 
                onClick={() => setMobileMenuVisible(!mobileMenuVisible)}
                className="mobile-menu-btn"
              />
              <Title level={4} style={{ margin: 0, color: '#fff' }}>HP CMS</Title>
            </div>
            <div className="header-right">
              <Dropdown menu={userMenu} placement="bottomRight">
                <Avatar style={{ cursor: 'pointer', backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
              </Dropdown>
            </div>
          </Header>
        )}

        {/* Mobile overlay menu */}
        {!screens.md && mobileMenuVisible && (
          <div className="mobile-overlay-menu">
            <Menu 
              mode="inline" 
              selectedKeys={[location.pathname]} 
              items={menuItems}
              onClick={({ key }) => {
                setMobileMenuVisible(false);
                navigate(key);
              }}
            />
          </div>
        )}

        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
