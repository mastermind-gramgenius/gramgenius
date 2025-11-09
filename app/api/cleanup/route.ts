import { NextResponse } from "next/server";
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME || "Submissions";

export async function POST() {
  try {
    console.log("🧹 Running cleanup...");

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();
    const threeDaysAgoISO = threeDaysAgo.toISOString();

    // 1️⃣ Fetch records that need action
    const records = await base(TABLE)
      .select({
        filterByFormula: `
          OR(
            {Status}='Rejected',
            AND({Status}='Needs Revision', IS_BEFORE({CreatedAt}, '${threeDaysAgoISO}')),
            AND({Status}='Approved', OR({PostedAt}='', NOT({PostedAt})), IS_BEFORE({CreatedAt}, '${sevenDaysAgoISO}'))
          )
        `,
        fields: ["Status", "CreatedAt", "PostedAt"],
        maxRecords: 1000
      })
      .all();

    if (!records.length) {
      return NextResponse.json({ message: "✅ Nothing to clean up today." });
    }

    const toReject: string[] = [];
    const toDelete: string[] = [];

    for (const rec of records) {
      const status = rec.get("Status");
      const createdAt = new Date(rec.get("CreatedAt") as string);

      if (status === "Needs Revision" && createdAt < threeDaysAgo) {
        toReject.push(rec.id);
      } else {
        toDelete.push(rec.id);
      }
    }

    // 2️⃣ Update “Needs Revision” to “Rejected”
    if (toReject.length) {
      console.log(`⚠️ Converting ${toReject.length} "Needs Revision" → "Rejected"`);
      for (let i = 0; i < toReject.length; i += 10) {
        await base(TABLE).update(
          toReject.slice(i, i + 10).map((id) => ({
            id,
            fields: { Status: "Rejected" },
          }))
        );
      }
    }

    // 3️⃣ Delete rejected and expired ideas
    if (toDelete.length) {
      console.log(`🗑 Deleting ${toDelete.length} expired/rejected records`);
      for (let i = 0; i < toDelete.length; i += 10) {
        const batch = toDelete.slice(i, i + 10);
        await base(TABLE).destroy(batch);
      }
    }

    return NextResponse.json({
      message: `🧹 Cleanup complete. Updated ${toReject.length} to Rejected, deleted ${toDelete.length} records.`,
    });
  } catch (error: any) {
    console.error("❌ Cleanup error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
