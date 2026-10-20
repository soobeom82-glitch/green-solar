import "server-only";
import { createCipheriv } from "node:crypto";
import type { AlertData, DashboardData, DailyPoint, HourlyEnergyPoint, PlantData, PlantState, PlantTrendData, TodayPoint } from "./types";

const AES_KEY = Buffer.from("abcdefghijklmnopqrstuvwxyz123456", "utf8");
const ZERO_IV = Buffer.alloc(16);

type UnknownRecord = Record<string, unknown>;

function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? "0").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function arrayValue(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter((item): item is UnknownRecord => Boolean(item) && typeof item === "object") : [];
}

function encryptNrems(value: string): string {
  const cipher = createCipheriv("aes-256-cbc", AES_KEY, ZERO_IV);
  return Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64");
}

function cookieHeader(headers: Headers): string {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  const values = extended.getSetCookie?.() ?? (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function postForm<T>(baseUrl: string, path: string, body: Record<string, string>, cookie?: string): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`NREMS ${path} 요청 실패 (${response.status})`);
  }

  return (await response.json()) as T;
}

async function createSession(baseUrl: string, user: string, password: string): Promise<string> {
  const response = await fetch(new URL("/login_chk.php", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
    },
    body: new URLSearchParams({
      act: "loginChk",
      user_id: encryptNrems(user),
      user_pw: encryptNrems(password),
    }),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) throw new Error(`NREMS 로그인 요청 실패 (${response.status})`);
  const result = (await response.json()) as { result?: boolean; msg?: string };
  if (!result.result) throw new Error(`NREMS 로그인 실패 (${result.msg ?? "unknown"})`);

  const cookie = cookieHeader(response.headers);
  if (!cookie) throw new Error("NREMS 로그인 쿠키를 받지 못했습니다.");
  return cookie;
}

function mapPlantState(status: unknown, communicationDelay: unknown): PlantState {
  if (numberValue(communicationDelay) > 15) return "offline";
  if (numberValue(status) === 1) return "normal";
  if (numberValue(status) === 2) return "fault";
  if (numberValue(status) === 3) return "stopped";
  return "offline";
}

function mapPlant(row: UnknownRecord): PlantData {
  const capacityKw = numberValue(row.INS_CAPACITY);
  const currentKw = numberValue(row.KW);
  return {
    id: textValue(row.WMU_CODE || row.PSCODE),
    name: textValue(row.PWR_PLANT_NAME || row.PLANT_NAME),
    capacityKw,
    currentKw,
    todayKwh: numberValue(row.TD),
    yesterdayKwh: numberValue(row.YD),
    monthKwh: numberValue(row.TM),
    totalKwh: numberValue(row.TT),
    generationHours: capacityKw > 0 ? numberValue(row.TD) / capacityKw : 0,
    outputRate: capacityKw > 0 ? (currentKw / capacityKw) * 100 : 0,
    state: mapPlantState(row.STATUS ?? row.ST, row.CTIMEDIFF),
    lastReceivedSeconds: row.CTIMEDIFF == null ? null : numberValue(row.CTIMEDIFF),
    address: textValue(row.PWR_PLANT_ADDR2 || row.ADDR) || undefined,
  };
}

