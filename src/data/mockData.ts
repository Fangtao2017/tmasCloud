// Mock Data for Devices, Timers, and Parameters
export const mockDevices = [
	{ id: 'device-001', name: 'Device-001', model: 'T-DIDO-01' },
	{ id: 'device-002', name: 'Device-002', model: 'T-TEM-01' },
	{ id: 'device-003', name: 'Device-003', model: 'T-DIM-01' },
	{ id: 'device-004', name: 'Device-004', model: 'T-ACP-01' },
	{ id: 'device-005', name: 'Device-005', model: 'T-OCC-01' },
	{ id: 'device-006', name: 'Device-006', model: 'T-EMS-01' },
	{ id: 'device-007', name: 'Device-007', model: 'T-TK-01' },
	{ id: 'device-008', name: 'Device-008', model: 'T-EMS-02' },
];

export const mockTimers = [
	{ id: 'timer-001', name: 'Timer-001', description: 'Daily Schedule' },
	{ id: 'timer-002', name: 'Timer-002', description: 'Weekly Backup' },
	{ id: 'timer-003', name: 'Timer-003', description: 'Monthly Report' },
];

export const mockParameters = [
	{ name: 'relay_state', unit: 'bool', deviceId: 'device-001' },
	{ name: 'trigger_mode', unit: 'int', deviceId: 'device-001' },
	{ name: 'temperature', unit: '°C', deviceId: 'device-002' },
	{ name: 'humidity', unit: '%', deviceId: 'device-002' },
	{ name: 'brightness', unit: '%', deviceId: 'device-003' },
	{ name: 'power_state', unit: 'bool', deviceId: 'device-003' },
	{ name: 'temperature', unit: '°C', deviceId: 'device-004' },
	{ name: 'fan_speed', unit: '%', deviceId: 'device-004' },
	{ name: 'occupancy', unit: 'bool', deviceId: 'device-005' },
	{ name: 'lux_level', unit: 'lux', deviceId: 'device-005' },
	{ name: 'voltage', unit: 'V', deviceId: 'device-006' },
	{ name: 'current', unit: 'A', deviceId: 'device-006' },
	{ name: 'level', unit: '%', deviceId: 'device-007' },
	{ name: 'flow_rate', unit: 'L/min', deviceId: 'device-007' },
	{ name: 'power_total', unit: 'kW', deviceId: 'device-008' },
	{ name: 'energy_total', unit: 'kWh', deviceId: 'device-008' },
	{ name: 'voltage_l1', unit: 'V', deviceId: 'device-008' },
];

export const timerStateOptions = [
	{ label: 'Idle', value: 0 },
	{ label: 'Running', value: 1 },
	{ label: 'Expired', value: 2 },
];

export const operatorOptions = [
	{ label: '==', value: '==' },
	{ label: '!=', value: '!=' },
	{ label: '<', value: '<' },
	{ label: '<=', value: '<=' },
	{ label: '>', value: '>' },
	{ label: '>=', value: '>=' },
];

export const actionTypeOptions = [
	{ label: 'Set', value: 'set' },
	{ label: 'Toggle', value: 'toggle' },
	{ label: 'Increase', value: 'increase' },
	{ label: 'Decrease', value: 'decrease' },
];

// Mock saved conditions that users can reuse
export const mockSavedConditions = [
	{
		id: 'cond-001',
		name: 'Temperature High Alert',
		type: 'device',
		description: 'Device-002 temperature >= 30°C',
		config: {
			device: 'device-002',
			parameter: 'temperature',
			operator: '>=',
			mode: 1,
			value: 30
		}
	},
	{
		id: 'cond-002',
		name: 'Occupancy Detected',
		type: 'device',
		description: 'Device-005 occupancy == true',
		config: {
			device: 'device-005',
			parameter: 'occupancy',
			operator: '==',
			mode: 1,
			value: 1
		}
	},
	{
		id: 'cond-003',
		name: 'Timer Running',
		type: 'timer',
		description: 'Timer-001 state == Running',
		config: {
			timerState: 1,
			operator: '=='
		}
	},
	{
		id: 'cond-004',
		name: 'Low Brightness',
		type: 'device',
		description: 'Device-003 brightness < 20%',
		config: {
			device: 'device-003',
			parameter: 'brightness',
			operator: '<',
			mode: 1,
			value: 20
		}
	},
];

// Mock saved controls that users can reuse
export const mockSavedControls = [
	{
		id: 'ctrl-001',
		name: 'Turn On Lights',
		type: 'device',
		description: 'Set Device-003 brightness to 100%',
		config: {
			device: 'device-003',
			parameter: 'brightness',
			mode: 1,
			value: 100
		}
	},
	{
		id: 'ctrl-002',
		name: 'Start Ventilation',
		type: 'device',
		description: 'Set Device-004 fan_speed to 75%',
		config: {
			device: 'device-004',
			parameter: 'fan_speed',
			mode: 1,
			value: 75
		}
	},
	{
		id: 'ctrl-003',
		name: 'Start Timer',
		type: 'timer',
		description: 'Start Timer-001',
		config: {
			timer: 'timer-001',
			timerAction: 'start'
		}
	},
	{
		id: 'ctrl-004',
		name: 'Relay On',
		type: 'device',
		description: 'Set Device-001 relay_state to On',
		config: {
			device: 'device-001',
			parameter: 'relay_state',
			mode: 1,
			value: 1
		}
	},
];

export const mockUsers = [
	{
		id: 'user-001',
		username: 'admin',
		password: 'password123',
		fullName: 'System Administrator',
		companyName: 'TCAM Technology',
		role: 'admin',
		permissions: ['all'],
		lastLoginTime: '2025-12-02 09:30:00'
	},
	{
		id: 'user-002',
		username: 'operator1',
		password: 'password123',
		fullName: 'Operator One',
		companyName: 'TCAM Technology',
		role: 'operator',
		permissions: ['read', 'control'],
		lastLoginTime: '2025-12-01 14:15:00'
	},
	{
		id: 'user-003',
		username: 'viewer1',
		password: 'password123',
		fullName: 'Viewer One',
		companyName: 'TCAM Technology',
		role: 'readonly',
		permissions: ['read'],
		lastLoginTime: '2025-11-30 10:00:00'
	}
];

export const mockRules = [
	{ id: 'rule-001', name: 'High Temp Alert', severity: 'Critical' },
	{ id: 'rule-002', name: 'Night Mode', severity: 'Info' },
	{ id: 'rule-003', name: 'Security Breach', severity: 'Critical' },
	{ id: 'rule-004', name: 'Energy Saving', severity: 'Warning' },
];

export const ruleStateOptions = [
	{ label: 'Active', value: 1 },
	{ label: 'Inactive', value: 0 },
];
