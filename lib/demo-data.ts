import type { DashboardData, DailyPoint, HourlyEnergyPoint, TodayPoint } from "./types";

const powerCurve = [0, 0, 0, 2, 15, 44, 86, 139, 194, 231, 261, 278, 269, 242.07, 205, 151, 93, 42, 12, 0, 0, 0, 0, 0];

const todaySeries: TodayPoint[] = powerCurve.map((powerKw, hour) => ({
  label: String(hour).padStart(2, "0"),
  powerKw,
  energyKwh: Number((powerKw * 0.86).toFixed(2)),
}));

const yesterdayCurve = [0, 0, 0, 0, 0, 0, 0, 18, 56, 171, 236, 264, 251, 223, 181, 124, 72, 31, 7, 0, 0, 0, 0, 0];

const yesterdaySeries: HourlyEnergyPoint[] = yesterdayCurve.map((powerKw, hour) => ({
  label: String(hour).padStart(2, "0"),
  energyKwh: Number((powerKw * 0.84).toFixed(2)),
}));

const dailyValues = [
  3210, 3620, 2990, 4150, 4380, 3970, 4560, 4720, 4290, 3810,
  4480, 4670, 4210, 3890, 4520, 4810, 4630, 4170, 1091.06,
];

const dailySeries: DailyPoint[] = dailyValues.map((energyKwh, index) => ({
  date: `10-${String(index + 1).padStart(2, "0")}`,
  energyKwh,
}));

export function getDemoDashboard(reason = "NREMS 환경변수가 없어 데모 데이터로 표시 중입니다."): DashboardData {
  return {
    source: "demo",
    sourceMessage: reason,
    updatedAt: new Date().toISOString(),
    summary: {
      currentKw: 242.07,
      todayKwh: 1091.06,
      yesterdayKwh: 4024.28,
      monthKwh: 60941.38,
      totalKwh: 7381443.38,
      capacityKw: 760,
      normalCount: 2,
      faultCount: 0,
      stoppedCount: 0,
      offlineCount: 0,
    },
    plants: [
      {
        id: "d2021064272",
        name: "그린솔라 태양광발전소",
        capacityKw: 260,
        currentKw: 87.51,
        todayKwh: 397.06,
        yesterdayKwh: 1468.25,
        monthKwh: 22549.38,
        totalKwh: 1639249.38,
        generationHours: 1.5,
        outputRate: 33.7,
        state: "normal",
        lastReceivedSeconds: 8,
        address: "전북 고창군 후포리 778-6",
      },
      {
        id: "p2018060034",
        name: "그린솔라3호 태양광발전소",
        capacityKw: 500,
        currentKw: 154.56,
        todayKwh: 694,
        yesterdayKwh: 2556.03,
        monthKwh: 38392,
        totalKwh: 5742194,
        generationHours: 1.4,
        outputRate: 30.9,
        state: "normal",
        lastReceivedSeconds: 11,
        address: "전북 고창군 후포리 778-6",
      },
    ],
    todaySeries,
    yesterdaySeries,
    dailySeries,
    alerts: [],
  };
}
