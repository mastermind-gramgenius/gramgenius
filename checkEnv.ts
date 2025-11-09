import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Compute absolute path manually
const envPath = path.resolve(__dirname, ".env.local");

// Debug check
console.log("Checking env file path:", envPath);
console.log("File exists:", fs.existsSync(envPath));

// Force load
dotenv.config({ path: envPath });

console.log("Loaded env values:");
console.log("AIRTABLE_TOKEN:", process.env.AIRTABLE_TOKEN || "❌ missing");
console.log("AIRTABLE_BASE_ID:", process.env.AIRTABLE_BASE_ID || "❌ missing");
console.log("AIRTABLE_TABLE_NAME:", process.env.AIRTABLE_TABLE_NAME || "❌ missing");
console.log("TEST_ENV:", process.env.TEST_ENV || "❌ missing");

