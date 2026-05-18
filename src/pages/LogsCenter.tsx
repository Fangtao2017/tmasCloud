import { DevStatusModal } from '../components/DevStatusModal';
import React from 'react';
import {
  AlertOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  DisconnectOutlined,
  DownloadOutlined,
  FilterOutlined,
  FireOutlined,
  FlagOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Bar, Column, Line, Pie } from '@ant-design/plots';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Drawer,
  Input,
  List,
  message,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useNavigate, useLocation } from 'react-router-dom';
import './LogsCenter.css';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

type Severity = 'critical' | 'error' | 'warning' | 'info';
type LogType = 'Alarm' | 'Communication' | 'Rule' | 'System' | 'Device' | 'User';
type LogStatus = 'active' | 'cleared' | 'acknowledged';
type LogModule = 'rule' | 'communication' | 'system' | 'alarm';
type ViewKey = 'operations' | 'communication' | 'audit';
type TimeKey = '1h' | '24h' | '7d' | 'custom';

interface LogRecord {
  id: string;
  timestamp: number;
  severity: Severity;
  type: LogType;
  site: string;
  gateway: string;
  device: string;
  summary: string;
  status: LogStatus;
  module: LogModule;
  topic: string;
  messageId: string;
  payload: Record<string, unknown>;
  timeline: Array<{ at: number; event: string }>;
  pinned?: boolean;
  note?: string;
}

interface GroupedLogRecord extends LogRecord {
  count: number;
}

interface Filters {
  time: TimeKey;
  customRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  site?: string;
  gateway?: string;
  device?: string;
  type?: LogType;
  severity?: Severity;
  status?: LogStatus;
  module?: LogModule;
  keyword: string;
  messageId: string;
  topic: string;
  chips: {
    activeAlarms: boolean;
    offlineDevices: boolean;
    communicationErrors: boolean;
    unacknowledged: boolean;
    last1Hour: boolean;
  };
}

const sites = ['Temasek Polytechnic', 'ITE College East', 'Republic Polytechnic', 'Ngee Ann Polytechnic'];

const API_BASE = 'http://192.168.10.73:3000';

const severityColors: Record<Severity, string> = {
  critical: 'red',
  error: 'volcano',
  warning: 'gold',
  info: 'blue',
};

const typePool: LogType[] = ['Alarm', 'Communication', 'Rule', 'System', 'Device', 'User'];
const severityPool: Severity[] = ['critical', 'error', 'warning', 'info'];
const statusPool: LogStatus[] = ['active', 'acknowledged', 'cleared'];

// Map API event log to LogRecord
function apiEventToRecord(item: Record<string, unknown>): LogRecord {
  return {
    id: String(item.id),
    timestamp: Number(item.timestamp),
    severity: (item.severity as Severity) || 'info',
    type: (item.type as LogType) || 'System',
    site: String(item.site || ''),
    gateway: String(item.gateway || 'Unknown'),
    device: String(item.device || '–'),
    summary: String(item.summary || ''),
    status: (item.status as LogStatus) || 'active',
    module: (item.module as LogModule) || 'system',
    topic: String(item.topic || ''),
    messageId: String(item.messageId || ''),
    payload: (item.payload as Record<string, unknown>) || {},
    timeline: (item.timeline as Array<{ at: number; event: string }>) || [],
    pinned: false,
  };
}

// Map MQTT raw log entry to LogRecord
function mqttEntryToRecord(item: Record<string, unknown>): LogRecord {
  const ts = Number(item.timestamp);
  const mode = String(item.mode || 'unknown');
  const sn = String(item.gatewaySn || '?');
  const hasError = item.status === 'error';
  return {
    id: `mqtt-${item.id}`,
    timestamp: ts,
    severity: hasError ? 'error' : 'info',
    type: 'Communication',
    site: '',
    gateway: sn,
    device: '–',
    summary: hasError
      ? `MQTT ${mode} failed: ${item.error}`
      : `MQTT ${mode} message — ${item.itemCount} item(s)`,
    status: 'active',
    module: 'communication',
    topic: String(item.topic || ''),
    messageId: `MQTT-${item.id}`,
    payload: { mode, itemCount: item.itemCount, gatewaySn: sn, error: item.error },
    timeline: [{ at: ts, event: hasError ? 'Error' : 'Received' }],
    pinned: false,
  };
}

