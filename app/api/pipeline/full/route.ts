import { NextResponse } from "next/server";

export async function GET() {
  const hour = new Date().getUTCHours();
  if (![9, 15, 21].includes(hour)) {
    return Response.json({ skipped: true });
  }

  console.log("🚀 CRON PIPELINE START");

  const APP = process.env.APP_URL!;

  // 1️⃣ autoAssess
  console.log("🧠 autoAssess...");
  const assess = await fetch(`${APP}/api/autoAssess`, { method: "POST" });
  const assessJson = await assess.json();
  console.log("✔ autoAssess done");

  // 2️⃣ selectCarousels
  console.log("🎯 selectCarousels...");
  const select = await fetch(`${APP}/api/selectCarousels`, { method: "POST" });
  const selectJson = await select.json();
  console.log("✔ selectCarousels done");

  // If no carousels planned → stop early
  if (!selectJson.carousels || selectJson.carousels.length === 0) {
    console.log("⚠ No carousels selected — nothing to generate.");
    return NextResponse.json({ message: "No carousels today." });
  }

  // 3️⃣ start RunPod pod
  console.log("🔵 Starting RunPod pod...");
  const start = await fetch(`${APP}/api/runpod/start`, { method: "POST" });
  const startJson = await start.json();
  if (!start.ok) {
    console.error(startJson);
    return NextResponse.json({ error: "Pod start failed", startJson }, { status: 500 });
  }
  console.log("🟢 Pod ready");

  // 4️⃣ generateCarouselImages (this uses ComfyUI)
  console.log("🎨 Generating images...");
  const gen = await fetch(`${APP}/api/generateCarouselImages`, { method: "POST" });
  const genJson = await gen.json();
  console.log("✔ Image generation done");

  // 5️⃣ stop pod
  console.log("🔴 Stopping RunPod pod...");
  await fetch(`${APP}/api/runpod/stop`, { method: "POST" });

  // 6️⃣ postCarousel
  console.log("📤 Posting carousel to Instagram...");
  const post = await fetch(`${APP}/api/postCarousel`, { method: "POST" });
  const postJson = await post.json();
  console.log("✔ Post done");

  console.log("🏁 FULL PIPELINE COMPLETE");

  return NextResponse.json({
    autoAssess: assessJson,
    selection: selectJson,
    generation: genJson,
    post: postJson,
    status: "finished"
  });
}
