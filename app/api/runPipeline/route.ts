import { NextResponse } from "next/server";

export async function POST() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    console.log("🚀 Starting full GramGenius pipeline...");

    // 1️⃣ Assess new submissions
    await fetch(`${baseUrl}/api/autoAssess`, { method: "POST" });

    // 2️⃣ Cluster themes
    await fetch(`${baseUrl}/api/clusterThemes`);

    // 3️⃣ Select & generate carousels
    await fetch(`${baseUrl}/api/buildCarousels`, { method: "POST" });

    // 4️⃣ Post to Instagram
    await fetch(`${baseUrl}/api/postToInstagram`, { method: "POST" });

    return NextResponse.json({ message: "Pipeline completed successfully." });
  } catch (error: any) {
    console.error("❌ runPipeline error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
