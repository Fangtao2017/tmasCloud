// RootLayout.tsx - Protected layout with auth guard
import React from 'react';
import { Layout, Spin } from 'antd';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import SecondaryNav from '../components/SecondaryNav';
import TopNav from '../components/TopNav';
import { useAuth } from '../context/AuthContext';

const { Header, Content } = Layout;

const RootLayout: React.FC = () => {
	const { isAuthenticated, isLoading } = useAuth();
	const location = useLocation();

	// Show loading spinner while checking auth state
	if (isLoading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
				<Spin size="large" />
			</div>
		);
	}

	// Redirect to login if not authenticated
	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location.pathname }} replace />;
	}

	return (
		<Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			{/* 顶部区域：放 Logo、标题、右侧占位（用户、设置等） */}
			<Header style={{ 
				padding: 0, 
				background: '#ffffff', 
				borderBottom: 'none',
				height: 'auto',
				lineHeight: 'normal',
				zIndex: 10,
				flex: '0 0 auto',
				display: 'flex',
				flexDirection: 'column'
			}}>
				<div style={{ height: 56, flex: '0 0 56px' }}>
					<TopNav />
				</div>
				<SecondaryNav />
			</Header>
			
			{/* 内容区：承载子路由页面 */}
			<Content style={{ 
				padding: '16px', 
				background: '#ffffff', 
				flex: '1 1 auto', 
				overflow: 'auto',
				position: 'relative'
			}}>
				<div style={{ maxWidth: 1600, margin: '0 auto', width: '100%' }}>
					{/* Outlet 渲染 <Route path="/"> 的子路由页面 */}
					<Outlet />
				</div>
			</Content>
		</Layout>
	);
};

export default RootLayout;
