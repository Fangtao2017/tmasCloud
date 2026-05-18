import React from 'react';
import {
  ArrowLeftOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Column, Line } from '@ant-design/plots';
import { Button, Card, Col, Row, Segmented, Select, Space, Spin, Tag, Typography } from 'antd';
import { getSites, getSiteEnergySummary } from '../services/api';
import { DevStatusModal } from '../components/DevStatusModal';
import type { Site, EnergySummary } from '../types/api';

const { Text, Title } = Typography;

type TimeRange = '1h' | '24h' | '7d' | '30d';
type TrendMetric = 'energy' | 'power';
type BreakdownMode = 'area' | 'device';

const SCHOOLS = [
  'Temasek Polytechnic',
  'ITE College East',
  'Republic Polytechnic',
  'Ngee Ann Polytechnic',
] as const;

const schoolSummary: Record<string, { share: number; todayKwh: number; currentKw: number }> = {
  'Temasek Polytechnic': { share: 31.6, todayKwh: 1260, currentKw: 282 },
  'ITE College East': { share: 25.4, todayKwh: 1016, currentKw: 227 },
  'Republic Polytechnic': { share: 22.1, todayKwh: 882, currentKw: 201 },
  'Ngee Ann Polytechnic': { share: 20.9, todayKwh: 836, currentKw: 194 },
};

const issues: Array<{
  id: string;
  severity: 'high' | 'medium' | 'low';
  school: string;
  title: string;
  detail: string;
  action: string;
}> = [
  {
    id: 'issue-1',
    severity: 'high',
    school: 'Temasek Polytechnic',
    title: 'Cooling loop running overnight',
    detail: 'HVAC load stayed 19% above baseline between 01:00 and 04:00.',
    action: 'Check BMS schedule and night setback policy.',
  },
  {
    id: 'issue-2',
    severity: 'medium',
    school: 'ITE College East',
    title: 'High standby load in labs',
    detail: 'Weekend standby remains at 41 kW (target < 28 kW).',
    action: 'Inspect idle devices and auto-shutdown rules.',
  },
  {
    id: 'issue-3',
    severity: 'medium',
    school: 'Republic Polytechnic',
    title: 'Demand spike near tariff boundary',
    detail: 'Peak jumped to 398 kW at 14:10, close to penalty threshold.',
    action: 'Shift non-critical loads outside peak period.',
  },
  {
    id: 'issue-4',
    severity: 'low',
    school: 'Ngee Ann Polytechnic',
    title: 'Power factor drift',
    detail: 'Average power factor dropped from 0.95 to 0.91 this week.',
    action: 'Review capacitor bank staging.',
  },
];

const topDevices = [
  { name: 'HVAC Chiller Group', school: 'Temasek Polytechnic', value: 312, share: 18.2 },
  { name: 'Main AHU Cluster', school: 'ITE College East', value: 244, share: 14.1 },
  { name: 'Workshop Compressor', school: 'Republic Polytechnic', value: 198, share: 11.5 },
  { name: 'Library Cooling Plant', school: 'Ngee Ann Polytechnic', value: 176, share: 10.3 },
  { name: 'Lighting Feeder A', school: 'Temasek Polytechnic', value: 154, share: 9.1 },
];

const labelsByRange: Record<TimeRange, string[]> = {
  '1h': ['00m', '10m', '20m', '30m', '40m', '50m', '60m'],
  '24h': ['00', '04', '08', '12', '16', '20', '24'],
  '7d': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  '30d': ['W1', 'W2', 'W3', 'W4', 'W5'],
};

