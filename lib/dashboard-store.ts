import "server-only";
import { Redis } from "@upstash/redis";
import type { DashboardData, HourlyEnergyPoint } from "./types";

const LATEST_KEY = "green-solar:dashboard:latest";
const RETENTION_SECONDS = 400 * 24 * 60 * 60;

export interface StoredDay {
  date: string;
  updatedAt: string;
  series: HourlyEnergyPoint[];
  plantSeries?: Record<string, HourlyEnergyPoint[]>;
}

let redisClient: Redis | null = null;

export function isRedisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function redis() {
  if (!isRedisConfigured()) throw new Error("Upstash Redis 환경변수가 설정되지 않았습니다.");
  redisClient ??= Redis.fromEnv();
  return redisClient;
}

function koreaDate(value: string, daysFromDate = 0) {
  const date = new Date(new Date(value).getTime() + daysFromDate * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayKey(date: string) {
  return `green-solar:hourly:${date}`;
}

function energySeries(series: Array<{ label: string; energyKwh: number }>): HourlyEnergyPoint[] {
  return series.map((point) => ({ label: point.label, energyKwh: point.energyKwh }));
}

function plantEnergySeries(data: DashboardData, period: "todaySeries" | "yesterdaySeries") {
  return Object.fromEntries(Object.entries(data.plantSeries).map(([plantId, series]) => [plantId, energySeries(series[period])]));
}

export async function saveDashboard(data: DashboardData) {
  const today = koreaDate(data.updatedAt);
  const yesterday = koreaDate(data.updatedAt, -1);
  const pipeline = redis().pipeline();

  pipeline.set(LATEST_KEY, data, { ex: RETENTION_SECONDS });
  pipeline.set(dayKey(today), { date: today, updatedAt: data.updatedAt, series: energySeries(data.todaySeries), plantSeries: plantEnergySeries(data, "todaySeries") } satisfies StoredDay, { ex: RETENTION_SECONDS });
  if (data.yesterdaySeries.length) {
    pipeline.set(dayKey(yesterday), { date: yesterday, updatedAt: data.updatedAt, series: data.yesterdaySeries, plantSeries: plantEnergySeries(data, "yesterdaySeries") } satisfies StoredDay, { ex: RETENTION_SECONDS });
  }

  await pipeline.exec();
}

export async function getStoredDashboard(): Promise<DashboardData | null> {
  if (!isRedisConfigured()) return null;
  return redis().get<DashboardData>(LATEST_KEY);
}

export async function getStoredDay(date: string): Promise<StoredDay | null> {
  if (!isRedisConfigured()) return null;
  return redis().get<StoredDay>(dayKey(date));
}
