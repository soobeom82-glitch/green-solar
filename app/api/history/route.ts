import { NextRequest, NextResponse } from "next/server";
import { getStoredDay, isRedisConfigured } from "@/lib/dashboard-store";

export const dynamic = "force-dynamic";

function isDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function previousDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!isDate(date)) return NextResponse.json({ error: "날짜 형식이 올바르지 않습니다." }, { status: 400 });
  if (!isRedisConfigured()) return NextResponse.json({ error: "저장소가 연결되지 않았습니다." }, { status: 503 });

  const previous = previousDate(date);
  const [selectedDay, previousDay] = await Promise.all([getStoredDay(date), getStoredDay(previous)]);
  return NextResponse.json({
    date,
    previousDate: previous,
    series: selectedDay?.series ?? [],
    previousSeries: previousDay?.series ?? [],
    updatedAt: selectedDay?.updatedAt ?? null,
  }, {
    headers: { "cache-control": "private, no-store, max-age=0" },
  });
}
