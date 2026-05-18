import { DevStatusModal } from '../components/DevStatusModal';
import React from 'react';
import {
  CheckCircleOutlined,
  ClusterOutlined,
  ControlOutlined,
  CopyOutlined,
  GatewayOutlined,
  LayoutOutlined,
  ReloadOutlined,
  RocketOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  TabletOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGatewayData, sites } from '../hooks/useGatewayData';
import type { CloudGateway, CloudSubDevice } from '../data/cloudData';
import './ConfigurationWorkspace.css';

const { Text } = Typography;

type DomainKey = 'devices' | 'models' | 'parameters' | 'interfaces' | 'alarms' | 'rules' | 'templates';

type ScopedDevice = CloudSubDevice & {
  gatewayName: string;
  gatewayStatus: CloudGateway['status'];
  gatewayProtocol: string;
};

interface ParameterRecord {
  key: string;
  parameter: string;
  expected: string;
  actual: string;
  status: 'aligned' | 'warning' | 'mismatch';
  gatewayName: string;
  deviceName: string;
  deviceType: string;
}

interface TemplateRecord {
  key: string;
  name: string;
  version: string;
  targets: string;
  status: 'active' | 'draft' | 'outdated';
  lastUpdated: string;
}

const BRAND = '#0f5c9b';

/** Tabs that require a gateway to be selected */
const gatewayRequiredTabs: DomainKey[] = ['devices', 'models', 'parameters', 'interfaces', 'alarms', 'rules'];

const domainOptions: Array<{ key: DomainKey; label: string; icon: React.ReactNode }> = [
  { key: 'devices', label: 'Devices', icon: <TabletOutlined /> },
  { key: 'models', label: 'Models', icon: <LayoutOutlined /> },
  { key: 'parameters', label: 'Parameters', icon: <SettingOutlined /> },
  { key: 'interfaces', label: 'Interfaces', icon: <ClusterOutlined /> },
  { key: 'alarms', label: 'Alarms', icon: <WarningOutlined /> },
  { key: 'rules', label: 'Rules', icon: <ControlOutlined /> },
  { key: 'templates', label: 'Templates', icon: <CopyOutlined /> },
];

const templateLibrary: TemplateRecord[] = [
  { key: 'template-1', name: 'Occupancy Sensors - Campus Standard', version: 'v3.2', targets: '2 sites / 4 gateways', status: 'active', lastUpdated: '2 hours ago' },
  { key: 'template-2', name: 'Power Meter Baseline', version: 'v1.9', targets: '3 gateways / 12 devices', status: 'draft', lastUpdated: 'Yesterday' },
  { key: 'template-3', name: 'Air Quality Rollout', version: 'v2.4', targets: '1 site / 8 devices', status: 'outdated', lastUpdated: '5 days ago' },
];

const statusColorMap: Record<TemplateRecord['status'], string> = {
  active: 'green',
  draft: 'gold',
  outdated: 'red',
};

const deviceTypeConfig: Record<string, Array<{ parameter: string; expected: string; variant: string; severity: 'warning' | 'mismatch' }>> = {
  'Air Quality Sensor': [
    { parameter: 'Sampling Interval', expected: '60 sec', variant: '75 sec', severity: 'warning' },
    { parameter: 'Alert Threshold', expected: 'AQI 100', variant: 'AQI 108', severity: 'mismatch' },
    { parameter: 'Reporting Mode', expected: 'Delta + Heartbeat', variant: 'Heartbeat only', severity: 'warning' },
  ],
  'Power Meter': [
    { parameter: 'Polling Interval', expected: '30 sec', variant: '45 sec', severity: 'warning' },
    { parameter: 'CT Ratio', expected: '400/5', variant: '300/5', severity: 'mismatch' },
    { parameter: 'Demand Window', expected: '15 min', variant: '10 min', severity: 'warning' },
  ],
  'Temperature Sensor': [
    { parameter: 'Calibration Offset', expected: '0.5 C', variant: '1.5 C', severity: 'warning' },
    { parameter: 'Sampling Interval', expected: '45 sec', variant: '60 sec', severity: 'warning' },
    { parameter: 'Alarm Band', expected: '18-26 C', variant: '17-28 C', severity: 'mismatch' },
  ],
};