function mergeTodaySeries(details: UnknownRecord[]): TodayPoint[] {
  const points = new Map<string, TodayPoint>();
  for (const detail of details) {
    for (const row of arrayValue(detail.timedata)) {
      const label = textValue(row.DATE).slice(-5, -3) || textValue(row.DATE);
      const previous = points.get(label) ?? { label, powerKw: 0, energyKwh: 0 };
      previous.powerKw += numberValue(row.INVKW ?? row.INV);
      previous.energyKwh += numberValue(row.INVKWD);
      points.set(label, previous);
    }
  }
  return [...points.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function hourLabel(row: UnknownRecord): string {
  const raw = textValue(row.TIME || row.DATE);
  const match = raw.match(/(?:^|\s)(\d{1,2}):/);
  return String(match ? Number(match[1]) : Number(raw.slice(0, 2))).padStart(2, "0");
}

function mergeHistoricalSeries(results: UnknownRecord[]): HourlyEnergyPoint[] {
  const points = new Map<string, HourlyEnergyPoint>();
  for (const result of results) {
    for (const row of arrayValue(result.pdata)) {
      const label = hourLabel(row);
      if (!/^\d{2}$/.test(label)) continue;
      const previous = points.get(label) ?? { label, energyKwh: 0 };
      const energyKwh = numberValue(row.INV);
      previous.energyKwh += energyKwh;
      points.set(label, previous);
    }
  }
  return [...points.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function koreaDate(daysFromToday = 0): string {
  const date = new Date(Date.now() + daysFromToday * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function mergeDailySeries(details: UnknownRecord[]): DailyPoint[] {
  const points = new Map<string, DailyPoint>();
  for (const detail of details) {
    for (const row of arrayValue(detail.daydata)) {
      const date = textValue(row.DATE).slice(5) || textValue(row.DATE);
      const previous = points.get(date) ?? { date, energyKwh: 0 };
      previous.energyKwh += numberValue(row.IVT_KWH);
      points.set(date, previous);
    }
  }
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeAlerts(details: UnknownRecord[]): AlertData[] {
  const alerts: AlertData[] = [];
  details.forEach((detail, detailIndex) => {
    arrayValue(detail.faultdata).forEach((row, rowIndex) => {
      alerts.push({
        id: `${detailIndex}-${rowIndex}-${textValue(row.stime)}`,
        plantName: textValue(row.PWR_PLANT_NAME || row.plantName || "발전소"),
        equipment: `${textValue(row.fterm)} #${textValue(row.ftermindex)}`.trim(),
        message: textValue(row.fcontent || "장애 감지"),
        startedAt: textValue(row.stime),
        state: row.etime ? "resolved" : "active",
      });
    });
  });
  return alerts;
}

export async function fetchNremsDashboard(): Promise<DashboardData> {
  const user = process.env.NREMS_USER;
  const password = process.env.NREMS_PASSWORD;
  if (!user || !password) throw new Error("NREMS_USER 또는 NREMS_PASSWORD가 설정되지 않았습니다.");

  const baseUrl = process.env.NREMS_BASE_URL || "http://nrems.co.kr";
  const groupId = process.env.NREMS_GROUP_ID || "726";
  const managerGroupId = process.env.NREMS_MANAGER_GROUP_ID || "0";
  const cookie = await createSession(baseUrl, user, password);

  const live = await postForm<{ plist?: UnknownRecord[] }>(baseUrl, "/proc/livestat_proc.php", {
    act: "empty",
    o_Base: "sBasePname",
    o_Sort: "asc",
    o_AreCode: "all",
    o_Pname: "",
    grpid: groupId,
    mnggrpid: managerGroupId,
    pcnt: "1",
  }, cookie);

  const plants = arrayValue(live.plist).map(mapPlant);
  if (!plants.length) throw new Error("NREMS에서 발전소 목록을 받지 못했습니다.");

  const [detailResults, yesterdayResults] = await Promise.all([
    Promise.allSettled(
      plants.map((plant) => postForm<UnknownRecord>(baseUrl, "/v2/local/proc/index_proc.php", {
        act: "empty",
        pscode: plant.id,
      }, cookie)),
    ),
    Promise.allSettled(
      plants.map((plant) => postForm<UnknownRecord>(baseUrl, "/v2/local/proc/pl_time_proc.php", {
        act: "empty",
        s_date: koreaDate(-1),
        pscode: plant.id,
      }, cookie)),
    ),
  ]);
  const details = detailResults
    .filter((result): result is PromiseFulfilledResult<UnknownRecord> => result.status === "fulfilled")
    .map((result) => result.value);
  const yesterdayDetails = yesterdayResults
    .filter((result): result is PromiseFulfilledResult<UnknownRecord> => result.status === "fulfilled")
    .map((result) => result.value);
  const plantSeries: Record<string, PlantTrendData> = Object.fromEntries(plants.map((plant, index) => {
    const detail = detailResults[index];
    const yesterdayDetail = yesterdayResults[index];
    const currentDetail = detail?.status === "fulfilled" ? [detail.value] : [];
    const priorDetail = yesterdayDetail?.status === "fulfilled" ? [yesterdayDetail.value] : [];
    return [plant.id, {
      todaySeries: mergeTodaySeries(currentDetail),
      yesterdaySeries: mergeHistoricalSeries(priorDetail),
      dailySeries: mergeDailySeries(currentDetail),
    }];
  }));

  const summary = plants.reduce(
    (acc, plant) => {
      acc.currentKw += plant.currentKw;
      acc.todayKwh += plant.todayKwh;
      acc.yesterdayKwh += plant.yesterdayKwh;
      acc.monthKwh += plant.monthKwh;
      acc.totalKwh += plant.totalKwh;
      acc.capacityKw += plant.capacityKw;
      if (plant.state === "normal") acc.normalCount += 1;
      if (plant.state === "fault") acc.faultCount += 1;
      if (plant.state === "stopped") acc.stoppedCount += 1;
      if (plant.state === "offline") acc.offlineCount += 1;
      return acc;
    },
    { currentKw: 0, todayKwh: 0, yesterdayKwh: 0, monthKwh: 0, totalKwh: 0, capacityKw: 0, normalCount: 0, faultCount: 0, stoppedCount: 0, offlineCount: 0 },
  );

  return {
    source: "live",
    sourceMessage: details.length === plants.length ? "NREMS 실시간 데이터" : "일부 상세 데이터가 지연되고 있습니다.",
    updatedAt: new Date().toISOString(),
    summary,
    plants,
    todaySeries: mergeTodaySeries(details),
    yesterdaySeries: mergeHistoricalSeries(yesterdayDetails),
    dailySeries: mergeDailySeries(details),
    plantSeries,
    alerts: mergeAlerts(details),
  };
}
