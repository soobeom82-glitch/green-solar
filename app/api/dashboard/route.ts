import { NextResponse } from "next/server";
import { getDemoDashboard } from "@/lib/demo-data";
import { fetchNremsDashboard } from "@/lib/nrems";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchNremsDashboard();
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
