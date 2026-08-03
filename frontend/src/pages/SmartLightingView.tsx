import { DevStatusModal } from '../components/DevStatusModal';
import React from 'react';
import {
	CalendarOutlined,
	ClockCircleOutlined,
	ControlOutlined,
	EyeOutlined,
	WarningOutlined,
} from '@ant-design/icons';
import { Card, Col, Progress, Row, Select, Switch, Tag, Typography } from 'antd';

const { Text, Title } = Typography;

// ── Types ─────────────────────────────────────────────────────────────────────
type ScheduleStatus = 'on-schedule' | 'deviated' | 'no-schedule';
type LuxStatus = 'compliant' | 'under' | 'over';
type OccupancyStatus = 'occupied' | 'vacant-dimmed' | 'vacant-override';
type ZoneType = 'classroom' | 'lab' | 'corridor' | 'office';
type ZoneMode = 'auto' | 'manual';

interface ZoneRecord {
	id: string;
	site: string;
	zone: string;
	zoneType: ZoneType;
	mode: ZoneMode;
	scheduleLabel: string;
	scheduleStatus: ScheduleStatus;
	scheduleDeviation?: string;
	targetLux: number;
	currentLux: number;
	luxStatus: LuxStatus;
	occupancyStatus: OccupancyStatus;
	dimLevel: number;
	lastMotion: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const ZONES: ZoneRecord[] = [
	{
		id: 'z1', site: 'Republic Polytechnic', zone: 'LT Block A', zoneType: 'classroom',
		mode: 'auto',
		scheduleLabel: '07:00–22:00 weekdays', scheduleStatus: 'on-schedule',
		targetLux: 500, currentLux: 487, luxStatus: 'compliant',
		occupancyStatus: 'occupied', dimLevel: 100, lastMotion: '2 min ago',
	},
	{
		id: 'z2', site: 'Republic Polytechnic', zone: 'Lab B-03', zoneType: 'lab',
		mode: 'manual',
		scheduleLabel: '08:00–21:00 weekdays', scheduleStatus: 'deviated',
		scheduleDeviation: 'Lights ON — schedule says OFF since 21:05',
		targetLux: 750, currentLux: 712, luxStatus: 'compliant',
		occupancyStatus: 'vacant-override', dimLevel: 100, lastMotion: '38 min ago',
	},
	{
		id: 'z3', site: 'Republic Polytechnic', zone: 'Corridor L2', zoneType: 'corridor',
		mode: 'auto',
		scheduleLabel: '06:00–23:00 daily', scheduleStatus: 'on-schedule',
		targetLux: 150, currentLux: 98, luxStatus: 'under',
		occupancyStatus: 'vacant-dimmed', dimLevel: 30, lastMotion: '12 min ago',
	},
	{
		id: 'z4', site: 'Temasek Polytechnic', zone: 'Engineering LT 1', zoneType: 'classroom',
		mode: 'auto',
		scheduleLabel: '07:30–22:00 weekdays', scheduleStatus: 'on-schedule',
		targetLux: 500, currentLux: 523, luxStatus: 'compliant',
		occupancyStatus: 'occupied', dimLevel: 100, lastMotion: 'just now',
	},
	{
		id: 'z5', site: 'Temasek Polytechnic', zone: 'Computer Lab C-12', zoneType: 'lab',
		mode: 'auto',
		scheduleLabel: '08:00–20:00 weekdays', scheduleStatus: 'on-schedule',
		targetLux: 750, currentLux: 445, luxStatus: 'under',
		occupancyStatus: 'vacant-dimmed', dimLevel: 20, lastMotion: '25 min ago',
	},
	{
		id: 'z6', site: 'Temasek Polytechnic', zone: 'Admin Office', zoneType: 'office',
		mode: 'manual',
		scheduleLabel: '08:00–18:00 weekdays', scheduleStatus: 'deviated',
		scheduleDeviation: 'Lights OFF — schedule says ON (08:15 now)',
		targetLux: 400, currentLux: 0, luxStatus: 'under',
		occupancyStatus: 'vacant-dimmed', dimLevel: 0, lastMotion: '2 h ago',
	},
	{
		id: 'z7', site: 'ITE College East', zone: 'Workshop W-01', zoneType: 'lab',
		mode: 'auto',
		scheduleLabel: '07:00–18:00 weekdays', scheduleStatus: 'on-schedule',
		targetLux: 750, currentLux: 801, luxStatus: 'over',
		occupancyStatus: 'occupied', dimLevel: 100, lastMotion: '5 min ago',
	},
	{
		id: 'z8', site: 'ITE College East', zone: 'Classroom E-21', zoneType: 'classroom',
		mode: 'manual',
		scheduleLabel: '07:30–22:00 weekdays', scheduleStatus: 'no-schedule',
		targetLux: 500, currentLux: 320, luxStatus: 'under',
		occupancyStatus: 'vacant-dimmed', dimLevel: 45, lastMotion: '18 min ago',
	},
	{
		id: 'z9', site: 'Ngee Ann Polytechnic', zone: 'Library L1', zoneType: 'office',
		mode: 'auto',
		scheduleLabel: '08:00–21:00 daily', scheduleStatus: 'on-schedule',
		targetLux: 400, currentLux: 388, luxStatus: 'compliant',
		occupancyStatus: 'occupied', dimLevel: 95, lastMotion: '1 min ago',
	},
	{
		id: 'z10', site: 'Ngee Ann Polytechnic', zone: 'Corridor C-B2', zoneType: 'corridor',
		mode: 'auto',
		scheduleLabel: '06:00–23:00 daily', scheduleStatus: 'on-schedule',
		targetLux: 150, currentLux: 162, luxStatus: 'compliant',
		occupancyStatus: 'vacant-dimmed', dimLevel: 35, lastMotion: '8 min ago',
	},
];

const ALL_SITES = ['All Sites', ...Array.from(new Set(ZONES.map((z) => z.site)))];

// ── Configs ────────────────────────────────────────────────────────────────────
const SCHEDULE_CFG: Record<ScheduleStatus, { tagColor: string; label: string }> = {
	'on-schedule': { tagColor: 'success', label: 'On Schedule' },
	'deviated':    { tagColor: 'error',   label: 'Deviated' },
	'no-schedule': { tagColor: 'default', label: 'No Schedule' },
};

const LUX_CFG: Record<LuxStatus, { color: string; tagColor: string; label: string }> = {
	'compliant': { color: '#0f766e', tagColor: 'success', label: 'Compliant' },
	'under':     { color: '#dc2626', tagColor: 'error',   label: 'Below Target' },
	'over':      { color: '#d97706', tagColor: 'warning', label: 'Above Target' },
};

const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
	classroom: 'Classroom', lab: 'Lab', corridor: 'Corridor', office: 'Office',
};

