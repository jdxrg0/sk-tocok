import { neon } from "@neondatabase/serverless";
import fs from "fs";

const sql = neon(process.env.DATABASE_URL);

async function backup() {
  const sessions = await sql`SELECT * FROM attendance_sessions ORDER BY id ASC`;
  const records = await sql`SELECT * FROM attendance_records ORDER BY id ASC`;
  
  const backupData = {
    timestamp: new Date().toISOString(),
    sessions,
    records,
  };

  fs.writeFileSync("scripts/attendance_backup.json", JSON.stringify(backupData, null, 2));
  console.log(`Backed up ${sessions.length} sessions and ${records.length} records to scripts/attendance_backup.json`);
}

backup().catch(console.error);
