import React from 'react';
import { DevStatusModal } from '../components/DevStatusModal';

const Page: React.FC = () => (
	<div style={{ minHeight: '60vh' }}>
		<DevStatusModal
			title="System"
			storageKey="dev_status_system"
			items={[
				{ label: 'System Settings', status: 'mock', note: 'Page is under development' },
			]}
		/>
	</div>
);

export default Page;
