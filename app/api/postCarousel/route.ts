import { NextResponse } from "next/server";
import Airtable from "airtable";

// Instagram API constants
const IG_USER_ID = process.env.IG_BUSINESS_ID!;
const IG_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN!;

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME!;

export async function POST() {
  try {
    console.log("📤 Starting Instagram posting cycle...");

    // 1️⃣ Fetch ReadyForPosting
    const ready = await base(TABLE)
      .select({
        filterByFormula: `{CarouselStatus} = "ReadyForPosting"`,
        sort: [{ field: "CreatedAt", direction: "asc" }],
        maxRecords: 200,
      })
      .all();

    if (ready.length === 0) {
      return NextResponse.json({ message: "No carousels ready for posting." });
    }

    // Group by CarouselID
    const groups: Record<string, any[]> = {};
    for (const rec of ready) {
      const cid = rec.get("CarouselID") as string;
      if (!groups[cid]) groups[cid] = [];
      groups[cid].push(rec);
    }

    // Find oldest carousel
    const sortedIds = Object.keys(groups).sort((a, b) => {
      const earliest = (records: any[]) =>
        Math.min(...records.map((r) => new Date(r.get("CreatedAt")).getTime()));
      return earliest(groups[a]) - earliest(groups[b]);
    });

    const nextCarouselId = sortedIds[0];
    let records = groups[nextCarouselId];

    // Ensure consistent order
    records.sort(
      (a, b) =>
        Number(a.get("SlideNumber") || 0) - Number(b.get("SlideNumber") || 0)
    );

    console.log(
      `🖼️ Posting carousel ${nextCarouselId} with ${records.length} slides…`
    );

    const creditsURL = `${process.env.NEXT_PUBLIC_APP_URL}/p/${nextCarouselId}`;
    const caption = `✨ Created by YouPost\nCredits: ${creditsURL}`;

    // ⛔ OLD BEHAVIOR — blocked single-slide carousels
    // if (records.length < 2) return NextResponse…

    // ✅ NEW BEHAVIOR: if only ONE image → post a normal image instead of a carousel
    if (records.length === 1) {
      console.log("🖼️ Only 1 slide — posting as a single image.");

      const rec = records[0];
      const imageUrl = rec.get("GeneratedImageURLs");

      if (!imageUrl) {
        throw new Error(`Record ${rec.id} has no GeneratedImageURLs`);
      }

      // Create IG media container with caption
      const containerUrl =
        `https://graph.facebook.com/v21.0/${IG_USER_ID}/media` +
        `?image_url=${encodeURIComponent(imageUrl)}` +
        `&caption=${encodeURIComponent(caption)}` +
        `&access_token=${IG_ACCESS_TOKEN}`;

      const containerRes = await fetch(containerUrl, { method: "POST" });
      const containerJson = await containerRes.json();

      console.log("Single image container result:", containerJson);

      if (!containerJson.id) {
        throw new Error(
          `Single image container creation failed: ${JSON.stringify(containerJson)}`
        );
      }

      // Publish
      const publishUrl =
        `https://graph.facebook.com/v21.0/${IG_USER_ID}/media_publish` +
        `?creation_id=${containerJson.id}` +
        `&access_token=${IG_ACCESS_TOKEN}`;

      const publishRes = await fetch(publishUrl, { method: "POST" });
      const publishJson = await publishRes.json();

      if (!publishJson.id) {
        throw new Error(`Publish failed: ${JSON.stringify(publishJson)}`);
      }

      const igPostId = publishJson.id;

      // Fetch permalink
      const linkUrl =
        `https://graph.facebook.com/v21.0/${igPostId}` +
        `?fields=permalink` +
        `&access_token=${IG_ACCESS_TOKEN}`;

      const linkRes = await fetch(linkUrl);
      const linkJson = await linkRes.json();

      const permalink = linkJson.permalink || "";

      // Update Airtable
      await base(TABLE).update([
        {
          id: rec.id,
          fields: {
            CarouselURL: creditsURL,
            CarouselID: nextCarouselId,
            SlideNumber: rec.get("SlideNumber"),
            CarouselStatus: "Posted",
            Status: "Posted",
            InstagramPostId: igPostId,
            InstagramURL: permalink,
            PostedAt: new Date().toISOString(),
          },
        },
      ]);

      return NextResponse.json({
        message: "Single image posted successfully.",
        carouselId: nextCarouselId,
        slides: 1,
        instagramUrl: permalink,
      });
    }

    // 2️⃣ Create IG containers for MULTIPLE SLIDES
    const mediaIds: string[] = [];

    for (const rec of records) {
      const imageUrl = rec.get("GeneratedImageURLs");

      if (!imageUrl) {
        throw new Error(`Record ${rec.id} has no GeneratedImageURLs`);
      }

      console.log("📦 Creating IG container for:", imageUrl);

      const url =
        `https://graph.facebook.com/v21.0/${IG_USER_ID}/media` +
        `?image_url=${encodeURIComponent(imageUrl)}` +
        `&is_carousel_item=true` +
        `&access_token=${IG_ACCESS_TOKEN}`;

      const res = await fetch(url, { method: "POST" });
      const json = await res.json();

      console.log("IG container result:", json);

      if (!json.id) {
        throw new Error(
          `Failed to create image container: ${JSON.stringify(json)}`
        );
      }

      mediaIds.push(json.id);
    }

    // 3️⃣ Create carousel parent container (WITH CAPTION)
    console.log("🎠 Creating carousel parent container…");

    const childrenParams = mediaIds.map((id) => `children=${id}`).join("&");

    const parentUrl =
      `https://graph.facebook.com/v21.0/${IG_USER_ID}/media` +
      `?media_type=CAROUSEL` +
      `&${childrenParams}` +
      `&caption=${encodeURIComponent(caption)}` +
      `&access_token=${IG_ACCESS_TOKEN}`;

    const parentRes = await fetch(parentUrl, { method: "POST" });
    const parentJson = await parentRes.json();

    console.log("Parent container result:", parentJson);

    if (!parentJson.id) {
      throw new Error(
        `Failed to create carousel parent container: ${JSON.stringify(parentJson)}`
      );
    }

    const carouselContainerId = parentJson.id;

    // 4️⃣ Publish carousel
    console.log("🚀 Publishing carousel…");

    const publishUrl =
      `https://graph.facebook.com/v21.0/${IG_USER_ID}/media_publish` +
      `?creation_id=${carouselContainerId}` +
      `&access_token=${IG_ACCESS_TOKEN}`;

    const publishRes = await fetch(publishUrl, { method: "POST" });
    const publishJson = await publishRes.json();

    console.log("Publish result:", publishJson);

    if (!publishJson.id) {
      throw new Error(`Publish failed: ${JSON.stringify(publishJson)}`);
    }

    const igPostId = publishJson.id;

    // 5️⃣ Fetch permalink
    console.log("🔗 Fetching permalink…");

    const linkUrl =
      `https://graph.facebook.com/v21.0/${igPostId}` +
      `?fields=permalink` +
      `&access_token=${IG_ACCESS_TOKEN}`;

    const linkRes = await fetch(linkUrl);
    const linkJson = await linkRes.json();

    console.log("Permalink:", linkJson);

    const permalink = linkJson.permalink || "";

    // 6️⃣ Update Airtable
    console.log("📝 Updating Airtable…");

    for (const rec of records) {
      await base(TABLE).update([
        {
          id: rec.id,
          fields: {
            CarouselURL: creditsURL,
            CarouselID: nextCarouselId,
            SlideNumber: rec.get("SlideNumber"),
            CarouselStatus: "Posted",
            Status: "Posted",
            InstagramPostId: igPostId,
            InstagramURL: permalink,
            PostedAt: new Date().toISOString(),
          },
        },
      ]);
    }

    return NextResponse.json({
      message: "Carousel posted successfully.",
      carouselId: nextCarouselId,
      slides: records.length,
      instagramUrl: permalink,
    });

  } catch (err: any) {
    console.error("❌ postCarousel error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
