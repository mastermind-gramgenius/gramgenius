import { NextResponse } from "next/server";
import Airtable from "airtable";

const IG_BUSINESS_ID = process.env.IG_BUSINESS_ID!;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN!;
const TABLE = process.env.AIRTABLE_TABLE_NAME || "Submissions";

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForFinished(containerId: string, maxAttempts = 6, delayMs = 4000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delayMs);
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${encodeURIComponent(
        FB_PAGE_ACCESS_TOKEN
      )}`
    );
    const json = await res.json();
    const status = json?.status_code;
    console.log(`📡 Container ${containerId} status (attempt ${attempt}):`, status);
    if (status === "FINISHED") return true;
  }
  return false;
}

export async function POST() {
  try {
    if (!IG_BUSINESS_ID || !FB_PAGE_ACCESS_TOKEN) {
      throw new Error("Missing IG_BUSINESS_ID or FB_PAGE_ACCESS_TOKEN");
    }

    // 1️⃣ Fetch all items marked as NextToPost
    const nextToPost = await base(TABLE)
      .select({
        filterByFormula: "AND({CarouselStatus}='NextToPost', {Status}='Approved', NOT({GeneratedMedia}=''))",
        fields: [
          "Idea",
          "AI_Theme",
          "ViralityScore",
          "AestheticScore",
          "GeneratedMedia",
          "Instagram",
          "CarouselID",
        ],
        maxRecords: 50,
      })
      .all();

    if (!nextToPost.length) {
      return NextResponse.json({ message: "No NextToPost carousel ready to publish." });
    }

    const theme = (nextToPost[0].get("AI_Theme") as string) || "GramGenius";
    const carouselId = nextToPost[0].get("CarouselID") as string;
    console.log(`🎠 Posting carousel "${carouselId}" (${nextToPost.length} slides)`);

    // Sort slides by virality / aesthetic
    const slides = nextToPost
      .slice()
      .sort(
        (a, b) =>
          Number(b.get("ViralityScore") || 0) - Number(a.get("ViralityScore") || 0) ||
          Number(b.get("AestheticScore") || 0) - Number(a.get("AestheticScore") || 0)
      )
      .slice(0, 20); // up to 20 slides max

    const captionParts = [`✨ ${theme} — curated by #GramGenius #GG`];
    const credits = Array.from(
      new Set(
        slides
          .map((r) => (r.get("Instagram") as string)?.trim())
          .filter(Boolean)
      )
    );
    if (credits.length) captionParts.push(`Credits: ${credits.join(" ")}`);
    const caption = captionParts.join("\n");

    // 2️⃣ Create child media
    const childIds: string[] = [];
    for (const r of slides) {
      const url = (r.get("GeneratedMedia") as any)?.[0]?.url;
      if (!url) continue;
      const res = await fetch(`https://graph.facebook.com/v21.0/${IG_BUSINESS_ID}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: url,
          is_carousel_item: true,
          access_token: FB_PAGE_ACCESS_TOKEN,
        }),
      });
      const j = await res.json();
      if (j?.id) childIds.push(j.id);
      else console.warn("⚠️ Failed child:", j);
    }

    if (childIds.length < 2) {
      return NextResponse.json({ message: "Not enough valid slides to post." });
    }

    // 3️⃣ Create parent carousel
    const parentRes = await fetch(`https://graph.facebook.com/v21.0/${IG_BUSINESS_ID}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "CAROUSEL",
        children: childIds,
        caption,
        access_token: FB_PAGE_ACCESS_TOKEN,
      }),
    });
    const parentJson = await parentRes.json();
    if (!parentJson?.id) throw new Error(`Parent creation failed: ${JSON.stringify(parentJson)}`);

    // 4️⃣ Wait until container ready
    const ready = await waitForFinished(parentJson.id, 6, 4000);
    if (!ready) throw new Error("Carousel container not ready.");

    // 5️⃣ Publish carousel
    const pubRes = await fetch(
      `https://graph.facebook.com/v21.0/${IG_BUSINESS_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: parentJson.id,
          access_token: FB_PAGE_ACCESS_TOKEN,
        }),
      }
    );
    const pubJson = await pubRes.json();
    if (!pubJson?.id) throw new Error(`Publish failed: ${JSON.stringify(pubJson)}`);

    // 6️⃣ Fetch permalink
    const linkRes = await fetch(
      `https://graph.facebook.com/v21.0/${pubJson.id}?fields=permalink&access_token=${encodeURIComponent(
        FB_PAGE_ACCESS_TOKEN
      )}`
    );
    const linkJson = await linkRes.json();
    const permalink = linkJson?.permalink || "";

    // 7️⃣ Update Airtable (Posted + Done)
    const nowISO = new Date().toISOString();
    const updates = slides.map((r) => ({
      id: r.id,
      fields: {
        Status: "Posted",
        CarouselStatus: "Done",
        PostedAt: nowISO,
        InstagramPostID: pubJson.id,
        InstagramURL: permalink,
      },
    }));

    for (let i = 0; i < updates.length; i += 10) {
      await base(TABLE).update(updates.slice(i, i + 10));
    }

    console.log(`✅ Posted carousel "${carouselId}" (${slides.length} slides)`);
    return NextResponse.json({
      message: "✅ Carousel posted successfully",
      carouselId,
      slideCount: slides.length,
      permalink,
    });
  } catch (err: any) {
    console.error("❌ postCarousel error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
