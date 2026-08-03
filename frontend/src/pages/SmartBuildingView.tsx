import React from 'react';
import {
	CloudServerOutlined,
	EnvironmentOutlined,
} from '@ant-design/icons';
import { Card, Col, List, Row, Spin, Tag, Typography } from 'antd';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useGatewayData, getStatsFromGateways } from '../hooks/useGatewayData';
import type { CloudGateway } from '../data/cloudData';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string ?? '';

const mapContainerStyle = { width: '100%', height: '100%' };
const mapCenter = { lat: 1.352, lng: 103.82 };
const mapOptions: google.maps.MapOptions = {
	zoom: 11,
	disableDefaultUI: false,
	streetViewControl: false,
	mapTypeControl: false,
	scrollwheel: true,
	styles: [
		{ featureType: 'poi', stylers: [{ visibility: 'off' }] },
		{ featureType: 'transit', stylers: [{ visibility: 'simplified' }] }
	]
};

const { Text, Title } = Typography;

function gatewayStatusLabel(status: CloudGateway['status']): string {
	if (status === 'online') return 'Healthy';
	if (status === 'degraded') return 'Investigating';
	return 'Attention';
}

function gatewayStatusColor(status: CloudGateway['status']): string {
	if (status === 'online') return 'success';
	if (status === 'degraded') return 'warning';
	return 'error';
}

const eventFeed = [
	{ title: 'Cold-chain threshold exceeded', meta: 'Sydney Cold Chain', time: '2 min ago', level: 'critical' },
	{ title: 'Generator auto-recovery completed', meta: 'Dallas Distribution Site', time: '11 min ago', level: 'normal' },
	{ title: 'LoRaWAN gateway joined backup route', meta: 'London Building Cluster', time: '19 min ago', level: 'warning' },
	{ title: 'Air quality report exported', meta: 'Singapore Hub', time: '42 min ago', level: 'normal' }
];

const SiteMap: React.FC = () => {
	const { isLoaded, loadError } = useJsApiLoader({
		googleMapsApiKey: GOOGLE_MAPS_API_KEY,
		id: 'tmas-gmap'
	});

	if (loadError) return (
		<div className="overview-map-placeholder">
			<p>Map failed to load. Check your <code>VITE_GOOGLE_MAPS_API_KEY</code>.</p>
		</div>
	);

	if (!isLoaded) return <div className="overview-map-placeholder">Loading map…</div>;

	return (
		<GoogleMap
			mapContainerStyle={mapContainerStyle}
			center={mapCenter}
			options={mapOptions}
		/>
	);
};

const SmartBuildingView: React.FC = () => {
	const { gateways, loading } = useGatewayData();
	const stats = getStatsFromGateways(gateways);

	const onlineDevices = gateways.reduce(
		(s, g) => s + g.subDevices.filter((d) => d.status === 'online').length, 0
	);
	const avgHealth = gateways.length > 0
		? Math.round(gateways.reduce((s, g) => s + g.healthScore, 0) / gateways.length)
		: 100;

	const metrics = [
		{
			label: 'Connected Devices',
			value: loading ? '—' : String(stats.totalSubDevices),
			change: loading ? '' : `${onlineDevices} online`,
			tone: 'teal'
		},
		{
			label: 'Gateways',
			value: loading ? '—' : String(stats.totalGateways),
			change: loading ? '' : `${stats.onlineGateways} online`,
			tone: 'amber'
		},
		{
			label: 'Active Alarms',
			value: loading ? '—' : String(stats.activeAlarms),
			change: stats.activeAlarms > 0 ? 'Requires attention' : 'All clear',
			tone: 'coral'
		},
		{
			label: 'Avg Health Score',
			value: loading ? '—' : `${avgHealth}%`,
			change: avgHealth > 80 ? 'Good' : 'Degraded',
			tone: 'blue'
		},
	];

	return (
		<Row gutter={[20, 20]} className="overview-main-row">
			<Col xs={24} xl={14}>
				<Card className="overview-card overview-map-card" bordered={false}>
					<div className="overview-card-header">
						<div className="overview-card-title-row">
							<Text className="overview-section-label">Map</Text>
							<Title level={4}>Field Network Visibility</Title>
						</div>
						<Tag color="geekblue">All gateways</Tag>
					</div>
					<div className="overview-map-shell">
						<SiteMap />
					</div>
					<div className="overview-location-grid">
						{loading ? (
							<Spin size="small" />
						) : gateways.length === 0 ? (
							<Text type="secondary">No gateways found</Text>
						) : (
							gateways.map((gw) => (
								<div key={gw.id} className="overview-location-item">
									<div>
										<Text strong>{gw.name}</Text>
										<div className="overview-location-meta">
											<EnvironmentOutlined />
											<span>{gw.ipAddress}</span>
											<span>{gw.subDevices.length} devices</span>
										</div>
									</div>
									<Tag color={gatewayStatusColor(gw.status)}>
										{gatewayStatusLabel(gw.status)}
									</Tag>
								</div>
							))
						)}
					</div>
				</Card>
			</Col>

			<Col xs={24} xl={10}>
				<div className="overview-side-stack">
					<Card className="overview-card" bordered={false}>
						<div className="overview-card-header">
							<div className="overview-card-title-row">
								<Text className="overview-section-label">Live Snapshot</Text>
								<Title level={4}>Platform Health</Title>
							</div>
							<CloudServerOutlined className="overview-header-icon" />
						</div>
						<div className="overview-metric-grid">
							{metrics.map((metric) => (
								<div key={metric.label} className={`overview-metric-tile overview-metric-${metric.tone}`}>
									<Text className="overview-metric-label">{metric.label}</Text>
									<div className="overview-metric-value">{metric.value}</div>
									<Text className="overview-metric-change">{metric.change}</Text>
								</div>
							))}
						</div>
					</Card>

					<Card className="overview-card" bordered={false}>
						<div className="overview-card-header">
							<div className="overview-card-title-row">
								<Text className="overview-section-label">Event Center</Text>
								<Title level={4}>Recent Operational Signals</Title>
							</div>
							<Tag color="red">7 open</Tag>
						</div>
						<List
							dataSource={eventFeed}
							renderItem={(item) => (
								<List.Item className="overview-event-item">
									<div className={`overview-event-dot overview-event-${item.level}`} />
									<div className="overview-event-body">
										<Text strong>{item.title}</Text>
										<Text type="secondary">{item.meta}</Text>
									</div>
									<Text type="secondary">{item.time}</Text>
								</List.Item>
							)}
						/>
					</Card>
				</div>
			</Col>
		</Row>
	);
};

export default SmartBuildingView;
