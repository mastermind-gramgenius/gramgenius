import { NextResponse } from "next/server";
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME || "Submissions";

export async function POST() {
  try {
    // 1️⃣ Clear previous "NextToPost" flags
    const oldNext = await base(TABLE)
      .select({
        filterByFormula: "{CarouselStatus}='NextToPost'",
        fields: ["CarouselStatus"],
        maxRecords: 100,
      })
      .all();

    if (oldNext.length) {
      await base(TABLE).update(
        oldNext.map((r) => ({ id: r.id, fields: { CarouselStatus: "" } }))
      );
    }

    // 2️⃣ Fetch approved, unposted ideas with carousel grouping
    const records = await base(TABLE)
      .select({
        filterByFormula:
          "AND({Status}='Approved', OR({PostedAt}='', NOT({PostedAt})), NOT({CarouselID}=''))",
        fields: ["CarouselID", "ViralityScore", "AestheticScore", "AI_Theme"],
        maxRecords: 500,
      })
      .all();

    if (!records.length)
      return NextResponse.json({ message: "No approved carousels found." });

    // 3️⃣ Group by CarouselID
    const groups: Record<
      string,
      { recs: Airtable.Record<any>[]; avgVir: number; avgAes: number }
    > = {};

    for (const r of records) {
      const cid = String(r.get("CarouselID") || "");
      if (!cid) continue;
      const vir = Number(r.get("ViralityScore") || 0);
      const aes = Number(r.get("AestheticScore") || 0);
      if (!groups[cid]) groups[cid] = { recs: [], avgVir: 0, avgAes: 0 };
      groups[cid].recs.push(r);
      groups[cid].avgVir += vir;
      groups[cid].avgAes += aes;
    }

    for (const g of Object.values(groups)) {
      const n = g.recs.length || 1;
      g.avgVir /= n;
      g.avgAes /= n;
    }

    // 4️⃣ Sort carousels by average virality → aesthetic → count
    const sorted = Object.keys(groups).sort((a, b) => {
      const ga = groups[a];
      const gb = groups[b];
      if (gb.avgVir !== ga.avgVir) return gb.avgVir - ga.avgVir;
      if (gb.avgAes !== ga.avgAes) return gb.avgAes - ga.avgAes;
      return gb.recs.length - ga.recs.length;
    });

    const topId = sorted[0];
    const top = groups[topId];
    if (!top)
      return NextResponse.json({ message: "No valid carousel to mark." });

    // 5️⃣ Mark top carousel as "NextToPost"
    await base(TABLE).update(
      top.recs.map((r) => ({
        id: r.id,
        fields: { CarouselStatus: "NextToPost" },
      }))
    );

    console.log(`🎯 Marked carousel ${topId} as NextToPost`);
    return NextResponse.json({
      message: "Next carousel selected for posting.",
      nextCarousel: topId,
      itemCount: top.recs.length,
      avgVirality: top.avgVir.toFixed(1),
    });
  } catch (err: any) {
    console.error("❌ selectCarousels error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
