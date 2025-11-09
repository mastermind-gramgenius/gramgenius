import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID!);
const TABLE = process.env.AIRTABLE_TABLE_NAME!;

export async function POST() {
  try {
    console.log("🧠 Starting optimized autoAssess...");
    const records = await base(TABLE)
      .select({
        filterByFormula: "OR(Status='Pending', Status='Needs Revision')",
        maxRecords: 20, // limit batch size to prevent token overload
      })
      .all();

    if (!records.length) {
      return NextResponse.json({ message: "No new records to assess." });
    }

    // Split into batches of 5
    const batchSize = 5;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      // Prepare short JSON instruction
      const ideasText = batch
        .map(
          (r, idx) =>
            `${idx + 1}. ${r.fields.Idea || "(no idea text)"} | Type: ${r.fields.Type || "Unknown"} | Mood: ${r.fields.Mood || "Unspecified"}`
        )
        .join("\n");

      const messages = [
        {
          role: "system",
          content: `
  You are a concise social media content evaluator.
  Analyze each submission (text or image) and return just a compact JSON array with:
  - ViralityScore (1–10)
  - AestheticScore (1–10)
  - SafeForPost (true/false)
  - AssessmentExplanation (brief)
  - AI_Theme (short, reusable theme name)
  
  If the content seems promotional, advertises a product, brand, company, or influencer,
  or contains visible logos, brand names, or slogans,
  set SafeForPost = false and clearly explain "Rejected for advertising content".
  `,
        }
        ,
        {
          role: "user",
          content: `Evaluate these ideas:\n${ideasText}`,
        },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages,
      });

      const raw = completion.choices[0].message?.content || "{}";
      let parsed: any = {};

      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        console.warn("⚠️ JSON parse fallback, raw:", raw);
        continue;
      }

      const results = Array.isArray(parsed) ? parsed : parsed.results || [];

      for (const result of results) {
        const record = batch[result.IdeaNumber - 1];
        if (!record) continue;

        const virality = Math.min(10, Math.max(1, Number(result.ViralityScore || 5)));
        const aesthetic = Math.min(10, Math.max(1, Number(result.AestheticScore || 5)));
        const safe = !!result.SafeForPost;
        const explanation = String(result.AssessmentExplanation || "").slice(0, 500);
        const theme = String(result.AI_Theme || "Generic").slice(0, 60);

        let status = "Needs Revision";
        if (safe && virality >= 7) status = "Approved";
        else if (!safe) status = "Rejected";

        await base(TABLE).update([
          {
            id: record.id,
            fields: {
              ViralityScore: virality,
              AestheticScore: aesthetic,
              SafeForPost: safe,
              AssessmentExplanation: explanation,
              AI_Theme: theme,
              Status: status,
            },
          },
        ]);

        console.log(`✅ Updated ${record.id}: ${theme} | ${status}`);
      }
    }

    return NextResponse.json({ message: "Optimized auto-assessment completed." });
  } catch (error: any) {
    console.error("❌ Optimized autoAssess error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
