import React, { useEffect, useState } from 'react';
import {
	AlertOutlined,
	ArrowLeftOutlined,
	ArrowRightOutlined,
	CheckCircleOutlined,
	ClockCircleOutlined,
	CloseOutlined,
	EditOutlined,
	LockOutlined,
	WifiOutlined,
} from '@ant-design/icons';
import {
	Badge,
	Button,
	Descriptions,
	Divider,
	Drawer,
	Empty,
	Form,
	InputNumber,
	message,
	Modal,
	Space,
	Tag,
	Tooltip,
	Typography,
} from 'antd';
import { sendConfigToGateway } from '../services/api';
import type { CloudSubDevice } from '../data/cloudData';
import type { LatestPointValue } from '../hooks/useGatewayData';

const { Text, Title } = Typography;

const BRAND_COLOR = '#003A70';

function fmtTimestamp(ts: string | null): string {
	if (!ts) return '—';
	const d = new Date(ts);
	return d.toLocaleString();
}

function fmtAgo(ts: string | null): string {
	if (!ts) return '—';
	const diff = Date.now() - new Date(ts).getTime();
	const s = Math.floor(diff / 1000);
	if (s < 60) return 'just now';
	if (s < 3600) return `${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
	return `${Math.floor(s / 86400)}d ago`;
}

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

function formatValue(row: LatestPointValue, isModel4 = false): string {
	const v = row.latest_value;
	if (v === null || v === undefined) return '—';
	if (isModel4) {
		const name = row.parameter_name ?? row.point_name ?? row.param_id ?? '';
		const fmt = formatModel4Value(name, v);
		return fmt.unit ? `${fmt.label} ${fmt.unit}` : fmt.label;
	}
	const unit = row.unit ? ` ${row.unit}` : '';
	return `${v}${unit}`;
}

function limitBadge(row: LatestPointValue): 'normal' | 'error' {
	const v = parseFloat(row.latest_value ?? '');
	if (isNaN(v)) return 'normal';
	if (row.upper_limit !== null && v > row.upper_limit) return 'error';
	if (row.lower_limit !== null && v < row.lower_limit) return 'error';
	return 'normal';
}

// ── Write modal ──────────────────────────────────────────

const WriteParamModal: React.FC<{
	open: boolean;
	point: LatestPointValue | null;
	device: CloudSubDevice;
	onClose: () => void;
}> = ({ open, point, device, onClose }) => {
	const [form] = Form.useForm();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (open) { form.resetFields(); }
	}, [open, form]);

	if (!point) return null;

	const paramName = point.parameter_name ?? point.point_name ?? point.param_id ?? '—';

	const handleConfirm = async () => {
		try {
			const values = await form.validateFields();
			const gatewaySn = device.gatewaySn;
			const devId = device.externalDeviceId;
			const paramId = point.param_id;

			if (!gatewaySn || !devId || !paramId) {
				message.error('Missing device or gateway information');
				return;
			}

			setLoading(true);
			const result = await sendConfigToGateway({
				gatewaySn,
				devId: Number(devId),
				paramId: Number(paramId),
				value: Number(values.value),
				duration: Number(values.duration),
			});

			if (result.success) {
				message.success(`"${paramName}" confirmed by gateway (error: ${result.error})`);
				onClose();
			} else {
				message.error(`Gateway rejected write — error code: ${result.error}`);
			}
		} catch (e) {
			if ((e as { errorFields?: unknown }).errorFields) return;
			message.error((e as Error).message ?? 'Request failed');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal
			open={open}
			title={
				<div>
					<EditOutlined style={{ marginRight: 8, color: BRAND_COLOR }} />
					Write Parameter
					<div style={{ fontSize: 12, fontWeight: 400, color: '#595959', marginTop: 2 }}>
						{device.name} · {paramName} ({point.param_id})
					</div>
				</div>
			}
			onCancel={loading ? undefined : onClose}
			closable={!loading}
			maskClosable={!loading}
			onOk={handleConfirm}
			okText={loading ? 'Waiting for ACK…' : 'Confirm Write'}
			okButtonProps={{ loading, style: { background: BRAND_COLOR, borderColor: BRAND_COLOR } }}
			width={380}
		>
			<div style={{ marginBottom: 16, padding: '8px 12px', background: '#fffbe6', borderRadius: 6, border: '1px solid #ffe58f', fontSize: 12 }}>
				Current value: <strong>{formatValue(point)}</strong>
				{point.unit && <span style={{ color: '#8c8c8c' }}> {point.unit}</span>}
				{point.upper_limit !== null && <span style={{ color: '#8c8c8c', marginLeft: 8 }}>Max: {point.upper_limit}</span>}
				{point.lower_limit !== null && <span style={{ color: '#8c8c8c', marginLeft: 8 }}>Min: {point.lower_limit}</span>}
			</div>
			<Form form={form} layout="vertical" size="middle">
				<Form.Item
					name="value"
					label="New Value"
					rules={[{ required: true, message: 'Please enter a value' }]}
				>
					<InputNumber
						style={{ width: '100%' }}
						placeholder="Enter new value"
						addonAfter={point.unit || undefined}
					/>
				</Form.Item>
				<Form.Item
					name="duration"
					label="Force Duration (seconds)"
					tooltip="How long to hold this value before the device reverts to auto. Use 0 for permanent."
					rules={[{ required: true, message: 'Please enter duration' }]}
					initialValue={0}
				>
					<InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 60" addonAfter="s" />
				</Form.Item>
			</Form>
		</Modal>
	);
};

// ── Device Detail Drawer ─────────────────────────────────

interface DeviceDetailDrawerProps {
	open: boolean;
	device: CloudSubDevice | null;
	points: LatestPointValue[];
	allDevices: CloudSubDevice[];
	pointsByDevice: Map<number, LatestPointValue[]>;
	onClose: () => void;
	onNavigate: (device: CloudSubDevice) => void;
}

export const DeviceDetailDrawer: React.FC<DeviceDetailDrawerProps> = ({
	open,
	device,
	points,
	allDevices,
	onClose,
	onNavigate,
}) => {
	const [writePoint, setWritePoint] = useState<LatestPointValue | null>(null);

	useEffect(() => {
		setWritePoint(null);
	}, [device?.id]);

	if (!device) return null;

	const isOnline = device.status === 'online';
	const hasAlarm = device.alarm;
	const borderColor = hasAlarm ? '#ff4d4f' : isOnline ? '#52c41a' : '#d9d9d9';
	const isModel4 = device.model === '4';

	const currentIdx = allDevices.findIndex((d) => d.id === device.id);
	const prevDevice = currentIdx > 0 ? allDevices[currentIdx - 1] : null;
	const nextDevice = currentIdx < allDevices.length - 1 ? allDevices[currentIdx + 1] : null;

	return (
		<>
			<Drawer
				open={open}
				onClose={onClose}
				width={520}
				placement="right"
				closable={false}
				styles={{
					body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
					header: { display: 'none' },
				}}
			>
				{/* ── Custom header ── */}
				<div style={{
					borderLeft: `5px solid ${borderColor}`,
					background: '#fff',
					padding: '14px 20px',
					borderBottom: '1px solid #f0f0f0',
					flexShrink: 0,
				}}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
						<div style={{ flex: 1, minWidth: 0 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
								<Title level={5} style={{ margin: 0 }}>{device.name}</Title>
								<Tag
									color={isOnline ? 'success' : 'default'}
									icon={isOnline ? <WifiOutlined /> : undefined}
									style={{ margin: 0 }}
								>
									{isOnline ? 'Online' : 'Offline'}
								</Tag>
								{hasAlarm && (
									<Tag color="error" icon={<AlertOutlined />} style={{ margin: 0 }}>Alarm</Tag>
								)}
							</div>
							<Space size={6} style={{ marginTop: 4 }}>
								<Text type="secondary" style={{ fontSize: 11 }}>{device.type}</Text>
								{device.zone && device.zone !== '—' && (
									<Text type="secondary" style={{ fontSize: 11 }}>· {device.zone}</Text>
								)}
							</Space>
						</div>
						<Button
							type="text"
							icon={<CloseOutlined />}
							onClick={onClose}
							size="small"
						/>
					</div>

					{/* Prev / Next device navigation */}
					<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
						<Button
							size="small"
							type="text"
							icon={<ArrowLeftOutlined />}
							disabled={!prevDevice}
							onClick={() => prevDevice && onNavigate(prevDevice)}
						>
							{prevDevice?.name ?? ''}
						</Button>
						<Button
							size="small"
							type="text"
							iconPosition="end"
							icon={<ArrowRightOutlined />}
							disabled={!nextDevice}
							onClick={() => nextDevice && onNavigate(nextDevice)}
						>
							{nextDevice?.name ?? ''}
						</Button>
					</div>
				</div>

				{/* ── Scrollable body ── */}
				<div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

					{/* Device info */}
					<Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
						<Descriptions.Item label="Device ID">{device.externalDeviceId ?? device.id}</Descriptions.Item>
						<Descriptions.Item label="Model">{device.model || '—'}</Descriptions.Item>
						<Descriptions.Item label="Modbus Addr">{(device as CloudSubDevice & { modbusAddress?: number }).modbusAddress ?? '—'}</Descriptions.Item>
						<Descriptions.Item label="Last Seen">
							<Tooltip title={fmtTimestamp(device.lastSeenAt ?? null)}>
								<Text type={isOnline ? 'success' : 'secondary'}>
									<ClockCircleOutlined style={{ marginRight: 4 }} />
									{fmtAgo(device.lastSeenAt ?? null)}
								</Text>
							</Tooltip>
						</Descriptions.Item>
					</Descriptions>

					<Divider style={{ margin: '12px 0' }} />

					<Text strong style={{ fontSize: 13 }}>Parameters ({points.length})</Text>

					{points.length === 0 ? (
						<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No parameters" style={{ marginTop: 16 }} />
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10 }}>
							{points.map((p) => {
								const name = p.parameter_name ?? p.point_name ?? p.param_id ?? '—';
								const badge = limitBadge(p);
								const isWritable = p.rw === 1;

								return (
									<div
										key={p.point_id}
										onClick={() => { if (isWritable) setWritePoint(p); }}
										style={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											padding: '7px 10px',
											borderRadius: 6,
											cursor: isWritable ? 'pointer' : 'default',
											background: 'transparent',
											border: '1px solid transparent',
											transition: 'background 0.15s',
										}}
										onMouseEnter={(e) => {
											if (isWritable) (e.currentTarget as HTMLDivElement).style.background = `${BRAND_COLOR}08`;
										}}
										onMouseLeave={(e) => {
											(e.currentTarget as HTMLDivElement).style.background = 'transparent';
										}}
									>
										<Space size={6}>
											{badge === 'error' ? (
												<AlertOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
											) : (
												<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
											)}
											<Text style={{ fontSize: 13 }}>{name}</Text>
											{p.param_id && (
												<Text type="secondary" style={{ fontSize: 10 }}>({p.param_id})</Text>
											)}
										</Space>
										<Space size={8}>
											<Text
												strong
												style={{
													fontSize: 14,
													color: badge === 'error' ? '#ff4d4f'
														: p.latest_value !== null ? BRAND_COLOR
														: '#d9d9d9',
												}}
											>
												{formatValue(p, isModel4)}
											</Text>
											{isWritable ? (
												<Tooltip title="Click to write value">
													<EditOutlined style={{ fontSize: 13, color: '#aaa' }} />
												</Tooltip>
											) : (
												<Tooltip title="Read-only">
													<LockOutlined style={{ fontSize: 12, color: '#d9d9d9' }} />
												</Tooltip>
											)}
										</Space>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* ── Footer status bar ── */}
				<div style={{
					borderTop: '1px solid #f0f0f0',
					padding: '8px 20px',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					flexShrink: 0,
					background: '#fafafa',
				}}>
					<Text type="secondary" style={{ fontSize: 11 }}>
						{points.length} parameter{points.length !== 1 ? 's' : ''}
						{points.filter(p => p.rw === 1).length > 0 && (
							<Tag color="blue" style={{ marginLeft: 8, fontSize: 10 }}>
								{points.filter(p => p.rw === 1).length} writable
							</Tag>
						)}
						{points.filter(p => limitBadge(p) === 'error').length > 0 && (
							<Tag color="error" style={{ marginLeft: 4, fontSize: 10 }}>
								{points.filter(p => limitBadge(p) === 'error').length} out of range
							</Tag>
						)}
					</Text>
					<Badge
						status={isOnline ? 'processing' : 'default'}
						text={<Text type="secondary" style={{ fontSize: 11 }}>{isOnline ? 'Live' : 'Offline'}</Text>}
					/>
				</div>
			</Drawer>

			{/* Write param modal — rendered outside Drawer to avoid z-index issues */}
			<WriteParamModal
				open={writePoint !== null}
				point={writePoint}
				device={device}
				onClose={() => setWritePoint(null)}
			/>
		</>
	);
};