const buildTrendData = (range: TimeRange, metric: TrendMetric, school: string) => {
  const labels = labelsByRange[range];
  const schoolFactor = schoolSummary[school]?.share ?? 25;
  const scale = metric === 'energy' ? 1 : 0.24;
  const base = metric === 'energy' ? 620 : 152;

  const currentSeries = labels.map((time, idx) => {
    const noise = Math.sin((idx + 1) * 1.15) * 24 + Math.cos((idx + 1) * 0.8) * 10;
    const value = Math.round((base + schoolFactor * 3.2 + idx * 6 + noise) * scale);
    const anomaly = range === '24h' ? idx === 4 : range === '7d' ? idx === 2 : idx === labels.length - 2;
    return { time, value, series: 'Current Period', anomaly };
  });

  const baselineSeries = labels.map((time, idx) => {
    const value = Math.round((base + schoolFactor * 2.7 + idx * 4) * scale);
    return { time, value, series: 'Baseline', anomaly: false };
  });

  return [...currentSeries, ...baselineSeries];
};

const EnergyMonitoringView: React.FC = () => {
  const [selectedSite, setSelectedSite] = React.useState<Site | null>(null);
  const [sites, setSites] = React.useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = React.useState(true);
  const [energySummary, setEnergySummary] = React.useState<EnergySummary | null>(null);
  const [energyLoading, setEnergyLoading] = React.useState(false);
  const [selectedSchool, setSelectedSchool] = React.useState<string | null>(null);
  const [timeRange, setTimeRange] = React.useState<TimeRange>('24h');
  const [trendMetric, setTrendMetric] = React.useState<TrendMetric>('energy');
  const [breakdownMode, setBreakdownMode] = React.useState<BreakdownMode>('area');

  React.useEffect(() => {
    getSites().then((data) => {
      setSites(data);
    }).catch(console.error).finally(() => setSitesLoading(false));
  }, []);

  React.useEffect(() => {
    if (!selectedSite) { setEnergySummary(null); return; }
    setEnergyLoading(true);
    getSiteEnergySummary(selectedSite.id)
      .then(setEnergySummary)
      .catch(console.error)
      .finally(() => setEnergyLoading(false));
  }, [selectedSite]);

  const trendData = React.useMemo(() => buildTrendData(timeRange, trendMetric, selectedSchool ?? ''), [timeRange, trendMetric, selectedSchool]);

  const breakdownData = React.useMemo(() => {
    if (breakdownMode === 'device') {
      return topDevices.map((d) => ({ name: d.name, value: d.value, pct: d.share }));
    }
    return SCHOOLS.map((s) => ({ name: s, value: schoolSummary[s].todayKwh, pct: schoolSummary[s].share }));
  }, [breakdownMode]);

  const schoolIssuesCount = React.useMemo(() => issues.filter((i) => i.school === selectedSchool).length, [selectedSchool]);

  const todayTotal = SCHOOLS.reduce((sum, s) => sum + schoolSummary[s].todayKwh, 0);
  const totalCurrentKw = SCHOOLS.reduce((sum, s) => sum + schoolSummary[s].currentKw, 0);
  const totalContractedKw = 1400;
  const totalLoadPct = Math.min(100, Math.round((totalCurrentKw / totalContractedKw) * 100));
  const topSchool = SCHOOLS.slice().sort((a, b) => schoolSummary[b].todayKwh - schoolSummary[a].todayKwh)[0];

  // Real energy KPIs from backend
  const fmtKw = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)} MW` : `${v.toFixed(1)} kW`;
  const fmtKwh = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)} MWh` : `${v.toFixed(0)} kWh`;
  const peakTimeStr = energySummary?.peak_time
    ? new Date(energySummary.peak_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const kpis = selectedSchool ? [
    {
      title: 'Current Load',
      value: energyLoading ? '…' : energySummary ? fmtKw(energySummary.current_load_kw) : '— kW',
      hint: energySummary ? `${energySummary.meter_count} meter(s)` : 'No meter data',
      trend: '—',
      tone: 'coral',
    },
    {
      title: 'Today Energy',
      value: energyLoading ? '…' : energySummary ? fmtKwh(energySummary.today_energy_kwh) : '— kWh',
      hint: 'Since midnight',
      trend: '—',
      tone: 'teal',
    },
    {
      title: 'Peak Demand',
      value: energyLoading ? '…' : energySummary ? fmtKw(energySummary.peak_demand_kw) : '— kW',
      hint: `Today ${peakTimeStr}`,
      trend: '—',
      tone: 'amber',
    },
    {
      title: 'EUI',
      value: '—',
      hint: 'No floor area configured',
      trend: '—',
      tone: 'blue',
    },
  ] as const : [];

  if (!selectedSite) {
    return (
      <div className="emd-page">
        <div style={{ marginBottom: 20 }}>
          <Text className="overview-section-label">Energy Monitoring</Text>
          <Title level={4} style={{ margin: '4px 0 0' }}>Select a Site</Title>
        </div>
        {sitesLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : (
          <Row gutter={[16, 16]}>
            {sites.map((site) => (
              <Col key={site.id} xs={24} sm={12} xl={6}>
                <button
                  type="button"
                  onClick={() => { setSelectedSite(site); setSelectedSchool(site.name); }}
                  style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                >
                  <Card
                    bordered={false}
                    className="overview-card"
                    style={{ transition: 'box-shadow 0.2s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,58,112,0.15)')}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <Text strong style={{ fontSize: 15 }}>{site.name}</Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <EnvironmentOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>{site.address ?? site.code ?? '—'}</Text>
                        </div>
                      </div>
                      <ThunderboltOutlined style={{ fontSize: 18, color: '#003A70' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>Gateways</Text>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{site.gateway_count}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>Online</Text>
                        <div style={{ fontWeight: 600, fontSize: 14, color: site.online_gateways > 0 ? '#0f766e' : '#94a3b8' }}>
                          {site.online_gateways} / {site.gateway_count}
                        </div>
                      </div>
                    </div>
                  </Card>
                </button>
              </Col>
            ))}
          </Row>
        )}
      </div>
    );
  }

  return (
    <div className="emd-page">
      <DevStatusModal
        title="Home — Energy Monitoring"
        storageKey="dev_status_energy"
        items={[
          { label: 'Site Data', status: 'partial', note: 'Connected to live site data' },
          { label: 'Energy Meter Data', status: 'mock', note: 'Electricity meter readings are sample data' },
        ]}
      />
      <div style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => { setSelectedSite(null); setSelectedSchool(null); }} style={{ paddingLeft: 0 }}>
          All Sites
        </Button>
      </div>
      <Card className="overview-card emd-total-strip" bordered={false}>
        <div className="emd-total-strip-inner">
          <div className="emd-total-strip-title">
            <Text className="overview-section-label">All Areas Total</Text>
            <Text strong>Total Usage Overview</Text>
          </div>
          <div className="emd-total-strip-metrics">
            <div className="emd-total-metric">
              <Text className="overview-metric-label">Total Current Load</Text>
              <div className="emd-total-value">{totalCurrentKw} kW</div>
            </div>
            <div className="emd-total-metric">
              <Text className="overview-metric-label">Total Today Energy</Text>
              <div className="emd-total-value">{todayTotal.toLocaleString()} kWh</div>
            </div>
            <div className="emd-total-metric">
              <Text className="overview-metric-label">Total Load Ratio</Text>
              <div className="emd-total-progress-row">
                <div className="emd-total-progress-track">
                  <div className="emd-total-progress-fill" style={{ width: `${totalLoadPct}%` }} />
                </div>
                <Text>{totalLoadPct}%</Text>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overview-card emd-kpi" bordered={false}>
        <div className="overview-card-header emd-section-header">
          <div className="overview-card-title-row">
            <Text className="overview-section-label">Overview</Text>
            <Title level={4}>Actionable Metrics</Title>
          </div>
          <Space className="emd-kpi-header-right" size={6}>
            <Select
              size="small"
              className="emd-school-select"
              value={selectedSchool}
              onChange={setSelectedSchool}
              options={SCHOOLS.map((s) => ({ label: s, value: s }))}
            />
            <ThunderboltOutlined className="overview-header-icon" />
          </Space>
        </div>

        <div className="emd-kpi-grid">
          {kpis.map((kpi) => (
            <div key={kpi.title} className={`overview-metric-tile overview-metric-${kpi.tone}`}>
              <Text className="overview-metric-label">{kpi.title}</Text>
              <div className="overview-metric-value">{kpi.value}</div>
              <div className="emd-kpi-meta">
                <Text className="overview-metric-change">{kpi.hint}</Text>
                <Tag color={(kpi.trend as string) === 'down' ? 'green' : 'orange'}>{kpi.trend}</Tag>
              </div>
            </div>
          ))}
        </div>

        <div className="emd-insights-row">
          <button className="emd-insight" onClick={() => setTimeRange('24h')} type="button">
            <Text strong>High Load: 78% (12:00-16:00)</Text>
          </button>
          <button className="emd-insight" onClick={() => setSelectedSchool(topSchool)} type="button">
            <Text strong>Top Area: {topSchool} ({schoolSummary[topSchool].share}%)</Text>
          </button>
          <button className="emd-insight" onClick={() => setSelectedSchool(selectedSchool)} type="button">
            <Text strong>Active Issues: {schoolIssuesCount} open for selected school</Text>
          </button>
        </div>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card className="overview-card emd-trend" bordered={false}>
            <div className="overview-card-header emd-section-header">
              <div className="overview-card-title-row">
                <Text className="overview-section-label">Trend Chart</Text>
                <Title level={4}>Consumption Trend with Baseline</Title>
              </div>
              <Space className="emd-header-controls" size={6}>
                <Segmented
                  size="small"
                  options={[
                    { label: 'Energy (kWh)', value: 'energy' },
                    { label: 'Power (kW)', value: 'power' },
                  ]}
                  value={trendMetric}
                  onChange={(v) => setTrendMetric(v as TrendMetric)}
                />
                <Segmented
                  size="small"
                  options={[
                    { label: '1h', value: '1h' },
                    { label: '24h', value: '24h' },
                    { label: '7d', value: '7d' },
                    { label: '30d', value: '30d' },
                  ]}
                  value={timeRange}
                  onChange={(v) => setTimeRange(v as TimeRange)}
                />
              </Space>
            </div>

            <Line
              data={trendData}
              xField="time"
              yField="value"
              seriesField="series"
              height={220}
              smooth
              point={{
                size: ({ anomaly, series }: { anomaly: boolean; series: string }) => (anomaly && series === 'Current Period' ? 5 : 2),
                shape: 'circle',
                style: ({ anomaly, series }: { anomaly: boolean; series: string }) => ({
                  fill: anomaly && series === 'Current Period' ? '#ef4444' : series === 'Current Period' ? '#0ea5e9' : '#94a3b8',
                  stroke: '#fff',
                  lineWidth: anomaly ? 1 : 0,
                }),
              }}
              lineStyle={({ series }: { series: string }) => ({
                lineDash: series === 'Baseline' ? [6, 4] : undefined,
                lineWidth: series === 'Current Period' ? 2.2 : 1.6,
              })}
              tooltip={{
                title: 'time',
                items: ['series', 'value'],
              }}
            />
            <Text type="secondary">Red points indicate anomaly marks. Dashed line is baseline/previous period.</Text>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card className="overview-card" bordered={false}>
            <div className="overview-card-header emd-section-header">
              <div className="overview-card-title-row">
                <Text className="overview-section-label">Breakdown</Text>
                <Title level={4}>Energy Breakdown</Title>
              </div>
              <Segmented
                size="small"
                options={[
                  { label: 'By Area', value: 'area' },
                  { label: 'By Device', value: 'device' },
                ]}
                value={breakdownMode}
                onChange={(v) => setBreakdownMode(v as BreakdownMode)}
              />
            </div>

            <Column
              data={breakdownData}
              xField="name"
              yField="value"
              height={220}
              label={{
                text: ({ value, pct }: { value: number; pct: number }) => `${value} (${pct}%)`,
                position: 'top',
                style: { fill: '#475569', fontSize: 11 },
              }}
              color="#38bdf8"
              style={{ radiusTopLeft: 6, radiusTopRight: 6 }}
              xAxis={{ labelAutoRotate: false }}
            />
          </Card>
        </Col>
      </Row>

    </div>
  );
};

export default EnergyMonitoringView;
