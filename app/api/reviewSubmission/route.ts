import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN! }).base(
  process.env.AIRTABLE_BASE_ID!
);

export async function GET() {
  try {
    console.log("🔍 Fetching Pending submissions from Airtable...");

    const records = await base(process.env.AIRTABLE_TABLE_NAME!)
      .select({ filterByFormula: "Status = 'Pending'", maxRecords: 10 })
      .all();

    if (records.length === 0) {
      return NextResponse.json({ message: "No pending submissions found." });
    }

    console.log(`📦 Found ${records.length} pending submissions.`);

    const results = [];

    for (const record of records) {
      const idea = record.get("Idea") as string;
      const userMedia = record.get("UserMedia") as string;
      const type = record.get("Type") as string;
      const mood = record.get("Mood") as string;

      // Choose which content to analyze (text or media link)
      const contentDescription = userMedia
        ? `This is an uploaded image (link: ${userMedia}). Assess whether it’s engaging, creative, or visually appealing for Instagram.`
        : `This is a user-submitted idea for an Instagram post:\n"${idea}"\nType: ${type}\nMood: ${mood}`;

      // Use GPT-4o-mini for efficiency
      const prompt = `
You are reviewing content ideas for GramGenius, an app that curates community ideas into Instagram carousels.
Evaluate the following submission on creativity, clarity, and engagement potential (0–100).
Return a JSON with:
{
  "score": number,
  "status": "Approved" | "Needs revision" | "Rejected",
  "feedback": string
}

Be selective: 
- Approve only ideas that are clear, creative, and on-brand.
- Mark as "Needs revision" if it's interesting but unclear.
- Reject if it's spam, irrelevant, or low quality.

Submission:
${contentDescription}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a content quality reviewer." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
      });

      const text = response.choices[0].message?.content || "{}";
      console.log("🧩 AI response:", text);

      let evaluation;
      try {
        evaluation = JSON.parse(text);
      } catch {
        evaluation = {
          score: 50,
          status: "Needs revision",
          feedback: "Parsing error, fallback classification.",
        };
      }

      // Update Airtable record
      await base(process.env.AIRTABLE_TABLE_NAME!).update(record.id, {
        Status: evaluation.status,
        Score: evaluation.score,
        Feedback: evaluation.feedback,
      });

      results.push({
        id: record.id,
        idea: idea || "Uploaded image",
        status: evaluation.status,
        score: evaluation.score,
      });
    }

    return NextResponse.json({ reviewed: results });
  } catch (error) {
    console.error("❌ Error reviewing submissions:", error);
    return NextResponse.json(
      { error: "Failed to review submissions", details: String(error) },
      { status: 500 }
    );
  }
}
