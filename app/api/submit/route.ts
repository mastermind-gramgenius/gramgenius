import { NextResponse } from "next/server";
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME || "Submissions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { idea, type, mood, instagram, email, userMedia } = body;

    if (!idea && !userMedia) {
      return NextResponse.json(
        { error: "Either 'idea' or 'userMedia' is required." },
        { status: 400 }
      );
    }

    const fields: Record<string, any> = {
      Status: "Pending",
    };

    if (idea) fields.Idea = idea;
    if (instagram) fields.Instagram = instagram;
    if (email) fields.Email = email;

    // Only set select fields when non-empty
    if (type) fields.Type = type;
    if (mood) fields.Mood = mood;

    if (userMedia) {
      fields.UserMedia = [{ url: userMedia }];
    }

    const created = await base(TABLE).create([{ fields }]);
    return NextResponse.json({ success: true, id: created[0].id });
  } catch (error: any) {
    console.error("❌ Error submitting idea:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