const buildParameterRecords = (devices: ScopedDevice[]): ParameterRecord[] => {
  return devices.flatMap((device, index) => {
    const templates = deviceTypeConfig[device.type] ?? [
      { parameter: 'Polling Interval', expected: '60 sec', variant: '75 sec', severity: 'warning' as const },
      { parameter: 'Reporting Mode', expected: 'Standard', variant: 'High frequency', severity: 'warning' as const },
      { parameter: 'Health Check', expected: 'Enabled', variant: 'Deferred', severity: 'mismatch' as const },
    ];

    return templates.map((template, templateIndex) => {
      const bias = (index + templateIndex + device.lastSeenMinutes) % 4;
      const status: ParameterRecord['status'] = bias <= 1 ? 'aligned' : template.severity;

      return {
        key: `${device.id}-${template.parameter}`,
        parameter: template.parameter,
        expected: template.expected,
        actual: status === 'aligned' ? template.expected : template.variant,
        status,
        gatewayName: device.gatewayName,
        deviceName: device.name,
        deviceType: device.type,
      };
    });
  });
};

const ConfigurationWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { gateways: cloudGateways, loading: gatewaysLoading, error: gatewaysError, refresh } = useGatewayData();
  const requestedTab = searchParams.get('tab');
  const activeTab: DomainKey = domainOptions.some((item) => item.key === requestedTab)
    ? (requestedTab as DomainKey)
    : 'devices';

  const [selectedSiteId, setSelectedSiteId] = React.useState<string>('all');
  const [selectedGatewayId, setSelectedGatewayId] = React.useState<string | null>(null);
  const [gatewaySearch, setGatewaySearch] = React.useState('');
  const [selectedDeviceRowKeys, setSelectedDeviceRowKeys] = React.useState<React.Key[]>([]);
  const [selectedParameterRowKeys, setSelectedParameterRowKeys] = React.useState<React.Key[]>([]);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [templateModalOpen, setTemplateModalOpen] = React.useState(false);
  // Template multi-select: separate gateway selection for template operations
  const [templateGatewayIds, setTemplateGatewayIds] = React.useState<string[]>([]);
  // Template creation form state
  const [newTemplateName, setNewTemplateName] = React.useState('');
  const [newTemplateSourceId, setNewTemplateSourceId] = React.useState<string | null>(null);
  const [newTemplateDomains, setNewTemplateDomains] = React.useState<string[]>(['parameters', 'alarms', 'rules', 'interfaces']);

  const hasGatewaySelected = selectedGatewayId !== null;

  const siteGateways = React.useMemo(
    () => selectedSiteId && selectedSiteId !== 'all'
      ? cloudGateways.filter((gateway) => gateway.siteId === selectedSiteId)
      : cloudGateways,
    [selectedSiteId, cloudGateways],
  );

  const filteredGateways = React.useMemo(() => {
    const query = gatewaySearch.trim().toLowerCase();
    if (query.length === 0) return siteGateways;
    return siteGateways.filter((gateway) =>
      gateway.name.toLowerCase().includes(query)
      || gateway.protocol.toLowerCase().includes(query)
      || gateway.model.toLowerCase().includes(query)
    );
  }, [gatewaySearch, siteGateways]);

  // Reset gateway selection when site changes
  React.useEffect(() => {
    setSelectedGatewayId(null);
    setTemplateGatewayIds([]);
  }, [selectedSiteId]);

  const activeGateway = React.useMemo(
    () => siteGateways.find((gateway) => gateway.id === selectedGatewayId) ?? null,
    [selectedGatewayId, siteGateways],
  );

  const scopedDevices = React.useMemo(() => {
    if (!activeGateway) return [];
    return activeGateway.subDevices.map((device) => ({
      ...device,
      gatewayName: activeGateway.name,
      gatewayStatus: activeGateway.status,
      gatewayProtocol: activeGateway.protocol,
    }));
  }, [activeGateway]);

  const parameterRecords = React.useMemo(() => buildParameterRecords(scopedDevices), [scopedDevices]);


  const selectedDevicesForAction = React.useMemo(
    () => scopedDevices.filter((device) => selectedDeviceRowKeys.includes(device.id)),
    [scopedDevices, selectedDeviceRowKeys],
  );

  const selectedParametersForAction = React.useMemo(
    () => parameterRecords.filter((record) => selectedParameterRowKeys.includes(record.key)),
    [parameterRecords, selectedParameterRowKeys],
  );

  const handleTabChange = (nextTab: string) => {
    const domain = nextTab as DomainKey;
    // Block switching to gateway-required tabs when no gateway selected
    if (!hasGatewaySelected && gatewayRequiredTabs.includes(domain)) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    setSearchParams(next);
  };

  const handleSelectGateway = (gatewayId: string) => {
    setSelectedGatewayId(gatewayId);
    setSelectedDeviceRowKeys([]);
    setSelectedParameterRowKeys([]);
    // Always switch to devices when selecting a gateway
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'devices');
    setSearchParams(next);
  };

  const handleApplyPreview = () => {
    setPreviewOpen(true);
  };

  const deviceColumns: ColumnsType<ScopedDevice> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      fixed: 'left',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Model Name',
      dataIndex: 'type',
      key: 'type',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Location',
      dataIndex: 'zone',
      key: 'zone',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Network Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => (
        <Badge
          status={status === 'online' ? 'success' : 'error'}
          text={status === 'online' ? 'Online' : 'Offline'}
        />
      ),
    },
    {
      title: 'Reading',
      dataIndex: 'reading',
      key: 'reading',
      width: 120,
    },
  ];

  const parameterColumns: ColumnsType<ParameterRecord> = [
    {
      title: 'Parameter Name',
      dataIndex: 'parameter',
      key: 'parameter',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      sorter: (a, b) => a.parameter.localeCompare(b.parameter),
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Device Model',
      dataIndex: 'deviceType',
      key: 'deviceType',
      width: 150,
      ellipsis: true,
      sorter: (a, b) => a.deviceType.localeCompare(b.deviceType),
    },
    {
      title: 'Device',
      dataIndex: 'deviceName',
      key: 'deviceName',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Expected',
      dataIndex: 'expected',
      key: 'expected',
      width: 120,
    },
    {
      title: 'Actual',
      dataIndex: 'actual',
      key: 'actual',
      width: 120,
      render: (value: string, record) => (
        <Tag color={record.status === 'aligned' ? 'green' : record.status === 'warning' ? 'gold' : 'red'}>{value}</Tag>
      ),
    },
    {
      title: 'Gateway',
      dataIndex: 'gatewayName',
      key: 'gatewayName',
      width: 150,
      ellipsis: true,
    },
  ];

  const modelRows = React.useMemo(() => {
    const usage = new Map<string, { devices: number; parameters: string[]; updatedAt: string }>();

    scopedDevices.forEach((device) => {
      const entry = usage.get(device.type) ?? { devices: 0, parameters: [], updatedAt: '2026-03-28' };
      entry.devices += 1;
      const params = deviceTypeConfig[device.type]?.map((p) => p.parameter) ?? ['Polling Interval', 'Reporting Mode'];
      entry.parameters = params;
      usage.set(device.type, entry);
    });

    return Array.from(usage.entries()).map(([type, entry]) => ({
      key: type,
      model: type,
      type: type.includes('Sensor') ? 'Sensor' : type.includes('Meter') ? 'Meter' : 'Controller',
      brand: type.includes('Air') ? 'Sensirion' : type.includes('Power') ? 'Schneider' : type.includes('Temperature') ? 'Honeywell' : 'Generic',
      parameterCount: entry.parameters.length,
      parameters: entry.parameters,
      usageCount: entry.devices,
      updatedAt: entry.updatedAt,
    }));
  }, [scopedDevices]);

  const interfaceRows = React.useMemo(() => {
    if (!activeGateway) return [];
    return activeGateway.subDevices.map((device, index) => ({
      key: `${activeGateway.id}-modbus-${index}`,
      id: index + 1,
      model: device.type,
      att: device.name,
      reg: 40000 + index * 10,
      readFC: 3,
      writeFC: 6,
      timeout: 3000,
      poll_intvl: 60,
      poll_speed: 9600,
    }));
  }, [activeGateway]);

  const alarmRows = React.useMemo(() => scopedDevices.filter((device) => device.alarm).map((device, index) => {
    const paramName = device.type.includes('Temperature') ? 'Temperature' : device.type.includes('Air') ? 'AQI' : 'Power';
    const operator = '>';
    const value = device.type.includes('Temperature') ? '26' : device.type.includes('Air') ? '100' : '500';
    return {
      key: `${device.id}-alarm`,
      id: index + 1,
      name: `${device.name} - ${paramName} Alert`,
      param_id: index + 1,
      paramName,
      operator,
      value,
    };
  }), [scopedDevices]);

  const ruleRows = React.useMemo(() => {
    if (!activeGateway) return [];
    const rules = activeGateway.subDevices.slice(0, 3).map((device, index) => {
      const paramName = device.type.includes('Temperature') ? 'Temperature' : device.type.includes('Air') ? 'AQI' : 'Power';
      return {
        key: `${activeGateway.id}-rule-${index}`,
        ruleName: `${device.name} - Auto ${paramName} Control`,
        conditions: [
          { device: device.name, parameter: paramName, operator: '>', value: device.type.includes('Temperature') ? '26' : '100' },
        ],
        enabled: device.status === 'online',
      };
    });
    return rules;
  }, [activeGateway]);

  const selectionCount = activeTab === 'parameters' ? selectedParameterRowKeys.length : selectedDeviceRowKeys.length;

  const renderDevicesTab = () => (
    <Card className="configuration-workspace__panel">
      <Table
        rowKey="id"
        dataSource={scopedDevices}
        columns={deviceColumns}
        rowSelection={{ selectedRowKeys: selectedDeviceRowKeys, onChange: setSelectedDeviceRowKeys }}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 850 }}
      />
    </Card>
  );

  const renderModelsTab = () => (
    <Card className="configuration-workspace__panel">
      <Table
        rowKey="key"
        dataSource={modelRows}
        pagination={false}
        columns={[
          {
            title: 'Model',
            dataIndex: 'model',
            key: 'model',
            width: 200,
            fixed: 'left' as const,
            ellipsis: true,
            sorter: (a: typeof modelRows[0], b: typeof modelRows[0]) => a.model.localeCompare(b.model),
            render: (text: string) => <strong>{text}</strong>,
          },
          {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: (type: string) => <Tag color="default">{type}</Tag>,
          },
          {
            title: 'Brand',
            dataIndex: 'brand',
            key: 'brand',
            width: 120,
          },
          {
            title: 'Parameters',
            dataIndex: 'parameterCount',
            key: 'parameterCount',
            width: 120,
            sorter: (a: typeof modelRows[0], b: typeof modelRows[0]) => a.parameterCount - b.parameterCount,
            render: (count: number) => <Tag>{count}</Tag>,
          },
          {
            title: 'Usage',
            dataIndex: 'usageCount',
            key: 'usageCount',
            width: 100,
            sorter: (a: typeof modelRows[0], b: typeof modelRows[0]) => a.usageCount - b.usageCount,
            render: (count: number) => (
              <Tag color={count > 0 ? '#003A70' : 'default'} style={count > 0 ? { color: '#fff', borderColor: '#003A70' } : {}}>{count} Devices</Tag>
            ),
          },
          {
            title: 'Last Updated',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 150,
          },
        ]}
      />
    </Card>
  );

  const renderParametersTab = () => (
    <Card className="configuration-workspace__panel">
      <Table
        rowKey="key"
        dataSource={parameterRecords}
        columns={parameterColumns}
        rowSelection={{ selectedRowKeys: selectedParameterRowKeys, onChange: setSelectedParameterRowKeys }}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 900 }}
      />
    </Card>
  );

  const renderInterfacesTab = () => (
    <Card className="configuration-workspace__panel">
      <Table
        rowKey="key"
        dataSource={interfaceRows}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }}
        columns={[
          { title: 'ID', dataIndex: 'id', key: 'id', width: 70, sorter: (a: typeof interfaceRows[0], b: typeof interfaceRows[0]) => a.id - b.id },
          { title: 'Model', dataIndex: 'model', key: 'model', width: 180, ellipsis: true },
          { title: 'Att', dataIndex: 'att', key: 'att', ellipsis: true, render: (text: string) => <strong>{text}</strong> },
          { title: 'Reg', dataIndex: 'reg', key: 'reg', width: 70 },
          { title: <span style={{ whiteSpace: 'nowrap' }}>ReadFC</span>, dataIndex: 'readFC', key: 'readFC', width: 80 },
          { title: <span style={{ whiteSpace: 'nowrap' }}>WriteFC</span>, dataIndex: 'writeFC', key: 'writeFC', width: 80 },
          { title: 'Timeout', dataIndex: 'timeout', key: 'timeout', width: 80 },
          { title: <span style={{ whiteSpace: 'nowrap' }}>Poll Intvl</span>, dataIndex: 'poll_intvl', key: 'poll_intvl', width: 90 },
          { title: <span style={{ whiteSpace: 'nowrap' }}>Poll Speed</span>, dataIndex: 'poll_speed', key: 'poll_speed', width: 90 },
        ]}
      />
    </Card>
  );

  const renderAlarmsTab = () => (
    <Card className="configuration-workspace__panel">
      <Table
        rowKey="key"
        dataSource={alarmRows}
        pagination={false}
        locale={{ emptyText: 'No active alarm bindings in current scope' }}
        columns={[
          { title: 'ID', dataIndex: 'id', key: 'id', width: 80, fixed: 'left' as const },
          { title: 'Alarm Name', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' as const, render: (text: string) => <strong>{text}</strong> },
          {
            title: 'Condition',
            key: 'condition',
            render: (_: unknown, record: typeof alarmRows[0]) => (
              <Tag>{`${record.paramName} ${record.operator} ${record.value}`}</Tag>
            ),
          },
        ]}
      />
    </Card>
  );

  const renderRulesTab = () => (
    <Card className="configuration-workspace__panel">
      <Table
        rowKey="key"
        dataSource={ruleRows}
        pagination={false}
        columns={[
          {
            title: 'Rule Name',
            dataIndex: 'ruleName',
            key: 'ruleName',
            width: 250,
            ellipsis: true,
            render: (text: string) => <strong>{text}</strong>,
          },
          {
            title: 'Condition',
            key: 'condition',
            render: (_: unknown, record: typeof ruleRows[0]) => (
              <Space direction="vertical" size={2}>
                {record.conditions.map((c, i) => (
                  <Tag key={i} color="blue">
                    {c.device ? `${c.device}: ` : ''}{c.parameter} {c.operator} {c.value}
                  </Tag>
                ))}
              </Space>
            ),
          },
          {
            title: 'En',
            dataIndex: 'enabled',
            key: 'enabled',
            width: 100,
            align: 'center' as const,
            render: (enabled: boolean) => (
              <Tag color={enabled ? 'green' : 'red'}>
                {enabled ? 'Enable' : 'Disable'}
              </Tag>
            ),
          },
        ]}
      />
    </Card>
  );

  const renderTemplatesTab = () => {
    const templateScopedGateways = siteGateways.filter((gateway) => templateGatewayIds.includes(gateway.id));
    const templateDeviceCount = templateScopedGateways.reduce((sum, gw) => sum + gw.subDevices.length, 0);
    const currentStep = templateGatewayIds.length === 0 ? 0 : 1;

    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* Header */}
        <Card className="configuration-workspace__panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text strong style={{ fontSize: 16 }}>Multi-Gateway Batch Configuration</Text>
              <div><Text type="secondary">Apply a saved configuration template to multiple gateways at once</Text></div>
            </div>
            <Button icon={<SaveOutlined />} onClick={() => { setNewTemplateSourceId(selectedGatewayId); setTemplateModalOpen(true); }}>
              Create Template
            </Button>
          </div>
        </Card>

        {/* Workflow steps */}
        <Card className="configuration-workspace__panel">
          <Steps
            current={currentStep}
            size="small"
            style={{ marginBottom: 20 }}
            items={[
              { title: 'Select Gateways', description: templateGatewayIds.length > 0 ? `${templateGatewayIds.length} selected` : 'Choose targets' },
              { title: 'Choose Template', description: templateGatewayIds.length > 0 ? 'Pick or create' : 'Waiting' },
              { title: 'Apply', description: 'Push config' },
            ]}
          />
          <Divider style={{ margin: '0 0 16px' }} />

          {/* Step 1: Gateway multi-select */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>Target Gateways</Text>
              <Space size={8}>
                <Button size="small" type="link" onClick={() => setTemplateGatewayIds(siteGateways.map((gw) => gw.id))}>Select All</Button>
                <Button size="small" type="link" onClick={() => setTemplateGatewayIds([])}>Clear</Button>
              </Space>
            </div>
            <div className="configuration-workspace__template-gateway-grid">
              {siteGateways.map((gateway) => {
                const checked = templateGatewayIds.includes(gateway.id);
                return (
                  <div
                    key={gateway.id}
                    className={`configuration-workspace__template-gateway-item ${checked ? 'configuration-workspace__template-gateway-item--selected' : ''}`}
                    onClick={() => {
                      setTemplateGatewayIds((prev) =>
                        checked ? prev.filter((id) => id !== gateway.id) : [...prev, gateway.id]
                      );
                    }}
                  >
                    <Checkbox checked={checked} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 13 }}>{gateway.name}</Text>
                      <div><Text type="secondary" style={{ fontSize: 11 }}>{gateway.protocol} · {gateway.subDevices.length} devices</Text></div>
                    </div>
                    <Tag color={gateway.status === 'online' ? 'green' : gateway.status === 'degraded' ? 'gold' : 'default'} style={{ margin: 0 }}>
                      {gateway.status}
                    </Tag>
                  </div>
                );
              })}
            </div>
            {templateGatewayIds.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Tag color="blue">{templateGatewayIds.length} gateways · {templateDeviceCount} devices in scope</Tag>
              </div>
            )}
          </div>

          {templateGatewayIds.length === 0 && (
            <Alert type="info" showIcon message="Select one or more gateways above to proceed" />
          )}
        </Card>

        {/* Step 2: Template library — only visible when gateways selected */}
        {templateGatewayIds.length > 0 && (
          <Card className="configuration-workspace__panel" title="Available Templates" extra={<Tag color="blue">{templateLibrary.length} templates</Tag>}>
            <div className="configuration-workspace__template-card-list">
              {templateLibrary.map((template) => (
                <div key={template.key} className="configuration-workspace__template-detail-card">
                  <div className="configuration-workspace__template-detail-top">
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 14 }}>{template.name}</Text>
                      <div style={{ marginTop: 4 }}>
                        <Space size={6}>
                          <Tag style={{ margin: 0 }}>{template.version}</Tag>
                          <Tag color={statusColorMap[template.status]} style={{ margin: 0 }}>{template.status}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>Updated {template.lastUpdated}</Text>
                        </Space>
                      </div>
                    </div>
                    <Space size={8}>
                      <Button
                        type="primary"
                        icon={<SwapOutlined />}
                        onClick={() => message.success(`Template "${template.name}" applied to ${templateGatewayIds.length} gateways (${templateDeviceCount} devices)`)}
                      >
                        Apply to {templateGatewayIds.length} gateways
                      </Button>
                      <Button icon={<CopyOutlined />} onClick={() => message.info(`Duplicated "${template.name}"`)}>Clone</Button>
                    </Space>
                  </div>
                  <div className="configuration-workspace__template-detail-content">
                    <Text type="secondary" style={{ fontSize: 12 }}>Contains:</Text>
                    <Space size={4} wrap style={{ marginTop: 4 }}>
                      <Tag>Parameters: Polling, Reporting, Thresholds</Tag>
                      <Tag>Alarms: 3 rules</Tag>
                      <Tag>Interfaces: Protocol config</Tag>
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Last applied to: {template.targets}</Text>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </Space>
    );
  };

  const renderTabContent = () => {
    // Templates tab is always accessible
    if (activeTab === 'templates') return renderTemplatesTab();

    // Other tabs require a gateway
    if (!activeGateway) {
      return (
        <Card className="configuration-workspace__panel">
          <div className="configuration-workspace__empty-state">
            <GatewayOutlined style={{ fontSize: 40, color: '#bfbfbf' }} />
            <Text strong style={{ fontSize: 16, marginTop: 12 }}>Select a Gateway</Text>
            <Text type="secondary">Choose a gateway from the left panel to view its devices, parameters, and configuration</Text>
          </div>
        </Card>
      );
    }

    switch (activeTab) {
      case 'models':
        return renderModelsTab();
      case 'parameters':
        return renderParametersTab();
      case 'interfaces':
        return renderInterfacesTab();
      case 'alarms':
        return renderAlarmsTab();
      case 'rules':
        return renderRulesTab();
      case 'devices':
      default:
        return renderDevicesTab();
    }
  };

  const gatewayStatusColor = (status: CloudGateway['status']) =>
    status === 'online' ? '#52c41a' : status === 'degraded' ? '#faad14' : '#d9d9d9';

  return (
    <div className="configuration-workspace">
      <DevStatusModal
        title="Configuration"
        storageKey="dev_status_config"
        items={[
          { label: 'Data Display', status: 'partial', note: 'Connected to real data' },
          { label: 'Add / Update / Delete / Clear', status: 'mock', note: 'Write operations are not yet connected to backend' },
          { label: 'UI Layout', status: 'partial', note: 'Some stacking and layout issues remain' },
        ]}
      />
      <div className="configuration-workspace__layout">
        {/* Left: Gateway selector */}
        <div className="configuration-workspace__gateway-panel">
          <Card className="configuration-workspace__panel configuration-workspace__panel--gateway" styles={{ body: { padding: '12px' } }}>
            <div className="configuration-workspace__gateway-header">
              <Select
                value={selectedSiteId}
                onChange={setSelectedSiteId}
                options={[{ value: 'all', label: 'All Sites' }, ...sites.map((site) => ({ value: site.id, label: site.name }))]}
                style={{ width: '100%' }}
                size="small"
              />
            </div>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search gateways"
              value={gatewaySearch}
              onChange={(e) => setGatewaySearch(e.target.value)}
              size="small"
              allowClear
              style={{ marginTop: 8 }}
            />
            <div className="configuration-workspace__gateway-list">
              {gatewaysLoading && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}><Spin /></div>
              )}
              {gatewaysError && (
                <Alert type="error" message={gatewaysError} style={{ margin: '8px 0' }} />
              )}
              {!gatewaysLoading && filteredGateways.map((gateway) => {
                const isActive = gateway.id === selectedGatewayId;
                return (
                  <div
                    key={gateway.id}
                    className={`configuration-workspace__gateway-item ${isActive ? 'configuration-workspace__gateway-item--active' : ''}`}
                    onClick={() => handleSelectGateway(gateway.id)}
                  >
                    <Badge color={gatewayStatusColor(gateway.status)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 13 }}>{gateway.name}</Text>
                      <div><Text type="secondary" style={{ fontSize: 11 }}>{gateway.protocol} · {gateway.subDevices.length} devices</Text></div>
                    </div>
                    {isActive && <CheckCircleOutlined style={{ color: BRAND, fontSize: 14 }} />}
                  </div>
                );
              })}
              {!gatewaysLoading && filteredGateways.length === 0 && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No gateways found" style={{ margin: '16px 0' }} />
              )}
            </div>
          </Card>
          {/* Selected gateway detail card */}
          {activeGateway && (
            <Card className="configuration-workspace__panel configuration-workspace__gateway-detail" size="small" styles={{ body: { padding: '10px 12px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <GatewayOutlined style={{ color: BRAND, fontSize: 16 }} />
                <Text strong style={{ fontSize: 14 }}>{activeGateway.name}</Text>
                <Tag color={activeGateway.status === 'online' ? 'green' : activeGateway.status === 'degraded' ? 'gold' : 'default'} style={{ margin: 0 }}>
                  {activeGateway.status}
                </Tag>
              </div>
              <div className="configuration-workspace__gateway-detail-grid">
                <div><Text type="secondary" style={{ fontSize: 11 }}>Model</Text><div><Text style={{ fontSize: 12 }}>{activeGateway.model}</Text></div></div>
                <div><Text type="secondary" style={{ fontSize: 11 }}>Protocol</Text><div><Text style={{ fontSize: 12 }}>{activeGateway.protocol}</Text></div></div>
                <div><Text type="secondary" style={{ fontSize: 11 }}>Devices</Text><div><Text style={{ fontSize: 12 }}>{activeGateway.subDevices.length}</Text></div></div>
                <div><Text type="secondary" style={{ fontSize: 11 }}>Health</Text><div><Text style={{ fontSize: 12 }}>{activeGateway.healthScore}%</Text></div></div>
              </div>
            </Card>
          )}
        </div>

        {/* Right: Tabs + content */}
        <div className="configuration-workspace__main">
          <Card className="configuration-workspace__tabs-shell" styles={{ body: { padding: 0 } }}>
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              items={domainOptions.map((domain) => {
                const disabled = !hasGatewaySelected && gatewayRequiredTabs.includes(domain.key);
                return {
                  key: domain.key,
                  disabled,
                  label: (
                    <Space size={8} style={disabled ? { color: '#bfbfbf', cursor: 'not-allowed' } : undefined}>
                      {domain.icon}
                      <span>{domain.label}</span>
                    </Space>
                  ),
                };
              })}
              tabBarExtraContent={hasGatewaySelected ? {
                right: (
                  <Space size={8} style={{ marginRight: 12 }} wrap>
                    {activeGateway && <Tag color="blue" style={{ margin: 0 }}><GatewayOutlined /> {activeGateway.name}</Tag>}
                    {selectionCount > 0 && (
                      <Tag color="geekblue" style={{ margin: 0 }}>{selectionCount} selected</Tag>
                    )}
                    <Button size="small" icon={<RocketOutlined />} onClick={handleApplyPreview} disabled={selectionCount === 0}>Preview</Button>
                    <Button size="small" type="primary" icon={<RocketOutlined />} onClick={() => navigate('/realtime')}>Monitoring</Button>
                    <Button size="small" icon={<ReloadOutlined />} onClick={refresh}>Refresh</Button>
                  </Space>
                ),
              } : undefined}
            />
          </Card>

          {renderTabContent()}
        </div>
      </div>

      <Modal
        title="Preview Configuration Changes"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        onOk={() => {
          setPreviewOpen(false);
          message.success(`Queued ${activeTab === 'parameters' ? selectedParametersForAction.length : selectedDevicesForAction.length} changes for ${activeGateway?.name ?? 'gateway'}`);
        }}
        okText="Apply Changes"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="Review grouped targets before applying"
            description="This mock flow previews the roll-out sequence by gateway to support safe cloud-scale edits."
          />
          <Divider style={{ margin: '4px 0' }} />
          {activeTab === 'parameters' ? selectedParametersForAction.map((row) => (
            <div key={row.key} className="configuration-workspace__preview-row">
              <div>
                <Text strong>{row.parameter}</Text>
                <div><Text type="secondary">{row.deviceName} · {row.gatewayName}</Text></div>
              </div>
              <Tag color={row.status === 'aligned' ? 'green' : row.status === 'warning' ? 'gold' : 'red'}>{row.actual}</Tag>
            </div>
          )) : selectedDevicesForAction.map((device) => (
            <div key={device.id} className="configuration-workspace__preview-row">
              <div>
                <Text strong>{device.name}</Text>
                <div><Text type="secondary">{device.gatewayName} · {device.type}</Text></div>
              </div>
              <Tag>{device.status}</Tag>
            </div>
          ))}
        </Space>
      </Modal>

      <Modal
        title="Create Configuration Template"
        open={templateModalOpen}
        onCancel={() => { setTemplateModalOpen(false); setNewTemplateName(''); setNewTemplateSourceId(null); }}
        onOk={() => {
          if (!newTemplateName.trim()) { message.warning('Please enter a template name'); return; }
          if (!newTemplateSourceId) { message.warning('Please select a source gateway'); return; }
          if (newTemplateDomains.length === 0) { message.warning('Please select at least one domain to include'); return; }
          setTemplateModalOpen(false);
          message.success(`Template "${newTemplateName}" created from ${siteGateways.find((gw) => gw.id === newTemplateSourceId)?.name ?? 'gateway'}`);
          setNewTemplateName('');
          setNewTemplateSourceId(null);
        }}
        okText="Create Template"
        width={520}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert type="info" showIcon message="A template captures a gateway's current configuration so it can be applied to other gateways later." />

          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Template Name</Text>
            <Input
              placeholder="e.g. Standard Occupancy Sensor Config"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Source Gateway</Text>
            <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
              The configuration will be captured from this gateway
            </Text>
            <Select
              placeholder="Select a gateway as source"
              value={newTemplateSourceId}
              onChange={setNewTemplateSourceId}
              options={siteGateways.map((gw) => ({
                value: gw.id,
                label: `${gw.name} (${gw.protocol} · ${gw.subDevices.length} devices)`,
              }))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Include in Template</Text>
            <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
              Choose which configuration domains to capture
            </Text>
            <Checkbox.Group
              value={newTemplateDomains}
              onChange={(values) => setNewTemplateDomains(values as string[])}
              options={[
                { label: 'Parameters (polling intervals, thresholds, calibration)', value: 'parameters' },
                { label: 'Alarms (alarm rules and bindings)', value: 'alarms' },
                { label: 'Rules (automation and override rules)', value: 'rules' },
                { label: 'Interfaces (protocol and communication settings)', value: 'interfaces' },
              ]}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            />
          </div>

          {newTemplateSourceId && (
            <div style={{ padding: '10px 12px', background: '#f6f9fc', borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Preview: Will capture <b>{newTemplateDomains.length}</b> domain(s) from <b>{siteGateways.find((gw) => gw.id === newTemplateSourceId)?.name}</b> and save as a draft template.</Text>
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default ConfigurationWorkspace;
