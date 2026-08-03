import { DevStatusModal } from '../components/DevStatusModal';
import React from 'react';
import {
  AlertOutlined,
  BarChartOutlined,
  BellOutlined,
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
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
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
  Pagination,
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

const { Text } = Typography;
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
  gateways?: string[];
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

const API_BASE = import.meta.env.VITE_API_URL || '';

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
  const gatewayDisplay = String(item.gatewayName || sn); // prefer resolved name
  const hasError = item.status === 'error';
  return {
    id: `mqtt-${item.id}`,
    timestamp: ts,
    severity: hasError ? 'error' : 'info',
    type: 'Communication',
    site: '',
    gateway: gatewayDisplay,
    device: '–',
    summary: hasError
      ? `MQTT ${mode} failed: ${item.error}`
      : `MQTT ${mode} message — ${item.itemCount} item(s)`,
    status: 'active',
    module: 'communication',
    topic: String(item.topic || ''),
    messageId: `MQTT-${item.id}`,
    payload: { mode, itemCount: item.itemCount, gatewaySn: sn, error: item.error, items: (item.items as unknown[]) || [] },
    timeline: [{ at: ts, event: hasError ? 'Error' : 'Received' }],
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
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  // Use a ref so the Refresh button always calls the latest version without
  // needing to recreate the callback on every filter change.
  const filtersRef = React.useRef(filters);
  React.useEffect(() => { filtersRef.current = filters; });

  // Fetch real log data from API
  // fetchLogs is a stable reference (no deps) — it reads the latest filters via ref.
  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const { time, customRange } = filtersRef.current;
      const [start, end] = toTimeRange(time, customRange);
      // Use a larger limit for wider time ranges so switching from 24h to 7d
      // actually returns more historical data (not just the same latest 500).
      const limitMap: Record<string, number> = { '1h': 300, '24h': 800, '7d': 2000, 'custom': 1500 };
      const limit = limitMap[time] ?? 800;
      const qs = `start=${start}&end=${end}&limit=${limit}`;

      const [evtRes, mqttRes] = await Promise.all([
        fetch(`${API_BASE}/api/logs/events?${qs}`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`${API_BASE}/api/logs/mqtt?${qs}`, { credentials: 'include' }).then((r) => r.json()),
      ]);

      const eventLogs: LogRecord[] = ((evtRes.logs ?? []) as Record<string, unknown>[]).map(apiEventToRecord);
      const mqttLogs: LogRecord[] = ((mqttRes.logs ?? []) as Record<string, unknown>[]).map(mqttEntryToRecord);

      const merged = [...eventLogs, ...mqttLogs].sort((a, b) => b.timestamp - a.timestamp);
      setLogs(merged);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      message.error('Failed to load logs from server');
    } finally {
      setLoading(false);
    }
  }, []); // stable — reads latest filters from ref

  // Refetch whenever the time range changes
  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs, filters.time, filters.customRange]);

  const timeWindow = React.useMemo(() => toTimeRange(filters.time, filters.customRange), [filters.time, filters.customRange]);

  const scopedLogs = React.useMemo(() => {
    const [start, end] = timeWindow;
    return logs.filter((log) => {
      if (log.timestamp < start || log.timestamp > end) return false;
      if (filters.site && log.site !== filters.site) return false;
      if (filters.gateways && filters.gateways.length > 0 && !filters.gateways.includes(log.gateway)) return false;
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

  // Reset to page 1 whenever the filtered+grouped result set changes
  React.useEffect(() => { setPage(1); }, [groupedLogs.length]);

  const pagedLogs = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return groupedLogs.slice(start, start + pageSize);
  }, [groupedLogs, page, pageSize]);

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
    const [start, end] = timeWindow;
    const duration = Math.max(end - start, 1);
    const prevStart = start - duration;
    const bucketSize = Math.max(1, Math.floor(duration / 8));

    const cur = scopedLogs;
    const prev = logs.filter((l) => l.timestamp >= prevStart && l.timestamp < start && l.timestamp > 0);

    const metric = (predicate: (l: LogRecord) => boolean) => {
      const current = cur.filter(predicate).length;
      const previous = prev.filter(predicate).length;
      const hasPrev = previous > 0;
      const up = current >= previous;
      const trend = hasPrev ? Math.round(((current - previous) / previous) * 100) : null;
      const sparkline = Array.from({ length: 8 }, (_, i) => {
        const bStart = start + i * bucketSize;
        const bEnd = bStart + bucketSize;
        return cur.filter((l) => l.timestamp >= bStart && l.timestamp < bEnd && predicate(l)).length;
      });
      return { current, previous, up, trend, hasPrev, sparkline };
    };

    // Affected gateways: count distinct gateways with non-info severity
    const affGwCur = new Set(cur.filter((l) => l.severity !== 'info').map((l) => l.gateway)).size;
    const affGwPrev = new Set(prev.filter((l) => l.severity !== 'info').map((l) => l.gateway)).size;
    const hasPrevGw = affGwPrev > 0;

    return {
      total: metric(() => true),
      critical: metric((l) => l.severity === 'critical'),
      error: metric((l) => l.severity === 'error'),
      warning: metric((l) => l.severity === 'warning'),
      info: metric((l) => l.severity === 'info'),
      activeAlarms: metric((l) => l.type === 'Alarm' && l.status === 'active'),
      offlineDevices: metric((l) => l.summary.toLowerCase().includes('heartbeat missing')),
      affectedGateways: {
        current: affGwCur,
        previous: affGwPrev,
        up: affGwCur >= affGwPrev,
        hasPrev: hasPrevGw,
        trend: hasPrevGw ? Math.round(((affGwCur - affGwPrev) / affGwPrev) * 100) : null,
        sparkline: Array.from({ length: 8 }, (_, i) => {
          const bStart = start + i * bucketSize;
          const bEnd = bStart + bucketSize;
          return new Set(cur.filter((l) => l.timestamp >= bStart && l.timestamp < bEnd && l.severity !== 'info').map((l) => l.gateway)).size;
        }),
      },
    };
  }, [scopedLogs, logs, timeWindow]);

  const volumeTrend = React.useMemo(() => {
    const [start] = timeWindow;
    const buckets = new Map<string, number>();
    scopedLogs.filter((log) => log.timestamp > 0 && !isNaN(log.timestamp)).forEach((log) => {
      const label = dayjs.unix(log.timestamp).format('MM-DD HH:00');
      buckets.set(label, (buckets.get(label) || 0) + 1);
    });
    if (buckets.size === 0) {
      for (let i = 11; i >= 0; i -= 1) {
        const label = dayjs.unix(start).add(i * 2, 'hour').format('MM-DD HH:00');
        buckets.set(label, 0);
      }
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([time, value]) => ({ time, value }));
  }, [scopedLogs, timeWindow]);

  const severityDist = React.useMemo(() => {
    const counts: Record<Severity, number> = { critical: 0, error: 0, warning: 0, info: 0 };
    scopedLogs.forEach((l) => { counts[l.severity] += 1; });
    return Object.entries(counts).map(([severity, value]) => ({ severity, value }));
  }, [scopedLogs]);

  const topSources = React.useMemo(() => {
    const bySource = new Map<string, number>();
    scopedLogs.filter((l) => l.severity !== 'info').forEach((l) => {
      const src = l.gateway + (l.device && l.device !== '\u2013' ? ` / ${l.device}` : '');
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
      width: 152,
      sorter: (a, b) => a.timestamp - b.timestamp,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (ts: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {dayjs.unix(ts).format('YYYY-MM-DD HH:mm:ss')}
        </span>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 96,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (sev: Severity) => (
        <Tag color={severityColors[sev]} style={{ margin: 0, fontSize: 11 }}>
          {sev === 'critical' ? 'CRIT' : sev.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Critical', value: 'critical' },
        { text: 'Error', value: 'error' },
        { text: 'Warning', value: 'warning' },
        { text: 'Info', value: 'info' },
      ],
      onFilter: (value, record) => record.severity === value,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 130,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (v: string) => <span style={{ whiteSpace: 'nowrap' }}>{v}</span>,
    },
    {
      title: 'Source',
      width: 200,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (_: unknown, row: GroupedLogRecord) => (
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 196 }}>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto', fontSize: 13 }}
            onClick={(e) => { e.stopPropagation(); navigate('/realtime'); }}
          >
            {row.gateway}
          </Button>
          {row.device && row.device !== '–' && (
            <span style={{ color: '#9ca3af', fontSize: 12 }}>
              {' / '}
              <Button
                type="link"
                size="small"
                style={{ padding: 0, height: 'auto', fontSize: 12, color: '#9ca3af' }}
                onClick={(e) => { e.stopPropagation(); navigate('/devices'); }}
              >
                {row.device}
              </Button>
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'Summary Message',
      dataIndex: 'summary',
      ellipsis: true,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 90,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (status: LogStatus) => (
        <Tag
          color={status === 'active' ? 'red' : status === 'acknowledged' ? 'gold' : 'green'}
          style={{ margin: 0, fontSize: 11 }}
        >
          {status === 'active' ? 'Active' : status === 'acknowledged' ? 'Ack' : 'Cleared'}
        </Tag>
      ),
    },
    {
      title: '#',
      dataIndex: 'count',
      width: 52,
      sorter: (a, b) => a.count - b.count,
      onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
    },
    {
      title: <FlagOutlined style={{ color: '#9ca3af' }} />,
      width: 44,
      render: (_, row) => (
        <Button
          type="text"
          size="small"
          icon={<FlagOutlined style={{ color: row.pinned ? '#d97706' : '#d1d5db' }} />}
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

  const goToListWithFilter = React.useCallback((overrides: Partial<Filters>) => {
    setFilters((prev) => ({
      time: prev.time,
      customRange: prev.customRange,
      keyword: '',
      messageId: '',
      topic: '',
      site: undefined,
      gateways: [],
      device: undefined,
      type: undefined,
      severity: undefined,
      status: undefined,
      module: undefined,
      chips: { activeAlarms: false, offlineDevices: false, communicationErrors: false, unacknowledged: false, last1Hour: false },
      ...overrides,
    }));
    navigate('/log/list');
  }, [navigate]);

  const activeAlarmsList = React.useMemo(() =>
    scopedLogs
      .filter((l) => l.type === 'Alarm' && l.status === 'active')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6),
    [scopedLogs]
  );

  const recentIssues = React.useMemo(() =>
    scopedLogs
      .filter((l) =>
        (l.severity === 'critical' || l.severity === 'error') &&
        l.type !== 'Alarm'
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8),
    [scopedLogs]
  );

  const errorTrend = React.useMemo(() => {
    const buckets = new Map<string, number>();
    scopedLogs
      .filter((l) => (l.severity === 'critical' || l.severity === 'error') && l.timestamp > 0 && !isNaN(l.timestamp))
      .forEach((l) => {
        const key = dayjs.unix(l.timestamp).format('MM-DD HH:00');
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, value]) => ({ time, value }));
  }, [scopedLogs]);

  const logTypeDist = React.useMemo(() => {
    const counts: Partial<Record<LogType, number>> = {};
    scopedLogs.forEach((l) => { counts[l.type] = (counts[l.type] ?? 0) + 1; });
    return (Object.entries(counts) as [LogType, number][])
      .map(([type, value]) => ({ type, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [scopedLogs]);

  const recentActivity = React.useMemo(() =>
    scopedLogs
      .filter((l) => l.timestamp > 0 && !isNaN(l.timestamp))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 7),
    [scopedLogs]
  );

  const gatewayHealth = React.useMemo(() => {
    const map = new Map<string, { total: number; critical: number; error: number; warning: number }>();
    scopedLogs.forEach((l) => {
      const gw = l.gateway || '(unknown)';
      const cur = map.get(gw) ?? { total: 0, critical: 0, error: 0, warning: 0 };
      cur.total += 1;
      if (l.severity === 'critical') cur.critical += 1;
      else if (l.severity === 'error') cur.error += 1;
      else if (l.severity === 'warning') cur.warning += 1;
      map.set(gw, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => (b.critical + b.error) - (a.critical + a.error));
  }, [scopedLogs]);

  const [distTab, setDistTab] = React.useState<'severity' | 'type' | 'sources'>('severity');
  const [trendTab, setTrendTab] = React.useState<'volume' | 'error'>('volume');
  const timeLabel = filters.time === '1h' ? '1h' : filters.time === '7d' ? '7d' : '24h';

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
        <>
          {/* ── Time range selector ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Time range:</Text>
            <Segmented
              size="small"
              options={[
                { label: 'Last 1h', value: '1h' },
                { label: 'Last 24h', value: '24h' },
                { label: 'Last 7d', value: '7d' },
              ]}
              value={filters.time === 'custom' ? '24h' : filters.time}
              onChange={(v) => setFilters((prev) => ({ ...prev, time: v as TimeKey }))}
            />
            <Button icon={<ReloadOutlined />} size="small" loading={loading} onClick={fetchLogs}>Refresh</Button>
          </div>

          {/* ── Summary pills ── */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {[
              { label: `Total (${timeLabel})`, icon: <BarChartOutlined />, metric: summary24h.total, color: '#3b82f6', onClick: () => goToListWithFilter({}) },
              { label: 'Critical', icon: <AlertOutlined />, metric: summary24h.critical, color: '#dc2626', onClick: () => goToListWithFilter({ severity: 'critical' as Severity }) },
              { label: 'Error', icon: <FireOutlined />, metric: summary24h.error, color: '#f97316', onClick: () => goToListWithFilter({ severity: 'error' as Severity }) },
              { label: 'Warning', icon: <WarningOutlined />, metric: summary24h.warning, color: '#eab308', onClick: () => goToListWithFilter({ severity: 'warning' as Severity }) },
              { label: 'Info', icon: <CheckCircleOutlined />, metric: summary24h.info, color: '#22c55e', onClick: () => goToListWithFilter({ severity: 'info' as Severity }) },
              { label: 'Active Alarms', icon: <BellOutlined />, metric: summary24h.activeAlarms, color: '#dc2626', onClick: () => goToListWithFilter({ type: 'Alarm' as LogType, status: 'active' as LogStatus }) },
              { label: 'Offline Devices', icon: <DisconnectOutlined />, metric: summary24h.offlineDevices, color: '#6b7280', onClick: () => goToListWithFilter({ keyword: 'heartbeat missing' }) },
              { label: 'Affected GW', icon: <ClusterOutlined />, metric: summary24h.affectedGateways, color: '#8b5cf6', onClick: () => goToListWithFilter({}) },
            ].map((item) => (
              <div
                key={item.label}
                onClick={item.onClick}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', flex: '1 1 120px', minWidth: 110, transition: 'box-shadow 0.15s, border-color 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = item.color; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              >
                <span style={{ fontSize: 20, color: item.color, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: '#0f172a' }}>{item.metric.current}</div>
                  <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                </div>
                {item.metric.hasPrev && (
                  <Text type={item.metric.up ? 'success' : 'danger'} style={{ fontSize: 11, marginLeft: 'auto', flexShrink: 0 }}>
                    {item.metric.up ? '↑' : '↓'}{Math.abs(item.metric.trend ?? 0)}%
                  </Text>
                )}
              </div>
            ))}
          </div>

          {/* ── Charts + Right column ── */}
          <Row gutter={[10, 10]} style={{ marginTop: 10 }}>
            <Col xs={24} xl={7}>
              <Card
                className="overview-card"
                bordered={false}
                title="Distribution"
                styles={{ body: { paddingTop: 8 } }}
                extra={
                  <Segmented
                    size="small"
                    options={[
                      { label: 'Severity', value: 'severity' },
                      { label: 'By Type', value: 'type' },
                      { label: 'Sources', value: 'sources' },
                    ]}
                    value={distTab}
                    onChange={(v) => setDistTab(v as 'severity' | 'type' | 'sources')}
                  />
                }
              >
                {distTab === 'severity' && (
                  <ResponsiveContainer width="100%" height={175}>
                    <PieChart>
                      <Pie
                        data={severityDist.filter((d) => d.value > 0)}
                        dataKey="value"
                        nameKey="severity"
                        cx="50%"
                        cy="50%"
                        outerRadius={62}
                        label={({ name, value }) => `${name} ${value}`}
                        labelLine={false}
                      >
                        {severityDist.filter((d) => d.value > 0).map((entry) => {
                          const clr: Record<string, string> = { critical: '#dc2626', error: '#f97316', warning: '#eab308', info: '#3b82f6' };
                          return <Cell key={entry.severity} fill={clr[entry.severity] ?? '#9ca3af'} />;
                        })}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                {distTab === 'type' && (
                  <ResponsiveContainer width="100%" height={175}>
                    <BarChart
                      data={logTypeDist}
                      layout="vertical"
                      margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Count">
                        {logTypeDist.map((entry) => {
                          const c: Record<string, string> = { Alarm: '#dc2626', Communication: '#3b82f6', Rule: '#f59e0b', System: '#6b7280', Device: '#10b981', User: '#8b5cf6' };
                          return <Cell key={entry.type} fill={c[entry.type] ?? '#9ca3af'} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {distTab === 'sources' && (
                  <ResponsiveContainer width="100%" height={175}>
                    <BarChart
                      data={topSources.length > 0 ? topSources.slice(0, 6) : [{ source: 'No issues', count: 0 }]}
                      layout="vertical"
                      margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>

            <Col xs={24} xl={9}>
              <Card
                className="overview-card"
                bordered={false}
                title="Trends"
                extra={
                  <Segmented
                    size="small"
                    options={[
                      { label: 'Log Volume', value: 'volume' },
                      { label: 'Error Trend', value: 'error' },
                    ]}
                    value={trendTab}
                    onChange={(v) => setTrendTab(v as 'volume' | 'error')}
                  />
                }
              >
                {trendTab === 'volume' && (
                  <>
                    <ResponsiveContainer width="100%" height={175}>
                      <AreaChart data={volumeTrend} margin={{ top: 4, right: 16, bottom: 20, left: 0 }}>
                        <defs>
                          <linearGradient id="lgVolume" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#lgVolume)" dot={false} name="Count" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}
                {trendTab === 'error' && (
                  <>
                    {errorTrend.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '38px 0', color: '#9ca3af' }}>
                        <CheckCircleOutlined style={{ fontSize: 24, marginBottom: 8, display: 'block', color: '#22c55e' }} />
                        <Text type="secondary">No errors or critical events in this period</Text>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={175}>
                        <AreaChart data={errorTrend} margin={{ top: 4, right: 16, bottom: 20, left: 0 }}>
                          <defs>
                            <linearGradient id="lgError" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#dc2626" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="time" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
                          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip />
                          <Area type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} fill="url(#lgError)" dot={{ r: 3, fill: '#dc2626' }} name="Errors" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </>
                )}
              </Card>
            </Col>

            <Col xs={24} xl={8} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* ── Active Alarms ── */}
              <Card
                className="overview-card"
                bordered={false}
                title={
                  <Space>
                    <BellOutlined style={{ color: activeAlarmsList.length > 0 ? '#dc2626' : '#9ca3af' }} />
                    <span>Active Alarms</span>
                    <Tag color={activeAlarmsList.length > 0 ? 'red' : 'default'} style={{ fontSize: 11, margin: 0 }}>{activeAlarmsList.length}</Tag>
                  </Space>
                }
                extra={<Button type="link" size="small" onClick={() => goToListWithFilter({ type: 'Alarm' as LogType, status: 'active' as LogStatus })}>View all →</Button>}
              >
                {activeAlarmsList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '10px 0', color: '#9ca3af' }}>
                    <CheckCircleOutlined style={{ fontSize: 20, marginBottom: 6, display: 'block', color: '#22c55e' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>No active alarms</Text>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {activeAlarmsList.map((rec) => (
                      <div
                        key={rec.id}
                        style={{ padding: '5px 8px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer' }}
                        onClick={() => goToListWithFilter({ type: 'Alarm' as LogType, status: 'active' as LogStatus })}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <Tag color="red" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>ALARM</Tag>
                          <Text type="secondary" style={{ fontSize: 11 }}>{dayjs.unix(rec.timestamp).format('MM-DD HH:mm')}</Text>
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                            {rec.gateway}{rec.device && rec.device !== '–' ? ` / ${rec.device}` : ''}
                          </Text>
                        </div>
                        <div style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.summary}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* ── Recent Issues (warnings + errors + critical) ── */}
              <Card
                className="overview-card"
                bordered={false}
                title={
                  <Space>
                    <FireOutlined style={{ color: recentIssues.length > 0 ? '#ea580c' : '#9ca3af' }} />
                    <span>Error History</span>
                    <Tag color={recentIssues.length > 0 ? 'volcano' : 'default'} style={{ fontSize: 11, margin: 0 }}>{recentIssues.length}</Tag>
                  </Space>
                }
                extra={<Button type="link" size="small" onClick={() => goToListWithFilter({ severity: 'error' as Severity })}>View all →</Button>}
              >
                {recentIssues.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '10px 0', color: '#9ca3af' }}>
                    <CheckCircleOutlined style={{ fontSize: 20, marginBottom: 6, display: 'block', color: '#22c55e' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>No errors in this period</Text>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                    {recentIssues.map((rec) => {
                      const bgMap: Record<Severity, string> = { critical: '#fef2f2', error: '#fff7ed', warning: '#fefce8', info: '#f8fafc' };
                      const bdMap: Record<Severity, string> = { critical: '#fecaca', error: '#fed7aa', warning: '#fef08a', info: '#e2e8f0' };
                      const clMap: Record<Severity, string> = { critical: '#dc2626', error: '#ea580c', warning: '#ca8a04', info: '#2563eb' };
                      const lbMap: Record<Severity, string> = { critical: 'CRIT', error: 'ERR', warning: 'WARN', info: 'INFO' };
                      return (
                        <div
                          key={rec.id}
                          style={{ padding: '5px 8px', borderRadius: 6, background: bgMap[rec.severity], border: `1px solid ${bdMap[rec.severity]}`, cursor: 'pointer' }}
                          onClick={() => goToListWithFilter({ severity: rec.severity })}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                            <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px', color: clMap[rec.severity], background: bgMap[rec.severity], border: `1px solid ${bdMap[rec.severity]}` }}>{lbMap[rec.severity]}</Tag>
                            <Text type="secondary" style={{ fontSize: 11 }}>{dayjs.unix(rec.timestamp).format('MM-DD HH:mm')}</Text>
                            <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{rec.gateway}</Text>
                          </div>
                          <div style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.summary}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* ── Bottom row: Gateway Activity + Recent Activity ── */}
          <Row gutter={[10, 10]} style={{ marginTop: 10 }}>
            {/* Gateway Activity */}
            <Col xs={24} xl={7}>
              <Card
                className="overview-card"
                bordered={false}
                title="Gateway Activity"
                styles={{ body: { padding: '8px 16px 12px' } }}
              >
                {gatewayHealth.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>No gateway data</Text>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {gatewayHealth.slice(0, 6).map((gw) => {
                      return (
                        <div key={gw.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: gw.critical > 0 ? '#dc2626' : gw.error > 0 ? '#f97316' : gw.warning > 0 ? '#eab308' : '#22c55e',
                          }} />
                          <Text style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gw.name}</Text>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {gw.critical > 0 && <span style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '0 5px', lineHeight: '18px' }}>{gw.critical}</span>}
                            {gw.error > 0 && <span style={{ fontSize: 11, color: '#ea580c', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 4, padding: '0 5px', lineHeight: '18px' }}>{gw.error}</span>}
                            {gw.warning > 0 && <span style={{ fontSize: 11, color: '#ca8a04', background: '#fefce8', border: '1px solid #fef08a', borderRadius: 4, padding: '0 5px', lineHeight: '18px' }}>{gw.warning}</span>}
                            <span style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '0 5px', lineHeight: '18px' }}>{gw.total}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </Col>

            {/* Recent Activity */}
            <Col xs={24} xl={17}>
              <Card
                className="overview-card"
                bordered={false}
                title="Recent Activity"
                styles={{ body: { padding: '0 0 4px' } }}
              >
                {recentActivity.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>No recent activity</Text>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {['', 'Time', 'Gateway', 'Device', 'Type', 'Summary'].map((h) => (
                            <th key={h} style={{ padding: '4px 10px', textAlign: 'left', fontWeight: 500, color: '#94a3b8', whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentActivity.map((log, i) => {
                          const sevColor: Record<Severity, string> = { critical: '#dc2626', error: '#f97316', warning: '#eab308', info: '#3b82f6' };
                          return (
                            <tr key={log.id} style={{ borderBottom: i < recentActivity.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                              <td style={{ padding: '3px 6px 3px 10px', width: 10 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: sevColor[log.severity] }} />
                              </td>
                              <td style={{ padding: '3px 10px', whiteSpace: 'nowrap', color: '#64748b' }}>
                                {dayjs.unix(log.timestamp).format('HH:mm:ss')}
                              </td>
                              <td style={{ padding: '3px 10px', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {log.gateway || '—'}
                              </td>
                              <td style={{ padding: '3px 10px', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', color: '#64748b' }}>
                                {log.device || '—'}
                              </td>
                              <td style={{ padding: '3px 10px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '1px 6px' }}>{log.type}</span>
                              </td>
                              <td style={{ padding: '3px 10px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>
                                {log.summary}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}

      {subView === 'list' && (
        <Card className="overview-card" bordered={false}>
            {/* ── Unified toolbar ── */}
            <div className="logs-list-toolbar">
              {/* LEFT: Gateway multi-select */}
              <Select
                mode="multiple"
                allowClear
                showSearch
                size="small"
                placeholder="All gateways"
                className="logs-gateway-select"
                value={filters.gateways ?? []}
                options={gatewayOptions.map((g) => ({ label: g, value: g }))}
                onChange={(v) => setFilters((prev) => ({ ...prev, gateways: v }))}
                maxTagCount="responsive"
              />
              {/* MIDDLE: Stat pills (clickable) */}
              <div className="logs-list-toolbar-stats">
                {[
                  { label: 'Total',         value: scopedLogs.length,                                                            color: '#0f172a', bg: '#f1f5f9', border: '#e2e8f0', active: !filters.severity && !filters.chips.activeAlarms, onClick: () => setFilters((p) => ({ ...p, severity: undefined, chips: { ...p.chips, activeAlarms: false } })) },
                  { label: 'Critical',      value: scopedLogs.filter((l) => l.severity === 'critical').length,                   color: '#dc2626', bg: '#fef2f2', border: '#fecaca', active: filters.severity === 'critical', onClick: () => setFilters((p) => ({ ...p, severity: p.severity === 'critical' ? undefined : 'critical' as Severity })) },
                  { label: 'Error',         value: scopedLogs.filter((l) => l.severity === 'error').length,                      color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', active: filters.severity === 'error',    onClick: () => setFilters((p) => ({ ...p, severity: p.severity === 'error'    ? undefined : 'error'    as Severity })) },
                  { label: 'Warning',       value: scopedLogs.filter((l) => l.severity === 'warning').length,                    color: '#ca8a04', bg: '#fefce8', border: '#fef08a', active: filters.severity === 'warning',  onClick: () => setFilters((p) => ({ ...p, severity: p.severity === 'warning'  ? undefined : 'warning'  as Severity })) },
                  { label: 'Info',          value: scopedLogs.filter((l) => l.severity === 'info').length,                       color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', active: filters.severity === 'info',     onClick: () => setFilters((p) => ({ ...p, severity: p.severity === 'info'     ? undefined : 'info'     as Severity })) },
                  { label: 'Active Alarms', value: scopedLogs.filter((l) => l.type === 'Alarm' && l.status === 'active').length, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', active: filters.chips.activeAlarms,      onClick: () => setFilters((p) => ({ ...p, chips: { ...p.chips, activeAlarms: !p.chips.activeAlarms } })) },
                ].map(({ label, value, color, bg, border, active, onClick }) => (
                  <div
                    key={label}
                    className={`logs-stat-pill${active ? ' logs-stat-pill-active' : ''}`}
                    style={{ background: bg, borderColor: active ? color : border }}
                    onClick={onClick}
                  >
                    <span className="logs-stat-pill-value" style={{ color }}>{value}</span>
                    <span className="logs-stat-pill-label">{label}</span>
                  </div>
                ))}
              </div>
              <div className="logs-list-toolbar-actions">
                <Text type="secondary" style={{ fontSize: 12 }}>{groupedLogs.length} grouped rows</Text>
                <Segmented
                  size="small"
                  options={[
                    { label: '1h', value: '1h' },
                    { label: '24h', value: '24h' },
                    { label: '7d', value: '7d' },
                  ]}
                  value={filters.time === 'custom' ? '24h' : filters.time}
                  onChange={(v) => setFilters((prev) => ({ ...prev, time: v as TimeKey }))}
                />
                <Button icon={<FilterOutlined />} onClick={() => setFilterDrawerOpen(true)}>Filters</Button>
                <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchLogs}>Refresh</Button>
                <Button icon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button>
              </div>
            </div>

            <Table<GroupedLogRecord>
              rowKey="id"
              size="small"
              columns={tableColumns}
              dataSource={pagedLogs}
              sticky
              pagination={false}
              rowClassName={(row) => `logs-row-${row.severity}`}
              onRow={(row) => ({ onClick: () => onOpenDetail(row) })}
              scroll={{ x: 800 }}
            />
            <div className="logs-list-pagination">
              <Pagination
                current={page}
                pageSize={pageSize}
                total={groupedLogs.length}
                showSizeChanger
                pageSizeOptions={['15', '30', '50']}
                size="small"
                onChange={(p, ps) => { setPage(p); if (ps !== pageSize) setPageSize(ps); }}
              />
            </div>
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
                site: undefined, gateways: [], device: undefined,
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
              <Select mode="multiple" allowClear placeholder="All gateways" value={filters.gateways ?? []} style={{ width: '100%' }} onChange={(v) => setFilters((p) => ({ ...p, gateways: v }))} options={gatewayOptions.map((g) => ({ label: g, value: g }))} />
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
              <pre className="logs-json-block">{JSON.stringify(
                { ...selected.payload, items: undefined },
                null, 2
              )}</pre>
            </Card>

            {Array.isArray(selected.payload.items) && (selected.payload.items as unknown[]).length > 0 && (
              <Card size="small" title={`Device Values (${(selected.payload.items as unknown[]).length} item(s))`}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 500 }}>Dev ID</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 500 }}>Parameter</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 500 }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.payload.items as Array<Record<string, unknown>>).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '3px 8px', color: '#475569' }}>{String(it.devId ?? '–')}</td>
                        <td style={{ padding: '3px 8px', color: '#475569' }}>{String(it.paramId ?? '–')}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 500 }}>{String(it.value ?? '–')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

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
