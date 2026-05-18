import React from 'react';
import {
	AlertOutlined,
	AppstoreOutlined,
	ArrowLeftOutlined,
	CheckCircleOutlined,
	ClockCircleOutlined,
	CloudServerOutlined,
	DashboardOutlined,
	DeleteOutlined,
	EditOutlined,
	EnvironmentOutlined,
	FilterOutlined,
	FolderOutlined,
	GatewayOutlined,
	PlusOutlined,
	ReloadOutlined,
	SearchOutlined,
	SettingOutlined,
	WarningOutlined,
} from '@ant-design/icons';
import { Badge, Button, Card, Checkbox, Col, Collapse, ColorPicker, Drawer, Empty, Input, Layout, Popconfirm, Progress, Row, Select, Space, Spin, Statistic, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGatewayData, getSiteById, getTenantById, sites, getStatsFromGateways } from '../hooks/useGatewayData';
import type { LatestPointValue } from '../hooks/useGatewayData';
import type { CloudGateway, CloudSubDevice } from '../data/cloudData';
import { DeviceDetailDrawer } from '../components/DeviceDetailDrawer';
import { DevStatusModal } from '../components/DevStatusModal';
import './RealTimeMonitor.css';

const { Paragraph, Text, Title } = Typography;

const BRAND_COLOR = '#003A70';

/** Format a minute count as a human-friendly relative string */
const fmtAgo = (mins: number): string => {
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
	return `${Math.round(mins / 1440)}d ago`;
};

type GatewayFilter = 'all' | 'online' | 'degraded' | 'offline';

// ── Device Group types & helpers ─────────────────────────

interface DeviceGroup {
	id: string;
	name: string;
	color: string;
	deviceIds: string[];
	collapsed?: boolean;
}

const GROUP_COLORS = ['#003A70', '#52c41a', '#1890ff', '#722ed1', '#eb2f96', '#fa8c16', '#13c2c2', '#2f54eb'];

/** Persist groups per gateway to localStorage */
const GROUPS_STORAGE_KEY = (gatewayId: string) => `tmas_cloud_groups_${gatewayId}`;

const loadGroups = (gatewayId: string): DeviceGroup[] => {
	try {
		const raw = localStorage.getItem(GROUPS_STORAGE_KEY(gatewayId));
		return raw ? (JSON.parse(raw) as DeviceGroup[]) : [];
	} catch { return []; }
};

const saveGroups = (gatewayId: string, groups: DeviceGroup[]): void => {
	try { localStorage.setItem(GROUPS_STORAGE_KEY(gatewayId), JSON.stringify(groups)); } catch { /* ignore */ }
};

const getGatewayTone = (status: CloudGateway['status']) => {
	if (status === 'online') return 'success';
	if (status === 'degraded') return 'warning';
	return 'error';
};

const getGatewayStatusLabel = (status: CloudGateway['status']) => {
	if (status === 'degraded') return 'Degraded';
	return status === 'online' ? 'Online' : 'Offline';
};

// ── Sub-device filter state ──────────────────────────────

interface SubDeviceFilterState {
	status: ('online' | 'offline')[];
	alarm: ('active' | 'normal')[];
	zones: string[];
	types: string[];
}

// ── Filter panel (left sidebar content) ─────────────────

const SubDeviceFilterPanel: React.FC<{
	filters: SubDeviceFilterState;
	onChange: (f: SubDeviceFilterState) => void;
	allZones: string[];
	allTypes: string[];
	zoneCounts: Record<string, number>;
	typeCounts: Record<string, number>;
}> = ({ filters, onChange, allZones, allTypes, zoneCounts, typeCounts }) => (
	<div style={{ padding: '10px 14px' }}>
		<div style={{ marginBottom: 12 }}>
			<Text strong style={{ fontSize: 13 }}>
				<FilterOutlined style={{ marginRight: 6 }} />Filters
			</Text>
		</div>
		<Collapse
			defaultActiveKey={['status', 'alarm']}
			ghost
			expandIconPosition="end"
			size="small"
		>
			<Collapse.Panel header="Status" key="status">
				<Checkbox.Group
					style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
					value={filters.status}
					onChange={(vals) => onChange({ ...filters, status: vals as ('online' | 'offline')[] })}
				>
					<Checkbox value="online"><Badge status="success" text="Online" /></Checkbox>
					<Checkbox value="offline"><Badge status="error" text="Offline" /></Checkbox>
				</Checkbox.Group>
			</Collapse.Panel>

			<Collapse.Panel header="Alarm" key="alarm">
				<Checkbox.Group
					style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
					value={filters.alarm}
					onChange={(vals) => onChange({ ...filters, alarm: vals as ('active' | 'normal')[] })}
				>
					<Checkbox value="active">
						<Text type="danger"><AlertOutlined /> Active Alarm</Text>
					</Checkbox>
					<Checkbox value="normal">
						<Text type="success"><CheckCircleOutlined /> Normal</Text>
					</Checkbox>
				</Checkbox.Group>
			</Collapse.Panel>

			{allZones.length > 0 && (
				<Collapse.Panel header="Zone" key="zone">
					<Checkbox.Group
						style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
						value={filters.zones}
						onChange={(vals) => onChange({ ...filters, zones: vals as string[] })}
					>
						{allZones.map((z) => (
							<Checkbox key={z} value={z}>
								{z || 'Unknown'}
								<Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>({zoneCounts[z] ?? 0})</Text>
							</Checkbox>
						))}
					</Checkbox.Group>
				</Collapse.Panel>
			)}

			{allTypes.length > 0 && (
				<Collapse.Panel header="Device Type" key="type">
					<Checkbox.Group
						style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
						value={filters.types}
						onChange={(vals) => onChange({ ...filters, types: vals as string[] })}
					>
						{allTypes.map((t) => (
							<Checkbox key={t} value={t}>
								{t}
								<Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>({typeCounts[t] ?? 0})</Text>
							</Checkbox>
						))}
					</Checkbox.Group>
				</Collapse.Panel>
			)}
		</Collapse>

		<Button
			type="link"
			size="small"
			style={{ paddingLeft: 2, marginTop: 8 }}
			onClick={() => onChange({ status: [], alarm: [], zones: [], types: [] })}
		>
			Clear All
		</Button>
	</div>
);

