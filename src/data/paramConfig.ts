/**
 * Parameter Display & Control Configuration
 * ==========================================
 * 
 * This file centralizes ALL parameter styling, categorization, and control
 * configuration used across the dashboard. Edit this file to:
 * 
 *   - Change how a parameter is visualized (gauge, progress bar, dot, number…)
 *   - Add new parameter categories
 *   - Adjust color thresholds (e.g. temperature color ranges)
 *   - Configure writable parameter control types (switch, slider, select…)
 *   - Add/remove digital channel name patterns
 *   - Change device type detection rules
 * 
 * Imported by: RealTimeMonitor.tsx (ParamVisual, SensorDisplay, ControlWidget, DeviceCard, etc.)
 */

import type { DeviceData, DeviceParameterData } from './devicesData';

// ────────────────────────────────────────────────────────────────────────────
// 1. PARAMETER CATEGORIES
//    Determines the visual style of each parameter.
//    Add new categories here and handle them in ParamVisual component.
// ────────────────────────────────────────────────────────────────────────────

export type ParamCategory = 'temperature' | 'percentage' | 'boolean' | 'electrical' | 'default';

/**
 * Rules to classify a parameter into a visual category.
 * Matched top-to-bottom; first match wins.
 * 
 * To add a new category:
 *  1. Add the literal to the ParamCategory type above
 *  2. Add a matching rule here
 *  3. Add icon in CATEGORY_ICONS
 *  4. Add color logic in getGaugeColor (if needed)
 *  5. Add a rendering branch in ParamVisual (RealTimeMonitor.tsx)
 */
const CATEGORY_RULES: Array<{
    category: ParamCategory;
    /** Test against param.name (lowercased) — substring match */
    namePatterns?: string[];
    /** Test against param.name — regex match (for precise patterns like do0, di1…) */
    nameRegex?: RegExp;
}> = [
    {
        category: 'temperature',
        namePatterns: ['temp', 'setpoint'],
    },
    {
        category: 'percentage',
        namePatterns: ['humidity', 'brightness', 'level'],
    },
    {
        category: 'boolean',
        namePatterns: ['output', 'input'],
        // Also match digital channel names: do0, di1, relay2, coil3…
        nameRegex: /^(do|di|relay|coil)\d*$/i,
    },
    {
        category: 'electrical',
        namePatterns: ['voltage', 'current', 'power', 'energy', 'frequency'],
    },
    // Everything else falls through to 'default'
];

export const getParamCategory = (param: DeviceParameterData): ParamCategory => {
    const name = param.name.toLowerCase();
    for (const rule of CATEGORY_RULES) {
        if (rule.namePatterns?.some(pattern => name.includes(pattern))) {
            return rule.category;
        }
        if (rule.nameRegex?.test(param.name)) {
            return rule.category;
        }
    }
    return 'default';
};


// ────────────────────────────────────────────────────────────────────────────
// 2. CATEGORY ICONS
//    Emoji icon shown next to the parameter name in sensor displays.
// ────────────────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<ParamCategory, string> = {
    temperature: '🌡️',
    percentage:  '📊',
    boolean:     '⚡',
    electrical:  '🔌',
    default:     '📈',
};

export const getCategoryIcon = (category: ParamCategory): string => {
    return CATEGORY_ICONS[category] || '📈';
};


// ────────────────────────────────────────────────────────────────────────────
// 3. GAUGE / STATUS COLORS
//    Color thresholds for visual elements (gauges, progress bars, etc.)
//    Adjust ranges or add new categories as needed.
// ────────────────────────────────────────────────────────────────────────────

const BRAND_COLOR_FOR_GAUGE = '#003A70';

export const getGaugeColor = (category: ParamCategory | string, value: number): string => {
    switch (category) {
        case 'temperature':
            if (value < 18) return '#1890ff';  // Cold — blue
            if (value < 26) return '#52c41a';  // Comfortable — green
            if (value < 35) return '#faad14';  // Warm — amber
            return '#ff4d4f';                  // Hot — red

        case 'percentage':
            if (value < 20) return '#ff4d4f';  // Low — red
            if (value < 80) return '#52c41a';  // Normal — green
            return '#faad14';                  // High — amber

        default:
            return BRAND_COLOR_FOR_GAUGE;
    }
};


// ────────────────────────────────────────────────────────────────────────────
// 4. TEMPERATURE GAUGE RANGE
//    Controls the mapping of temperature values to gauge percentage.
// ────────────────────────────────────────────────────────────────────────────

/** Temperature range for gauge display: [min, max] in °C */
export const TEMP_GAUGE_RANGE: [number, number] = [-10, 50];

