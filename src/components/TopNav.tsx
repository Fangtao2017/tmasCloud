import React from 'react';
import { Flex, Typography, Dropdown, Avatar, ConfigProvider, Tag } from 'antd';
import { 
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  ControlOutlined,
  ApiOutlined,
  GlobalOutlined,
  DownOutlined,
  HomeOutlined,
  LineChartOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import type { MenuProps } from 'antd';
import tmasLogo from '../assets/TMAS.png';
import { ResponsiveMenu } from './ResponsiveMenu';
import type { MenuItem } from './ResponsiveMenu';
import { useAuth } from '../context/AuthContext';

const TopNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, logout } = useAuth();

  const getPath = (path: string) => {
    return path;
  };

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'account-details') {
      navigate(getPath('/account/details'));
    } else if (key === 'profile') {
      navigate(getPath('/account'));
    } else if (key === 'user-management') {
      navigate(role === 'admin' ? '/admin' : '/user-management');
    } else if (key === 'settings') {
      navigate(getPath('/settings'));
    } else if (key === 'logout') {
      logout();
      navigate('/login');
    }
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-header',
      label: (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <Avatar 
            size={48} 
            icon={<UserOutlined />} 
            style={{ 
              backgroundColor: '#003A70',
              flexShrink: 0,
              marginTop: 2
            }} 
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography.Text strong style={{ fontSize: 16, lineHeight: 1.2, color: '#001B34' }}>
                {user?.displayName || user?.username || 'Guest'}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {user?.username || ''}
              </Typography.Text>
            </div>
            
            <div>
              <Tag 
                color={role === 'admin' ? 'volcano' : 'blue'} 
                style={{ margin: 0, border: 'none', padding: '0 8px', fontSize: 11 }}
              >
                {role?.toUpperCase() || 'VISITOR'}
              </Tag>
            </div>
          </div>
        </div>
      ),
      disabled: true,
      style: { 
        cursor: 'default', 
        opacity: 1, 
        padding: '24px 24px 20px', 
        backgroundColor: '#fff'
      }
    },
    { type: 'divider', style: { margin: '4px 0' } },
    {
      key: 'account-details',
      label: 'Account Details',
      icon: <IdcardOutlined style={{ fontSize: 16, width: 16 }} />,
      style: { padding: '10px 24px', fontSize: 14 }
    },
    {
      key: 'profile',
      label: 'Security Settings',
      icon: <SafetyCertificateOutlined style={{ fontSize: 16, width: 16 }} />,
      style: { padding: '10px 24px', fontSize: 14 }
    },
    ...(role === 'admin' || role === 'site_admin' ? [
      {
        key: 'user-management',
        label: 'User Management',
        icon: <UserOutlined style={{ fontSize: 16, width: 16 }} />,
        style: { padding: '10px 24px', fontSize: 14 }
      }
    ] : []),
    { type: 'divider', style: { margin: '4px 0' } },
    {
      key: 'language',
      label: 'Language',
      icon: <GlobalOutlined style={{ fontSize: 16, width: 16 }} />,
      style: { padding: '10px 24px', fontSize: 14 },
      children: [
        { key: 'en', label: 'English' },
        { key: 'zh', label: '中文' }
      ]
    },
    {
      key: 'support',
      label: 'Support',
      icon: <QuestionCircleOutlined style={{ fontSize: 16, width: 16 }} />,
      style: { padding: '10px 24px', fontSize: 14 },
      children: [
        { key: 'docs', label: 'Documentation' },
        { key: 'contact-support', label: 'Contact Support' }
      ]
    },
    { type: 'divider', style: { margin: '4px 0' } },
    {
      key: 'logout',
      label: 'Sign Out',
      icon: <LogoutOutlined style={{ fontSize: 16, width: 16 }} />,
      danger: true,
      style: { padding: '10px 24px', fontSize: 14 }
    },
  ];

  // Determine selected key based on path
  const getSelectedKey = () => {
    const path = location.pathname;
    const effectivePath = path === '' ? '/' : path;

    // Home mapping
    if (effectivePath === '/') {
      return ['home'];
    }

    // Report
    if (effectivePath.startsWith('/analysis') || effectivePath.startsWith('/log')) {
      return ['report'];
    }

    // Sensor Setting (was Device Management)
    if (effectivePath.startsWith('/devices') || effectivePath.startsWith('/configuration/workspace') || effectivePath.startsWith('/settings/modbus') || effectivePath.startsWith('/configuration/source-interface') || effectivePath.startsWith('/configuration/add-model') || effectivePath.startsWith('/configuration/add-parameter') || effectivePath.startsWith('/alarms') || effectivePath.startsWith('/rules') || effectivePath.startsWith('/configuration/add-rule') || effectivePath.startsWith('/configuration/add-alarm')) {
      return ['sensor-setting'];
    }
    
    // Monitor & Control (was Logic Management)
    if (effectivePath.startsWith('/monitor') || effectivePath.startsWith('/realtime')) {
      return ['monitor-control'];
    }
    
    // System Configuration
    if (effectivePath.startsWith('/settings')) {
      return ['system-configuration'];
    }

    return [];
  };

  const activeKeys = getSelectedKey();
  const isAccountActive = location.pathname.startsWith('/account') || location.pathname.startsWith('/user-management');

  const navItems: MenuItem[] = [
    { key: 'home', label: 'Home', icon: <HomeOutlined />, path: '/', onClick: () => navigate(getPath('/')) },
    { key: 'monitor-control', label: 'Monitor & Control', icon: <ControlOutlined />, path: '/realtime', onClick: () => navigate(getPath('/realtime')) },
    { key: 'report', label: 'Report', icon: <LineChartOutlined />, path: '/log/overview', onClick: () => navigate(getPath('/log/overview')) },
    { key: 'sensor-setting', label: 'Configuration', icon: <ApiOutlined />, path: '/configuration/workspace', onClick: () => navigate(getPath('/configuration/workspace')) },
    { key: 'system-configuration', label: 'System', icon: <SettingOutlined />, path: '/settings/system', onClick: () => navigate(getPath('/settings/system')) },
  ];

  const renderNavItem = (item: MenuItem, isActive: boolean) => {
    let color = isActive ? '#8CC63F' : '#ffffff';

    return (
      <div 
        className="nav-item"
        style={{ 
          padding: '0 16px', 
          height: '56px', // Match navbar height
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          cursor: 'pointer',
          color: color,
          borderBottom: isActive ? '2px solid #8CC63F' : '2px solid transparent',
          transition: 'all 0.3s',
          whiteSpace: 'nowrap'
        }}
        onClick={() => {
          if (item.path) navigate(getPath(item.path));
        }}
      >
        {item.icon}
        <span style={{ fontWeight: 500, fontSize: 16 }}>{item.label}</span>
      </div>
    );
  };

  return (
    <>
      <style>
        {`
          .nav-item:hover {
            color: #8CC63F !important;
            background-color: rgba(255,255,255,0.05);
          }
          .dropdown-trigger {
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.3s;
          }
          .dropdown-trigger:hover {
            background-color: rgba(255,255,255,0.1);
          }
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @media (max-width: 1200px) {
            .nav-text-label {
              display: none;
            }
          }
        `}
      </style>
      <Flex align="center" justify="space-between" style={{ 
        height: '100%', 
        backgroundColor: '#001B34',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        color: '#ffffff',
        position: 'relative',
        zIndex: 1000
      }}>
        <Flex align="center" style={{ flex: 1, overflow: 'hidden' }}>
          {/* Fixed Width Left Section for Alignment */}
          <Flex align="center" style={{ flex: '0 1 auto', minWidth: 200, maxWidth: 280, height: '100%' }}>
            {/* 左侧Logo区域 */}
            <Flex align="center" gap={12} style={{ 
              padding: '0 10px', 
              height: '100%',
              width: '100%',
              transition: 'all 0.2s',
            }}>
              <img 
                src={tmasLogo} 
                alt="TMAS" 
                style={{ 
                  height: 25,
                  width: 'auto',
                  objectFit: 'contain'
                }} 
              />
            </Flex>

            {/* Return to Cloud Button - REMOVED for Embedded */}
          </Flex>

          {/* Main Navigation Menu */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ResponsiveMenu
              items={navItems}
              activeKey={activeKeys[0]}
              renderItem={renderNavItem}
              style={{ justifyContent: 'flex-end' }}
              moreLabel={
                <div className="nav-item" style={{ padding: '0 16px', height: '56px', display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#fff' }}>
                  More <DownOutlined style={{ marginLeft: 4 }} />
                </div>
              }
            />
          </div>
        </Flex>
        
        {/* 右侧区域 */}
        <Flex align="center" justify="flex-end" gap={12} style={{ 
          padding: '0 24px',
          height: '100%',
          flexShrink: 1,
          minWidth: 80
        }}>
          <ConfigProvider
            theme={{
              token: {
                colorBgElevated: '#001B34',
                colorText: '#ffffff',
              },
              components: {
                Menu: {
                  colorItemBg: '#001B34',
                  colorItemText: '#ffffff',
                  colorItemTextHover: '#ffffff',
                  colorItemBgHover: '#002B54',
                  colorItemBgSelected: '#002B54',
                  colorItemTextSelected: '#ffffff',
                }
              }
            }}
          >
            {/* Language and Support moved to Account Menu */}
          </ConfigProvider>

          {/* Account */}
          <Dropdown 
            menu={{ items: userMenuItems, onClick: handleMenuClick }} 
            placement="bottomRight" 
            arrow
            trigger={['click']}
            overlayStyle={{ minWidth: 260 }}
            dropdownRender={(menu) => (
              <div style={{ 
                backgroundColor: '#fff', 
                borderRadius: 12, 
                boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
                overflow: 'hidden'
              }}>
                {React.cloneElement(menu as React.ReactElement<any>, { style: { boxShadow: 'none', borderRadius: 0 } })}
              </div>
            )}
          >
            <div style={{ cursor: 'pointer', flexShrink: 0 }}>
              <Avatar 
                size="default" 
                icon={<UserOutlined />} 
                style={{ 
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  border: isAccountActive ? '2px solid #8CC63F' : 'none',
                  boxSizing: 'border-box'
                }} 
              />
            </div>
          </Dropdown>
        </Flex>
      </Flex>
    </>
  );
};

export default TopNav;
