import { isRedisConfigured } from "@/lib/dashboard-store";

export async function GET() {
  return Response.json({
    ok: true,
    nremsConfigured: Boolean(process.env.NREMS_USER && process.env.NREMS_PASSWORD),
    redisConfigured: isRedisConfigured(),
    qstashConfigured: Boolean(process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY),
    checkedAt: new Date().toISOString(),
  });
}
