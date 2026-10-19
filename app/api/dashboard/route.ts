import { NextResponse } from "next/server";
import { getDemoDashboard } from "@/lib/demo-data";
import { getStoredDashboard, isRedisConfigured, saveDashboard } from "@/lib/dashboard-store";
import { fetchNremsDashboard } from "@/lib/nrems";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stored = await getStoredDashboard();
    if (stored) {
      return NextResponse.json({
        ...stored,
        sourceMessage: "Upstash 저장 데이터 · NREMS 15분 수집",
      }, {
        headers: { "cache-control": "private, no-store, max-age=0" },
      });
    }

    const data = await fetchNremsDashboard();
    if (isRedisConfigured()) await saveDashboard(data);
    return NextResponse.json(data, {
      headers: { "cache-control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 연동 오류";
    console.error("[dashboard] NREMS fetch failed:", message);

    if (process.env.NREMS_STRICT === "true") {
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json(getDemoDashboard(message), {
      headers: { "cache-control": "private, no-store, max-age=0" },
    });
  }
}
