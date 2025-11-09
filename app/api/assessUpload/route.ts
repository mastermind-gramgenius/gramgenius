// app/api/assessUpload/route.ts
import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);
const table = base(process.env.AIRTABLE_TABLE_NAME!);

export async function GET() {
  try {
    // 1️⃣ Get unassessed submissions
    const records = await table.select({
      filterByFormula: "AND(UserMedia != '', NOT(Assessed))",
      maxRecords: 3, // Process a few at a time
    }).firstPage();

    if (records.length === 0) {
      return NextResponse.json({ message: "No unassessed uploads." });
    }

    const results = [];

    for (const record of records) {
      const imageUrl = record.get("UserMedia")?.[0]?.url;
      if (!imageUrl) continue;

      const prompt = `
      You are an expert in viral Instagram content. 
      Analyze the following image for its potential engagement.

      Return JSON:
      {
        "ViralityScore": 0-100,
        "AestheticScore": 0-100,
        "FitScore": 0-100,
        "SafeForPost": "Yes" or "No",
        "AssessmentExplanation": "Short explanation"
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: imageUrl },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const data = JSON.parse(response.choices[0].message.content || "{}");

      // 2️⃣ Save results to Airtable
      await table.update(record.id, {
        ViralityScore: data.ViralityScore,
        AestheticScore: data.AestheticScore,
        FitScore: data.FitScore,
        SafeForPost: data.SafeForPost,
        AssessmentExplanation: data.AssessmentExplanation,
        Assessed: true,
      });

      results.push({ id: record.id, ...data });
    }

    return NextResponse.json({ results });

  } catch (error) {
    console.error("Error assessing uploads:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
