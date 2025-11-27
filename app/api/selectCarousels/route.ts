import { NextResponse } from "next/server";
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME!;
const MAX_SLIDES = 20;

// Weighted random picker
function weightedRandomPick(records: any[], count: number) {
  const selected: any[] = [];
  const available = [...records];

  while (selected.length < count && available.length > 0) {
    const totalWeight = available.reduce((sum, r) => sum + r._weight, 0);
    let rand = Math.random() * totalWeight;

    let idx = 0;
    for (let i = 0; i < available.length; i++) {
      rand -= available[i]._weight;
      if (rand <= 0) {
        idx = i;
        break;
      }
    }

    selected.push(available[idx]);
    available.splice(idx, 1);
  }

  return selected;
}

export async function POST() {
  try {
    console.log("📊 Selecting carousel (virality-weighted)…");

    // 1️⃣ Fetch all eligible submissions
    const records = await base(TABLE)
      .select({
        filterByFormula: `AND(
          {SafeForPost} = TRUE(),
          {Status} = "Approved",
          {CarouselID} = "",
          {PostedAt} = ""
        )`,
        maxRecords: 300,
      })
      .all();

    console.log(`📥 Found ${records.length} eligible submissions`);

    if (records.length === 0) {
      return NextResponse.json({
        message: "No eligible submissions found.",
        carousels: [],
      });
    }

    // 2️⃣ Compute virality-dominant weight = ViralityScore²
    const weighted = records.map((r) => {
      const v = Number(r.get("ViralityScore") || 0);
      const safeWeight = Math.max(v, 0) ** 2 || 1;
      return { ...r, _weight: safeWeight };
    });

    // 3️⃣ Pick up to MAX_SLIDES using weighted random
    const selected = weightedRandomPick(weighted, MAX_SLIDES);

    if (selected.length === 0) {
      return NextResponse.json({
        message: "No eligible submissions after weighting.",
        carousels: [],
      });
    }

    // 4️⃣ Create carousel metadata
    const carouselId = `carousel-${Date.now()}`;
    const final = {
      carouselId,
      recordIds: selected.map((r) => r.id),
      slideCount: selected.length,
    };

    console.log(`🟢 Prepared carousel with ${final.slideCount} slides`);

    // 5️⃣ Update Airtable
    await Promise.all(
      final.recordIds.map((id, index) =>
        base(TABLE).update([
          {
            id,
            fields: {
              CarouselStatus: "Planned",
              CarouselID: carouselId,
              SlideNumber: index + 1,
            },
          },
        ])
      )
    );

    return NextResponse.json({
      message: "Carousel selected.",
      carousels: [final],
    });
  } catch (err: any) {
    console.error("❌ selectCarousels error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