/** Convert a temperature value to a 0–100 gauge percentage */
export const tempToGaugePercent = (value: number): number => {
    const [min, max] = TEMP_GAUGE_RANGE;
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
};


// ────────────────────────────────────────────────────────────────────────────
// 5. WRITABLE PARAMETER CONTROLS
//    Defines the control widget type for known writable parameters.
//    Parameters not listed here will be auto-inferred at runtime.
//
//    type: 'number'  → slider + number input
//    type: 'switch'  → ON/OFF toggle
//    type: 'select'  → dropdown menu
// ────────────────────────────────────────────────────────────────────────────

export interface WritableConfig {
    type: 'number' | 'select' | 'switch';
    options?: string[];
}

export const writableConfigs: Record<string, WritableConfig> = {
    setTemp:     { type: 'number' },
    setpoint:    { type: 'number' },
    brightness:  { type: 'number' },
    fanSpeed:    { type: 'number' },
    mode:        { type: 'select', options: ['cool', 'heat', 'auto', 'fan', 'dry'] },
    output1:     { type: 'switch' },
    output2:     { type: 'switch' },
    output3:     { type: 'switch' },
    output4:     { type: 'switch' },
};


// ────────────────────────────────────────────────────────────────────────────
// 6. DIGITAL CHANNEL DETECTION
//    Determines whether a writable parameter is rendered with the compact
//    industrial DO panel (DOControlPanel) vs a standard ControlWidget card.
//
//    Name patterns below are matched case-insensitively.
// ────────────────────────────────────────────────────────────────────────────

/** Regex for parameter names that are digital channels */
export const DIGITAL_CHANNEL_PATTERN = /^(do|di|relay|output|coil)\d*$/i;

export const isDigitalChannel = (param: DeviceParameterData): boolean => {
    if (writableConfigs[param.name]?.type === 'switch') return true;
    if (DIGITAL_CHANNEL_PATTERN.test(param.name)) return true;
    return false;
};


// ────────────────────────────────────────────────────────────────────────────
// 7. DEVICE TYPE CLASSIFICATION
//    Maps devices to high-level types for filtering and display.
//    Checked top-to-bottom; first match wins.
// ────────────────────────────────────────────────────────────────────────────

const DEVICE_TYPE_RULES: Array<{
    type: string;
    /** Substrings to match against device.modelName */
    modelPatterns?: string[];
    /** Parameter name substrings (checked in device.liveData) */
    paramPatterns?: string[];
}> = [
    { type: 'Occupancy',    modelPatterns: ['OCC'] },
    { type: 'Lighting',     modelPatterns: ['DIM'] },
    { type: 'Power Meter',  modelPatterns: ['EMS'] },
    { type: 'Water Meter',  modelPatterns: ['TK', 'FM'] },
    // Fallback rules based on parameter names
    { type: 'Temperature',  paramPatterns: ['temp'] },
    { type: 'Power',        paramPatterns: ['power'] },
];

export const getDeviceType = (device: DeviceData): string => {
    for (const rule of DEVICE_TYPE_RULES) {
        // Check model name patterns
        if (rule.modelPatterns && device.modelName) {
            if (rule.modelPatterns.some(p => device.modelName!.includes(p))) {
                return rule.type;
            }
        }
        // Check parameter name patterns (only if no modelPatterns or modelPatterns didn't match)
        if (rule.paramPatterns && !rule.modelPatterns && device.liveData) {
            if (device.liveData.some(ld => rule.paramPatterns!.some(p => ld.name.toLowerCase().includes(p)))) {
                return rule.type;
            }
        }
    }
    return 'Other';
};


// ────────────────────────────────────────────────────────────────────────────
// 8. EUI (Energy Use Intensity) CONFIGURATION
//    Parameter names that represent cumulative energy consumption.
//    Used to detect "energy devices" in groups and calculate EUI.
//
//    EUI = Total Energy (kWh) / Building Area (m²)
// ────────────────────────────────────────────────────────────────────────────

/** Parameter names (case-insensitive exact match) that hold cumulative energy values */
export const ENERGY_PARAM_NAMES: string[] = [
    'energy_total',
    'energy_total_all',
    'energyTotal',
    'energy',
    'total_energy_all',
    'total_energy',
    'totalEnergy',
    'import_energy_total',
];

/** Check if a device has any energy parameter */
export const getDeviceEnergyParam = (device: DeviceData): DeviceParameterData | undefined => {
    return device.liveData?.find(p =>
        ENERGY_PARAM_NAMES.some(name => p.name.toLowerCase() === name.toLowerCase())
    );
};

/** Check if a device has energy data */
export const hasEnergyData = (device: DeviceData): boolean => {
    return getDeviceEnergyParam(device) !== undefined;
};