// ── Model-4 (occupancy/lux sensor) display formatters ────

function popcount(n: number): number {
	let v = n >>> 0;
	let c = 0;
	while (v) { c += v & 1; v >>>= 1; }
	return c;
}

function formatModel4Value(paramName: string, rawVal: number | string | null): { label: string; unit: string | null } {
	if (rawVal === null || rawVal === undefined) return { label: '—', unit: null };
	const name = String(paramName).toLowerCase();
	const num = Number(rawVal);
	if (name === 'occupancy') {
		return { label: num ? 'Occup' : 'No Occup', unit: null };
	}
	if (name === 'sensitivity') {
		const map: Record<number, string> = { 0: 'Low', 1: 'High', 2: 'Medium' };
		return { label: map[num] ?? String(rawVal), unit: null };
	}
	if (name === 'detection_area') {
		const meters = popcount(num) * 0.5;
		return { label: String(meters), unit: 'm' };
	}
	return { label: String(rawVal), unit: null };
}

// ── Sub-device card ──────────────────────────────────────

const SubDeviceCard: React.FC<{
	device: CloudSubDevice;
	points: LatestPointValue[];
	onClick?: () => void;
}> = React.memo(({ device, points, onClick }) => {
	const isOnline = device.status === 'online';
	const hasAlarm = device.alarm;

	const borderColor = hasAlarm ? '#ff4d4f' : isOnline ? '#52c41a' : '#d9d9d9';

	// Show up to 4 key parameters
	const keyPoints = points.slice(0, 4);

	return (
		<Card
			hoverable
			className="rtm-sub-device-card"
			onClick={onClick}
			style={{
				borderLeft: `4px solid ${borderColor}`,
				opacity: isOnline ? 1 : 0.65,
				borderRadius: 10,
				overflow: 'hidden',
				cursor: onClick ? 'pointer' : 'default',
			}}
			styles={{ body: { padding: '10px 12px', display: 'flex', flexDirection: 'column', height: '100%' } }}
		>
			{/* Header */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
				<div style={{ flex: 1, minWidth: 0 }}>
					<Text strong style={{ fontSize: 13, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
						{device.name}
					</Text>
					<div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
						<Tag
							color={isOnline ? 'success' : 'default'}
							style={{ fontSize: 10, lineHeight: '14px', padding: '0 4px', margin: 0 }}
						>
							{isOnline ? 'Online' : 'Offline'}
						</Tag>
						{device.zone && device.zone !== '—' && (
							<Text type="secondary" style={{ fontSize: 10 }}>
								<EnvironmentOutlined style={{ fontSize: 9 }} /> {device.zone}
							</Text>
						)}
					</div>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
					{hasAlarm && (
						<Tag color="error" style={{ fontSize: 10, lineHeight: '14px', padding: '0 4px', margin: 0 }}>
							<AlertOutlined /> Alarm
						</Tag>
					)}
					<Text type="secondary" style={{ fontSize: 10 }}>{device.type}</Text>
				</div>
			</div>

			{/* Parameter grid */}
			<div style={{ flex: 1, marginBottom: 6 }}>
				{keyPoints.length > 0 ? (
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
						{keyPoints.map((p) => {
							const name = p.parameter_name ?? p.point_name ?? p.param_id ?? '—';
							const val = p.latest_value;
							const isModel4 = device.model === '4';
							const fmt = isModel4 ? formatModel4Value(name, val) : null;
							const displayVal = fmt ? fmt.label : (val ?? '—');
							const displayUnit = fmt ? fmt.unit : p.unit;
							return (
								<div
									key={p.point_id}
									style={{
										background: '#fafafa',
										borderRadius: 6,
										padding: '4px 6px',
										border: '1px solid #f0f0f0',
									}}
								>
									<Text type="secondary" style={{ fontSize: 10, display: 'block', lineHeight: 1.2 }}>
										{name}
									</Text>
									<Text
										strong
										style={{ fontSize: 14, color: val !== null ? BRAND_COLOR : '#d9d9d9', lineHeight: 1.3 }}
									>
										{displayVal}
										{val !== null && displayUnit ? (
											<span style={{ fontSize: 10, fontWeight: 400, color: '#8c8c8c', marginLeft: 2 }}>{displayUnit}</span>
										) : null}
									</Text>
								</div>
							);
						})}
					</div>
				) : (
					<div style={{ textAlign: 'center', padding: '12px 0', color: '#d9d9d9' }}>
						<Text type="secondary" style={{ fontSize: 11 }}>No parameters</Text>
					</div>
				)}
			</div>

			{/* Footer */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #f0f0f0', marginTop: 'auto' }}>
				<Text type="secondary" style={{ fontSize: 10 }}>
					<ClockCircleOutlined style={{ marginRight: 3 }} />
					{fmtAgo(device.lastSeenMinutes)}
				</Text>
				{points.length > 4 && (
					<Text type="secondary" style={{ fontSize: 10 }}>+{points.length - 4} more</Text>
				)}
			</div>
		</Card>
	);
});

// ── Summary strip ────────────────────────────────────────

const SummaryStrip: React.FC<{
	devices: CloudSubDevice[];
	gateway: CloudGateway;
}> = ({ devices, gateway }) => {
	const online = devices.filter((d) => d.status === 'online').length;
	const offline = devices.length - online;
	const alarms = devices.filter((d) => d.alarm).length;

	const items: { label: string; value: React.ReactNode; color?: string }[] = [
		{ label: 'Devices', value: devices.length },
		{ label: 'Online', value: online, color: '#52c41a' },
		{ label: 'Offline', value: offline, color: offline > 0 ? '#ff4d4f' : '#94a3b8' },
		{ label: 'Alarms', value: alarms, color: alarms > 0 ? '#ff4d4f' : '#52c41a' },
		{ label: 'Health', value: `${gateway.healthScore}%`, color: gateway.healthScore > 80 ? '#0f766e' : '#d97706' },
		{
			label: 'Last Seen',
			value: fmtAgo(gateway.lastSeenMinutes),
			color: gateway.lastSeenMinutes < 5 ? '#52c41a' : '#94a3b8',
		},
	];

	return (
		<div className="rtm-summary-strip">
			{items.map((item, i) => (
				<div key={i} className="rtm-summary-item">
					<span className="rtm-summary-label">{item.label}</span>
					<span className="rtm-summary-value" style={item.color ? { color: item.color } : undefined}>
						{item.value}
					</span>
				</div>
			))}
		</div>
	);
};

// ── Group Manager Drawer ─────────────────────────────────

const GroupManagerDrawer: React.FC<{
	open: boolean;
	onClose: () => void;
	groups: DeviceGroup[];
	onGroupsChange: (groups: DeviceGroup[]) => void;
	devices: CloudSubDevice[];
}> = ({ open, onClose, groups, onGroupsChange, devices }) => {
	const [newGroupName, setNewGroupName] = useState('');
	const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState('');

	const [localGroups, setLocalGroups] = useState<DeviceGroup[]>(groups);
	const dirtyRef = useRef(false);

	useEffect(() => {
		if (!dirtyRef.current) setLocalGroups(groups);
	}, [groups]);

	useEffect(() => {
		if (open) { setLocalGroups(groups); dirtyRef.current = false; }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const flushToParent = useCallback((updated: DeviceGroup[]) => {
		dirtyRef.current = false;
		onGroupsChange(updated);
	}, [onGroupsChange]);

	const handleClose = useCallback(() => {
		if (dirtyRef.current) flushToParent(localGroups);
		onClose();
	}, [localGroups, flushToParent, onClose]);

	const handleAddGroup = () => {
		const name = newGroupName.trim();
		if (!name) { message.warning('Please enter a group name'); return; }
		if (localGroups.some(g => g.name === name)) { message.warning('Group name already exists'); return; }
		const colorIdx = localGroups.length % GROUP_COLORS.length;
		const newGroup: DeviceGroup = { id: `grp_${Date.now()}`, name, color: GROUP_COLORS[colorIdx], deviceIds: [] };
		const updated = [...localGroups, newGroup];
		setLocalGroups(updated);
		flushToParent(updated);
		setNewGroupName('');
		message.success(`Group "${name}" created`);
	};

	const handleDeleteGroup = (id: string) => {
		const updated = localGroups.filter(g => g.id !== id);
		setLocalGroups(updated);
		flushToParent(updated);
	};

	const handleRename = (id: string) => {
		const name = editingName.trim();
		if (!name) return;
		if (localGroups.some(g => g.id !== id && g.name === name)) { message.warning('Name already exists'); return; }
		const updated = localGroups.map(g => g.id === id ? { ...g, name } : g);
		setLocalGroups(updated);
		flushToParent(updated);
		setEditingGroupId(null);
	};

	const handleColorChange = (id: string, color: string) => {
		const updated = localGroups.map(g => g.id === id ? { ...g, color } : g);
		setLocalGroups(updated);
		flushToParent(updated);
	};

	const handleToggleDevice = (groupId: string, deviceId: string) => {
		dirtyRef.current = true;
		setLocalGroups(prev => prev.map(g => {
			if (g.id !== groupId) {
				return { ...g, deviceIds: g.deviceIds.filter(did => did !== deviceId) };
			}
			const has = g.deviceIds.includes(deviceId);
			return { ...g, deviceIds: has ? g.deviceIds.filter(did => did !== deviceId) : [...g.deviceIds, deviceId] };
		}));
	};

	const getDeviceGroupId = (deviceId: string): string | null => {
		const g = localGroups.find(g => g.deviceIds.includes(deviceId));
		return g?.id ?? null;
	};

	return (
		<Drawer
			title={<span><SettingOutlined /> Manage Device Groups</span>}
			placement="right"
			width={460}
			onClose={handleClose}
			open={open}
			styles={{ body: { padding: '16px 20px' } }}
		>
			{/* Create new group */}
			<div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
				<Input
					placeholder="New group name..."
					value={newGroupName}
					onChange={e => setNewGroupName(e.target.value)}
					onPressEnter={handleAddGroup}
					style={{ flex: 1 }}
				/>
				<Button
					type="primary"
					icon={<PlusOutlined />}
					onClick={handleAddGroup}
					disabled={!newGroupName.trim()}
					style={newGroupName.trim() ? { background: BRAND_COLOR, borderColor: BRAND_COLOR } : {}}
				>
					Add
				</Button>
			</div>

			{localGroups.length === 0 ? (
				<Empty description="No groups yet. Create one above." image={Empty.PRESENTED_IMAGE_SIMPLE} />
			) : (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
					{localGroups.map(group => {
						const assignedCount = group.deviceIds.filter(id => devices.some(d => d.id === id)).length;
						return (
							<Card
								key={group.id}
								size="small"
								style={{ borderLeft: `4px solid ${group.color}`, borderRadius: 8 }}
								styles={{ body: { padding: '12px 16px' } }}
							>
								{/* Header */}
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
									{editingGroupId === group.id ? (
										<Input
											size="small"
											value={editingName}
											onChange={e => setEditingName(e.target.value)}
											onPressEnter={() => handleRename(group.id)}
											onBlur={() => handleRename(group.id)}
											style={{ width: 180 }}
											autoFocus
										/>
									) : (
										<Space size={8}>
											<FolderOutlined style={{ color: group.color }} />
											<Text strong style={{ fontSize: 14 }}>{group.name}</Text>
											<Tag>{assignedCount} devices</Tag>
										</Space>
									)}
									<Space size={4}>
										<ColorPicker
											size="small"
											value={group.color}
											presets={[{ label: 'Theme', colors: GROUP_COLORS }]}
											onChange={(_, hex) => handleColorChange(group.id, hex)}
										/>
										<Button
											size="small"
											type="text"
											icon={<EditOutlined />}
											onClick={() => { setEditingGroupId(group.id); setEditingName(group.name); }}
										/>
										<Popconfirm
											title="Delete this group?"
											description="Devices will be moved to Ungrouped."
											onConfirm={() => handleDeleteGroup(group.id)}
											okText="Delete"
											cancelText="Cancel"
										>
											<Button size="small" type="text" danger icon={<DeleteOutlined />} />
										</Popconfirm>
									</Space>
								</div>

								{/* Device assignment */}
								<div style={{ maxHeight: 200, overflowY: 'auto' }}>
									{devices.map(d => {
										const currentGroup = getDeviceGroupId(d.id);
										const isInThis = currentGroup === group.id;
										const isInOther = currentGroup !== null && currentGroup !== group.id;
										const otherGroupName = isInOther ? localGroups.find(g => g.id === currentGroup)?.name : null;
										return (
											<div
												key={d.id}
												style={{
													display: 'flex', alignItems: 'center', justifyContent: 'space-between',
													padding: '4px 8px', borderRadius: 6, marginBottom: 2, cursor: 'pointer',
													background: isInThis ? `${group.color}15` : 'transparent',
													opacity: isInOther ? 0.5 : 1,
												}}
												onClick={() => handleToggleDevice(group.id, d.id)}
											>
												<Space size={6}>
													<Checkbox checked={isInThis} />
													<Text style={{ fontSize: 12 }}>{d.name}</Text>
													<Text type="secondary" style={{ fontSize: 10 }}>{d.type}</Text>
												</Space>
												{isInOther && (
													<Text type="secondary" style={{ fontSize: 10 }}>in {otherGroupName}</Text>
												)}
											</div>
										);
									})}
								</div>
							</Card>
						);
					})}
				</div>
			)}
		</Drawer>
	);
};

// ── Grouped device card view ─────────────────────────────

const GroupedView: React.FC<{
	filteredDevices: CloudSubDevice[];
	deviceGroups: DeviceGroup[];
	toggleGroupCollapse: (groupId: string) => void;
	pointsByDevice: Map<number, LatestPointValue[]>;
	onDeviceClick: (device: CloudSubDevice) => void;
}> = React.memo(({ filteredDevices, deviceGroups, toggleGroupCollapse, pointsByDevice, onDeviceClick }) => {
	const assignedIds = React.useMemo(
		() => new Set(deviceGroups.flatMap(g => g.deviceIds)),
		[deviceGroups],
	);
	const ungroupedDevices = React.useMemo(
		() => filteredDevices.filter(d => !assignedIds.has(d.id)),
		[filteredDevices, assignedIds],
	);
	const groupEntries = React.useMemo(() =>
		deviceGroups.map(group => {
			const groupDevices = filteredDevices.filter(d => group.deviceIds.includes(d.id));
			const online = groupDevices.filter(d => d.status === 'online').length;
			return { group, groupDevices, online };
		}).filter(e => e.groupDevices.length > 0),
	[deviceGroups, filteredDevices]);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			{groupEntries.map(({ group, groupDevices, online }) => (
				<div
					key={group.id}
					className={`rtm-group-section${group.collapsed ? ' rtm-group-collapsed' : ''}`}
				>
					<div
						className="rtm-group-header"
						style={{ borderLeft: `4px solid ${group.color}` }}
						onClick={() => toggleGroupCollapse(group.id)}
					>
						<Space size={8}>
							<FolderOutlined style={{ color: group.color, fontSize: 16 }} />
							<Text strong style={{ fontSize: 14 }}>{group.name}</Text>
							<Tag style={{ background: `${group.color}15`, color: group.color, border: `1px solid ${group.color}30`, fontSize: 11 }}>
								{groupDevices.length} devices
							</Tag>
							<Tag color={online === groupDevices.length ? 'success' : online > 0 ? 'warning' : 'error'} style={{ fontSize: 11 }}>
								{online}/{groupDevices.length} online
							</Tag>
						</Space>
						<span style={{ fontSize: 18, color: '#bbb', lineHeight: 1, transition: 'transform 0.2s', transform: group.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>
							▾
						</span>
					</div>
					{!group.collapsed && (
						<div className="rtm-card-grid" style={{ padding: '12px 0 4px' }}>
							{groupDevices.map(device => (
								<SubDeviceCard
									key={device.id}
									device={device}
									points={pointsByDevice.get(Number(device.id)) ?? []}
									onClick={() => onDeviceClick(device)}
								/>
							))}
						</div>
					)}
				</div>
			))}
			{ungroupedDevices.length > 0 && (
				<div className="rtm-group-section">
					<div className="rtm-group-header" style={{ borderLeft: '4px solid #d9d9d9' }}>
						<Space size={8}>
							<AppstoreOutlined style={{ color: '#8c8c8c', fontSize: 16 }} />
							<Text strong style={{ fontSize: 14, color: '#8c8c8c' }}>Ungrouped</Text>
							<Tag style={{ fontSize: 11 }}>{ungroupedDevices.length} devices</Tag>
						</Space>
					</div>
					<div className="rtm-card-grid" style={{ padding: '12px 0 4px' }}>
						{ungroupedDevices.map(device => (
							<SubDeviceCard
								key={device.id}
								device={device}
								points={pointsByDevice.get(Number(device.id)) ?? []}
								onClick={() => onDeviceClick(device)}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
});

// ── Gateway Detail View (filter sidebar + device cards) ────────────

const GatewayDetailView: React.FC<{
	gateway: CloudGateway;
	pointsByDevice: Map<number, LatestPointValue[]>;
	search: string;
	onSearchChange: (v: string) => void;
	onBack: () => void;
	onRefresh: () => void;
}> = ({ gateway, pointsByDevice, search, onSearchChange, onBack, onRefresh }) => {
	const query = search.trim().toLowerCase();

	// Build unique zone & type lists
	const allZones = React.useMemo(
		() => [...new Set(gateway.subDevices.map((d) => d.zone))].filter(Boolean).sort(),
		[gateway.subDevices],
	);
	const allTypes = React.useMemo(
		() => [...new Set(gateway.subDevices.map((d) => d.type))].filter(Boolean).sort(),
		[gateway.subDevices],
	);
	const zoneCounts = React.useMemo(() => {
		const m: Record<string, number> = {};
		gateway.subDevices.forEach((d) => { m[d.zone] = (m[d.zone] ?? 0) + 1; });
		return m;
	}, [gateway.subDevices]);
	const typeCounts = React.useMemo(() => {
		const m: Record<string, number> = {};
		gateway.subDevices.forEach((d) => { m[d.type] = (m[d.type] ?? 0) + 1; });
		return m;
	}, [gateway.subDevices]);

	const [filters, setFilters] = React.useState<SubDeviceFilterState>({
		status: [], alarm: [], zones: [], types: [],
	});

	const filteredDevices = React.useMemo(() => {
		return gateway.subDevices.filter((device) => {
			// Status filter
			if (filters.status.length > 0 && !filters.status.includes(device.status)) return false;
			// Alarm filter
			if (filters.alarm.length > 0) {
				const wantActive = filters.alarm.includes('active');
				const wantNormal = filters.alarm.includes('normal');
				if (wantActive && !wantNormal && !device.alarm) return false;
				if (wantNormal && !wantActive && device.alarm) return false;
			}
			// Zone filter
			if (filters.zones.length > 0 && !filters.zones.includes(device.zone)) return false;
			// Type filter
			if (filters.types.length > 0 && !filters.types.includes(device.type)) return false;
			// Search
			if (query.length > 0) {
				const matchDevice =
					device.name.toLowerCase().includes(query) ||
					device.type.toLowerCase().includes(query) ||
					device.zone.toLowerCase().includes(query);
				if (matchDevice) return true;
				const points = pointsByDevice.get(Number(device.id)) ?? [];
				return points.some(
					(p) =>
						(p.param_id ?? '').toLowerCase().includes(query) ||
						(p.parameter_name ?? p.point_name ?? '').toLowerCase().includes(query),
				);
			}
			return true;
		});
	}, [gateway.subDevices, filters, query, pointsByDevice]);

	const activeFilterCount =
		filters.status.length + filters.alarm.length + filters.zones.length + filters.types.length;

	// ── Groups state (localStorage-persisted per gateway) ──
	const [deviceGroups, setDeviceGroups] = React.useState<DeviceGroup[]>(() => loadGroups(gateway.id));
	const [groupManagerOpen, setGroupManagerOpen] = React.useState(false);
	const [viewMode, setViewMode] = React.useState<'flat' | 'grouped'>('flat');

	// ── Device detail drawer state ──
	const [selectedDevice, setSelectedDevice] = useState<CloudSubDevice | null>(null);

	const handleGroupsChange = useCallback((updated: DeviceGroup[]) => {
		setDeviceGroups(updated);
		saveGroups(gateway.id, updated);
	}, [gateway.id]);

	const toggleGroupCollapse = useCallback((groupId: string) => {
		setDeviceGroups(prev => {
			const updated = prev.map(g => g.id === groupId ? { ...g, collapsed: !g.collapsed } : g);
			saveGroups(gateway.id, updated);
			return updated;
		});
	}, [gateway.id]);

	return (
		<div className="rtm-detail-page">
			{/* Sticky Header */}
			<div className="rtm-detail-header">
				<div className="rtm-detail-header-left">
					<Button icon={<ArrowLeftOutlined />} type="text" onClick={onBack}>
						Fleet
					</Button>
					<div className="rtm-detail-header-title">
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<Text strong style={{ fontSize: 16 }}>{gateway.name}</Text>
							<Tag
								color={gateway.status === 'online' ? 'success' : gateway.status === 'degraded' ? 'warning' : 'error'}
								style={{ margin: 0 }}
							>
								{gateway.status === 'online' ? 'Online' : gateway.status === 'degraded' ? 'Degraded' : 'Offline'}
							</Tag>
							{gateway.status === 'online' && (
								<Badge status="processing" text={<Text type="secondary" style={{ fontSize: 11 }}>MQTT</Text>} />
							)}
						</div>
						<Text type="secondary" style={{ fontSize: 11 }}>
							{gateway.protocol} · SN: {gateway.model} · {gateway.ipAddress}
						</Text>
					</div>
				</div>
				<div className="rtm-detail-header-right">
					<Input
						prefix={<SearchOutlined />}
						placeholder="Search device, parameter..."
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						allowClear
						style={{ width: 260 }}
					/>
					<Button
						icon={<FolderOutlined />}
						onClick={() => setGroupManagerOpen(true)}
					>
						Groups{deviceGroups.length > 0 && ` (${deviceGroups.length})`}
					</Button>
					{deviceGroups.length > 0 && (
						<Button
							icon={viewMode === 'grouped' ? <AppstoreOutlined /> : <FolderOutlined />}
							onClick={() => setViewMode(v => v === 'flat' ? 'grouped' : 'flat')}
						>
							{viewMode === 'grouped' ? 'Flat View' : 'Grouped View'}
						</Button>
					)}
					<Button icon={<ReloadOutlined />} onClick={onRefresh}>Refresh</Button>
				</div>
			</div>

			{/* Summary Strip */}
			<SummaryStrip devices={gateway.subDevices} gateway={gateway} />

			{/* Main content: filter sidebar + card grid */}
			<Layout style={{ flex: 1, overflow: 'hidden', background: 'transparent' }}>
				{/* Left filter sidebar */}
				<Layout.Sider
					width={220}
					style={{
						background: '#fff',
						borderRight: '1px solid #f0f0f0',
						overflow: 'auto',
						flexShrink: 0,
					}}
				>
					<SubDeviceFilterPanel
						filters={filters}
						onChange={setFilters}
						allZones={allZones}
						allTypes={allTypes}
						zoneCounts={zoneCounts}
						typeCounts={typeCounts}
					/>
				</Layout.Sider>

				{/* Right: device cards */}
				<Layout.Content style={{ overflow: 'auto', padding: '14px 16px' }}>
					<div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<Text type="secondary" style={{ fontSize: 12 }}>
							{filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''}
							{activeFilterCount > 0 && (
								<Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</Tag>
							)}
						</Text>
					</div>

					{filteredDevices.length === 0 ? (
						<Empty description={query || activeFilterCount > 0 ? 'No devices match the current filters' : 'No devices'} style={{ marginTop: 40 }} />
					) : viewMode === 'grouped' && deviceGroups.length > 0 ? (
						<GroupedView
							filteredDevices={filteredDevices}
							deviceGroups={deviceGroups}
							toggleGroupCollapse={toggleGroupCollapse}
							pointsByDevice={pointsByDevice}
						onDeviceClick={setSelectedDevice}
						/>
					) : (
						<div className="rtm-card-grid">
							{filteredDevices.map((device) => (
								<SubDeviceCard
									key={device.id}
									device={device}
									points={pointsByDevice.get(Number(device.id)) ?? []}
									onClick={() => setSelectedDevice(device)}
								/>
							))}
						</div>
					)}
				</Layout.Content>
			</Layout>

			{/* Group Manager Drawer */}
			<GroupManagerDrawer
				open={groupManagerOpen}
				onClose={() => setGroupManagerOpen(false)}
				groups={deviceGroups}
				onGroupsChange={handleGroupsChange}
				devices={gateway.subDevices}
			/>

			{/* Device Detail Drawer */}
			<DeviceDetailDrawer
				open={selectedDevice !== null}
				device={selectedDevice}
				points={selectedDevice ? (pointsByDevice.get(Number(selectedDevice.id)) ?? []) : []}
				allDevices={filteredDevices}
				pointsByDevice={pointsByDevice}
				onClose={() => setSelectedDevice(null)}
				onNavigate={(d) => setSelectedDevice(d)}
			/>
		</div>
	);
};

const RealTimeMonitor: React.FC = () => {
	const navigate = useNavigate();
	const { gatewayId } = useParams<{ gatewayId: string }>();
	const { gateways: cloudGateways, pointsByDevice, loading, refresh } = useGatewayData();
	const stats = React.useMemo(() => getStatsFromGateways(cloudGateways), [cloudGateways]);

	// Fleet-level state
	const [search, setSearch] = React.useState('');
	const [siteId, setSiteId] = React.useState<string>('all');
	const [statusFilter, setStatusFilter] = React.useState<GatewayFilter>('all');

	// Detail-level state
	const [detailSearch, setDetailSearch] = React.useState('');

	const filteredGateways = React.useMemo(() => {
		const query = search.trim().toLowerCase();

		return cloudGateways.filter((gateway) => {
			const matchesSite = siteId === 'all' || gateway.siteId === siteId;
			const matchesStatus = statusFilter === 'all' || gateway.status === statusFilter;
			const matchesQuery =
				query.length === 0 ||
				gateway.name.toLowerCase().includes(query) ||
				gateway.ipAddress.toLowerCase().includes(query) ||
				getSiteById(gateway.siteId)?.name.toLowerCase().includes(query) ||
				gateway.subDevices.some((device) => device.name.toLowerCase().includes(query));

			return matchesSite && matchesStatus && matchesQuery;
		});
	}, [cloudGateways, search, siteId, statusFilter]);

	const selectedGateway = React.useMemo(() => {
		if (!gatewayId) return null;
		return cloudGateways.find((gateway) => gateway.id === gatewayId) ?? null;
	}, [cloudGateways, gatewayId]);

	// Reset detail search when navigating to a new gateway
	React.useEffect(() => {
		setDetailSearch('');
	}, [gatewayId]);

	if (loading) {
		return (
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
				<Spin size="large" />
			</div>
		);
	}

	if (gatewayId && !selectedGateway) {
		return (
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
				<Empty description="Gateway not found">
					<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/realtime')}>
						Back to Gateway Fleet
					</Button>
				</Empty>
			</div>
		);
	}

	if (selectedGateway) {
		return (
			<GatewayDetailView
				gateway={selectedGateway}
				pointsByDevice={pointsByDevice}
				search={detailSearch}
				onSearchChange={setDetailSearch}
				onBack={() => navigate('/realtime')}
				onRefresh={refresh}
			/>
		);
	}

	return (
		<div className="gateway-monitoring-page">
			<DevStatusModal
				title="Monitor & Control — Gateway Monitoring"
				storageKey="dev_status_rtm"
				items={[
					{ label: 'Real-Time Monitoring', status: 'live', note: 'Live device data and parameter values' },
					{ label: 'Device Grouping', status: 'live', note: 'Group View available' },
					{ label: 'Parameter Write / Control', status: 'live', note: 'MQTT config-write with ACK confirmation implemented' },
					{ label: 'UI', status: 'partial', note: 'UI is still being optimized' },
				]}
			/>
			<div className="gateway-monitoring-hero">
				<div className="gateway-monitoring-title-row">
					<Title level={2}>Gateway Monitoring</Title>
					<Space wrap>
						<Button className="monitoring-action-button" icon={<ReloadOutlined />} onClick={refresh}>Refresh Fleet</Button>
						<Tag color="geekblue">{stats.totalSites} school sites</Tag>
					</Space>
				</div>
				<Paragraph className="gateway-monitoring-subtitle">
					Start with gateway fleet health, then drill into each gateway&apos;s sub-devices instead of flattening the entire campus into one device list.
				</Paragraph>
			</div>

			<div className="gateway-monitoring-kpi-grid">
				<Card className="gateway-monitoring-kpi gateway-monitoring-kpi-navy" bordered={false}>
					<Statistic title="Total Gateways" value={stats.totalGateways} prefix={<GatewayOutlined />} />
				</Card>
				<Card className="gateway-monitoring-kpi gateway-monitoring-kpi-green" bordered={false}>
					<Statistic title="Online Gateways" value={stats.onlineGateways} prefix={<CloudServerOutlined />} />
				</Card>
				<Card className="gateway-monitoring-kpi gateway-monitoring-kpi-amber" bordered={false}>
					<Statistic title="Degraded Gateways" value={stats.degradedGateways} prefix={<WarningOutlined />} />
				</Card>
				<Card className="gateway-monitoring-kpi gateway-monitoring-kpi-red" bordered={false}>
					<Statistic title="Active Alarms" value={stats.activeAlarms} prefix={<AlertOutlined />} />
				</Card>
				<Card className="gateway-monitoring-kpi gateway-monitoring-kpi-blue" bordered={false}>
					<Statistic title="Managed Sub-devices" value={stats.totalSubDevices} prefix={<DashboardOutlined />} />
				</Card>
			</div>

			<Row gutter={[16, 16]}>
				<Col xs={24}>
					<Card className="gateway-monitoring-card" bordered={false}>
						<div className="gateway-monitoring-card-header">
							<div>
								<Title level={3}>Gateway Fleet</Title>
							</div>
							<Tag color="blue">{filteredGateways.length} visible</Tag>
						</div>

						<div className="gateway-monitoring-filters">
							<Input
								allowClear
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								prefix={<SearchOutlined />}
								placeholder="Search gateway, IP, site, or sub-device"
							/>
							<Select
								value={siteId}
								onChange={setSiteId}
								options={[{ value: 'all', label: 'All sites' }, ...sites.map((site) => ({ value: site.id, label: site.name }))]}
							/>
							<Select
								value={statusFilter}
								onChange={(value) => setStatusFilter(value as GatewayFilter)}
								options={[
									{ value: 'all', label: 'All statuses' },
									{ value: 'online', label: 'Online' },
									{ value: 'degraded', label: 'Degraded' },
									{ value: 'offline', label: 'Offline' },
								]}
							/>
						</div>

						<div className="gateway-monitoring-list">
							{filteredGateways.length === 0 ? (
								<Empty description="No gateways match the current filters" />
							) : (
								filteredGateways.map((gateway) => {
									const site = getSiteById(gateway.siteId);
									const tenant = getTenantById(gateway.tenantId);
									const alarmCount = gateway.subDevices.filter((device) => device.alarm).length;

									return (
										<button
											key={gateway.id}
											type="button"
											className="gateway-monitoring-list-item"
											onClick={() => navigate(`/realtime/${gateway.id}`)}
										>
											<div className="gateway-monitoring-list-top">
												<div>
													<div className="gateway-monitoring-gateway-name">{gateway.name}</div>
													<div className="gateway-monitoring-gateway-meta">
														<EnvironmentOutlined />
														<span>{site?.name}</span>
														{tenant && (tenant as { name?: string }).name && <span>{(tenant as { name?: string }).name}</span>}
													</div>
												</div>
												<Tag color={getGatewayTone(gateway.status)}>{getGatewayStatusLabel(gateway.status)}</Tag>
											</div>

											<div className="gateway-monitoring-gateway-stats">
												<span>{gateway.subDevices.length} sub-devices</span>
												<span>{alarmCount} alarms</span>
												<span>{gateway.protocol}</span>
											</div>

											<div className="gateway-monitoring-health-row">
												<Text type="secondary">Gateway health</Text>
												<Text strong>{gateway.healthScore}%</Text>
											</div>
											<Progress percent={gateway.healthScore} showInfo={false} strokeColor={gateway.healthScore > 90 ? '#0f766e' : gateway.healthScore > 75 ? '#d97706' : '#dc2626'} />

											<div className="gateway-monitoring-footer-row">
												<Text type="secondary">{gateway.ipAddress}</Text>
												<Space>
													<Text type="secondary">Last seen {fmtAgo(gateway.lastSeenMinutes)}</Text>
													<Tag color="processing">Open Detail</Tag>
												</Space>
											</div>
										</button>
									);
								})
							)}
						</div>
					</Card>
				</Col>
			</Row>
		</div>
	);
};

export default RealTimeMonitor;
