import { DevStatusModal } from '../components/DevStatusModal';
import React from 'react';
import {
  CheckCircleOutlined,
  ClusterOutlined,
  ControlOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  GatewayOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RocketOutlined,
  SaveOutlined,
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
  Descriptions,
  Divider,
  Drawer,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Steps,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGatewayData, useSites } from '../hooks/useGatewayData';
import { requestReadSetting, updateDevice as apiUpdateDevice, deleteDevice as apiDeleteDevice, createDevice as apiCreateDevice, getT8000Parameters, getT8000Models } from '../services/api';
import type { T8000Parameter, T8000Model } from '../services/api';
import type { CloudGateway, CloudSubDevice } from '../data/cloudData';
import './ConfigurationWorkspace.css';

const { Text } = Typography;

// ── Add Device wizard helpers ─────────────────────────────
type T8000ModelInfo = T8000Model;
interface AddFormState {
  name: string; firmwareVersion: string; modbusAddress: string; secondaryAddress: string; tertiaryAddress: string;
  loggingInterval: string; reportingInterval: string; healthInterval: string; enabled: string;
  locationName: string; locationSubname: string; blockNumber: string; floorUnit: string;
  postalCode: string; latitude: string; longitude: string; heightFromFloor: string; locationAddress: string;
}
const INTERVAL_OPTIONS = ['Disabled', '5 min', '15 min', '30 min', '1 hr', '6 hr', '12 hr', '24 hr'];
const HEALTH_OPTIONS = ['Disabled', 'Enabled'];
const ONOFF_OPTIONS = ['Enabled', 'Disabled'];
const EMPTY_ADD_FORM: AddFormState = {
  name: '', firmwareVersion: '', modbusAddress: '', secondaryAddress: '', tertiaryAddress: '',
  loggingInterval: 'Disabled', reportingInterval: 'Disabled', healthInterval: 'Disabled', enabled: 'Enabled',
  locationName: '', locationSubname: '', blockNumber: '', floorUnit: '',
  postalCode: '', latitude: '', longitude: '', heightFromFloor: '', locationAddress: '',
};

type DomainKey = 'devices' | 'parameters' | 'interfaces' | 'alarms' | 'rules' | 'templates';

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

// BRAND kept for potential future use
// const BRAND = '#0f5c9b';

/** Tabs that require a gateway to be selected */
const gatewayRequiredTabs: DomainKey[] = ['devices', 'parameters', 'interfaces', 'alarms', 'rules'];

