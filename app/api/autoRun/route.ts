import { NextResponse } from "next/server";

export async function POST() {
  try {
    const endpoints = [
      "/api/autoAssess",
      "/api/selectCarousels",
      "/api/generateCarouselImages",
      "/api/postCarousel"
    ];
    for (const ep of endpoints) {
      console.log(`🚀 Running ${ep}`);
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${ep}`, { method: "POST" });
      console.log(await res.text());
    }
    return NextResponse.json({ message: "✅ Full pipeline completed." });
  } catch (err: any) {
    console.error("❌ autoRun error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
