"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  FileBarChart,
  Gauge,
  LayoutDashboard,
  Menu,
  Radio,
  RefreshCw,
  Sun,
  Sunrise,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardData, HourlyEnergyPoint, PlantData, PlantState, SummaryData } from "@/lib/types";

type Section = "overview" | "live" | "trends" | "alerts" | "reports";

const navigation: Array<{ id: Section; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "통합 현황", icon: LayoutDashboard },
  { id: "live", label: "실시간", icon: Activity },
  { id: "trends", label: "발전 분석", icon: BarChart3 },
  { id: "alerts", label: "장애·알림", icon: AlertTriangle },
  { id: "reports", label: "보고서", icon: FileBarChart },
];

const stateLabels: Record<PlantState, string> = {
  normal: "정상",
  fault: "장애",
  stopped: "정지",
  offline: "통신 끊김",
};

const compactNumber = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const koreaHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  hourCycle: "h23",
});
const koreaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits }).format(value);
}

function formatEnergy(value: number) {
  if (value >= 1_000_000) return { value: value / 1_000_000, unit: "GWh" };
  if (value >= 1_000) return { value: value / 1_000, unit: "MWh" };
  return { value, unit: "kWh" };
}

function formatUpdatedAt(value?: string) {
  if (!value) return "연결 중";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function summaryForPlant(plant: PlantData): SummaryData {
  return {
    currentKw: plant.currentKw,
    todayKwh: plant.todayKwh,
    yesterdayKwh: plant.yesterdayKwh,
    monthKwh: plant.monthKwh,
    totalKwh: plant.totalKwh,
    capacityKw: plant.capacityKw,
    normalCount: plant.state === "normal" ? 1 : 0,
    faultCount: plant.state === "fault" ? 1 : 0,
    stoppedCount: plant.state === "stopped" ? 1 : 0,
    offlineCount: plant.state === "offline" ? 1 : 0,
  };
}

type ChartPoint = { label: string; value: number };

function pointCoordinates(point: ChartPoint, max: number, width: number, height: number, padding: number, startHour = 0, endHour = 23) {
  const hour = Number.parseInt(point.label, 10);
  const ratio = Number.isFinite(hour) ? (hour - startHour) / Math.max(endHour - startHour, 1) : 0;
  return {
    x: padding + ratio * (width - padding * 2),
    y: height - padding - (point.value / max) * (height - padding * 2),
  };
}

function buildLinePath(data: ChartPoint[], max: number, width = 720, height = 228, padding = 24, startHour = 0, endHour = 23) {
  return data
    .map((point, index) => {
      const { x, y } = pointCoordinates(point, max, width, height, padding, startHour, endHour);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function koreaHour(value: string) {
  return Number(koreaHourFormatter.format(new Date(value)));
}

function koreaDate(value: string) {
  return koreaDateFormatter.format(new Date(value));
}

function offsetDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function formatChartDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00+09:00`));
}

function hourlyChartData(data: DashboardData, day: "today" | "yesterday") {
  const currentHour = koreaHour(data.updatedAt);
  const series = day === "today" ? data.todaySeries : data.yesterdaySeries;
  return series.filter((point) => Number(point.label) <= currentHour).map((point) => ({ label: point.label, value: point.energyKwh }));
}

function TrendLineChart({ data, comparisonData = [], unit, ariaLabel, primaryLabel = "오늘", comparisonLabel = "어제" }: { data: ChartPoint[]; comparisonData?: ChartPoint[]; unit: string; ariaLabel: string; primaryLabel?: string; comparisonLabel?: string }) {
  const width = 720;
  const height = 280;
  const padding = 64;
  const activeHours = [...data, ...comparisonData]
    .filter((point) => point.value > 0)
    .map((point) => Number.parseInt(point.label, 10))
    .filter(Number.isFinite);
  const startHour = activeHours.length ? Math.max(0, Math.min(...activeHours) - 1) : 0;
  const endHour = activeHours.length ? Math.min(23, Math.max(...activeHours) + 1) : 23;
  const visibleData = data.filter((point) => {
    const hour = Number.parseInt(point.label, 10);
    return hour >= startHour && hour <= endHour;
  });
  const visibleComparisonData = comparisonData.filter((point) => {
    const hour = Number.parseInt(point.label, 10);
    return hour >= startHour && hour <= endHour;
  });
  const values = [...visibleData, ...visibleComparisonData].map((point) => point.value);
  const max = Math.max(...values, 1);
  const line = buildLinePath(visibleData, max, width, height, padding, startHour, endHour);
  const comparisonLine = buildLinePath(visibleComparisonData, max, width, height, padding, startHour, endHour);
  const firstPoint = visibleData[0] ? pointCoordinates(visibleData[0], max, width, height, padding, startHour, endHour) : null;
  const lastPoint = visibleData.at(-1) ? pointCoordinates(visibleData.at(-1) as ChartPoint, max, width, height, padding, startHour, endHour) : null;
  const area = line && firstPoint && lastPoint ? `${line} L${lastPoint.x.toFixed(1)} ${height - padding} L${firstPoint.x.toFixed(1)} ${height - padding} Z` : "";
  const tickHours = Array.from(new Set([startHour, Math.round((startHour * 2 + endHour) / 3), Math.round((startHour + endHour * 2) / 3), endHour]));
  const todayTotal = data.reduce((total, point) => total + point.value, 0);
  const yesterdayTotal = comparisonData.reduce((total, point) => total + point.value, 0);

  if (!visibleData.length) return <EmptyChart />;

  return (
    <div className="trend-chart-wrap">
      <div className="chart-legend" aria-label={`${primaryLabel} 발전량 ${formatNumber(todayTotal)} ${unit}${comparisonData.length ? `, ${comparisonLabel} 발전량 ${formatNumber(yesterdayTotal)} ${unit}` : ""}`}>
        <span><i className="legend-today" /><b>{primaryLabel}</b><strong>{formatNumber(todayTotal)} <small>{unit}</small></strong></span>
        {comparisonData.length ? <span><i className="legend-yesterday" /><b>{comparisonLabel}</b><strong>{formatNumber(yesterdayTotal)} <small>{unit}</small></strong></span> : null}
      </div>
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id="solar-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--green-500)" stopOpacity="0.24" />
            <stop offset="1" stopColor="var(--green-500)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding + ratio * (height - padding * 2);
          return <line key={ratio} x1={padding} y1={y} x2={width - padding} y2={y} className="chart-grid-line" />;
        })}
        <text className="chart-axis-unit" x="20" y={height / 2} textAnchor="middle" transform={`rotate(-90 20 ${height / 2})`}>발전량 ({unit})</text>
        {comparisonLine ? <path d={comparisonLine} className="chart-line chart-line-yesterday" /> : null}
        <path d={area} fill="url(#solar-area)" />
        <path d={line} className="chart-line" />
        {visibleData.map((point, index) => {
          if (index !== visibleData.length - 1 && Number(point.label) % 3 !== 0) return null;
          const { x, y } = pointCoordinates(point, max, width, height, padding, startHour, endHour);
          return <circle key={`${point.label}-${index}`} cx={x} cy={y} r="4" className="chart-point"><title>{`오늘 ${point.label}시 · ${compactNumber.format(point.value)} ${unit}`}</title></circle>;
        })}
        {tickHours.map((hour) => {
          const x = padding + ((hour - startHour) / Math.max(endHour - startHour, 1)) * (width - padding * 2);
          return <text key={hour} x={x} y={height - 6} textAnchor={hour === startHour ? "start" : hour === endHour ? "end" : "middle"}>{String(hour).padStart(2, "0")}시</text>;
        })}
      </svg>
    </div>
  );
}

interface HistoricalTrendData {
  date: string;
  previousDate: string;
  series: HourlyEnergyPoint[];
  previousSeries: HourlyEnergyPoint[];
}

function TrendDateBrowser({ data }: { data: DashboardData }) {
  const latestDate = koreaDate(data.updatedAt);
  const [selectedDate, setSelectedDate] = useState("");
  const [historicalData, setHistoricalData] = useState<HistoricalTrendData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const activeDate = selectedDate || latestDate;
  const isToday = activeDate === latestDate;

  useEffect(() => {
    if (isToday) {
      setHistoricalData(null);
      setHistoryError("");
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setHistoryError("");
    void fetch(`/api/history?date=${encodeURIComponent(activeDate)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("저장된 발전량을 불러오지 못했습니다.");
        return response.json() as Promise<HistoricalTrendData>;
      })
      .then((nextData) => setHistoricalData(nextData))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHistoricalData(null);
        setHistoryError(error instanceof Error ? error.message : "저장된 발전량을 불러오지 못했습니다.");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [activeDate, isToday]);

  const primaryData: ChartPoint[] = isToday
    ? hourlyChartData(data, "today")
    : (historicalData?.series ?? []).map((point) => ({ label: point.label, value: point.energyKwh }));
  const comparisonData: ChartPoint[] = isToday
    ? hourlyChartData(data, "yesterday")
    : (historicalData?.previousSeries ?? []).map((point) => ({ label: point.label, value: point.energyKwh }));
  const primaryLabel = isToday ? "오늘" : formatChartDate(activeDate);
  const comparisonDate = offsetDate(activeDate, -1);
  const comparisonLabel = isToday ? "어제" : formatChartDate(comparisonDate);
  const hasHistoricalData = isToday || Boolean(historicalData?.series.length || historicalData?.previousSeries.length);

  return (
    <div className="trend-browser">
      <div className="trend-date-controls" aria-label="발전량 비교 날짜 선택">
        <button type="button" className="date-step-button" onClick={() => setSelectedDate(offsetDate(activeDate, -1))} aria-label="이전 날짜"><ChevronLeft size={24} /></button>
        <label className="trend-date-picker"><span>비교 날짜</span><input type="date" value={activeDate} max={latestDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        <button type="button" className="date-step-button" onClick={() => setSelectedDate(offsetDate(activeDate, 1))} aria-label="다음 날짜" disabled={activeDate >= latestDate}><ChevronRight size={24} /></button>
      </div>
      <p className="trend-date-caption"><strong>{primaryLabel}</strong>과 <strong>{comparisonLabel}</strong> 발전량 비교</p>
      {isLoading ? <div className="empty-chart">저장된 발전량을 불러오는 중입니다.</div> : null}
      {!isLoading && historyError ? <div className="empty-chart">{historyError}</div> : null}
      {!isLoading && !historyError && !hasHistoricalData ? <div className="empty-chart">이 날짜의 저장된 발전량이 없습니다.</div> : null}
      {!isLoading && !historyError && hasHistoricalData ? <TrendLineChart data={primaryData} comparisonData={comparisonData} unit="kWh" primaryLabel={primaryLabel} comparisonLabel={comparisonLabel} ariaLabel={`${primaryLabel}와 ${comparisonLabel}의 시간별 발전량 비교`} /> : null}
    </div>
  );
}

function DailyBarChart({ data }: { data: DashboardData["dailySeries"] }) {
  const width = 720;
  const height = 280;
  const padding = 64;
  const max = Math.max(...data.map((point) => point.energyKwh), 1);
  const gap = 6;
  const chartWidth = width - padding * 2;
  const barWidth = Math.max(4, chartWidth / Math.max(data.length, 1) - gap);

  if (!data.length) return <EmptyChart />;

  return (
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="최근 일별 발전량 막대 그래프">
      {[0, 0.5, 1].map((ratio) => {
        const y = padding + ratio * (height - padding * 2);
        return <line key={ratio} x1={padding} y1={y} x2={width - padding} y2={y} className="chart-grid-line" />;
      })}
      <text className="chart-axis-unit" x="20" y={height / 2} textAnchor="middle" transform={`rotate(-90 20 ${height / 2})`}>발전량 (kWh)</text>
      {data.map((point, index) => {
        const barHeight = (point.energyKwh / max) * (height - padding * 2);
        const x = padding + index * (chartWidth / data.length) + gap / 2;
        const y = height - padding - barHeight;
        return (
          <rect key={`${point.date}-${index}`} x={x} y={y} width={barWidth} height={barHeight} rx="3" className="chart-bar">
            <title>{`${point.date} · ${compactNumber.format(point.energyKwh)} kWh`}</title>
          </rect>
        );
      })}
      <text x={padding} y={height - 6}>{data[0]?.date}</text>
      <text x={width - padding} y={height - 6} textAnchor="end">{data.at(-1)?.date}</text>
      <text x={width - padding} y={padding} textAnchor="end">{`${compactNumber.format(max)} kWh`}</text>
    </svg>
  );
}

function EmptyChart() {
  return <div className="empty-chart">연동 데이터가 쌓이면 추이가 표시됩니다.</div>;
}

function StatusPill({ state }: { state: PlantState }) {
  return <span className={`status-pill status-${state}`}><span className="status-dot" />{stateLabels[state]}</span>;
}

function KpiCard({ label, value, unit, note, icon: Icon, tone = "default" }: { label: string; value: string; unit: string; note: string; icon: typeof Activity; tone?: "default" | "good" | "warning" }) {
  return (
    <article className="kpi-card">
      <div className="kpi-label"><span>{label}</span><Icon size={18} aria-hidden="true" /></div>
      <div className={`kpi-value tone-${tone}`}>{value}<span>{unit}</span></div>
      <div className="kpi-note">{note}</div>
    </article>
  );
}

function PlantRows({ plants, onSelect }: { plants: PlantData[]; onSelect: (id: string) => void }) {
  return (
    <div className="plant-list">
      {plants.map((plant) => (
        <button key={plant.id} type="button" className="plant-row" onClick={() => onSelect(plant.id)}>
          <span className="plant-row-main">
            <strong>{plant.name}</strong>
            <small>{formatNumber(plant.capacityKw)} kW · 수신 {plant.lastReceivedSeconds == null ? "확인 중" : `${formatNumber(plant.lastReceivedSeconds, 0)}초 전`}</small>
          </span>
          <span className="plant-row-output"><strong>{formatNumber(plant.currentKw)} kW</strong><StatusPill state={plant.state} /></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function SolarDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [selectedPlantId, setSelectedPlantId] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store", signal });
      if (!response.ok) throw new Error(`대시보드 API 오류 (${response.status})`);
      const nextData = (await response.json()) as DashboardData;
      setData(nextData);
      setError("");
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === "AbortError") return;
      setError(nextError instanceof Error ? nextError.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    const interval = window.setInterval(() => void loadData(), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [loadData]);

  const selectedPlant = useMemo(
    () => data?.plants.find((plant) => plant.id === selectedPlantId) ?? null,
    [data, selectedPlantId],
  );
  const activeSummary = selectedPlant ? summaryForPlant(selectedPlant) : data?.summary;
  const monthEnergy = formatEnergy(activeSummary?.monthKwh ?? 0);
  const outputRate = activeSummary && activeSummary.capacityKw > 0 ? (activeSummary.currentKw / activeSummary.capacityKw) * 100 : 0;
  const normalTotal = activeSummary ? activeSummary.normalCount : 0;
  const monitoredTotal = activeSummary ? normalTotal + activeSummary.faultCount + activeSummary.stoppedCount + activeSummary.offlineCount : 0;
  const yesterdayDelta = activeSummary?.yesterdayKwh ? ((activeSummary.todayKwh - activeSummary.yesterdayKwh) / activeSummary.yesterdayKwh) * 100 : null;

  const chooseSection = (next: Section) => {
    setSection(next);
    setMenuOpen(false);
  };

  const selectPlant = (id: string) => {
    setSelectedPlantId(id);
    setSection("live");
  };

  return (
    <div className="dashboard-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Sun size={19} aria-hidden="true" /></span><span>Solar View</span></div>
        <button type="button" className="sidebar-close" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        <nav className="sidebar-nav" aria-label="주요 메뉴">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} className={section === id ? "nav-item active" : "nav-item"} onClick={() => chooseSection(id)}>
              <Icon size={19} aria-hidden="true" /><span>{label}</span>
              {id === "alerts" && data && data.alerts.filter((alert) => alert.state === "active").length > 0 ? <span className="nav-count">{data.alerts.length}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="source-card">
          <div className="source-card-row"><Radio size={16} aria-hidden="true" /><span>데이터 연결</span></div>
          <strong>{data?.source === "live" ? "정상 연결" : "데모 모드"}</strong>
          <small>{data?.sourceMessage ?? "연결 확인 중"}</small>
        </div>
      </aside>
      {menuOpen ? <button type="button" className="sidebar-backdrop" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)} /> : null}

      <main className="dashboard-main">
        <header className="topbar">
          <div className="title-wrap">
            <button type="button" className="mobile-menu-button" aria-label="메뉴 열기" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
            <div><h1>{section === "overview" ? "발전소 한눈에 보기" : navigation.find((item) => item.id === section)?.label}</h1><p>{selectedPlant ? selectedPlant.name : "전체 발전소"} · 마지막 확인 {formatUpdatedAt(data?.updatedAt)}</p></div>
          </div>
          <div className="topbar-actions">
            <label className="plant-select-label"><span className="sr-only">발전소 선택</span><select value={selectedPlantId} onChange={(event) => setSelectedPlantId(event.target.value)}><option value="all">전체 발전소</option>{data?.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name.replace(" 태양광발전소", "")}</option>)}</select></label>
            <button type="button" className="refresh-button" onClick={() => void loadData()} disabled={isRefreshing}><RefreshCw size={18} className={isRefreshing ? "spinning" : ""} aria-hidden="true" /><span>지금 확인</span></button>
          </div>
        </header>

        {error ? <div className="error-banner" role="alert"><AlertTriangle size={18} />{error}<button type="button" onClick={() => void loadData()}>다시 시도</button></div> : null}
        {data?.source === "demo" ? <div className="demo-banner"><CloudSun size={18} /><span>현재 데모 데이터입니다. Vercel 환경변수에 NREMS 계정을 넣으면 자동으로 실데이터로 전환됩니다.</span></div> : null}

        {!data ? <LoadingDashboard /> : (
          <>
            {section === "overview" ? (
              <OverviewSection
                data={data}
                summary={activeSummary ?? data.summary}
                monthEnergy={monthEnergy}
                outputRate={outputRate}
                normalTotal={normalTotal}
                monitoredTotal={monitoredTotal}
                yesterdayDelta={yesterdayDelta}
                onSelectPlant={selectPlant}
                onOpenTrends={() => setSection("trends")}
              />
            ) : null}
            {section === "live" ? <LiveSection data={data} selectedPlant={selectedPlant} onSelectPlant={setSelectedPlantId} /> : null}
            {section === "trends" ? <TrendsSection data={data} /> : null}
            {section === "alerts" ? <AlertsSection data={data} /> : null}
            {section === "reports" ? <ReportsSection data={data} /> : null}
          </>
        )}
      </main>

      <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴">
        {navigation.slice(0, 4).map(({ id, label, icon: Icon }) => (
          <button type="button" key={id} className={section === id ? "active" : ""} onClick={() => chooseSection(id)}><Icon size={20} /><span>{label === "통합 현황" ? "현황" : label === "발전 분석" ? "분석" : label.replace("·알림", "")}</span></button>
        ))}
      </nav>
    </div>
  );
}

function OverviewSection({ data, summary, monthEnergy, outputRate, normalTotal, monitoredTotal, yesterdayDelta, onSelectPlant, onOpenTrends }: {
  data: DashboardData;
  summary: SummaryData;
  monthEnergy: { value: number; unit: string };
  outputRate: number;
  normalTotal: number;
  monitoredTotal: number;
  yesterdayDelta: number | null;
  onSelectPlant: (id: string) => void;
  onOpenTrends: () => void;
}) {
  const yesterdayDifference = summary.todayKwh - summary.yesterdayKwh;
  const yesterdayComparison = yesterdayDelta == null
    ? "전일 데이터 확인 중"
    : yesterdayDifference === 0
      ? "전일과 같음 (0%)"
      : `전일 대비 ${yesterdayDifference > 0 ? "+" : "-"}${formatNumber(Math.abs(yesterdayDifference))} kWh (${yesterdayDelta > 0 ? "+" : ""}${formatNumber(yesterdayDelta, 1)}%)`;

  return (
    <div className="section-stack">
      <section className="senior-status-card" aria-label="현재 발전 상태">
        <div>
          <p>현재 발전 상태</p>
          <h2>{summary.faultCount + summary.offlineCount === 0 ? "정상 발전 중" : "설비 확인 필요"}</h2>
          <span>마지막 확인 {formatUpdatedAt(data.updatedAt)}</span>
        </div>
        <div className="senior-status-value"><strong>{formatNumber(summary.currentKw)}</strong><span>kW</span><small>현재 출력</small></div>
      </section>
      <section className="kpi-grid" aria-label="핵심 발전 지표">
        <KpiCard label="현재 출력" value={formatNumber(summary.currentKw)} unit="kW" note={`설비 대비 ${formatNumber(outputRate, 1)}%`} icon={Zap} tone="good" />
        <KpiCard label="금일 발전량" value={formatNumber(summary.todayKwh)} unit="kWh" note={yesterdayComparison} icon={Sunrise} tone={yesterdayDelta != null && yesterdayDelta < 0 ? "warning" : "good"} />
        <KpiCard label="금월 발전량" value={formatNumber(monthEnergy.value)} unit={monthEnergy.unit} note={`누적 ${formatNumber(summary.totalKwh / 1_000_000)} GWh`} icon={CalendarDays} />
        <KpiCard label="운영 상태" value={`${normalTotal}`} unit={`/ ${monitoredTotal}`} note={summary.faultCount + summary.offlineCount === 0 ? "현재 장애 없음" : `확인 필요 ${summary.faultCount + summary.offlineCount}개소`} icon={CheckCircle2} tone={summary.faultCount + summary.offlineCount === 0 ? "good" : "warning"} />
      </section>

      <section className="overview-grid">
        <article className="panel chart-panel">
          <div className="panel-heading"><div><h2>오늘 발전 추이</h2><p>현재 시각까지 · 어제 시간별 발전량 비교</p></div><button type="button" className="text-button" onClick={onOpenTrends}>상세 분석 <ChevronRight size={16} /></button></div>
          <TrendDateBrowser data={data} />
        </article>
        <GenerationShareChart plants={data.plants} />
        <article className="panel status-panel">
          <div className="panel-heading"><div><h2>발전소 상태</h2><p>{data.plants.length}개소 관제 중</p></div><span className={data.summary.faultCount ? "summary-status warning" : "summary-status good"}>{data.summary.faultCount ? "확인 필요" : "전체 정상"}</span></div>
          <PlantRows plants={data.plants} onSelect={onSelectPlant} />
        </article>
        <article className="panel plant-table-panel">
          <div className="panel-heading"><div><h2>발전소별 성과</h2><p>금일 기준</p></div></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>발전소</th><th>현재 출력</th><th>출력률</th><th>금일 발전량</th><th>발전시간</th><th>상태</th></tr></thead><tbody>{data.plants.map((plant) => <tr key={plant.id}><td><button type="button" onClick={() => onSelectPlant(plant.id)}>{plant.name}</button></td><td>{formatNumber(plant.currentKw)} kW</td><td>{formatNumber(plant.outputRate, 1)}%</td><td>{formatNumber(plant.todayKwh)} kWh</td><td>{formatNumber(plant.generationHours, 1)} h</td><td><StatusPill state={plant.state} /></td></tr>)}</tbody></table></div>
        </article>
        <article className="panel sync-panel">
          <div className="panel-heading"><div><h2>데이터 상태</h2><p>관제 연동 점검</p></div><Radio size={18} /></div>
          <dl className="detail-list"><div><dt>관제 API</dt><dd className={data.source === "live" ? "good-text" : "warning-text"}>{data.source === "live" ? "정상" : "데모"}</dd></div><div><dt>마지막 동기화</dt><dd>{formatUpdatedAt(data.updatedAt)}</dd></div><div><dt>자동 갱신</dt><dd>30초</dd></div><div><dt>설비용량</dt><dd>{formatNumber(data.summary.capacityKw)} kW</dd></div></dl>
        </article>
      </section>
    </div>
  );
}

function GenerationShareChart({ plants }: { plants: PlantData[] }) {
  const colors = ["#2d9d5d", "#2b76b8", "#d88a2d", "#8155b7"];
  const totalToday = plants.reduce((total, plant) => total + plant.todayKwh, 0);
  let cumulativePercent = 0;
  const shares = plants.map((plant, index) => {
    const percent = totalToday > 0 ? (plant.todayKwh / totalToday) * 100 : 0;
    const start = cumulativePercent;
    cumulativePercent += percent;
    return { plant, percent, start, end: cumulativePercent, color: colors[index % colors.length] };
  });
  const pieBackground = totalToday > 0
    ? `conic-gradient(${shares.map((share) => `${share.color} ${share.start}% ${share.end}%`).join(", ")})`
    : "conic-gradient(#dce6df 0 100%)";
  const ariaLabel = totalToday > 0
    ? `금일 발전량 비중. ${shares.map((share) => `${share.plant.name} ${formatNumber(share.percent, 1)}퍼센트`).join(", ")}`
    : "금일 발전량 데이터가 아직 없습니다.";

  return (
    <article className="panel generation-share-panel">
      <div className="panel-heading"><div><h2>오늘 발전량 비중</h2><p>두 발전소가 오늘 만든 전력의 비율</p></div></div>
      <div className="share-chart-layout">
        <div className="share-donut" style={{ background: pieBackground }} role="img" aria-label={ariaLabel}>
          <div className="share-donut-center"><span>금일 합계</span><strong>{formatNumber(totalToday, 0)}</strong><small>kWh</small></div>
        </div>
        <div className="share-list" aria-label="발전소별 금일 발전량 비중">
          {shares.map((share) => (
            <div className="share-list-item" key={share.plant.id}>
              <span className="share-color" style={{ backgroundColor: share.color }} aria-hidden="true" />
              <div><strong>{share.plant.name.replace(" 태양광발전소", "")}</strong><span>{formatNumber(share.plant.todayKwh)} kWh</span></div>
              <b>{formatNumber(share.percent, 1)}%</b>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function LiveSection({ data, selectedPlant, onSelectPlant }: { data: DashboardData; selectedPlant: PlantData | null; onSelectPlant: (id: string) => void }) {
  const visiblePlants = selectedPlant ? [selectedPlant] : data.plants;
  return (
    <div className="section-stack">
      <section className="live-hero">
        <div><span className="eyebrow">현재 총출력</span><strong>{formatNumber(selectedPlant?.currentKw ?? data.summary.currentKw)} <small>kW</small></strong><p><span className="live-dot" />화면은 30초마다 확인 · 실제 측정 {formatUpdatedAt(data.updatedAt)}</p></div>
        <div className="live-gauge"><Gauge size={24} /><span>출력률</span><strong>{formatNumber(selectedPlant?.outputRate ?? (data.summary.currentKw / Math.max(data.summary.capacityKw, 1)) * 100, 1)}%</strong></div>
      </section>
      <section className="plant-detail-grid">
        {visiblePlants.map((plant) => (
          <article key={plant.id} className="panel plant-detail-card">
            <div className="panel-heading"><div><h2>{plant.name}</h2><p>{plant.address || `${formatNumber(plant.capacityKw)} kW 설비`}</p></div><StatusPill state={plant.state} /></div>
            <div className="power-meter"><div className="power-meter-fill" style={{ width: `${Math.min(plant.outputRate, 100)}%` }} /></div>
            <div className="plant-metrics"><div><span>현재 출력</span><strong>{formatNumber(plant.currentKw)} kW</strong></div><div><span>금일 발전</span><strong>{formatNumber(plant.todayKwh)} kWh</strong></div><div><span>금월 발전</span><strong>{formatEnergy(plant.monthKwh).value.toFixed(2)} {formatEnergy(plant.monthKwh).unit}</strong></div><div><span>발전시간</span><strong>{formatNumber(plant.generationHours, 1)} h</strong></div></div>
          </article>
        ))}
      </section>
      {selectedPlant ? <button type="button" className="secondary-button" onClick={() => onSelectPlant("all")}>전체 발전소 다시 보기</button> : null}
    </div>
  );
}

function TrendsSection({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<"today" | "month">("today");
  return (
    <div className="section-stack">
      <div className="period-tabs" role="group" aria-label="분석 기간"><button type="button" className={period === "today" ? "active" : ""} onClick={() => setPeriod("today")}>오늘</button><button type="button" className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>최근 30일</button></div>
      <article className="panel analysis-chart-panel">
        <div className="panel-heading"><div><h2>{period === "today" ? "시간별 발전량 비교" : "일별 발전량"}</h2><p>{period === "today" ? "현재 시각까지의 오늘 발전량을 어제와 비교합니다." : "일사량 변화에 따른 발전량 추이를 확인합니다."}</p></div></div>
        {period === "today" ? <TrendDateBrowser data={data} /> : <DailyBarChart data={data.dailySeries} />}
      </article>
      <section className="analysis-insights">
        <article className="panel insight-card"><span>오늘 최고 출력</span><strong>{formatNumber(Math.max(...data.todaySeries.map((point) => point.powerKw), 0))} kW</strong><p>전체 설비용량의 {formatNumber((Math.max(...data.todaySeries.map((point) => point.powerKw), 0) / Math.max(data.summary.capacityKw, 1)) * 100, 1)}%</p></article>
        <article className="panel insight-card"><span>금일 발전량</span><strong>{formatNumber(data.summary.todayKwh)} kWh</strong><p>발전소 {data.plants.length}개소 합계</p></article>
        <article className="panel insight-card"><span>누적 발전량</span><strong>{formatNumber(data.summary.totalKwh / 1_000_000)} GWh</strong><p>전체 운영 기간 누적</p></article>
      </section>
    </div>
  );
}

function AlertsSection({ data }: { data: DashboardData }) {
  return (
    <div className="section-stack">
      <section className="alert-summary-grid"><article className="panel alert-summary"><span>진행 중</span><strong>{data.alerts.filter((alert) => alert.state === "active").length}</strong></article><article className="panel alert-summary"><span>오늘 전체</span><strong>{data.alerts.length}</strong></article><article className="panel alert-summary"><span>정상 발전소</span><strong>{data.summary.normalCount}</strong></article></section>
      <article className="panel alerts-panel"><div className="panel-heading"><div><h2>장애·알림 이력</h2><p>설비 이상과 통신 상태를 확인합니다.</p></div></div>{data.alerts.length ? <div className="alert-list">{data.alerts.map((alert) => <div className="alert-item" key={alert.id}><AlertTriangle size={18} /><div><strong>{alert.message}</strong><p>{alert.plantName} · {alert.equipment}</p></div><time>{alert.startedAt}</time></div>)}</div> : <div className="empty-state"><span className="empty-state-icon"><CheckCircle2 size={26} /></span><h3>현재 확인할 장애가 없습니다</h3><p>연결된 모든 발전소가 정상 상태입니다.</p></div>}</article>
    </div>
  );
}

function ReportsSection({ data }: { data: DashboardData }) {
  const months = ["2026-09", "2026-08", "2026-07", "2026-06", "2026-05", "2026-04"];
  return (
    <div className="section-stack"><article className="panel reports-panel"><div className="panel-heading"><div><h2>월간 발전 보고서</h2><p>NREMS에 생성된 월별 보고서 목록</p></div></div><div className="report-list">{months.map((month) => <div className="report-row" key={month}><span className="report-icon"><FileBarChart size={19} /></span><div><strong>{month} 월간 보고서</strong><p>{data.plants.length}개 발전소 통합 요약</p></div><span className="report-state">원본 시스템 연동 예정</span></div>)}</div></article></div>
  );
}

function LoadingDashboard() {
  return <div className="loading-grid" aria-label="대시보드 로딩 중">{Array.from({ length: 8 }).map((_, index) => <div className="loading-block" key={index} />)}</div>;
}
