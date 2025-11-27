/*import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID!);
const TABLE = process.env.AIRTABLE_TABLE_NAME!;

export async function POST() {
  try {
    console.log("🧠 Starting optimized clusterThemes...");

    // Fetch recently assessed records without AI_Theme
    const records = await base(TABLE)
      .select({
        filterByFormula: "AND(Status!='Pending', NOT({AI_Theme}))",
        maxRecords: 30,
      })
      .all();

    if (!records.length) {
      return NextResponse.json({ message: "No records to cluster." });
    }

    // Split into small batches to minimize token usage
    const batchSize = 5;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      // Build text for GPT input
      const ideasText = batch
        .map(
          (r, idx) =>
            `${idx + 1}. Idea: ${r.fields.Idea || "(no idea)"} | Type: ${r.fields.Type || "N/A"} | Mood: ${r.fields.Mood || "N/A"}`
        )
        .join("\n");

      const messages = [
        {
          role: "system",
          content:
            "You are a concise classifier. For each idea, return only a short JSON array. Each element must include: {IdeaNumber, AI_Theme(one or two words summarizing the idea’s topic)}. Themes should be concise and reusable (e.g. 'Cute Animals', 'Motivation', 'Food Humor', 'Tech').",
        },
        {
          role: "user",
          content: `Classify the following ideas into short themes:\n${ideasText}`,
        },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
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

        const theme = String(result.AI_Theme || "Misc").slice(0, 60);

        await base(TABLE).update([
          {
            id: record.id,
            fields: { AI_Theme: theme },
          },
        ]);

        console.log(`🏷️ Updated ${record.id}: Theme = ${theme}`);
      }
    }

    return NextResponse.json({ message: "Optimized clustering completed." });
  } catch (error: any) {
    console.error("❌ Optimized clusterThemes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
*/