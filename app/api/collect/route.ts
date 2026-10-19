import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import { saveDashboard } from "@/lib/dashboard-store";
import { fetchNremsDashboard } from "@/lib/nrems";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function qstashConfigured() {
  return Boolean(process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY);
}

export async function POST(request: Request) {
  if (!qstashConfigured()) {
    return NextResponse.json({ error: "QStash 서명키가 설정되지 않았습니다." }, { status: 503 });
  }

  const signature = request.headers.get("upstash-signature");
  const body = await request.text();
  if (!signature) return NextResponse.json({ error: "QStash 서명이 없습니다." }, { status: 401 });

  try {
    const receiver = new Receiver();
    const valid = await receiver.verify({
      signature,
      body,
      url: request.url,
      upstashRegion: request.headers.get("upstash-region") ?? undefined,
      clockTolerance: 5,
    });
    if (!valid) return NextResponse.json({ error: "QStash 서명이 올바르지 않습니다." }, { status: 401 });

    const data = await fetchNremsDashboard();
    await saveDashboard(data);
    return NextResponse.json({
      ok: true,
      collectedAt: data.updatedAt,
      plants: data.plants.length,
      todayPoints: data.todaySeries.length,
      yesterdayPoints: data.yesterdaySeries.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "수집 중 알 수 없는 오류가 발생했습니다.";
    console.error("[collect] NREMS collection failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
