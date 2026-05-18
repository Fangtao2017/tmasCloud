import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import RootLayout from './layouts/RootLayout';
import Overview from "./pages/Overview";
import Monitor from "./pages/Monitor";
import RealTimeMonitor from "./pages/RealTimeMonitor";
import LogsCenter from "./pages/LogsCenter";
import Analysis from "./pages/Analysis";
import ConfigurationWorkspace from "./pages/ConfigurationWorkspace";
import Settings from "./pages/Settings";
import Account from "./pages/Account";
import AccountDetails from "./pages/AccountDetails";
import SettingsNetwork from "./pages/settings/Network";
import SettingsMqtt from "./pages/settings/Mqtt";
import SettingsModbus from "./pages/Modbus";
import SettingsSystem from "./pages/settings/System";
import Login from "./pages/Login";
import UserManagement from "./pages/UserManagement";

const App: React.FC = () => {
return (
<AuthProvider>
<Routes>
	<Route path="/login" element={<Login />} />
	{/* Embedded Web - Single Device Layer */}
	<Route path="/" element={<RootLayout />}>
		<Route index element={<Overview />} />
		<Route path="monitor" element={<Monitor />} />
		<Route path="realtime" element={<RealTimeMonitor />} />
		<Route path="realtime/:gatewayId" element={<RealTimeMonitor />} />
		<Route path="alarms" element={<Navigate to="/configuration/workspace?tab=alarms" replace />} />
		<Route path="log" element={<Navigate to="/log/overview" replace />} />
		<Route path="log/overview" element={<LogsCenter />} />
		<Route path="log/list" element={<LogsCenter />} />
		<Route path="log/scheduled" element={<Navigate to="/log/overview" replace />} />
		<Route path="log/change" element={<Navigate to="/log/overview" replace />} />
		<Route path="log/alarm" element={<Navigate to="/log/overview" replace />} />
		<Route path="log/rule" element={<Navigate to="/log/overview" replace />} />
		<Route path="log/health" element={<Navigate to="/log/overview" replace />} />
		<Route path="log/error" element={<Navigate to="/log/overview" replace />} />
		<Route path="log/event" element={<Navigate to="/log/overview" replace />} />
		<Route path="analysis" element={<Analysis />} />
		<Route path="rules" element={<Navigate to="/configuration/workspace?tab=rules" replace />} />

		{/* Devices 区域 */}
		<Route path="devices" element={<Navigate to="/configuration/workspace?tab=devices" replace />} />
		<Route path="devices/add" element={<Navigate to="/configuration/workspace?tab=devices" replace />} />
		<Route path="devices/models" element={<Navigate to="/configuration/workspace?tab=models" replace />} />
		<Route path="devices/parameters" element={<Navigate to="/configuration/workspace?tab=parameters" replace />} />

		{/* Configuration 区域 */}
		<Route path="configuration/workspace" element={<ConfigurationWorkspace />} />
		<Route path="configuration/add-model" element={<Navigate to="/configuration/workspace?tab=models" replace />} />
		<Route path="configuration/add-parameter" element={<Navigate to="/configuration/workspace?tab=parameters" replace />} />
		<Route path="configuration/add-alarm" element={<Navigate to="/configuration/workspace?tab=alarms" replace />} />
		<Route path="configuration/add-rule" element={<Navigate to="/configuration/workspace?tab=rules" replace />} />
		<Route path="configuration/add-modbus" element={<Navigate to="/configuration/workspace?tab=interfaces" replace />} />
		<Route path="configuration/source-interface/modbus" element={<Navigate to="/configuration/workspace?tab=interfaces" replace />} />
		<Route path="configuration/source-interface/di" element={<Navigate to="/configuration/workspace?tab=interfaces" replace />} />
		<Route path="configuration/source-interface/do" element={<Navigate to="/configuration/workspace?tab=interfaces" replace />} />
		<Route path="configuration/source-interface/ai" element={<Navigate to="/configuration/workspace?tab=interfaces" replace />} />

		{/* Settings 区域：嵌套路由 */}
			<Route path="settings" element={<Settings />}>
			<Route index element={<Navigate to="network" replace />} />
			<Route path="network" element={<SettingsNetwork />} />
			<Route path="mqtt" element={<SettingsMqtt />} />
			<Route path="modbus" element={<SettingsModbus />} />
			<Route path="system" element={<SettingsSystem />} />
		</Route>

		{/* Account 页面 */}
		<Route path="account" element={<Account />} />
		<Route path="account/details" element={<AccountDetails />} />
		<Route path="user-management" element={<UserManagement />} />

		<Route path="*" element={<Navigate to="/" replace />} />
	</Route>
</Routes>
</AuthProvider>
);
};


export default App;