// Map system log entry to LogRecord
function sysEntryToRecord(item: Record<string, unknown>): LogRecord {
  const ts = Number(item.timestamp);
  const level = String(item.level || 'info');
  return {
    id: `sys-${item.id}`,
    timestamp: ts,
    severity: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info',
    type: 'System',
    site: '',
    gateway: 'Backend',
    device: '–',
    summary: String(item.message || ''),
    status: 'active',
    module: 'system',
    topic: 'system',
    messageId: `SYS-${item.id}`,
    payload: { level, message: item.message },
    timeline: [{ at: ts, event: level }],
    pinned: false,
  };
}

const toTimeRange = (time: TimeKey, customRange: [dayjs.Dayjs, dayjs.Dayjs] | null): [number, number] => {
  const now = dayjs();
  if (time === '1h') return [now.subtract(1, 'hour').unix(), now.unix()];
  if (time === '24h') return [now.subtract(24, 'hour').unix(), now.unix()];
  if (time === '7d') return [now.subtract(7, 'day').unix(), now.unix()];
  if (customRange) return [customRange[0].unix(), customRange[1].unix()];
  return [now.subtract(24, 'hour').unix(), now.unix()];
};

const groupRepeated = (rows: LogRecord[]): GroupedLogRecord[] => {
  const map = new Map<string, GroupedLogRecord>();
  rows.forEach((row) => {
    const key = [row.site, row.gateway, row.device, row.summary, row.severity, row.type, row.status].join('|');
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, count: 1 });
      return;
    }
    if (row.timestamp > existing.timestamp) {
      map.set(key, { ...row, count: existing.count + 1, pinned: existing.pinned || row.pinned, note: existing.note || row.note });
    } else {
      existing.count += 1;
      existing.pinned = existing.pinned || row.pinned;
    }
  });
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
};

// ── Main LogsCenter page ──────────────────────────────────

const MiniSparkline: React.FC<{ points: number[]; up: boolean }> = ({ points, up }) => {
  const max = Math.max(...points, 1);
  return (
    <div className="logs-mini-sparkline">
      {points.map((p, i) => (
        <span key={i} style={{ height: `${Math.max(18, Math.round((p / max) * 100))}%`, background: up ? '#16a34a' : '#dc2626' }} />
      ))}
    </div>
  );
};

