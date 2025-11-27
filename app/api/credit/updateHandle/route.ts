import { NextResponse } from "next/server";
import Airtable from "airtable";
import { getServerSession } from "next-auth";

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME!;

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.redirect("/login");

  const form = await req.formData();
  const recordId = form.get("recordId") as string;
  const newHandle = form.get("handle") as string;

  const record = await base(TABLE).find(recordId);
  const email = record.get("Email");

  if (email !== session.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await base(TABLE).update([
    { id: recordId, fields: { CustomHandle: newHandle } },
  ]);

  return NextResponse.redirect(req.headers.get("referer") || "/");
}
