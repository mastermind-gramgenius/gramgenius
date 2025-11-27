import { NextResponse } from "next/server";
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME!;

export async function GET(req: Request, { params }: any) {
  const recordId = params.recordId;

  const rec = await base(TABLE).find(recordId);
  const url = rec.get("GeneratedImageURLs") as string;

  if (!url) {
    return NextResponse.json({ error: "No image found" }, { status: 404 });
  }

  const imgRes = await fetch(url);
  const buffer = await imgRes.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename=youpost_${recordId}.jpg`,
    },
  });
}
