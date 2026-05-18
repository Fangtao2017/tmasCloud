import React, { useState, useEffect } from 'react';
import { Flex, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { 
	HomeOutlined, 
	BellOutlined,
	AppstoreAddOutlined,
	ControlOutlined,
	WifiOutlined,
	ApiOutlined,
	ClusterOutlined,
	SettingOutlined,
	DownOutlined,
	BlockOutlined,
	FormOutlined,
	UserOutlined,
	ArrowLeftOutlined
} from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

interface IconNavProps {
	collapsed?: boolean;
}

const IconNav: React.FC<IconNavProps> = ({ collapsed }) => {
	const location = useLocation();
	const navigate = useNavigate();
	const { deviceId } = useParams<{ deviceId: string }>();
	const [expandedSection, setExpandedSection] = useState<string | null>(null);

	// Helper to format path with deviceId
	const getPath = (path: string) => {
		if (!deviceId) return path;
		if (path === '/') return `/device/${deviceId}`;
		return `/device/${deviceId}${path}`;
	};

	// Determine current top-level section
	const section = (() => {
		const path = location.pathname;
		// Remove the /device/:deviceId prefix for matching
		const relativePath = deviceId ? path.replace(`/device/${deviceId}`, '') : path;
		const effectivePath = relativePath === '' ? '/' : relativePath;

		if (effectivePath === '/') return 'overview';
		
		if (effectivePath.startsWith('/devices') || effectivePath === '/settings/modbus' || effectivePath === '/configuration/add-model' || effectivePath === '/configuration/add-parameter') return 'device-management';
		
		if (effectivePath.startsWith('/alarms') || effectivePath.startsWith('/rules') || effectivePath === '/configuration/add-rule' || effectivePath === '/configuration/add-alarm') return 'logic-management';
		
		if (effectivePath === '/settings/network' || effectivePath === '/settings/system' || effectivePath === '/settings/mqtt' || effectivePath.startsWith('/account')) return 'communication-management';
		
		return 'overview';
	})();

	// Auto-expand section based on current path
	useEffect(() => {
		if (section !== 'overview') {
			setExpandedSection(section);
		}
	}, [section]);

	// Navigation items configuration
	const navigationItems = [
		{
			key: 'back-to-cloud',
			icon: <ArrowLeftOutlined />,
			label: 'Back to Cloud',
			path: '/', // This goes to the cloud dashboard
			hasDropdown: false,
			isCloudLink: true,
		},
		{
			key: 'overview',
			icon: <HomeOutlined />,
			label: 'Overview',
			path: '/',
			hasDropdown: false,
		},
		{
			key: 'device-management',
			icon: <AppstoreAddOutlined />,
			label: 'Connected Devices',
			hasDropdown: true,
			submenu: [
				{ key: 'model-setting', label: 'Model Setting', icon: <BlockOutlined />, path: '/devices/models' },
				{ key: 'device-setting', label: 'Device List', icon: <AppstoreAddOutlined />, path: '/devices' },
				{ key: 'parameter-setting', label: 'Parameter Setting', icon: <FormOutlined />, path: '/devices/parameters' },
				{ key: 'modbus-setting', label: 'Modbus Setting', icon: <ClusterOutlined />, path: '/settings/modbus' },
				{ key: 'add-model', label: 'Add Model', icon: <BlockOutlined />, path: '/configuration/add-model' },
				{ key: 'add-device', label: 'Add Sub-Device', icon: <AppstoreAddOutlined />, path: '/devices/add' },
				{ key: 'supplement-add-parameter', label: 'Supplement Add Parameter', icon: <FormOutlined />, path: '/configuration/add-parameter' },
			],
		},
		{
			key: 'logic-management',
			icon: <ControlOutlined />,
			label: 'Local Logic',
			hasDropdown: true,
			submenu: [
				{ key: 'alarm-setting', label: 'Alarm Setting', icon: <BellOutlined />, path: '/alarms' },
				{ key: 'rules-setting', label: 'Rules Setting', icon: <ControlOutlined />, path: '/rules' },
				{ key: 'add-rule', label: 'Add Rule', icon: <ControlOutlined />, path: '/configuration/add-rule' },
				{ key: 'add-alarm', label: 'Add Alarm', icon: <BellOutlined />, path: '/configuration/add-alarm' },
			],
		},
		{
			key: 'communication-management',
			icon: <ApiOutlined />,
			label: 'Gateway Settings',
			hasDropdown: true,
			submenu: [
				{ key: 'network-setting', label: 'Network Setting', icon: <WifiOutlined />, path: '/settings/network' },
				{ key: 'system-setting', label: 'Firmware Settings', icon: <SettingOutlined />, path: '/settings/system' },
				{ key: 'mqtt-setting', label: 'MQTT Setting', icon: <ApiOutlined />, path: '/settings/mqtt' },
				{ key: 'account-setting', label: 'Local Account', icon: <UserOutlined />, path: '/account' },
			],
		},
	];

	const handleItemClick = (item: typeof navigationItems[0]) => {
		if (item.hasDropdown) {
			if (collapsed) {
				return;
			}
			
			// Define default paths for main sections
			const defaultPaths: Record<string, string> = {
				'device-management': '/devices',
				'logic-management': '/configuration/add-rule',
				'communication-management': '/settings/network'
			};

			const defaultPath = defaultPaths[item.key];
			if (defaultPath) {
				navigate(getPath(defaultPath));
				setExpandedSection(item.key);
			} else {
				setExpandedSection(expandedSection === item.key ? null : item.key);
			}
		} else {
			// If it's a cloud link, navigate directly, otherwise use getPath
			navigate(item.isCloudLink ? item.path : getPath(item.path!));
		}
	};

	const handleSubmenuClick = (path: string) => {
		navigate(getPath(path));
	};

	// Create dropdown menu items for collapsed mode
	const getDropdownItems = (submenu: typeof navigationItems[0]['submenu']): MenuProps['items'] => {
		if (!submenu) return [];
		return submenu.map(subItem => ({
			key: subItem.key,
			label: subItem.label,
			icon: subItem.icon,
			onClick: () => handleSubmenuClick(subItem.path),
		}));
	};

	return (
		<Flex
			vertical
			gap={8}
			style={{
				width: '100%',
				background: '#001B34',
				paddingTop: 16,
				paddingBottom: 16,
				height: '100%',
				transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
				position: 'relative',
				zIndex: 1001,
				borderRight: '1px solid rgba(255,255,255,0.1)',
				overflowY: 'auto',
				overflowX: 'hidden',
			}}
		>
			{navigationItems.map((item) => {
				const active = section === item.key;
				const expanded = expandedSection === item.key;
				
				// For collapsed mode with dropdown, wrap in Dropdown
				const menuContent = (
					<div
						onClick={() => handleItemClick(item)}
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: collapsed ? 'center' : 'flex-start',
							gap: 12,
							padding: collapsed ? '12px 0' : '12px 16px',
							margin: '0 8px',
							borderRadius: 4,
							color: active ? '#8CC63F' : 'rgba(255,255,255,0.85)',
							cursor: 'pointer',
							transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
							background: active ? 'rgba(140, 198, 63, 0.15)' : 'transparent',
							position: 'relative',
							fontSize: 16,
							fontWeight: active ? 500 : 400,
						}}
						onMouseEnter={(e) => {
							if (!active) {
								e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
							}
						}}
						onMouseLeave={(e) => {
							if (!active) {
								e.currentTarget.style.background = 'transparent';
							}
						}}
					>
						<span style={{ fontSize: 20 }}>{item.icon}</span>
						{!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
						{!collapsed && item.hasDropdown && (
							<DownOutlined style={{ 
								fontSize: 10,
								opacity: 0.6,
								transition: 'transform 0.3s',
								transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
							}} />
						)}
					</div>
				);
				
				return (
					<div key={item.key}>
						{/* Main Menu Item */}
						{collapsed && item.hasDropdown ? (
							<Dropdown
								menu={{ items: getDropdownItems(item.submenu) }}
								placement="bottomRight"
								trigger={['click']}
							>
								{menuContent}
							</Dropdown>
						) : (
							menuContent
						)}
						
						{/* Submenu Items */}
						{!collapsed && item.hasDropdown && (
							<div style={{
								paddingLeft: 8,
								paddingRight: 8,
								marginTop: expanded ? 4 : 0,
								marginBottom: expanded ? 4 : 0,
								maxHeight: expanded ? 500 : 0,
								opacity: expanded ? 1 : 0,
								overflow: 'hidden',
								transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
							}}>
								{item.submenu?.map((subItem) => {
									const subActive = location.pathname === getPath(subItem.path);
									return (
										<div
											key={subItem.key}
											onClick={() => handleSubmenuClick(subItem.path)}
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: 10,
												padding: '10px 16px 10px 32px',
												margin: '2px 0',
												borderRadius: 4,
												color: subActive ? '#8CC63F' : 'rgba(255,255,255,0.65)',
												cursor: 'pointer',
												transition: 'all 0.2s',
												background: subActive ? 'rgba(140, 198, 63, 0.1)' : 'transparent',
												fontSize: 15,
											}}
											onMouseEnter={(e) => {
												if (!subActive) {
													e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
													e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
												}
											}}
											onMouseLeave={(e) => {
												if (!subActive) {
													e.currentTarget.style.background = 'transparent';
													e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
												}
											}}
										>
											<span style={{ fontSize: 16, opacity: 0.8 }}>{subItem.icon}</span>
											<span>{subItem.label}</span>
										</div>
									);
								})}
							</div>
						)}
					</div>
				);
			})}
		</Flex>
	);
};

export default IconNav;
