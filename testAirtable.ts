import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);

base(process.env.AIRTABLE_TABLE_NAME!)
  .select({ maxRecords: 1 })
  .firstPage((err, records) => {
    if (err) {
      console.error("❌ Airtable error:", err);
    } else {
      console.log("✅ Connected successfully:", records?.length, "record(s) found");
    }
  });
