import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID!);
const table = base(process.env.AIRTABLE_TABLE_NAME!);

export async function GET() {
  try {
    const records = await table.select({ filterByFormula: "{Status} = 'New'", maxRecords: 10 }).all();

    if (records.length === 0) {
      return NextResponse.json({ message: "No new ideas to score" });
    }

    for (const r of records) {
      const idea = (r.fields as any).Idea;

      const prompt = `You are helping pick Instagram content ideas. 
      Rate this idea from 0–100 for engagement potential and assign a short theme.
      Respond as JSON like this: {"score": 87, "theme": "Meme"}

      Idea: ${idea}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const content = completion.choices[0].message?.content ?? "";
      const match = content.match(/"score":\s*(\d+).*"theme":\s*"([^"]+)"/);
      const score = match ? parseInt(match[1]) : 50;
      const theme = match ? match[2] : "General";

      await table.update(r.id, {
        AI_Score: score,
        AI_Theme: theme,
        Status: "Scored",
      });
    }

    return NextResponse.json({ message: "Ideas scored successfully" });
  } catch (err: any) {
    console.error("Error scoring ideas:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
