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
    { key: '/investigation', icon: <SearchOutlined />, label: 'Investigation' },
    { key: '/hc-reply', icon: <BlockOutlined />, label: 'HC Reply' },
    { key: '/analysis', icon: <LineChartOutlined />, label: 'Analysis' },
    { key: '/search', icon: <SearchOutlined />, label: 'Smart Search' },
    { key: '/crime-map', icon: <EnvironmentOutlined />, label: 'Crime Map' },
    { key: '/gd', icon: <FileTextOutlined />, label: 'Smart GD' },
  ];

  return (
    <Layout className="app-layout">
      {/* Sidebar for Desktop */}
      {screens.md && (
        <Sider 
          theme="dark" 
          breakpoint="lg" 
          collapsedWidth="80"
          className="app-sider"
        >
          <div className="logo-container">
            <div className="logo-text">HP CMS</div>
          </div>
          <Menu 
            theme="dark" 
            mode="inline" 
            selectedKeys={[location.pathname]} 
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
      )}

      <Layout>
        {/* Header */}
        <Header className="app-header">
          <div className="header-left">
            {!screens.md && (
              <Button 
                type="text" 
                icon={<MenuOutlined />} 
                onClick={() => setMobileMenuVisible(!mobileMenuVisible)}
                className="mobile-menu-btn"
              />
            )}
            {!screens.md && <Title level={4} style={{ margin: 0, color: '#fff' }}>HP CMS</Title>}
          </div>
          <div className="header-right">
            {screens.md && (
              <div className="user-info">
                <Text style={{ color: '#fff' }}>{profile?.full_name}</Text>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', color: '#rgba(255,255,255,0.65)' }}>
                  {profile?.role.toUpperCase()}
                </Text>
              </div>
            )}
            <Dropdown menu={userMenu} placement="bottomRight">
              <Avatar style={{ cursor: 'pointer', backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
            </Dropdown>
          </div>
        </Header>

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