const domainOptions: Array<{ key: DomainKey; label: string; icon: React.ReactNode }> = [
  { key: 'devices', label: 'Devices', icon: <TabletOutlined /> },
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
  const { gateways: cloudGateways, loading: gatewaysLoading, refresh } = useGatewayData();
  const apiSites = useSites();
  const requestedTab = searchParams.get('tab');
  const activeTab: DomainKey = domainOptions.some((item) => item.key === requestedTab)
    ? (requestedTab as DomainKey)
    : 'devices';

  const [selectedSiteId, setSelectedSiteId] = React.useState<string>('all');
  const [selectedGatewayId, setSelectedGatewayId] = React.useState<string | null>(null);
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
    // Trigger read_setting to get fresh device list from gateway
    const gwNum = parseInt(gatewayId);
    if (!isNaN(gwNum)) {
      requestReadSetting(gwNum).catch(() => {});
    }
    // Always switch to devices when selecting a gateway
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'devices');
    setSearchParams(next);
  };

  // ── Device tab state ─────────────────────────────────────
  const [detailDevice, setDetailDevice] = React.useState<ScopedDevice | null>(null);
  const [editDevice, setEditDevice] = React.useState<ScopedDevice | null>(null);
  const [editFormName, setEditFormName] = React.useState('');
  const [editFormZone, setEditFormZone] = React.useState('');
  const [editSaving, setEditSaving] = React.useState(false);

  const handleEditOpen = (device: ScopedDevice) => {
    setEditDevice(device);
    setEditFormName(device.name);
    setEditFormZone(device.zone === '—' ? '' : device.zone);
  };

  const handleEditSave = async () => {
    if (!editDevice) return;
    setEditSaving(true);
    try {
      await apiUpdateDevice(parseInt(editDevice.id), { name: editFormName.trim() || undefined, zone: editFormZone });
      message.success('Device updated');
      setEditDevice(null);
      refresh();
    } catch {
      message.error('Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleEnabled = async (device: ScopedDevice, enabled: boolean) => {
    try {
      await apiUpdateDevice(parseInt(device.id), { enabled });
      refresh();
    } catch {
      message.error('Failed to update device');
    }
  };

  const handleDeleteDevice = async (device: ScopedDevice) => {
    try {
      await apiDeleteDevice(parseInt(device.id));
      message.success(`Device "${device.name}" deleted`);
      refresh();
    } catch {
      message.error('Failed to delete device');
    }
  };

  // ── Add Device wizard state ───────────────────────────────
  const [addOpen, setAddOpen] = React.useState(false);
  const [addStep, setAddStep] = React.useState(0);
  const [addModels, setAddModels] = React.useState<T8000ModelInfo[]>([]);
  const [addModelsLoading, setAddModelsLoading] = React.useState(false);
  const [addModelSearch, setAddModelSearch] = React.useState('');
  const [addSelectedModel, setAddSelectedModel] = React.useState<T8000ModelInfo | null>(null);
  const [addAutoParams, setAddAutoParams] = React.useState<Array<{ parameter: string; unit: string }>>([]);
  const [addForm, setAddForm] = React.useState<AddFormState>(EMPTY_ADD_FORM);
  const [addLocationExpanded, setAddLocationExpanded] = React.useState(false);
  const [addSaving, setAddSaving] = React.useState(false);

  const resetAddWizard = React.useCallback(() => {
    setAddStep(0);
    setAddSelectedModel(null);
    setAddModelSearch('');
    setAddAutoParams([]);
    setAddLocationExpanded(false);
    setAddForm(EMPTY_ADD_FORM);
  }, []);

  // Fetch model list when wizard opens
  React.useEffect(() => {
    if (!addOpen) return;
    setAddModelsLoading(true);
    getT8000Models()
      .then((data) => setAddModels(data))
      .catch(() => setAddModels([]))
      .finally(() => setAddModelsLoading(false));
  }, [addOpen]);

  // Fetch params for selected model (for preview step)
  React.useEffect(() => {
    if (!addSelectedModel) { setAddAutoParams([]); return; }
    getT8000Parameters(String(addSelectedModel.id))
      .then((data: T8000Parameter[]) =>
        setAddAutoParams(data.map((p) => ({ parameter: p.parameter ?? p.attr ?? '?', unit: p.unit ?? '' })))
      )
      .catch(() => setAddAutoParams([]));
  }, [addSelectedModel]);

  const handleAddConfirm = async () => {
    setAddSaving(true);
    try {
      await apiCreateDevice({
        gateway_id: parseInt(activeGateway!.id),
        name: addForm.name.trim(),
        model: addSelectedModel?.model ?? null,
        modbus_address: addForm.modbusAddress ? parseInt(addForm.modbusAddress) : null,
        zone: addForm.locationName.trim() || addForm.blockNumber.trim() || null,
        enabled: addForm.enabled === 'Enabled' ? 1 : 0,
        external_device_id: addForm.modbusAddress.trim() || null,
      });
      setAddStep(3);
      refresh();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to create device');
    } finally {
      setAddSaving(false);
    }
  };

  const handleApplyPreview = () => {
    setPreviewOpen(true);
  };

  const deviceColumns: ColumnsType<ScopedDevice> = [
    {
      title: 'ID',
      key: 'extId',
      width: 100,
      fixed: 'left' as const,
      render: (_: unknown, record: ScopedDevice) => record.externalDeviceId ?? parseInt(record.id),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      fixed: 'left' as const,
      ellipsis: true,
      sorter: (a: ScopedDevice, b: ScopedDevice) => a.name.localeCompare(b.name),
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Location',
      dataIndex: 'zone',
      key: 'zone',
      width: 140,
      ellipsis: true,
      render: (v: string) => v && v !== '—' ? v : <Text type="secondary">—</Text>,
    },
    {
      title: 'Network Addr',
      dataIndex: 'modbusAddress',
      key: 'modbusAddress',
      width: 120,
      render: (v: number | null) => v != null ? v : <Text type="secondary">—</Text>,
    },
    {
      title: 'Network Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      filters: [{ text: 'Online', value: 'online' }, { text: 'Offline', value: 'offline' }],
      onFilter: (value: unknown, record: ScopedDevice) => record.status === value,
      render: (status: string) => (
        <Badge
          status={status === 'online' ? 'success' : 'default'}
          text={status === 'online' ? 'Online' : 'Offline'}
        />
      ),
    },
    {
      title: 'Enabled',
      key: 'enabled',
      width: 90,
      render: (_: unknown, record: ScopedDevice) => (
        <Switch
          checked={record.enabled !== 0}
          size="small"
          onChange={(checked) => handleToggleEnabled(record, checked)}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 195,
      fixed: 'right' as const,
      render: (_: unknown, record: ScopedDevice) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => setDetailDevice(record)}
          >
            Details
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditOpen(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete device?"
            description={`Remove "${record.name}" from this gateway?`}
            onConfirm={() => handleDeleteDevice(record)}
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
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

  // ── Add Device wizard render ──────────────────────────────
  const filteredModels = React.useMemo(() => {
    const q = addModelSearch.toLowerCase();
    if (!q) return addModels;
    return addModels.filter(
      (m) =>
        String(m.model ?? '').toLowerCase().includes(q) ||
        String(m.brand ?? '').toLowerCase().includes(q) ||
        String(m.dev_type ?? '').toLowerCase().includes(q),
    );
  }, [addModels, addModelSearch]);

  const fieldLabel = (text: string, required = false) => (
    <span style={{ fontSize: 12, color: '#00000073', display: 'block', marginBottom: 4 }}>
      {required && <span style={{ color: '#ff4d4f', marginRight: 2 }}>*</span>}{text}
    </span>
  );

  const formField = (label: string, content: React.ReactNode, required = false) => (
    <div>
      {fieldLabel(label, required)}
      {content}
    </div>
  );

  const renderAddStep0 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Input
        placeholder="Search sensor models..."
        value={addModelSearch}
        onChange={(e) => setAddModelSearch(e.target.value)}
        allowClear
      />
      {addModelsLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}><Spin /></div>
      ) : (
        <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredModels.length === 0 && (
            <div style={{ textAlign: 'center', color: '#999', padding: '24px 0' }}>No models found</div>
          )}
          {filteredModels.map((m) => (
            <div
              key={m.id}
              onClick={() => setAddSelectedModel(m)}
              style={{
                padding: '10px 14px',
                border: `1.5px solid ${addSelectedModel?.id === m.id ? '#1677ff' : '#e8e8e8'}`,
                borderRadius: 8,
                cursor: 'pointer',
                background: addSelectedModel?.id === m.id ? '#e6f4ff' : '#fafafa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Space size={8}>
                <Text strong style={{ fontSize: 14 }}>{m.model ?? '—'}</Text>
                {m.brand && <Tag color="blue" style={{ margin: 0 }}>{m.brand}</Tag>}
                {m.dev_type && <Tag color="default" style={{ margin: 0 }}>{m.dev_type}</Tag>}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>ID: {m.id}</Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAddStep1 = () => {
    const selectField = (label: string, key: keyof AddFormState, options: string[], req = false) =>
      formField(label, (
        <Select
          value={addForm[key]}
          onChange={(v: string) => setAddForm((f) => ({ ...f, [key]: v }))}
          size="small"
          style={{ width: '100%' }}
          options={options.map((o) => ({ value: o, label: o }))}
        />
      ), req);

    const inputField = (label: string, key: keyof AddFormState, placeholder = '', req = false) =>
      formField(label, (
        <Input
          value={addForm[key] as string}
          onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
          size="small"
          placeholder={placeholder}
        />
      ), req);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Row 1: basic info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px 14px' }}>
          {inputField('Sensor Name', 'name', 'e.g. AHU-1 Temp', true)}
          {formField('Model', <Input value={addSelectedModel?.model ?? ''} size="small" disabled />)}
          {inputField('Firmware Version', 'firmwareVersion', 'e.g. 1.0.0')}
          {inputField('Modbus Address', 'modbusAddress', 'e.g. 1')}
          {inputField('Secondary Address', 'secondaryAddress', 'optional')}
        </div>
        {/* Row 2: intervals + enable */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px 14px' }}>
          {inputField('Tertiary Address', 'tertiaryAddress', 'optional')}
          {selectField('Logging Interval', 'loggingInterval', INTERVAL_OPTIONS)}
          {selectField('Reporting Interval', 'reportingInterval', INTERVAL_OPTIONS)}
          {selectField('Health Interval', 'healthInterval', HEALTH_OPTIONS)}
          {selectField('Enabled', 'enabled', ONOFF_OPTIONS)}
        </div>
        {/* Location section (collapsible) */}
        <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
          <div
            onClick={() => setAddLocationExpanded((v) => !v)}
            style={{
              padding: '8px 14px',
              background: '#fafafa',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none',
            }}
          >
            <Text strong style={{ fontSize: 13 }}>Location Information</Text>
            <span style={{ fontSize: 12, color: '#999' }}>{addLocationExpanded ? '▲' : '▼'}</span>
          </div>
          {addLocationExpanded && (
            <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px 14px' }}>
              {inputField('Location ID', 'postalCode', 'optional')}
              {inputField('Location Name', 'locationName', 'e.g. Floor 2')}
              {inputField('Location Subname', 'locationSubname', 'optional')}
              {inputField('Block Number/Name', 'blockNumber', 'optional')}
              {inputField('Floor / Unit', 'floorUnit', 'optional')}
              {inputField('Postal Code', 'postalCode', 'optional')}
              {inputField('Latitude (X)', 'latitude', 'e.g. 1.3521')}
              {inputField('Longitude (Y)', 'longitude', 'e.g. 103.8198')}
              {inputField('Height from Floor (H)', 'heightFromFloor', 'e.g. 2.5')}
              {inputField('Location Address', 'locationAddress', 'optional')}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAddStep2 = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Left: Sensor Summary */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 10 }}>Sensor Summary</Text>
        <Descriptions column={1} bordered size="small" labelStyle={{ width: 140, background: '#fafafa', fontSize: 12 }}>
          <Descriptions.Item label="Sensor Name">{addForm.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Model">{addSelectedModel?.model ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Modbus Address">{addForm.modbusAddress || '—'}</Descriptions.Item>
          <Descriptions.Item label="Logging Interval">{addForm.loggingInterval}</Descriptions.Item>
          <Descriptions.Item label="Reporting Interval">{addForm.reportingInterval}</Descriptions.Item>
          <Descriptions.Item label="Health Interval">{addForm.healthInterval}</Descriptions.Item>
          <Descriptions.Item label="Enabled">{addForm.enabled}</Descriptions.Item>
          {addForm.locationName && (
            <Descriptions.Item label="Location">{addForm.locationName}</Descriptions.Item>
          )}
          <Descriptions.Item label="Gateway">{activeGateway?.name ?? '—'}</Descriptions.Item>
        </Descriptions>
      </div>
      {/* Right: Auto-Link Params */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 10 }}>
          Auto-Link Parameters
          <Tag color="blue" style={{ marginLeft: 8, fontWeight: 400 }}>{addAutoParams.length} params</Tag>
        </Text>
        <Table
          size="small"
          dataSource={addAutoParams.map((p, i) => ({ key: i, parameter: p.parameter, unit: p.unit }))}
          pagination={false}
          scroll={{ y: 240 }}
          columns={[
            { title: 'Parameter', dataIndex: 'parameter', key: 'parameter', ellipsis: true, render: (t: string) => <strong>{t}</strong> },
            { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 70 },
            {
              title: 'Status',
              key: 'status',
              width: 80,
              render: () => <Tag color="green" style={{ margin: 0 }}>Linked</Tag>,
            },
          ]}
        />
      </div>
    </div>
  );

  const renderAddStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 20 }}>
      <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Device Created Successfully!</div>
        <Text type="secondary" style={{ fontSize: 14 }}>
          {addForm.name} has been created with {addAutoParams.length} parameters automatically configured and linked.
        </Text>
      </div>
      <Space size={12} style={{ marginTop: 8 }}>
        <Button onClick={() => { setAddOpen(false); resetAddWizard(); }}>View All Devices</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => resetAddWizard()}>Add Another Device</Button>
      </Space>
    </div>
  );

  const renderDevicesTab = () => (
    <>
      <Card className="configuration-workspace__panel">
        <Table
          rowKey="id"
          dataSource={scopedDevices}
          columns={deviceColumns}
          rowSelection={{ selectedRowKeys: selectedDeviceRowKeys, onChange: setSelectedDeviceRowKeys }}
          pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (total) => `${total} devices` }}
          scroll={{ x: 900 }}
          size="small"
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={detailDevice ? `Device — ${detailDevice.name}` : 'Device Details'}
        open={detailDevice !== null}
        onClose={() => setDetailDevice(null)}
        width={420}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setDetailDevice(null)}>Close</Button>
          </div>
        }
      >
        {detailDevice && (
          <Descriptions column={1} bordered size="small" labelStyle={{ width: 140 }}>
            <Descriptions.Item label="ID">{parseInt(detailDevice.id)}</Descriptions.Item>
            <Descriptions.Item label="Name"><strong>{detailDevice.name}</strong></Descriptions.Item>
            <Descriptions.Item label="External ID">{detailDevice.externalDeviceId ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Location">{detailDevice.zone && detailDevice.zone !== '—' ? detailDevice.zone : '—'}</Descriptions.Item>
            <Descriptions.Item label="Network Addr">
              {detailDevice.modbusAddress != null ? detailDevice.modbusAddress : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Network Status">
              <Badge
                status={detailDevice.status === 'online' ? 'success' : 'default'}
                text={detailDevice.status === 'online' ? 'Online' : 'Offline'}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Enabled">
              <Tag color={detailDevice.enabled !== 0 ? 'green' : 'default'}>
                {detailDevice.enabled !== 0 ? 'Enabled' : 'Disabled'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Gateway">{detailDevice.gatewayName}</Descriptions.Item>
            <Descriptions.Item label="Gateway SN">{detailDevice.gatewaySn ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Last Seen">
              {detailDevice.lastSeenAt
                ? new Date(detailDevice.lastSeenAt).toLocaleString()
                : detailDevice.lastSeenMinutes < 999
                  ? `${detailDevice.lastSeenMinutes} min ago`
                  : '—'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* Edit Modal */}
      <Modal
        title={editDevice ? `Edit — ${editDevice.name}` : 'Edit Device'}
        open={editDevice !== null}
        onCancel={() => setEditDevice(null)}
        onOk={handleEditSave}
        okText="Save"
        okButtonProps={{ loading: editSaving }}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size={16}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Name</Text>
            <Input
              value={editFormName}
              onChange={(e) => setEditFormName(e.target.value)}
              placeholder="Device name"
            />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Location</Text>
            <Input
              value={editFormZone}
              onChange={(e) => setEditFormZone(e.target.value)}
              placeholder="e.g. Floor 2, Server Room"
            />
          </div>
        </Space>
      </Modal>

      {/* Add Device wizard */}
      <Drawer
        open={addOpen}
        width={740}
        title={
          addStep < 3 ? (
            <Space>
              {addStep > 0 && (
                <Button type="text" size="small" onClick={() => setAddStep((s) => s - 1)} style={{ padding: '0 6px' }}>
                  ← Back
                </Button>
              )}
              <span>Add New Sensor</span>
            </Space>
          ) : null
        }
        closable={addStep < 3}
        onClose={() => { setAddOpen(false); resetAddWizard(); }}
        destroyOnClose
        footer={
          addStep < 3 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Gateway: {activeGateway?.name ?? '—'}
              </Text>
              <Space>
                {addStep === 0 && (
                  <Button type="primary" disabled={!addSelectedModel} onClick={() => setAddStep(1)}>
                    Next: Configure Sensor →
                  </Button>
                )}
                {addStep === 1 && (
                  <Button type="primary" disabled={!addForm.name.trim()} onClick={() => setAddStep(2)}>
                    Next: Preview →
                  </Button>
                )}
                {addStep === 2 && (
                  <Button type="primary" onClick={handleAddConfirm} loading={addSaving}>
                    Confirm &amp; Create
                  </Button>
                )}
              </Space>
            </div>
          ) : null
        }
      >
        {addStep < 3 && (
          <div style={{ marginBottom: 20 }}>
            <Steps
              current={addStep}
              size="small"
              items={[
                { title: 'Select Model' },
                { title: 'Sensor Info' },
                { title: 'Preview' },
              ]}
            />
            {addStep === 0 && (
              <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 13 }}>
                Select a sensor model — all parameters will be automatically configured and linked.
              </Text>
            )}
          </div>
        )}
        {addStep === 0 && renderAddStep0()}
        {addStep === 1 && renderAddStep1()}
        {addStep === 2 && renderAddStep2()}
        {addStep === 3 && renderAddStep3()}
      </Drawer>
    </>
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
        {/* Tabs + content — full width, gateway selector embedded in tab bar */}
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
              tabBarExtraContent={{
                left: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12 }}>
                    <Select
                      value={selectedSiteId}
                      onChange={setSelectedSiteId}
                      size="small"
                      style={{ width: 110 }}
                      options={[{ value: 'all', label: 'All Sites' }, ...apiSites.map((site) => ({ value: String(site.id), label: site.name }))]}
                    />
                    <Select
                      placeholder="Select gateway…"
                      value={selectedGatewayId ?? undefined}
                      onChange={(v) => {
                        if (!v) {
                          setSelectedGatewayId(null);
                          setSelectedDeviceRowKeys([]);
                          setSelectedParameterRowKeys([]);
                        } else {
                          handleSelectGateway(v);
                        }
                      }}
                      allowClear
                      showSearch
                      size="small"
                      style={{ width: 180 }}
                      filterOption={(input, opt) =>
                        String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      loading={gatewaysLoading}
                      options={siteGateways.map((gw) => ({ value: gw.id, label: gw.name }))}
                      optionRender={(opt) => {
                        const gw = siteGateways.find((g) => g.id === opt.value);
                        if (!gw) return String(opt.label);
                        return (
                          <Space size={6}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: gatewayStatusColor(gw.status), display: 'inline-block', flexShrink: 0 }} />
                            <span>{gw.name}</span>
                            <Text type="secondary" style={{ fontSize: 11 }}>{gw.subDevices.length} dev</Text>
                          </Space>
                        );
                      }}
                      labelRender={(opt) => {
                        const gw = siteGateways.find((g) => g.id === opt.value);
                        if (!gw) return String(opt.label ?? opt.value ?? '');
                        return (
                          <Space size={4}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: gatewayStatusColor(gw.status), display: 'inline-block' }} />
                            <span>{gw.name}</span>
                          </Space>
                        );
                      }}
                    />
                    <span style={{ display: 'inline-block', width: 1, height: 16, background: '#d9d9d9', margin: '0 10px 0 6px', borderRadius: 1, flexShrink: 0 }} />
                  </div>
                ),
                right: hasGatewaySelected ? (
                  <Space size={8} style={{ marginRight: 12 }} wrap>
                    {activeGateway && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {activeGateway.model} · {activeGateway.protocol} · {activeGateway.subDevices.length} dev · Health {activeGateway.healthScore}%
                      </Text>
                    )}
                    {selectionCount > 0 && (
                      <Tag color="geekblue" style={{ margin: 0 }}>{selectionCount} selected</Tag>
                    )}
                    <Button size="small" icon={<RocketOutlined />} onClick={handleApplyPreview} disabled={selectionCount === 0}>Preview</Button>
                    <Button size="small" type="primary" icon={<RocketOutlined />} onClick={() => navigate('/realtime')}>Monitoring</Button>
                    {activeTab === 'devices' && (
                      <Button size="small" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Add Device</Button>
                    )}
                    <Button size="small" icon={<ReloadOutlined />} onClick={refresh}>Refresh</Button>
                  </Space>
                ) : (
                  <Space size={8} style={{ marginRight: 12 }}>
                    <Button size="small" icon={<ReloadOutlined />} onClick={refresh}>Refresh</Button>
                  </Space>
                ),
              }}
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
