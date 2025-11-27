export async function GET() {
  console.log("🔵 Starting cron job...");

  // 1. START POD
  const startRes = await fetch(`${process.env.APP_URL}/api/runpod/start`, { method: "POST" });
  if (!startRes.ok) return Response.json({ error: "Could not start pod" }, { status: 500 });

  console.log("🟢 Pod ready!");

  // 2. Run your carousel generator
  const genRes = await fetch(`${process.env.APP_URL}/api/generateCarouselImages`, {
    method: "POST"
  });

  console.log("🎨 Generation done");

  // 3. STOP POD
  await fetch(`${process.env.APP_URL}/api/runpod/stop`, { method: "POST" });

  console.log("🔴 Pod stopped");

  return Response.json({ ok: true });
}
