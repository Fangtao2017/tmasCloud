import React from 'react';
import {
  HomeOutlined,
  UnorderedListOutlined,
  LineChartOutlined,
  FileTextOutlined,
  AlertOutlined,
  SettingOutlined,
  BlockOutlined,
  FormOutlined,
  ClusterOutlined,
  AppstoreAddOutlined,
  BellOutlined,
  ControlOutlined,
  ApiOutlined,
  TeamOutlined,
  WifiOutlined
} from '@ant-design/icons';

export type SectionKey = 'home' | 'report' | 'sensor-setting' | 'monitor-control' | 'system';

export interface SecondaryNavItem {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

export interface NavSection {
  key: SectionKey;
  label: string;
  title: string;
  defaultPath: string;
  icon: React.ReactNode;
  items: SecondaryNavItem[];
}

export const navSections: Record<SectionKey, NavSection> = {
  home: {
    key: 'home',
    label: 'Home',
    title: 'Device Monitor',
    defaultPath: '/',
    icon: <HomeOutlined />,
    items: [
      { key: 'overview', label: 'Overview', path: '/', icon: <HomeOutlined /> },
    ],
  },
  report: {
    key: 'report',
    label: 'Report',
    title: 'Report',
    defaultPath: '/analysis',
    icon: <LineChartOutlined />,
    items: [
      { key: 'analysis', label: 'Analysis', path: '/analysis', icon: <LineChartOutlined /> },
      { key: 'log', label: 'Log', path: '/log', icon: <FileTextOutlined /> },
    ],
  },
  'sensor-setting': {
    key: 'sensor-setting',
    label: 'Configuration',
    title: 'Configuration',
    defaultPath: '/configuration/workspace',
    icon: <SettingOutlined />,
    items: [
      { key: 'workspace-overview', label: 'Workspace', path: '/configuration/workspace', icon: <UnorderedListOutlined /> },
      { key: 'workspace-devices', label: 'Devices', path: '/configuration/workspace?tab=devices', icon: <AppstoreAddOutlined /> },
      { key: 'workspace-models', label: 'Models', path: '/configuration/workspace?tab=models', icon: <BlockOutlined /> },
      { key: 'workspace-parameters', label: 'Parameters', path: '/configuration/workspace?tab=parameters', icon: <FormOutlined /> },
      { key: 'workspace-interfaces', label: 'Interfaces', path: '/configuration/workspace?tab=interfaces', icon: <ClusterOutlined /> },
      { key: 'workspace-alarms', label: 'Alarms', path: '/configuration/workspace?tab=alarms', icon: <BellOutlined /> },
      { key: 'workspace-rules', label: 'Rules', path: '/configuration/workspace?tab=rules', icon: <ControlOutlined /> },
    ],
  },
  'monitor-control': {
    key: 'monitor-control',
    label: 'Monitor & Control',
    title: 'Monitor & Control',
    defaultPath: '/monitor',
    icon: <ControlOutlined />,
    items: [
      { key: 'monitor', label: 'Notification Center', path: '/monitor', icon: <AlertOutlined /> },
      { key: 'alarm-setting', label: 'Alarm Setting', path: '/alarms', icon: <BellOutlined /> },
      { key: 'rules-setting', label: 'Rules Setting', path: '/rules', icon: <ControlOutlined /> },
      { key: 'add-rule', label: 'Add Rule', path: '/configuration/add-rule', icon: <ControlOutlined /> },
      { key: 'add-alarm', label: 'Add Alarm', path: '/configuration/add-alarm', icon: <BellOutlined /> },
    ],
  },
  system: {
    key: 'system',
    label: 'System Configuration',
    title: 'System Configuration',
    defaultPath: '/settings/network',
    icon: <ApiOutlined />,
    items: [
      { key: 'system-setting', label: 'T8000 Setting', path: '/settings/system', icon: <SettingOutlined /> },
      { key: 'network-setting', label: 'Network Setting', path: '/settings/network', icon: <WifiOutlined /> },
      { key: 'mqtt-setting', label: 'MQTT Setting', path: '/settings/mqtt', icon: <ApiOutlined /> },
      { key: 'user-management', label: 'User Management', path: '/user-management', icon: <TeamOutlined /> },
    ],
  },
};

export const sectionOrder: SectionKey[] = ['home', 'report', 'sensor-setting', 'monitor-control', 'system'];

export const resolveSectionByPath = (effectivePath: string): SectionKey => {
  const path = effectivePath === '' ? '/' : effectivePath;

  if (path === '/') {
    return 'home';
  }

  if (path.startsWith('/analysis') || path.startsWith('/log')) {
    return 'report';
  }

  if (
    path === '/devices' ||
    path.startsWith('/devices/') ||
    path.startsWith('/configuration/workspace') ||
    path.startsWith('/settings/modbus') ||
    path.startsWith('/configuration/add-model') ||
    path.startsWith('/configuration/add-parameter')
  ) {
    return 'sensor-setting';
  }

  if (
    path.startsWith('/monitor') ||
    path.startsWith('/realtime') ||
    path.startsWith('/alarms') ||
    path.startsWith('/rules') ||
    path.startsWith('/configuration/add-rule') ||
    path.startsWith('/configuration/add-alarm')
  ) {
    return 'monitor-control';
  }

  if (
    path === '/settings' ||
    path.startsWith('/settings/network') ||
    path.startsWith('/settings/system') ||
    path.startsWith('/settings/mqtt') ||
    path.startsWith('/user-management') ||
    path.startsWith('/account')
  ) {
    return 'system';
  }

  return 'home';
};
