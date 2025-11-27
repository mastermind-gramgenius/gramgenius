import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME!;

export async function POST() {
  try {
    // 1️⃣ Fetch all Pending or Needs Revision submissions
    const records = await base(TABLE)
      .select({
        filterByFormula: "OR({Status} = 'Pending', {Status} = 'Needs Revision')",
        maxRecords: 20,
      })
      .all();

    if (records.length === 0) {
      return NextResponse.json({ message: "No submissions to assess." });
    }

    const batchSize = 5;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const ideasText = batch
        .map((r, idx) => {
          const idea = r.get("Idea") || "(no idea text)";
          const rawMedia = r.get("UserMedia");
          const userMedia =
            Array.isArray(rawMedia) && rawMedia[0]?.url ? rawMedia[0].url : "";

          return `${idx + 1}. Idea: "${idea}" | Image: ${userMedia}`;
        })
        .join("\n\n");

      const messages = [
        {
          role: "system",
          content: `
You evaluate user-submitted content for virality and safety.
Return ONLY JSON. No explanation outside JSON.

JSON format:
[
  {
    "IdeaNumber": 1,
    "ViralityScore": 1-10,
    "AestheticScore": 1-10,
    "SafeForPost": true/false,
    "AssessmentExplanation": "short reason"
  }
]

Rules:
- If the idea or image is promotional / a brand / a logo / an ad → SafeForPost = false.
- If it's harmless and in line with instagram's policy → SafeForPost = true.
- Do NOT reject based on low virality; only reject unsafe content.
`,
        },
        { role: "user", content: ideasText },
      ];

      // OpenAI call
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages,
      });

      const raw = completion.choices[0].message?.content || "{}";
      let parsed: any;

      try {
        parsed = JSON.parse(raw);
      } catch {
        continue; // skip batch if JSON invalid
      }

      // 🔧 Normalize output into array
      let results: any[] = [];

      if (Array.isArray(parsed)) {
        results = parsed;
      } else if (Array.isArray(parsed.results)) {
        results = parsed.results;
      } else if (typeof parsed === "object" && parsed !== null) {
        results = [parsed];
      }

      if (results.length === 0) continue;

      // 4️⃣ Update Airtable
      for (const result of results) {
        const idx = result.IdeaNumber - 1;
        const record = batch[idx];
        if (!record) continue;

        const virality = Math.min(10, Math.max(1, Number(result.ViralityScore || 5)));
        const aesthetic = Math.min(10, Math.max(1, Number(result.AestheticScore || 5)));
        const safe = !!result.SafeForPost;
        const explanation = String(result.AssessmentExplanation || "").slice(0, 500);

        // Only two statuses now:
        const status = safe ? "Approved" : "Rejected";

        await base(TABLE).update([
          {
            id: record.id,
            fields: {
              ViralityScore: virality,
              AestheticScore: aesthetic,
              SafeForPost: safe,
              AssessmentExplanation: explanation,
              Status: status,
            },
          },
        ]);
      }
    }

    return NextResponse.json({ message: "Auto-assessment completed." });
  } catch (error: any) {
    console.error("❌ autoAssess error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
