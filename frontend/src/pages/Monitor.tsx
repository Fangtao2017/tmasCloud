import { DevStatusModal } from '../components/DevStatusModal';
import React from 'react';
import {
	BellOutlined,
	CheckCircleOutlined,
	FilterOutlined,
	NotificationOutlined,
	ReloadOutlined,
	SearchOutlined,
	ThunderboltOutlined,
	WarningOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Input, Row, Segmented, Select, Space, Tag, Typography } from 'antd';
import './Monitor.css';

const { Paragraph, Text, Title } = Typography;

type NotificationType = 'event' | 'alarm' | 'rule';
type NotificationState = 'trigger' | 'normal';
type NotificationSeverity = 'critical' | 'warning' | 'info';

interface NotificationRecord {
	id: string;
	type: NotificationType;
	state: NotificationState;
	severity: NotificationSeverity;
	title: string;
	description: string;
	site: string;
	gateway: string;
	source: string;
	time: string;
}

const notificationFeed: NotificationRecord[] = [
	{
		id: 'notif-001',
		type: 'alarm',
		state: 'trigger',
		severity: 'critical',
		title: 'Cold room threshold exceeded',
		description: 'Temperature alarm triggered after room temperature stayed above the configured band for 6 minutes.',
		site: 'Temasek Polytechnic',
		gateway: 'Gateway TP-Block 22',
		source: 'Lecture Hall AHU-01',
		time: '2 min ago',
	},
	{
		id: 'notif-002',
		type: 'rule',
		state: 'trigger',
		severity: 'warning',
		title: 'Ventilation fallback rule executed',
		description: 'Rule triggered when CO2 exceeded threshold and the system switched to fallback ventilation profile.',
		site: 'Ngee Ann Polytechnic',
		gateway: 'Gateway NP-Engineering',
		source: 'Server Room Humidity',
		time: '5 min ago',
	},
	{
		id: 'notif-003',
		type: 'event',
		state: 'normal',
		severity: 'info',
		title: 'Gateway connectivity restored',
		description: 'Gateway returned to normal reporting interval and resumed scheduled event uploads.',
		site: 'Republic Polytechnic',
		gateway: 'Gateway RP-Sports Hall',
		source: 'Gateway Heartbeat',
		time: '9 min ago',
	},
	{
		id: 'notif-004',
		type: 'alarm',
		state: 'normal',
		severity: 'info',
		title: 'Humidity alarm normalized',
		description: 'Humidity value returned to acceptable range and alarm state has been cleared automatically.',
		site: 'Temasek Polytechnic',
		gateway: 'Gateway TP-Library',
		source: 'West Wing Humidity',
		time: '13 min ago',
	},
	{
		id: 'notif-005',
		type: 'event',
		state: 'trigger',
		severity: 'warning',
		title: 'Gateway switched to backup uplink',
		description: 'Event received from the gateway after primary path latency crossed the failover threshold.',
		site: 'ITE College East',
		gateway: 'Gateway ITE-Workshop',
		source: 'Gateway Uplink',
		time: '18 min ago',
	},
	{
		id: 'notif-006',
		type: 'rule',
		state: 'normal',
		severity: 'info',
		title: 'After-hours lighting rule normalized',
		description: 'Rule execution completed and lighting control sequence returned to default schedule.',
		site: 'Republic Polytechnic',
		gateway: 'Gateway RP-Campus Core',
		source: 'North Block Occupancy',
		time: '24 min ago',
	},
	{
		id: 'notif-007',
		type: 'alarm',
		state: 'trigger',
		severity: 'warning',
		title: 'Air quality warning triggered',
		description: 'PM2.5 rose above warning threshold and notification was sent to the operations workspace.',
		site: 'ITE College East',
		gateway: 'Gateway ITE-Workshop',
		source: 'Welding Bay VOC',
		time: '31 min ago',
	},
	{
		id: 'notif-008',
		type: 'event',
		state: 'normal',
		severity: 'info',
		title: 'Scheduled report exported',
		description: 'Daily gateway summary export completed and was shared to the school operations team.',
		site: 'Ngee Ann Polytechnic',
		gateway: 'Gateway NP-Engineering',
		source: 'Reporting Service',
		time: '42 min ago',
	},
];

const typeColors: Record<NotificationType, string> = {
	event: 'blue',
	alarm: 'red',
	rule: 'gold',
};