const LogsCenter: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [view] = React.useState<ViewKey>('operations');
  const subView: 'overview' | 'list' = location.pathname.endsWith('/list') ? 'list' : 'overview';
  const [logs, setLogs] = React.useState<LogRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<GroupedLogRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false);
  const [savedViews, setSavedViews] = React.useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('tmas-log-saved-views');
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [filters, setFilters] = React.useState<Filters>({
    time: '24h',
    customRange: null,
    keyword: '',
    messageId: '',
    topic: '',
    chips: {
      activeAlarms: false,
      offlineDevices: false,
      communicationErrors: false,
      unacknowledged: false,
      last1Hour: false,
    },
  });

  const [operatorNote, setOperatorNote] = React.useState('');

  // Fetch real log data from API
  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const [start, end] = toTimeRange(filters.time, filters.customRange);
      const qs = `start=${start}&end=${end}&limit=500`;

      const [evtRes, mqttRes, sysRes] = await Promise.all([
        fetch(`${API_BASE}/api/logs/events?${qs}`).then((r) => r.json()),
        fetch(`${API_BASE}/api/logs/mqtt?${qs}`).then((r) => r.json()),
        fetch(`${API_BASE}/api/logs/system?limit=200`).then((r) => r.json()),
      ]);

      const eventLogs: LogRecord[] = ((evtRes.logs ?? []) as Record<string, unknown>[]).map(apiEventToRecord);
      const mqttLogs: LogRecord[] = ((mqttRes.logs ?? []) as Record<string, unknown>[]).map(mqttEntryToRecord);
      const sysLogs: LogRecord[] = ((sysRes.logs ?? []) as Record<string, unknown>[]).map(sysEntryToRecord);

      const merged = [...eventLogs, ...mqttLogs, ...sysLogs].sort((a, b) => b.timestamp - a.timestamp);
      setLogs(merged);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      message.error('Failed to load logs from server');
    } finally {
      setLoading(false);
    }
  }, [filters.time, filters.customRange]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const timeWindow = React.useMemo(() => toTimeRange(filters.time, filters.customRange), [filters.time, filters.customRange]);

  const scopedLogs = React.useMemo(() => {
    const [start, end] = timeWindow;
    return logs.filter((log) => {
      if (log.timestamp < start || log.timestamp > end) return false;
      if (filters.site && log.site !== filters.site) return false;
      if (filters.gateway && log.gateway !== filters.gateway) return false;
      if (filters.device && log.device !== filters.device) return false;
      if (filters.type && log.type !== filters.type) return false;
      if (filters.severity && log.severity !== filters.severity) return false;
      if (filters.status && log.status !== filters.status) return false;
      if (filters.module && log.module !== filters.module) return false;
      if (filters.keyword && !`${log.summary} ${log.site} ${log.gateway} ${log.device}`.toLowerCase().includes(filters.keyword.toLowerCase())) return false;
      if (filters.messageId && !log.messageId.toLowerCase().includes(filters.messageId.toLowerCase())) return false;
      if (filters.topic && !log.topic.toLowerCase().includes(filters.topic.toLowerCase())) return false;

      if (view === 'communication' && log.type !== 'Communication') return false;
      if (view === 'audit' && !(log.type === 'User' || log.type === 'System')) return false;

      if (filters.chips.activeAlarms && !(log.type === 'Alarm' && log.status === 'active')) return false;
      if (filters.chips.communicationErrors && !(log.type === 'Communication' && (log.severity === 'critical' || log.severity === 'error'))) return false;
      if (filters.chips.unacknowledged && log.status === 'acknowledged') return false;
      if (filters.chips.last1Hour && log.timestamp < dayjs().subtract(1, 'hour').unix()) return false;
      if (filters.chips.offlineDevices && !log.summary.toLowerCase().includes('heartbeat missing')) return false;

      return true;
    });
  }, [filters, logs, timeWindow, view]);

  const groupedLogs = React.useMemo(() => groupRepeated(scopedLogs), [scopedLogs]);

  // Derive dynamic filter options from real log data
  const gatewayOptions = React.useMemo(() => {
    const set = new Set(logs.map((l) => l.gateway).filter(Boolean));
    return Array.from(set).sort();
  }, [logs]);

  const deviceOptions = React.useMemo(() => {
    const set = new Set(logs.map((l) => l.device).filter((d) => d && d !== '–'));
    return Array.from(set).sort();
  }, [logs]);

  const summary24h = React.useMemo(() => {
    const now = dayjs();
    const curStart = now.subtract(24, 'hour').unix();
    const prevStart = now.subtract(48, 'hour').unix();

    const cur = logs.filter((l) => l.timestamp >= curStart);
    const prev = logs.filter((l) => l.timestamp >= prevStart && l.timestamp < curStart);

    const metric = (predicate: (l: LogRecord) => boolean) => {
      const current = cur.filter(predicate).length;
      const previous = prev.filter(predicate).length;
      const up = current >= previous;
      const trend = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
      const sparkline = Array.from({ length: 8 }, (_, i) => {
        const end = now.subtract(i * 3, 'hour').unix();
        const start = now.subtract(i * 3 + 3, 'hour').unix();
        return logs.filter((l) => l.timestamp >= start && l.timestamp < end && predicate(l)).length;
      }).reverse();
      return { current, previous, up, trend, sparkline };
    };

    return {
      total: metric(() => true),
      critical: metric((l) => l.severity === 'critical'),
      error: metric((l) => l.severity === 'error'),
      warning: metric((l) => l.severity === 'warning'),
      info: metric((l) => l.severity === 'info'),
      activeAlarms: metric((l) => l.type === 'Alarm' && l.status === 'active'),
      offlineDevices: metric((l) => l.summary.toLowerCase().includes('heartbeat missing')),
      affectedGateways: metric((l) => l.severity !== 'info'),
    };
  }, [logs]);

  const volumeTrend = React.useMemo(() => {
    const [start] = timeWindow;
    const buckets = new Map<string, number>();
    scopedLogs.forEach((log) => {
      const label = dayjs.unix(log.timestamp).format('MM-DD HH:00');
      buckets.set(label, (buckets.get(label) || 0) + 1);
    });
    if (buckets.size === 0) {
      for (let i = 11; i >= 0; i -= 1) {
        const label = dayjs.unix(start).add(i * 2, 'hour').format('MM-DD HH:00');
        buckets.set(label, 0);
      }
    }
    return Array.from(buckets.entries()).map(([time, value]) => ({ time, value }));
  }, [scopedLogs, timeWindow]);

  const errorAlarmTrend = React.useMemo(() => {
    const bucket = new Map<string, { Error: number; Alarm: number }>();
    scopedLogs.forEach((l) => {
      const key = dayjs.unix(l.timestamp).format('MM-DD HH:00');
      const entry = bucket.get(key) || { Error: 0, Alarm: 0 };
      if (l.severity === 'critical' || l.severity === 'error') entry.Error += 1;
      if (l.type === 'Alarm') entry.Alarm += 1;
      bucket.set(key, entry);
    });
    return Array.from(bucket.entries()).flatMap(([time, val]) => ([
      { time, metric: 'Error', value: val.Error },
      { time, metric: 'Alarm', value: val.Alarm },
    ]));
  }, [scopedLogs]);

  const severityDist = React.useMemo(() => {
    const counts: Record<Severity, number> = { critical: 0, error: 0, warning: 0, info: 0 };
    scopedLogs.forEach((l) => { counts[l.severity] += 1; });
    return Object.entries(counts).map(([severity, value]) => ({ severity, value }));
  }, [scopedLogs]);

  const topSources = React.useMemo(() => {
    const bySource = new Map<string, number>();
    scopedLogs.forEach((l) => {
      const src = `${l.gateway} / ${l.device}`;
      bySource.set(src, (bySource.get(src) || 0) + 1);
    });
    return Array.from(bySource.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [scopedLogs]);

  const tableColumns: ColumnsType<GroupedLogRecord> = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      width: 168,
      sorter: (a, b) => a.timestamp - b.timestamp,
      render: (ts: number) => dayjs.unix(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 108,
      render: (sev: Severity) => <Tag color={severityColors[sev]}>{sev.toUpperCase()}</Tag>,
      filters: [
        { text: 'Critical', value: 'critical' },
        { text: 'Error', value: 'error' },
        { text: 'Warning', value: 'warning' },
        { text: 'Info', value: 'info' },
      ],
      onFilter: (value, record) => record.severity === value,
    },
    { title: 'Type', dataIndex: 'type', width: 132 },
    { title: 'Site', dataIndex: 'site', width: 180, render: (v: string) => <Button type="link" size="small">{v}</Button> },
    {
      title: 'Gateway',
      dataIndex: 'gateway',
      width: 128,
      render: (v: string) => <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); navigate('/realtime'); }}>{v}</Button>,
    },
    {
      title: 'Device',
      dataIndex: 'device',
      width: 138,
      render: (v: string) => <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); navigate('/devices'); }}>{v}</Button>,
    },
    { title: 'Summary Message', dataIndex: 'summary', ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 132,
      render: (status: LogStatus) => (
        <Tag color={status === 'active' ? 'red' : status === 'acknowledged' ? 'gold' : 'green'}>
          {status === 'active' ? 'Active' : status === 'acknowledged' ? 'Ack' : 'Cleared'}
        </Tag>
      ),
    },
    { title: 'Count', dataIndex: 'count', width: 80, sorter: (a, b) => a.count - b.count },
    {
      title: 'Pin',
      width: 74,
      render: (_, row) => (
        <Button
          type="text"
          icon={<FlagOutlined style={{ color: row.pinned ? '#d97706' : '#9ca3af' }} />}
          onClick={(e) => {
            e.stopPropagation();
            setLogs((prev) => prev.map((item) => (item.id === row.id ? { ...item, pinned: !item.pinned } : item)));
          }}
        />
      ),
    },
  ];

  const saveCurrentView = () => {
    const name = window.prompt('Saved view name:');
    if (!name) return;
    const next = Array.from(new Set([...savedViews, name]));
    setSavedViews(next);
    localStorage.setItem('tmas-log-saved-views', JSON.stringify(next));
    localStorage.setItem(`tmas-log-view-${name}`, JSON.stringify(filters));
    message.success(`Saved view: ${name}`);
  };

  const loadSavedView = (name: string) => {
    const raw = localStorage.getItem(`tmas-log-view-${name}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Filters;
      setFilters(parsed);
      message.success(`Loaded view: ${name}`);
    } catch {
      message.error('Failed to load saved view');
    }
  };

  const exportCsv = () => {
    const header = ['Timestamp', 'Severity', 'Type', 'Site', 'Gateway', 'Device', 'Summary', 'Status', 'Count'];
    const rows = groupedLogs.map((r) => [
      dayjs.unix(r.timestamp).format('YYYY-MM-DD HH:mm:ss'),
      r.severity,
      r.type,
      r.site,
      r.gateway,
      r.device,
      r.summary.replace(/,/g, ' '),
      r.status,
      String(r.count),
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tmas-logs-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const onOpenDetail = (row: GroupedLogRecord) => {
    setSelected(row);
    setOperatorNote(row.note || '');
    setDrawerOpen(true);
  };

  const updateSelectedStatus = (status: LogStatus) => {
    if (!selected) return;
    setLogs((prev) => prev.map((l) => (l.id === selected.id ? { ...l, status, note: operatorNote } : l)));
    setSelected((prev) => (prev ? { ...prev, status, note: operatorNote } : prev));
    message.success(`Log marked as ${status}`);
  };

  return (
    <div className="logs-center-page">
      <DevStatusModal
        title="Report — Log List"
        storageKey="dev_status_logs"
        items={[
          { label: 'Log Data', status: 'live', note: 'Real log data connected; click a row to view details' },
          { label: 'UI Layout', status: 'partial', note: 'Overlapping UI elements and incorrect labels still being fixed' },
        ]}
      />
      {subView === 'overview' && (
        <Row gutter={[12, 12]} className="logs-summary-grid">
          {[
            { label: 'Total Logs (24h)', icon: <BarChartOutlined />, metric: summary24h.total },
            { label: 'Critical', icon: <AlertOutlined />, metric: summary24h.critical },
            { label: 'Error', icon: <FireOutlined />, metric: summary24h.error },
            { label: 'Warning', icon: <WarningOutlined />, metric: summary24h.warning },
            { label: 'Info', icon: <CheckCircleOutlined />, metric: summary24h.info },
            { label: 'Active Alarms', icon: <AlertOutlined />, metric: summary24h.activeAlarms },
            { label: 'Offline Devices', icon: <DisconnectOutlined />, metric: summary24h.offlineDevices },
            { label: 'Affected Gateways', icon: <ClusterOutlined />, metric: summary24h.affectedGateways },
          ].map((item) => (
            <Col xs={24} sm={12} lg={6} xl={6} key={item.label}>
              <Card className="logs-summary-card" bordered={false}>
                <div className="logs-summary-head">
                  <span className="logs-summary-icon">{item.icon}</span>
                  <Text className="logs-summary-label">{item.label}</Text>
                </div>
                <div className="logs-summary-value">{item.metric.current}</div>
                <div className="logs-summary-trend">
                  <Text type={item.metric.up ? 'success' : 'danger'}>{item.metric.up ? '↑' : '↓'} {Math.abs(item.metric.trend)}%</Text>
                  <MiniSparkline points={item.metric.sparkline} up={item.metric.up} />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}


      {subView === 'overview' && (
        <Row gutter={[12, 12]} style={{ marginTop: 4 }}>
          <Col xs={24} xl={6}>
            <Card className="overview-card" bordered={false}>
              <Text className="overview-section-label">Visual Insights</Text>
              <Title level={5}>Severity Distribution</Title>
              <Pie
                data={severityDist}
                angleField="value"
                colorField="severity"
                height={220}
                label={{ text: 'value', position: 'outside' }}
                legend={{ position: 'bottom' }}
                color={({ severity }: { severity: Severity }) => {
                  if (severity === 'critical') return '#dc2626';
                  if (severity === 'error') return '#f97316';
                  if (severity === 'warning') return '#eab308';
                  return '#3b82f6';
                }}
              />
              <Title level={5} style={{ marginTop: 12 }}>Top Problem Sources</Title>
              <Bar data={topSources} xField="source" yField="count" height={220} />
            </Card>
          </Col>

          <Col xs={24} xl={18}>
            <Card className="overview-card" bordered={false}>
              <Text className="overview-section-label">Visual Insights</Text>
              <Title level={5}>Trends Analysis</Title>
              <Row gutter={[8, 8]}>
                <Col xs={24} md={10}>
                  <Card size="small" title="Log Volume Trend">
                    <Line data={volumeTrend} xField="time" yField="value" height={260} smooth />
                  </Card>
                </Col>
                <Col xs={24} md={14}>
                  <Card size="small" title="Error / Alarm Trend">
                    <Column data={errorAlarmTrend} xField="time" yField="value" seriesField="metric" isStack height={260} />
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      {subView === 'list' && (
        <Card className="overview-card" bordered={false}>
            {/* ── Unified toolbar ── */}
            <div className="logs-list-toolbar">
              <div className="logs-list-toolbar-stats">
                {[
                  { label: 'Total',         value: scopedLogs.length,                                                               color: '#0f172a', bg: '#f1f5f9', border: '#e2e8f0' },
                  { label: 'Critical',      value: scopedLogs.filter((l) => l.severity === 'critical').length,                      color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                  { label: 'Error',         value: scopedLogs.filter((l) => l.severity === 'error').length,                         color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
                  { label: 'Warning',       value: scopedLogs.filter((l) => l.severity === 'warning').length,                       color: '#ca8a04', bg: '#fefce8', border: '#fef08a' },
                  { label: 'Info',          value: scopedLogs.filter((l) => l.severity === 'info').length,                          color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
                  { label: 'Active Alarms', value: scopedLogs.filter((l) => l.type === 'Alarm' && l.status === 'active').length,    color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                ].map(({ label, value, color, bg, border }) => (
                  <div key={label} className="logs-stat-pill" style={{ background: bg, borderColor: border }}>
                    <span className="logs-stat-pill-value" style={{ color }}>{value}</span>
                    <span className="logs-stat-pill-label">{label}</span>
                  </div>
                ))}
              </div>
              <div className="logs-list-toolbar-actions">
                <Text type="secondary" style={{ fontSize: 12 }}>{groupedLogs.length} grouped rows</Text>
                <Button icon={<FilterOutlined />} onClick={() => setFilterDrawerOpen(true)}>Filters</Button>
                <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchLogs}>Refresh</Button>
                <Button icon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button>
              </div>
            </div>

            <Table<GroupedLogRecord>
              rowKey="id"
              columns={tableColumns}
              dataSource={groupedLogs}
              sticky
              pagination={{ pageSize: 12, showSizeChanger: true }}
              rowClassName={(row) => `logs-row-${row.severity}`}
              onRow={(row) => ({ onClick: () => onOpenDetail(row) })}
              scroll={{ x: 1100, y: 'calc(100vh - 360px)' }}
            />
          </Card>
      )}

      <Drawer
        title={
          <Space>
            <FilterOutlined />
            <span>Filters</span>
          </Space>
        }
        placement="right"
        width={480}
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button
              onClick={() => setFilters((p) => ({
                ...p,
                site: undefined, gateway: undefined, device: undefined,
                type: undefined, severity: undefined, status: undefined, module: undefined,
                keyword: '', messageId: '', topic: '',
                chips: { activeAlarms: false, offlineDevices: false, communicationErrors: false, unacknowledged: false, last1Hour: false },
              }))}
            >
              Reset All
            </Button>
            <Button type="primary" onClick={() => setFilterDrawerOpen(false)}>Apply</Button>
          </Space>
        }
      >
        <div className="lf-section">
          <Divider orientation="left" orientationMargin={0} className="lf-divider">Time Range</Divider>
          <Segmented
            block
            options={[
              { label: 'Last 1h', value: '1h' },
              { label: 'Last 24h', value: '24h' },
              { label: 'Last 7d', value: '7d' },
              { label: 'Custom', value: 'custom' },
            ]}
            value={filters.time}
            onChange={(v) => setFilters((p) => ({ ...p, time: v as TimeKey }))}
          />
          {filters.time === 'custom' && (
            <RangePicker
              showTime
              style={{ width: '100%', marginTop: 8 }}
              value={filters.customRange}
              onChange={(v) => setFilters((p) => ({ ...p, customRange: (v as [dayjs.Dayjs, dayjs.Dayjs] | null) }))}
            />
          )}
        </div>

        <div className="lf-section">
          <Divider orientation="left" orientationMargin={0} className="lf-divider">Location</Divider>
          <Row gutter={[8, 8]}>
            <Col span={24}>
              <div className="lf-label">Site</div>
              <Select allowClear placeholder="All sites" value={filters.site} style={{ width: '100%' }} onChange={(v) => setFilters((p) => ({ ...p, site: v }))} options={sites.map((s) => ({ label: s, value: s }))} />
            </Col>
            <Col span={12}>
              <div className="lf-label">Gateway</div>
              <Select allowClear placeholder="All gateways" value={filters.gateway} style={{ width: '100%' }} onChange={(v) => setFilters((p) => ({ ...p, gateway: v }))} options={gatewayOptions.map((g) => ({ label: g, value: g }))} />
            </Col>
            <Col span={12}>
              <div className="lf-label">Device</div>
              <Select allowClear placeholder="All devices" value={filters.device} style={{ width: '100%' }} onChange={(v) => setFilters((p) => ({ ...p, device: v }))} options={deviceOptions.map((d) => ({ label: d, value: d }))} />
            </Col>
          </Row>
        </div>

        <div className="lf-section">
          <Divider orientation="left" orientationMargin={0} className="lf-divider">Classification</Divider>
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <div className="lf-label">Type</div>
              <Select allowClear placeholder="All types" value={filters.type} style={{ width: '100%' }} onChange={(v) => setFilters((p) => ({ ...p, type: v }))} options={typePool.map((t) => ({ label: t, value: t }))} />
            </Col>
            <Col span={12}>
              <div className="lf-label">Severity</div>
              <Select allowClear placeholder="All severities" value={filters.severity} style={{ width: '100%' }} onChange={(v) => setFilters((p) => ({ ...p, severity: v }))} options={severityPool.map((s) => ({ label: s, value: s }))} />
            </Col>
            <Col span={12}>
              <div className="lf-label">Status</div>
              <Select allowClear placeholder="All statuses" value={filters.status} style={{ width: '100%' }} onChange={(v) => setFilters((p) => ({ ...p, status: v }))} options={statusPool.map((s) => ({ label: s, value: s }))} />
            </Col>
            <Col span={12}>
              <div className="lf-label">Module</div>
              <Select allowClear placeholder="All modules" value={filters.module} style={{ width: '100%' }} onChange={(v) => setFilters((p) => ({ ...p, module: v }))} options={['rule', 'communication', 'system', 'alarm'].map((m) => ({ label: m, value: m }))} />
            </Col>
          </Row>
        </div>

        <div className="lf-section">
          <Divider orientation="left" orientationMargin={0} className="lf-divider">Search</Divider>
          <Row gutter={[8, 8]}>
            <Col span={24}>
              <div className="lf-label">Keyword</div>
              <Input allowClear prefix={<SearchOutlined />} placeholder="Search in summary, site, gateway, device…" value={filters.keyword} onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value }))} />
            </Col>
            <Col span={12}>
              <div className="lf-label">Message ID</div>
              <Input allowClear placeholder="e.g. msg-0042" value={filters.messageId} onChange={(e) => setFilters((p) => ({ ...p, messageId: e.target.value }))} />
            </Col>
            <Col span={12}>
              <div className="lf-label">Topic</div>
              <Input allowClear placeholder="e.g. moe/+/Data" value={filters.topic} onChange={(e) => setFilters((p) => ({ ...p, topic: e.target.value }))} />
            </Col>
          </Row>
        </div>

        <div className="lf-section">
          <Divider orientation="left" orientationMargin={0} className="lf-divider">Quick Filters</Divider>
          <div className="lf-chips">
            <Tag.CheckableTag checked={filters.chips.activeAlarms} onChange={(c) => setFilters((p) => ({ ...p, chips: { ...p.chips, activeAlarms: c } }))}>Active Alarms</Tag.CheckableTag>
            <Tag.CheckableTag checked={filters.chips.offlineDevices} onChange={(c) => setFilters((p) => ({ ...p, chips: { ...p.chips, offlineDevices: c } }))}>Offline Devices</Tag.CheckableTag>
            <Tag.CheckableTag checked={filters.chips.communicationErrors} onChange={(c) => setFilters((p) => ({ ...p, chips: { ...p.chips, communicationErrors: c } }))}>Comm. Errors</Tag.CheckableTag>
            <Tag.CheckableTag checked={filters.chips.unacknowledged} onChange={(c) => setFilters((p) => ({ ...p, chips: { ...p.chips, unacknowledged: c } }))}>Unacknowledged</Tag.CheckableTag>
            <Tag.CheckableTag checked={filters.chips.last1Hour} onChange={(c) => setFilters((p) => ({ ...p, chips: { ...p.chips, last1Hour: c } }))}>Last 1 Hour</Tag.CheckableTag>
          </div>
        </div>

        <div className="lf-section">
          <Divider orientation="left" orientationMargin={0} className="lf-divider">Saved Views</Divider>
          <Row gutter={8}>
            <Col flex="1">
              <Select
                placeholder="Load a saved view…"
                style={{ width: '100%' }}
                onChange={loadSavedView}
                options={savedViews.map((s) => ({ label: s, value: s }))}
              />
            </Col>
            <Col>
              <Button icon={<FilterOutlined />} onClick={saveCurrentView}>Save current</Button>
            </Col>
          </Row>
        </div>
      </Drawer>

      <Drawer
        title="Log Detail"
        placement="right"
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {!selected ? null : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small" title="Summary">
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Text><strong>Timestamp:</strong> {dayjs.unix(selected.timestamp).format('YYYY-MM-DD HH:mm:ss')}</Text>
                <Text><strong>Severity:</strong> <Tag color={severityColors[selected.severity]}>{selected.severity.toUpperCase()}</Tag></Text>
                <Text><strong>Status:</strong> {selected.status}</Text>
                <Text><strong>Message:</strong> {selected.summary}</Text>
              </Space>
            </Card>

            <Card size="small" title="Event Timeline">
              <List
                size="small"
                dataSource={selected.timeline}
                renderItem={(item) => (
                  <List.Item>
                    <Text><ClockCircleOutlined /> {dayjs.unix(item.at).format('HH:mm:ss')} - {item.event}</Text>
                  </List.Item>
                )}
              />
            </Card>

            <Card size="small" title="Raw Payload (JSON)">
              <pre className="logs-json-block">{JSON.stringify(selected.payload, null, 2)}</pre>
            </Card>

            <Card size="small" title="Related Info">
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Text><strong>Site:</strong> {selected.site}</Text>
                <Text><strong>Gateway:</strong> {selected.gateway}</Text>
                <Text><strong>Device:</strong> {selected.device}</Text>
                <Text><strong>Topic:</strong> {selected.topic}</Text>
                <Text><strong>Message ID:</strong> {selected.messageId}</Text>
              </Space>
            </Card>

            <Card size="small" title="Operator Actions">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input.TextArea rows={3} value={operatorNote} onChange={(e) => setOperatorNote(e.target.value)} placeholder="Operator notes/comments" />
                <Space>
                  <Button type="primary" onClick={() => updateSelectedStatus('acknowledged')}>Acknowledge</Button>
                  <Button onClick={() => updateSelectedStatus('cleared')}>Clear</Button>
                </Space>
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default LogsCenter;
