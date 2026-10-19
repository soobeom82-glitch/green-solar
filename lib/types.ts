export type DataSource = "live" | "demo";
export type PlantState = "normal" | "fault" | "stopped" | "offline";

export interface SummaryData {
  currentKw: number;
  todayKwh: number;
  yesterdayKwh: number;
  monthKwh: number;
  totalKwh: number;
  capacityKw: number;
  normalCount: number;
  faultCount: number;
  stoppedCount: number;
  offlineCount: number;
}

export interface PlantData {
  id: string;
  name: string;
  capacityKw: number;
  currentKw: number;
  todayKwh: number;
  yesterdayKwh: number;
  monthKwh: number;
  totalKwh: number;
  generationHours: number;
  outputRate: number;
  state: PlantState;
  lastReceivedSeconds: number | null;
  address?: string;
}

export interface TodayPoint {
  label: string;
  powerKw: number;
  energyKwh: number;
}

export interface DailyPoint {
  date: string;
  energyKwh: number;
}

export interface AlertData {
  id: string;
  plantName: string;
  equipment: string;
  message: string;
  startedAt: string;
  state: "active" | "resolved";
}

export interface DashboardData {
  source: DataSource;
  sourceMessage: string;
  updatedAt: string;
  summary: SummaryData;
  plants: PlantData[];
  todaySeries: TodayPoint[];
  dailySeries: DailyPoint[];
  alerts: AlertData[];
}
