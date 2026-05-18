
export interface DeviceData {
    id: number | string;
    name: string; // device_id
    modelName: string; // node_id
    location: string; // loc_name
    priAddr: string; // pri_addr
    nwkStatus: number; // 1 or 0
    enabled: number; // 1 or 0
    lastSeen?: number; // unix timestamp
    
    // Legacy fields (optional, kept for compatibility if needed, but should be phased out)
	key?: string;
	model?: string;
	serialNumber?: string;
	status?: 'online' | 'offline';
	alarm_state?: 'Not alarm' | 'Active Alarm';
	err_state?: 'No error' | 'Error';
	lastReport?: string;
	parameters?: Record<string, number | string>; // Dynamic parameters
	// Extra fields for View Data
	pri_addr?: string | number;
	sec_addr?: string;
	ter_addr?: string;
	log_intvl?: number;
	report_intvl?: number;
	health_intvl?: number;
	loc_id?: string;
	loc_name?: string;
	loc_subname?: string;
	loc_blk?: string;
	loc_unit?: string;
	postal_code?: string;
	loc_addr?: string;
	x?: number | string;
	y?: number | string;
	h?: number | string;
	fw_ver?: string;
    liveData?: DeviceParameterData[];
}

export interface DeviceParameterData {
    id: number;
    name: string;
    value: number | string | null;
    unit?: string;
    timestamp?: number;
    alarm?: boolean;
    rw?: number; // 0: Read Only, 1: Read/Write
}

// Parameter unit mapping
export const parameterUnits: Record<string, string> = {
	voltage: 'V',
	voltageL1: 'V',
	voltageL2: 'V',
	voltageL3: 'V',
	current: 'A',
	currentL1: 'A',
	currentL2: 'A',
	currentL3: 'A',
	power: 'W',
	energy: 'kWh',
	frequency: 'Hz',
	powerFactor: '',
	temperature: '°C',
	setTemp: '°C',
	currentTemp: '°C',
	setpoint: '°C',
	humidity: '%',
	brightness: '%',
	level: '%',
	pressure: 'bar',
	uptime: 'h',
	connectionCount: '',
	fanSpeed: '',
	mode: '',
	input1: '',
	input2: '',
	input3: '',
	input4: '',
	output1: '',
	output2: '',
	output3: '',
	output4: '',
	 signalStrength: 'dBm',
};

// Writable parameter configuration moved to paramConfig.ts
// Import from '../data/paramConfig' instead

// Export empty array to prevent import errors in other files
export const allDevices: DeviceData[] = [];

