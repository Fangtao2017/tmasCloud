import React, { useState, useEffect } from 'react';
import { Typography, Button, Menu, theme, ConfigProvider, message } from 'antd';
import { 
  ArrowRightOutlined,
  BlockOutlined,
  FormOutlined,
  ClusterOutlined,
  BellOutlined,
  ControlOutlined,
  WifiOutlined,
  SettingOutlined,
  ApiOutlined,
  CloseOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Title, Paragraph } = Typography;
const { useToken } = theme;

export type MenuSectionType = 'report' | 'sensor-setting' | 'monitor-control' | 'system-configuration';

interface SubPageItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  description: string;
  features: string[];
  disabled?: boolean;
}

interface NavMegaMenuProps {
  section: MenuSectionType;
  deviceId?: string; // Kept for compatibility but unused
  onNavigate: (path: string) => void;
  onClose: () => void;
}

const NavMegaMenu: React.FC<NavMegaMenuProps> = ({ section, onNavigate, onClose }) => {
  const { token } = useToken();
  const [selectedKey, setSelectedKey] = useState<string>('');

  // Helper to format path
  const getPath = (path: string) => {
    return path;
  };

  // Data Definitions
  const reportItems: SubPageItem[] = [
    {
      key: 'analysis',
      label: 'Analysis',
      icon: <ArrowRightOutlined />, // Using generic icon as LineChartOutlined is not imported
      path: '/analysis',
      description: 'Analyze device data trends and historical performance.',
      features: ['Trend Analysis', 'Historical Data', 'Performance Metrics']
    },
    {
      key: 'log',
      label: 'Log',
      icon: <ArrowRightOutlined />, // Using generic icon
      path: '/log',
      description: 'View system and device logs for troubleshooting and auditing.',
      features: ['System Logs', 'Device Logs', 'Audit Trail']
    }
  ];

  const sensorSettingItems: SubPageItem[] = [
    {
      key: 'device-list',
      label: 'Sensor',
      icon: <SettingOutlined />,
      path: '/devices',
      description: 'View and manage all connected sensors and devices. Monitor their real-time status, connectivity, and basic configurations.',
      features: ['Real-time Status Monitoring', 'Device Inventory', 'Connection Health Check']
    },
    {
      key: 'model-setting',
      label: 'Model',
      icon: <BlockOutlined />,
      path: '/devices/models',
      description: 'Define and manage device models. Configure capabilities, brands, and types for standardization across your system.',
      features: ['Model Standardization', 'Capability Definition', 'Brand Management']
    },
    {
      key: 'parameter-setting',
      label: 'Parameter',
      icon: <FormOutlined />,
      path: '/devices/parameters',
      description: 'Configure data parameters for your devices. Set up data types, units, scaling factors, and access permissions.',
      features: ['Data Type Configuration', 'Unit Management', 'Access Control']
    },
    {
      key: 'modbus-setting',
      label: 'Source Interface',
      icon: <ClusterOutlined />,
      path: '/settings/modbus',
      description: 'Configure Modbus communication parameters including baud rate, parity, and slave IDs for industrial integration.',
      features: ['Protocol Configuration', 'Slave ID Management', 'Communication Tuning']
    },
    {
      key: 'alarm-setting',
      label: 'Alarm Setting',
      icon: <BellOutlined />,
      path: '/alarms',
      description: 'Configure alarm definitions and thresholds. Set up critical alerts for device parameters and system states.',
      features: ['Threshold Configuration', 'Severity Levels', 'Alert Definitions']
    },
    {
      key: 'rules-setting',
      label: 'Rules Setting',
      icon: <ControlOutlined />,
      path: '/rules',
      description: 'Define automation rules and logic. Create if-this-then-that scenarios to automate device controls.',
      features: ['Automation Logic', 'Condition-Action Pairs', 'Scenario Management'],
      disabled: true
    }
  ];

  const monitorControlItems: SubPageItem[] = [
    {
      key: 'realtime-monitor',
      label: 'Gateway Monitoring',
      icon: <DashboardOutlined />,
      path: '/realtime',
      description: 'Monitor gateway fleet health first, then drill into each gateway and its managed sub-devices.',
      features: ['Gateway Fleet View', 'Site-aware Drill-down', 'Live Status Tracking']
    },
    {
      key: 'monitor',
      label: 'Notification Center',
      icon: <BellOutlined />,
      path: '/monitor',
      description: 'Review event, alarm, and rule notifications in one operational feed, including trigger and normal states.',
      features: ['Trigger and Normal State Feed', 'Unified Event Intake', 'Operator Review Queue']
    }
  ];

  const systemConfigurationItems: SubPageItem[] = [
    {
      key: 'network-setting',
      label: 'Network Setting',
      icon: <WifiOutlined />,
      path: '/settings/network',
      description: 'Configure network interfaces, IP addresses, DNS, and gateway settings for system connectivity.',
      features: ['IP Configuration', 'Interface Management', 'Connectivity Setup'],
      disabled: true
    },
    {
      key: 'system-setting',
      label: 'Firmware Settings',
      icon: <SettingOutlined />,
      path: '/settings/system',
      description: 'Manage system firmware. Check for updates, upload new versions, and maintain system stability.',
      features: ['Version Control', 'Update Management', 'System Maintenance']
    },
    {
      key: 'mqtt-setting',
      label: 'MQTT Setting',
      icon: <ApiOutlined />,
      path: '/settings/mqtt',
      description: 'Configure MQTT broker connection details, topics, and authentication for cloud communication.',
      features: ['Broker Connection', 'Topic Mapping', 'Cloud Integration'],
      disabled: true
    }
  ];

  // Determine items based on section
  const getItems = () => {
    switch (section) {
      case 'report': return reportItems;
      case 'sensor-setting': return sensorSettingItems;
      case 'monitor-control': return monitorControlItems;
      case 'system-configuration': return systemConfigurationItems;
      default: return [];
    }
  };

  const items = getItems();
  const selectedItem = items.find(item => item.key === selectedKey) || items[0];

  useEffect(() => {
    if (items.length > 0 && !selectedKey) {
      setSelectedKey(items[0].key);
    }
  }, [items, selectedKey]);

  const menuItems: MenuProps['items'] = items.map(item => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '60vh', 
        background: '#fff', 
        boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        position: 'relative',
        zIndex: 1000,
        borderBottomLeftRadius: '16px',
        borderBottomRightRadius: '16px',
        overflow: 'hidden'
      }}
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
    >
      {/* Close Button */}
      <Button 
        type="text" 
        icon={<CloseOutlined style={{ fontSize: 20 }} />} 
        onClick={onClose}
        style={{ 
          position: 'absolute', 
          top: 16, 
          right: 16, 
          zIndex: 1001 
        }}
      />

      {/* Left Side: Menu List */}
      <div style={{ width: 300, borderRight: `1px solid ${token.colorSplit}`, background: '#fafafa', padding: '24px 0', overflowY: 'auto' }}>
        <ConfigProvider
          theme={{
            components: {
              Menu: {
                itemSelectedBg: '#003A70',
                itemSelectedColor: '#ffffff',
                itemHoverBg: 'rgba(0, 58, 112, 0.1)',
              }
            }
          }}
        >
          <Menu
            mode="vertical"
            selectedKeys={[selectedItem.key]}
            items={menuItems}
            onClick={({ key }) => setSelectedKey(key)}
            style={{ borderRight: 'none', background: 'transparent', fontSize: 16 }}
          />
        </ConfigProvider>
      </div>

      {/* Right Side: Content */}
      <div style={{ flex: 1, padding: '48px 64px', overflowY: 'auto' }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: 800 }}>
          <div>
            <Title level={2} style={{ marginTop: 0, marginBottom: 24, color: '#001B34' }}>
              {selectedItem.label}
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 18, marginBottom: 32, lineHeight: 1.6 }}>
              {selectedItem.description}
            </Paragraph>
            
            <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Key Features</Title>
            <ul style={{ paddingLeft: 20, marginBottom: 40, color: token.colorTextSecondary, fontSize: 16 }}>
              {selectedItem.features.map((feature, index) => (
                <li key={index} style={{ marginBottom: 12 }}>{feature}</li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <Button 
              type="primary" 
              size="large" 
              icon={<ArrowRightOutlined />}
              onClick={() => {
                if (selectedItem.disabled) {
                  message.info('This feature is still under development.');
                } else {
                  onNavigate(getPath(selectedItem.path));
                }
              }}
              style={{ 
                backgroundColor: selectedItem.disabled ? '#d9d9d9' : '#003A70', 
                borderColor: selectedItem.disabled ? '#d9d9d9' : '#003A70',
                height: 48,
                padding: '0 32px',
                fontSize: 16
              }}
            >
              {selectedItem.disabled ? 'Under Development' : `Go to ${selectedItem.label}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavMegaMenu;
