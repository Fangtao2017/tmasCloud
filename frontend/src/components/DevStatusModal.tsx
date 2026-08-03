import React, { useEffect, useState } from 'react';
import { Modal, Tag, Typography } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface DevStatusItem {
	label: string;
	status: 'mock' | 'partial' | 'live';
	note?: string;
}

interface DevStatusModalProps {
	title: string;
	items: DevStatusItem[];
	/** localStorage key — modal won't show again this session if dismissed */
	storageKey: string;
}

const STATUS_CONFIG = {
	mock: { color: 'orange', text: 'Mock Data' },
	partial: { color: 'blue', text: 'Partial Data' },
	live: { color: 'green', text: 'Live Data' },
};

export const DevStatusModal: React.FC<DevStatusModalProps> = ({ title, items, storageKey }) => {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		// Show once per session
		const dismissed = sessionStorage.getItem(storageKey);
		if (!dismissed) setOpen(true);
	}, [storageKey]);

	const handleClose = () => {
		sessionStorage.setItem(storageKey, '1');
		setOpen(false);
	};

	return (
		<Modal
			open={open}
			onCancel={handleClose}
			onOk={handleClose}
			okText="Got it"
			cancelButtonProps={{ style: { display: 'none' } }}
			title={
				<div style={{ paddingRight: 32 }}>
					<div>
						<ExperimentOutlined style={{ marginRight: 8, color: '#faad14' }} />
						<span>Development Status</span>
					</div>
					<div style={{ fontSize: 13, fontWeight: 400, color: '#595959', marginTop: 2 }}>
						{title}
					</div>
				</div>
			}
			width={460}
		>
			<Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
				This page is currently under active development. Some components may use mock data or have unoptimized UI.
			</Paragraph>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
				{items.map((item) => {
					const cfg = STATUS_CONFIG[item.status];
					return (
						<div
							key={item.label}
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'flex-start',
								padding: '8px 12px',
								background: '#fafafa',
								borderRadius: 6,
								border: '1px solid #f0f0f0',
							}}
						>
							<div>
								<Text strong style={{ fontSize: 13 }}>{item.label}</Text>
								{item.note && (
									<Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
										{item.note}
									</Text>
								)}
							</div>
							<Tag color={cfg.color} style={{ marginLeft: 12, flexShrink: 0 }}>{cfg.text}</Tag>
						</div>
					);
				})}
			</div>
		</Modal>
	);
};
