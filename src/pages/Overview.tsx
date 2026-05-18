import React from 'react';
import { AppstoreOutlined } from '@ant-design/icons';
import SmartBuildingView from './SmartBuildingView';
import EnergyMonitoringView from './EnergyMonitoringView';
import SmartLightingView from './SmartLightingView';
import { DevStatusModal } from '../components/DevStatusModal';
import './Overview.css';

const APPLICATION_SCENARIOS = [
	'Smart Building',
	'Energy Monitoring',
	'Smart Lighting',
] as const;

type ApplicationScenario = typeof APPLICATION_SCENARIOS[number];

const Overview: React.FC = () => {
	const [selectedApp, setSelectedApp] = React.useState<ApplicationScenario>(APPLICATION_SCENARIOS[0]);

	return (
		<div className="overview-page">
			<DevStatusModal
				title="Home — Smart Building"
				storageKey="dev_status_home"
				items={[
					{ label: 'Event Center', status: 'mock', note: 'Displaying sample data, not connected to live events' },
					{ label: 'Map Component', status: 'mock', note: 'Requires a paid map API key for full functionality' },
					{ label: 'Other Components', status: 'partial', note: 'Connected to live data, UI pending optimization' },
				]}
			/>
			{/* Application Scenarios */}
			<div className="app-scenario-panel">
				<div className="app-scenario-header">
					<AppstoreOutlined style={{ marginRight: 6 }} />
					<span className="app-scenario-eyebrow">APPLICATION SCENARIOS</span>
					<span className="app-scenario-title">Built for distributed operations</span>
				</div>
				<div className="app-scenario-tags">
					{APPLICATION_SCENARIOS.map((scenario) => (
						<button
							key={scenario}
							type="button"
							className={`app-scenario-tag${selectedApp === scenario ? ' app-scenario-tag-active' : ''}`}
							onClick={() => setSelectedApp(scenario)}
						>
							{scenario}
						</button>
					))}
				</div>
			</div>

			{selectedApp === 'Smart Building' && <SmartBuildingView />}
			{selectedApp === 'Energy Monitoring' && <EnergyMonitoringView />}
			{selectedApp === 'Smart Lighting' && <SmartLightingView />}
		</div>
	);
};

export default Overview;