// ── Component ─────────────────────────────────────────────────────────────────
const SmartLightingView: React.FC = () => {
	const [selectedSite, setSelectedSite] = React.useState('All Sites');
	const [scheduleFilter, setScheduleFilter] = React.useState<'all' | ScheduleStatus>('all');

	// Zone mode state — initialised from mock data, togglable in UI
	const [zoneModes, setZoneModes] = React.useState<Record<string, ZoneMode>>(
		() => Object.fromEntries(ZONES.map((z) => [z.id, z.mode])),
	);
	const toggleMode = (id: string) =>
		setZoneModes((prev) => ({ ...prev, [id]: prev[id] === 'auto' ? 'manual' : 'auto' }));

	const filtered = React.useMemo(() =>
		ZONES.filter((z) => {
			const siteOk = selectedSite === 'All Sites' || z.site === selectedSite;
			const schedOk = scheduleFilter === 'all' || z.scheduleStatus === scheduleFilter;
			return siteOk && schedOk;
		}),
	[selectedSite, scheduleFilter]);

	return (
		<div>
			<DevStatusModal
				title="Home — Smart Lighting"
				storageKey="dev_status_lighting"
				items={[
					{ label: 'All Data', status: 'mock', note: 'All lighting data is currently sample data' },
				]}
			/>
			{/* ── Main layout: left narrow (Lux) | right wide (Schedule + Mode) ── */}

			<Row gutter={[14, 14]}>
				{/* Left: Lux Compliance — narrow, full-height */}
				<Col xs={24} xl={6}>
					<Card
						className="overview-card"
						bordered={false}
						styles={{ body: { padding: '14px 16px' } }}
					>
						<div className="overview-card-header" style={{ marginBottom: 10 }}>
							<div className="overview-card-title-row">
								<Text className="overview-section-label">Lux Compliance</Text>
								<Title level={4} style={{ margin: 0 }}>Actual vs Target Lux</Title>
							</div>
							<EyeOutlined className="overview-header-icon" />
						</div>
						<div className="energy-zone-list" style={{ height: 625, overflowY: 'auto', paddingRight: 4 }}>
							{filtered.map((z) => {
								const cfg = LUX_CFG[z.luxStatus];
								const rawPct = z.targetLux > 0 ? Math.round((z.currentLux / z.targetLux) * 100) : 0;
								const barPct  = Math.min(rawPct, 100);
								return (
									<div key={z.id} className="energy-zone-item">
										<div className="energy-zone-header">
											<div>
												<Text strong>{z.zone}</Text>
												<br />
												<Text type="secondary" style={{ fontSize: '0.78rem' }}>{z.site}</Text>
											</div>
											<div style={{ textAlign: 'right' }}>
												<div style={{ color: cfg.color, fontWeight: 700, fontSize: '1rem' }}>{z.currentLux} lx</div>
												<Text type="secondary" style={{ fontSize: '0.72rem' }}>target {z.targetLux} lx</Text>
											</div>
										</div>
										<div style={{ marginTop: 6 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
												<Tag color={cfg.tagColor} style={{ fontSize: '0.7rem', padding: '0 5px' }}>{cfg.label}</Tag>
												<Text type="secondary" style={{ fontSize: '0.72rem' }}>
													{rawPct > 100 ? `+${rawPct - 100}% over target` : `${rawPct}% of target`}
												</Text>
											</div>
											<Progress percent={barPct} showInfo={false} strokeColor={cfg.color} size="small" />
										</div>
									</div>
								);
							})}
						</div>
					</Card>
				</Col>

				{/* Right: Schedule Control (top) + Zone Mode Control (bottom) */}
				<Col xs={24} xl={18}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
						{/* Schedule Control */}
						<Card
							className="overview-card"
							bordered={false}
							styles={{ body: { padding: '14px 16px' } }}
						>
						<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
							<div className="overview-card-title-row">
								<Text className="overview-section-label">Schedule Control</Text>
								<Title level={4} style={{ margin: 0 }}>Zone Schedule Status</Title>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<Select
									size="small"
									value={selectedSite}
									onChange={setSelectedSite}
									options={ALL_SITES.map((s) => ({ label: s, value: s }))}
									style={{ minWidth: 150 }}
								/>
								<Select
									size="small"
									value={scheduleFilter}
									onChange={(v) => setScheduleFilter(v as 'all' | ScheduleStatus)}
									options={[
										{ value: 'all',         label: 'All Schedule Status' },
										{ value: 'on-schedule', label: 'On Schedule' },
										{ value: 'deviated',    label: 'Deviated' },
										{ value: 'no-schedule', label: 'No Schedule' },
									]}
									style={{ minWidth: 150 }}
								/>
								<CalendarOutlined className="overview-header-icon" style={{ flexShrink: 0 }} />
							</div>
							</div>
							<div className="energy-zone-list" style={{ height: 270, overflowY: 'auto', paddingRight: 4 }}>
								{filtered.map((z) => {
									const cfg = SCHEDULE_CFG[z.scheduleStatus];
									return (
										<div key={z.id} className="energy-zone-item">
											<div className="energy-zone-header">
												<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
													<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
														<Text strong>{z.zone}</Text>
														<Tag style={{ fontSize: '0.7rem', padding: '0 5px' }} color="blue">{ZONE_TYPE_LABEL[z.zoneType]}</Tag>
													</div>
													<Text type="secondary" style={{ fontSize: '0.78rem' }}>{z.site}</Text>
												</div>
												<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
													<Tag color={cfg.tagColor}>{cfg.label}</Tag>
													<Text type="secondary" style={{ fontSize: '0.72rem' }}>
														<ClockCircleOutlined style={{ marginRight: 4 }} />{z.scheduleLabel}
													</Text>
												</div>
											</div>
											{z.scheduleStatus === 'deviated' && z.scheduleDeviation && (
												<div style={{ background: '#fff1f2', borderRadius: 8, padding: '4px 10px', marginTop: 4 }}>
													<Text style={{ fontSize: '0.78rem', color: '#dc2626' }}>
														<WarningOutlined style={{ marginRight: 6 }} />{z.scheduleDeviation}
													</Text>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</Card>

						{/* Zone Mode Control */}
						<Card
							className="overview-card"
							bordered={false}
							styles={{ body: { padding: '14px 16px' } }}
						>
							<div className="overview-card-header" style={{ marginBottom: 10 }}>
								<div className="overview-card-title-row">
									<Text className="overview-section-label">Zone Mode</Text>
									<Title level={4} style={{ margin: 0 }}>Auto / Manual Control</Title>
								</div>
								<ControlOutlined className="overview-header-icon" />
							</div>
							<div className="energy-zone-list" style={{ height: 270, overflowY: 'auto', paddingRight: 4 }}>
								{filtered.map((z) => {
									const isAuto = zoneModes[z.id] === 'auto';
									return (
										<div key={z.id} className="energy-zone-item">
											<div className="energy-zone-header">
												<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
													<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
														<Text strong>{z.zone}</Text>
														<Tag style={{ fontSize: '0.7rem', padding: '0 5px' }} color="blue">{ZONE_TYPE_LABEL[z.zoneType]}</Tag>
													</div>
													<Text type="secondary" style={{ fontSize: '0.78rem' }}>{z.site}</Text>
												</div>
												<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
													<Tag
														color={isAuto ? 'success' : 'warning'}
														style={{ fontSize: '0.72rem', padding: '0 6px', margin: 0 }}
													>
														{isAuto ? 'Auto' : 'Manual'}
													</Tag>
													<Switch
														size="small"
														checked={isAuto}
														onChange={() => toggleMode(z.id)}
														checkedChildren="Auto"
														unCheckedChildren="Manual"
														style={{ backgroundColor: isAuto ? '#0f766e' : '#d97706' }}
													/>
												</div>
											</div>
											{!isAuto && (
												<div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '4px 10px', marginTop: 6 }}>
													<Text style={{ fontSize: '0.75rem', color: '#92400e' }}>
														<WarningOutlined style={{ marginRight: 6 }} />
														Manual mode active — schedule and occupancy logic paused
													</Text>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</Card>
					</div>
				</Col>
			</Row>
		</div>
	);
};

export default SmartLightingView;
