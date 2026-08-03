import React, { useMemo } from 'react';
import { Menu } from 'antd'; // Antd 菜单
import type { MenuProps } from 'antd';
import {
	HomeOutlined,
	AppstoreOutlined,
	ApiOutlined,
	ClusterOutlined,
	PlayCircleOutlined,
	SettingOutlined,
	WifiOutlined,
	BellOutlined,
	FileTextOutlined,
	LineChartOutlined,
	DesktopOutlined,
} from '@ant-design/icons'; 


interface SidebarProps {
	currentPath: string;
	section: 'home' | 'devices' | 'settings';
	onSelect: (path: string) => void;
}


function item(
	label: React.ReactNode,
	key: string,
	icon?: React.ReactNode,
): Required<MenuProps>['items'][number] {
	return { key, icon, label } as Required<MenuProps>['items'][number];
}


const Sidebar: React.FC<SidebarProps> = ({ currentPath, section, onSelect }) => {
	const items = useMemo(() => {
			if (section === 'settings') {
				return [
					item('Network settings', '/settings/network', <WifiOutlined />),
					item('MQTT configuration', '/settings/mqtt', <ApiOutlined />),
					item('Source Interface', '/settings/modbus', <ClusterOutlined />),
					item('Firmware Settings', '/settings/system', <SettingOutlined />),
				];
			}
			if (section === 'devices') {
				return [];
		}
		return [
			item('Overview', '/', <HomeOutlined />),
			item('Monitor', '/monitor', <DesktopOutlined />),
			item('All Devices', '/devices', <AppstoreOutlined />),
			item('Analysis', '/analysis', <LineChartOutlined />),
			item('Alarms', '/alarms', <BellOutlined />),
			item('Log', '/log', <FileTextOutlined />),
			item('Rules', '/rules', <PlayCircleOutlined />),
		];
	}, [section]);
	const selectedKey = currentPath === '/settings' ? '/settings/network' : currentPath;

	return (
		<div style={{ padding: '8px 0' }}>
			<Menu
				theme="dark"
				mode="inline"
				items={items}
				selectedKeys={[selectedKey]}
				onClick={(e) => onSelect(e.key)}
				style={{ 
					borderRight: 0,
					background: 'transparent',
				}}
				className="custom-sidebar-menu"
			/>
			<style>{`
				.custom-sidebar-menu .ant-menu-item {
					border-radius: 0 24px 24px 0 !important;
					margin: 4px 0 4px 8px !important;
					height: 44px !important;
					line-height: 44px !important;
					padding-left: 16px !important;
					position: relative;
					overflow: hidden;
					transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
				}
				
				.custom-sidebar-menu .ant-menu-item::before {
					content: '';
					position: absolute;
					left: 0;
					top: 0;
					bottom: 0;
					width: 0;
					background: #1677ff;
					transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
					z-index: 0;
				}
				
				.custom-sidebar-menu .ant-menu-item-selected::before {
					width: 100%;
				}
				
				.custom-sidebar-menu .ant-menu-item > * {
					position: relative;
					z-index: 1;
				}
				
				.custom-sidebar-menu .ant-menu-item-selected {
					background: transparent !important;
				}
				
				.custom-sidebar-menu .ant-menu-item:hover:not(.ant-menu-item-selected) {
					background: rgba(255, 255, 255, 0.08) !important;
				}
				
				.custom-sidebar-menu .ant-menu-item-selected .ant-menu-title-content,
				.custom-sidebar-menu .ant-menu-item-selected .anticon {
					color: #fff !important;
				}
			`}</style>
		</div>
	);
};


export default Sidebar;
