import React from 'react';
import { 
	FileTextOutlined, 
	AlertOutlined,
	SettingOutlined,
	BlockOutlined,
	FormOutlined,
	ClusterOutlined,
	BellOutlined,
	ControlOutlined,
	WifiOutlined,
	ApiOutlined,
	DashboardOutlined,
	BarChartOutlined,
    DownOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dropdown, Breadcrumb, ConfigProvider, message } from 'antd';
import type { MenuProps } from 'antd';
import { ResponsiveMenu } from './ResponsiveMenu';
import type { MenuItem } from './ResponsiveMenu';

const SecondaryNav: React.FC = () => {
	const navigate = useNavigate();
    const dropdownTheme = {
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
    };
	const location = useLocation();
	// const { deviceId } = useParams<{ deviceId: string }>(); // Not needed in embedded

	// Helper to format path
	const getPath = (path: string) => {
		return path;
	};

	const getSection = () => {
		const path = location.pathname;
		const effectivePath = path === '' ? '/' : path;

		if (effectivePath === '/') {
			return 'home';
		}
		if (effectivePath.startsWith('/analysis') || effectivePath.startsWith('/log')) {
			return 'report';
		}
        if (effectivePath.startsWith('/devices') || effectivePath.startsWith('/configuration/workspace') || effectivePath.startsWith('/settings/modbus') || effectivePath.startsWith('/configuration/source-interface') || effectivePath.startsWith('/configuration/add-model') || effectivePath.startsWith('/configuration/add-parameter') || effectivePath.startsWith('/alarms') || effectivePath.startsWith('/rules') || effectivePath.startsWith('/configuration/add-rule') || effectivePath.startsWith('/configuration/add-alarm')) {
			return 'sensor-setting';
		}
		if (effectivePath.startsWith('/monitor') || effectivePath.startsWith('/realtime')) {
			return 'monitor-control';
		}
		if (effectivePath.startsWith('/settings')) {
			return 'system-configuration';
		}
		if (effectivePath.startsWith('/account') || effectivePath.startsWith('/user-management')) {
			return 'account';
		}
		return 'home';
	};

	const getMenuItems = (): MenuItem[] => {
		const section = getSection();

		if (section === 'home') {
			return [];
		}

		if (section === 'report') {
			return [
                { key: 'log-overview', icon: <BarChartOutlined />, label: 'Summary', onClick: () => navigate(getPath('/log/overview')) },
                { key: 'log-list', icon: <FileTextOutlined />, label: 'Log List', onClick: () => navigate(getPath('/log/list')) },
			];
		}

        if (section === 'sensor-setting') {
            const workspacePath = (tab?: string) => tab ? `/configuration/workspace?tab=${tab}` : '/configuration/workspace';

            return [
                { key: 'workspace-overview', label: 'Workspace', icon: <SettingOutlined />, onClick: () => navigate(getPath(workspacePath())) },
                { key: 'workspace-devices', label: 'Devices', icon: <SettingOutlined />, onClick: () => navigate(getPath(workspacePath('devices'))) },
                { key: 'workspace-models', label: 'Models', icon: <BlockOutlined />, onClick: () => navigate(getPath(workspacePath('models'))) },
                { key: 'workspace-parameters', label: 'Parameters', icon: <FormOutlined />, onClick: () => navigate(getPath(workspacePath('parameters'))) },
                { key: 'workspace-interfaces', label: 'Interfaces', icon: <ClusterOutlined />, onClick: () => navigate(getPath(workspacePath('interfaces'))) },
                { key: 'workspace-alarms', label: 'Alarms', icon: <BellOutlined />, onClick: () => navigate(getPath(workspacePath('alarms'))) },
                { key: 'workspace-rules', label: 'Rules', icon: <ControlOutlined />, onClick: () => navigate(getPath(workspacePath('rules'))) },
            ];
		}

		if (section === 'monitor-control') {
			return [
                { key: 'realtime-monitor', icon: <DashboardOutlined />, label: 'Gateway Monitoring', onClick: () => navigate(getPath('/realtime')) },
                { key: 'monitor', icon: <AlertOutlined />, label: 'Notification Center', onClick: () => navigate(getPath('/monitor')) },
			];
		}

		if (section === 'system-configuration') {
			return [
				{ key: 'system-setting', label: 'T8000 Setting', icon: <SettingOutlined />, onClick: () => navigate(getPath('/settings/system')) },
				{ key: 'network-setting', label: 'Network', icon: <WifiOutlined />, onClick: () => message.info('This feature is still under development.') },
				{ key: 'mqtt-setting', label: 'MQTT', icon: <ApiOutlined />, onClick: () => message.info('This feature is still under development.') },
			];
		}

		return [];
	};

	// Determine selected key based on path
	const getSelectedKey = () => {
		const path = location.pathname;
		const effectivePath = path === '' ? '/' : path;
        const workspaceTab = new URLSearchParams(location.search).get('tab') ?? 'devices';

		if (effectivePath === '/') return ['overview'];
		if (effectivePath.startsWith('/analysis')) return ['analysis'];
        if (effectivePath.startsWith('/log/list')) return ['log-list'];
        if (effectivePath.startsWith('/log')) return ['log-overview'];
        if (effectivePath.startsWith('/realtime')) return ['realtime-monitor'];
		if (effectivePath.startsWith('/monitor')) return ['monitor'];
        if (effectivePath === '/configuration/workspace') return [workspaceTab === 'devices' ? 'workspace-overview' : `workspace-${workspaceTab}`];
		
		if (effectivePath === '/devices') return ['device-list'];
		if (effectivePath === '/devices/models') return ['model-setting'];
		if (effectivePath === '/devices/parameters') return ['parameter-setting'];
		if (effectivePath === '/settings/modbus' || effectivePath.startsWith('/configuration/source-interface')) return ['modbus-setting'];
		if (effectivePath === '/configuration/add-model') return ['add-model'];
		if (effectivePath === '/devices/add') return ['add-device'];
		if (effectivePath === '/configuration/add-parameter') return ['supplement-add-parameter'];
		
		if (effectivePath === '/alarms') return ['alarm-setting'];
		if (effectivePath === '/rules') return ['rules-setting'];
		if (effectivePath === '/configuration/add-rule') return ['add-rule'];
		if (effectivePath === '/configuration/add-alarm') return ['add-alarm'];
		
		if (effectivePath === '/settings/network') return ['network-setting'];
		if (effectivePath === '/settings/system') return ['system-setting'];
		if (effectivePath === '/settings/mqtt') return ['mqtt-setting'];
		if (effectivePath.startsWith('/account')) return ['account-setting'];
		
		return [];
	};

    const getBreadcrumbItems = () => {
        const path = location.pathname;
        const effectivePath = path === '' ? '/' : path;
        
        // Base item
        const items: any[] = [];

        // Helper to create item
        const createItem = (title: string, menu?: any) => ({
            title: <span className="breadcrumb-text">{title}</span>,
            menu
        });

        // Report
        if (effectivePath.startsWith('/analysis')) {
            items.push(createItem('Report'));
            items.push(createItem('Analysis'));
        } else if (effectivePath.startsWith('/log/list')) {
            items.push(createItem('Report'));
            items.push(createItem('Log List'));
        } else if (effectivePath.startsWith('/log')) {
            items.push(createItem('Report'));
            items.push(createItem('Summary'));
        }
        
        // Configuration
        else if (effectivePath.startsWith('/devices') || effectivePath.startsWith('/configuration') || effectivePath.startsWith('/alarms') || effectivePath.startsWith('/rules')) {
            items.push(createItem('Configuration'));

            if (effectivePath.startsWith('/configuration/workspace')) {
                const workspaceTab = new URLSearchParams(location.search).get('tab') ?? 'devices';
                const workspaceLabel = {
                    devices: 'Devices',
                    models: 'Models',
                    parameters: 'Parameters',
                    interfaces: 'Interfaces',
                    alarms: 'Alarms',
                    rules: 'Rules',
                }[workspaceTab] ?? 'Devices';

                items.push(createItem('Configuration Workspace'));
                items.push(createItem(workspaceLabel));

                return items;
            }
            
            if (effectivePath === '/devices') items.push(createItem('Sensor'));
            else if (effectivePath === '/devices/models') items.push(createItem('Model'));
            else if (effectivePath === '/devices/parameters') items.push(createItem('Parameter'));
            else if (effectivePath.startsWith('/configuration/source-interface') || effectivePath === '/settings/modbus') {
                items.push(createItem('Source Interface', {
                    items: [
                        { 
                            key: 'modbus', 
                            label: (
                                <div>
                                    <div style={{ fontWeight: 500 }}>Modbus</div>
                                    <div style={{ fontSize: '11px', color: '#888', fontWeight: 'normal' }}>RTU-based industrial protocol</div>
                                </div>
                            ), 
                            onClick: () => navigate('/configuration/source-interface/modbus') 
                        },
                        { 
                            key: 'di', 
                            label: (
                                <div>
                                    <div style={{ fontWeight: 500 }}>DI</div>
                                    <div style={{ fontSize: '11px', color: '#888', fontWeight: 'normal' }}>digital signal input</div>
                                </div>
                            ), 
                            onClick: () => navigate('/configuration/source-interface/di') 
                        },
                        { 
                            key: 'do', 
                            label: (
                                <div>
                                    <div style={{ fontWeight: 500 }}>DO</div>
                                    <div style={{ fontSize: '11px', color: '#888', fontWeight: 'normal' }}>digital output control</div>
                                </div>
                            ), 
                            onClick: () => navigate('/configuration/source-interface/do') 
                        },
                        { 
                            key: 'ai', 
                            label: (
                                <div>
                                    <div style={{ fontWeight: 500 }}>AI</div>
                                    <div style={{ fontSize: '11px', color: '#888', fontWeight: 'normal' }}>Continuous analog signal</div>
                                </div>
                            ), 
                            onClick: () => navigate('/configuration/source-interface/ai') 
                        },
                    ]
                }));
                
                // Add specific interface type
                if (effectivePath.includes('/modbus')) items.push(createItem('Modbus'));
                else if (effectivePath.includes('/di')) items.push(createItem('DI'));
                else if (effectivePath.includes('/do')) items.push(createItem('DO'));
                else if (effectivePath.includes('/ai')) items.push(createItem('AI'));
            }
            else if (effectivePath === '/alarms') items.push(createItem('Alarm'));
            else if (effectivePath === '/rules') items.push(createItem('Rules'));
            else if (effectivePath === '/devices/add') items.push(createItem('Add Sensor'));
            else if (effectivePath === '/configuration/add-model') items.push(createItem('Add Model'));
            else if (effectivePath === '/configuration/add-parameter') items.push(createItem('Add Parameter'));
            else if (effectivePath === '/configuration/add-rule') items.push(createItem('Add Rule'));
            else if (effectivePath === '/configuration/add-alarm') items.push(createItem('Add Alarm'));
        }
        
        // Monitor & Control
        else if (effectivePath.startsWith('/monitor') || effectivePath.startsWith('/realtime')) {
            items.push(createItem('Monitor & Control'));
            if (effectivePath === '/realtime') items.push(createItem('Gateway Monitoring'));
            else if (effectivePath.startsWith('/realtime/')) {
                items.push(createItem('Gateway Monitoring'));
                items.push(createItem('Gateway Detail'));
            }
            else if (effectivePath.startsWith('/monitor')) items.push(createItem('Notification Center'));
        }
        
        // System
        else if (effectivePath.startsWith('/settings') || effectivePath.startsWith('/account')) {
            items.push(createItem('System'));
            if (effectivePath === '/settings/network') items.push(createItem('Network'));
            else if (effectivePath === '/settings/system') items.push(createItem('T8000 Setting'));
            else if (effectivePath === '/settings/mqtt') items.push(createItem('MQTT'));
            else if (effectivePath.startsWith('/account')) items.push(createItem('Local Account'));
        } else {
            items.push(createItem('Home'));
            items.push(createItem('Overview'));
        }

        return items;
    };

    const section = getSection();
    if (section === 'home' || section === 'account' || section === 'sensor-setting') {
		return null;
	}

	return (
		<div style={{ background: '#ffffff', borderBottom: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <style>
                {`
                    .secondary-nav-item:hover {
                        color: #001B34 !important;
                        background-color: rgba(0,0,0,0.02);
                    }
                    
                    /* Breadcrumb Styles */
                    .breadcrumb-text {
                        font-size: 12px;
                        font-weight: 500;
                    }

                    /* Dropdown Item Animation */
                    .nav-dropdown-overlay .ant-dropdown-menu-item {
                        transition: all 0.3s ease;
                    }
                    
                    .nav-dropdown-overlay .ant-dropdown-menu-item:hover {
                        padding-left: 16px !important; /* Slide effect */
                        background-color: #002B54; /* Ensure hover color matches theme */
                    }
                `}
            </style>
			<div style={{ 
				width: '100%', 
				display: 'flex', 
                flexDirection: 'row',
                alignItems: 'center',
				padding: '0 0',
				height: 40,
				position: 'relative'
			}}>
                {/* Breadcrumb Section - Left Side */}
                <div style={{ 
                    padding: '0 20px', 
                    display: 'flex', 
                    alignItems: 'center',
                    height: '100%',
                    flexShrink: 0
                }}>
                    <Breadcrumb items={getBreadcrumbItems()} />
                </div>

                {/* Menu Section - Right Side (Flexible) */}
                <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
                    <ResponsiveMenu
                        items={getMenuItems()}
                        activeKey={getSelectedKey()[0]}
                        style={{ justifyContent: 'flex-end', paddingRight: 20, height: '100%' }}
                        renderItem={(item, isActive) => {
                            const isDisabled = ['rules-setting', 'network-setting', 'mqtt-setting'].includes(item.key);
                            const itemStyle = {
                                padding: '0 16px',
                                height: '100%', // Fill height
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                color: isDisabled ? 'rgba(0, 0, 0, 0.25)' : isActive ? '#001B34' : 'rgba(0, 0, 0, 0.65)',
                                borderBottom: isActive ? '2px solid #001B34' : '2px solid transparent',
                                transition: 'all 0.3s',
                                whiteSpace: 'nowrap' as const,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6, // Reduced gap
                                fontSize: 14, // Increased to 13
                                fontWeight: 500
                            };

                            if (item.key === 'log') {
                                const items: MenuProps['items'] = [
                                    { 
                                        key: 'scheduled', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>Scheduled Log</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>Schedule execution records</div>
                                            </div>
                                        ), 
                                        onClick: () => navigate('/log/scheduled') 
                                    },
                                    { 
                                        key: 'change', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>Change Log</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>Data changes records</div>
                                            </div>
                                        ), 
                                        onClick: () => navigate('/log/change') 
                                    },
                                    { 
                                        key: 'alarm', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>Alarm Log</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>Alarm trigger & ACK</div>
                                            </div>
                                        ), 
                                        onClick: () => navigate('/log/alarm') 
                                    },
                                    { 
                                        key: 'rule', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>Rule Log</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>Rule execution records</div>
                                            </div>
                                        ), 
                                        onClick: () => navigate('/log/rule') 
                                    },
                                    { 
                                        key: 'health', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>Health Log</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>System & device health records</div>
                                            </div>
                                        ), 
                                        onClick: () => navigate('/log/health') 
                                    },
                                    { 
                                        key: 'error', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>Error Log</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>Error & exception records</div>
                                            </div>
                                        ), 
                                        onClick: () => navigate('/log/error') 
                                    },
                                    { 
                                        key: 'event', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>Event Log</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>System events records</div>
                                            </div>
                                        ), 
                                        onClick: () => navigate('/log/event') 
                                    },
                                ];
                                
                                const currentType = location.pathname.startsWith('/log/') 
                                    ? location.pathname.split('/').pop() 
                                    : '';

                                return (
                                    <ConfigProvider theme={dropdownTheme}>
                                        <Dropdown 
                                            menu={{ 
                                                items, 
                                                selectedKeys: currentType ? [currentType] : [] 
                                            }} 
                                            trigger={['click']}
                                            overlayClassName="nav-dropdown-overlay"
                                        >
                                            <div className="secondary-nav-item" style={itemStyle}>
                                                {React.cloneElement(item.icon as any, { style: { fontSize: 13 } })}
                                                <span>{item.label}</span>
                                                <DownOutlined style={{ fontSize: 11 }} />
                                            </div>
                                        </Dropdown>
                                    </ConfigProvider>
                                );
                            }

                            if (item.key === 'modbus-setting') {
                                const items: MenuProps['items'] = [
                                    { 
                                        key: 'modbus', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>Modbus</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>TCP-based industrial protocol</div>
                                            </div>
                                        ),
                                        onClick: () => navigate('/configuration/source-interface/modbus')
                                    },
                                    { 
                                        key: 'di', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>DI</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>digital signal input</div>
                                            </div>
                                        ),
                                        onClick: () => navigate('/configuration/source-interface/di')
                                    },
                                    { 
                                        key: 'do', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>DO</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>digital output control</div>
                                            </div>
                                        ),
                                        onClick: () => navigate('/configuration/source-interface/do')
                                    },
                                    { 
                                        key: 'ai', 
                                        label: (
                                            <div>
                                                <div style={{ fontWeight: 500 }}>AI</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 'normal' }}>Continuous analog signal</div>
                                            </div>
                                        ),
                                        onClick: () => navigate('/configuration/source-interface/ai')
                                    },
                                ];

                                // Determine selected key for highlighting in dropdown
                                const currentType = location.pathname.startsWith('/configuration/source-interface/') 
                                    ? location.pathname.split('/').pop() 
                                    : '';

                                return (
                                    <ConfigProvider theme={dropdownTheme}>
                                        <Dropdown 
                                            menu={{ 
                                                items, 
                                                selectedKeys: currentType ? [currentType] : [] 
                                            }} 
                                            trigger={['click']}
                                            overlayClassName="nav-dropdown-overlay"
                                        >
                                            <div className="secondary-nav-item" style={itemStyle}>
                                                {React.cloneElement(item.icon as any, { style: { fontSize: 13 } })}
                                                <span>{item.label}</span>
                                                <DownOutlined style={{ fontSize: 11 }} />
                                            </div>
                                        </Dropdown>
                                    </ConfigProvider>
                                );
                            }

                            return (
                                <div
                                    className="secondary-nav-item"
                                    style={itemStyle}
                                    onClick={item.onClick}
                                >
                                    {React.cloneElement(item.icon as any, { style: { fontSize: 13 } })}
                                    <span>{item.label}</span>
                                </div>
                            );
                        }}
                        moreLabel={
                            <div className="secondary-nav-item" style={{ padding: '0 16px', height: '100%', display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'rgba(0, 0, 0, 0.65)', fontSize: 13 }}>
                                More <DownOutlined style={{ marginLeft: 4, fontSize: 11 }} />
                            </div>
                        }
                    />
                </div>
			</div>
		</div>
	);
};

export default SecondaryNav;