const severityClasses: Record<NotificationSeverity, string> = {
	critical: 'notification-center-item-critical',
	warning: 'notification-center-item-warning',
	info: 'notification-center-item-info',
};

const stateColors: Record<NotificationState, string> = {
	trigger: 'error',
	normal: 'success',
};

const getTypeLabel = (type: NotificationType) => {
	if (type === 'alarm') return 'Alert';
	if (type === 'rule') return 'Rule';
	return 'Update';
};

const getStateLabel = (state: NotificationState) => {
	return state === 'trigger' ? 'Needs Attention' : 'Back to Normal';
};

const Monitor: React.FC = () => {
	const [query, setQuery] = React.useState('');
	const [typeFilter, setTypeFilter] = React.useState<'all' | NotificationType>('all');
	const [stateFilter, setStateFilter] = React.useState<'all' | NotificationState>('all');
	const [severityFilter, setSeverityFilter] = React.useState<'all' | NotificationSeverity>('all');

	const filteredNotifications = React.useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return notificationFeed.filter((item) => {
			const matchesType = typeFilter === 'all' || item.type === typeFilter;
			const matchesState = stateFilter === 'all' || item.state === stateFilter;
			const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter;
			const matchesQuery =
				normalizedQuery.length === 0 ||
				item.title.toLowerCase().includes(normalizedQuery) ||
				item.gateway.toLowerCase().includes(normalizedQuery) ||
				item.site.toLowerCase().includes(normalizedQuery) ||
				item.source.toLowerCase().includes(normalizedQuery);

			return matchesType && matchesState && matchesSeverity && matchesQuery;
		});
	}, [query, severityFilter, stateFilter, typeFilter]);

	const counts = React.useMemo(() => {
		const triggerCount = notificationFeed.filter((item) => item.state === 'trigger').length;
		const normalCount = notificationFeed.filter((item) => item.state === 'normal').length;
		const alarmCount = notificationFeed.filter((item) => item.type === 'alarm').length;
		const ruleCount = notificationFeed.filter((item) => item.type === 'rule').length;
		const eventCount = notificationFeed.filter((item) => item.type === 'event').length;

		return {
			total: notificationFeed.length,
			trigger: triggerCount,
			normal: normalCount,
			alarm: alarmCount,
			rule: ruleCount,
			event: eventCount,
		};
	}, []);

	return (
		<div className="notification-center-page">
			<DevStatusModal
				title="Monitor & Control — Notification Center"
				storageKey="dev_status_notif"
				items={[
					{ label: 'All Data', status: 'mock', note: 'Notification feed is currently sample data' },
				]}
			/>
			<div className="notification-center-hero">
				<div className="notification-center-title-row">
					<Title level={2}>Notification Center</Title>
					<Space wrap>
						<Button className="monitoring-action-button" icon={<ReloadOutlined />}>Refresh Feed</Button>
						<Tag color="geekblue">event + alarm + rule</Tag>
					</Space>
				</div>
				<Paragraph className="notification-center-subtitle">
					See important updates from all schools in one place, including new issues, rule actions, and items that have already returned to normal.
				</Paragraph>
			</div>

			<div className="notification-center-kpi-grid">
				<Card className="notification-center-kpi notification-center-kpi-navy" bordered={false}>
					<div className="notification-center-kpi-icon"><NotificationOutlined /></div>
					<div>
						<Text className="notification-center-kpi-label">All Updates</Text>
						<div className="notification-center-kpi-value">{counts.total}</div>
					</div>
				</Card>
				<Card className="notification-center-kpi notification-center-kpi-red" bordered={false}>
					<div className="notification-center-kpi-icon"><WarningOutlined /></div>
					<div>
						<Text className="notification-center-kpi-label">Needs Attention</Text>
						<div className="notification-center-kpi-value">{counts.trigger}</div>
					</div>
				</Card>
				<Card className="notification-center-kpi notification-center-kpi-green" bordered={false}>
					<div className="notification-center-kpi-icon"><CheckCircleOutlined /></div>
					<div>
						<Text className="notification-center-kpi-label">Back to Normal</Text>
						<div className="notification-center-kpi-value">{counts.normal}</div>
					</div>
				</Card>
				<Card className="notification-center-kpi notification-center-kpi-amber" bordered={false}>
					<div className="notification-center-kpi-icon"><BellOutlined /></div>
					<div>
						<Text className="notification-center-kpi-label">Alerts / Rules / Updates</Text>
						<div className="notification-center-kpi-value notification-center-kpi-mixed">{counts.alarm} / {counts.rule} / {counts.event}</div>
					</div>
				</Card>
			</div>

			<Row gutter={[16, 16]} className="notification-center-main-row">
				<Col xs={24} xl={16}>
					<Card className="notification-center-card notification-center-feed-card" bordered={false}>
						<div className="notification-center-card-header">
							<Title level={3}>Recent Updates</Title>
							<Tag color="blue">{filteredNotifications.length} visible</Tag>
						</div>

						<div className="notification-center-filters">
							<Input
								allowClear
								prefix={<SearchOutlined />}
								placeholder="Search update, gateway, school, or source"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
							/>
							<Select
								value={typeFilter}
								onChange={(value) => setTypeFilter(value as 'all' | NotificationType)}
								options={[
									{ value: 'all', label: 'All update types' },
									{ value: 'event', label: 'Update' },
									{ value: 'alarm', label: 'Alert' },
									{ value: 'rule', label: 'Rule' },
								]}
							/>
							<Segmented
								value={stateFilter}
								onChange={(value) => setStateFilter(value as 'all' | NotificationState)}
								options={[
									{ label: 'All', value: 'all' },
									{ label: 'Needs Attention', value: 'trigger' },
									{ label: 'Back to Normal', value: 'normal' },
								]}
							/>
							<Select
								value={severityFilter}
								onChange={(value) => setSeverityFilter(value as 'all' | NotificationSeverity)}
								options={[
									{ value: 'all', label: 'All severity' },
									{ value: 'critical', label: 'Critical' },
									{ value: 'warning', label: 'Warning' },
									{ value: 'info', label: 'Info' },
								]}
							/>
						</div>

						<div className="notification-center-list">
							{filteredNotifications.map((item) => (
								<div key={item.id} className={`notification-center-item ${severityClasses[item.severity]}`}>
									<div className="notification-center-item-top">
										<div>
											<div className="notification-center-item-title">{item.title}</div>
											<div className="notification-center-item-meta">
												<span>{item.site}</span>
												<span>{item.gateway}</span>
												<span>{item.source}</span>
											</div>
										</div>
										<Text type="secondary">{item.time}</Text>
									</div>

									<div className="notification-center-item-tags">
										<Tag color={typeColors[item.type]}>{getTypeLabel(item.type).toUpperCase()}</Tag>
										<Tag color={stateColors[item.state]}>{getStateLabel(item.state).toUpperCase()}</Tag>
										<Tag>{item.severity}</Tag>
									</div>

									<Paragraph>{item.description}</Paragraph>
								</div>
							))}
						</div>
					</Card>
				</Col>

				<Col xs={24} xl={8}>
					<div className="notification-center-side-stack">
						<Card className="notification-center-card" bordered={false}>
							<div className="notification-center-card-header">
								<Title level={4}>Update Types</Title>
								<FilterOutlined className="notification-center-header-icon" />
							</div>
							<div className="notification-center-channel-grid">
								<div className="notification-center-channel-item">
									<span>Updates</span>
									<strong>{counts.event}</strong>
								</div>
								<div className="notification-center-channel-item">
									<span>Alerts</span>
									<strong>{counts.alarm}</strong>
								</div>
								<div className="notification-center-channel-item">
									<span>Rule</span>
									<strong>{counts.rule}</strong>
								</div>
							</div>
						</Card>

						<Card className="notification-center-card" bordered={false}>
							<div className="notification-center-card-header">
								<Title level={4}>What Needs Review</Title>
								<ThunderboltOutlined className="notification-center-header-icon" />
							</div>
							<div className="notification-center-focus-list">
								<div className="notification-center-focus-item">
									<span>Gateways with active issues</span>
									<strong>4</strong>
								</div>
								<div className="notification-center-focus-item">
									<span>Recovered items</span>
									<strong>{counts.normal}</strong>
								</div>
								<div className="notification-center-focus-item">
									<span>Urgent items waiting for review</span>
									<strong>2</strong>
								</div>
							</div>
						</Card>

						<Card className="notification-center-card notification-center-policy-card" bordered={false}>
							<Text className="notification-center-eyebrow">How To Read This Page</Text>
							<Title level={4}>New issue + back to normal</Title>
							<Paragraph>
								Each item appears when something needs attention and again when it has recovered. That makes it easy to understand both the problem and the recovery without reading raw system logs.
							</Paragraph>
						</Card>
					</div>
				</Col>
			</Row>
		</div>
	);
};

export default Monitor;
