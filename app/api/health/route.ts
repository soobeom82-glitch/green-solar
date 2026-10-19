export async function GET() {
  return Response.json({
    ok: true,
    nremsConfigured: Boolean(process.env.NREMS_USER && process.env.NREMS_PASSWORD),
    checkedAt: new Date().toISOString(),
  });
}
