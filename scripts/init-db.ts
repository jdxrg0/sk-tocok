/**
 * Database initialisation & seed script — run once against your Neon/Postgres DB.
 * Execute locally:  npx ts-node --skip-project scripts/init-db.ts
 * Or via:           node -r @swc-node/register scripts/init-db.ts
 *
 * Requires DATABASE_URL in your .env.local (or environment).
 */

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import fs from "fs";

// Load .env.local when running locally if present
if (fs.existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local first.");
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("🚀 Initialising SK Tocok database on Neon Postgres...");

  // ------------------------------------------------------------------
  // 1. CREATE TABLES
  // ------------------------------------------------------------------
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id               SERIAL PRIMARY KEY,
      name             TEXT NOT NULL,
      email            TEXT UNIQUE NOT NULL,
      password_hash    TEXT NOT NULL DEFAULT '',
      role             TEXT NOT NULL,
      contact_number   TEXT,
      avatar_url       TEXT,
      auth_provider    TEXT DEFAULT 'email',
      google_id        TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id               SERIAL PRIMARY KEY,
      name             TEXT UNIQUE NOT NULL,
      description      TEXT,
      color            TEXT DEFAULT 'blue',
      allocated_budget NUMERIC DEFAULT 0,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      category    TEXT NOT NULL,
      amount      NUMERIC NOT NULL,
      date        TEXT NOT NULL,
      receipt_url TEXT,
      voucher_no  TEXT,
      payee       TEXT,
      line_items  JSONB,
      created_by  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS line_items JSONB`;

  await sql`
    CREATE TABLE IF NOT EXISTS deposits (
      id             SERIAL PRIMARY KEY,
      reference_no   TEXT UNIQUE NOT NULL,
      source         TEXT NOT NULL,
      amount         NUMERIC NOT NULL,
      date           TEXT NOT NULL,
      description    TEXT,
      attachment_url TEXT,
      recorded_by    TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS print_requests (
      id             SERIAL PRIMARY KEY,
      tracking_code  TEXT UNIQUE NOT NULL,
      student_name   TEXT NOT NULL,
      contact_number TEXT NOT NULL DEFAULT '',
      facebook_name  TEXT,
      purok          TEXT NOT NULL,
      school         TEXT NOT NULL,
      grade_level    TEXT NOT NULL,
      file_name      TEXT NOT NULL,
      file_path      TEXT NOT NULL,
      file_size      BIGINT NOT NULL,
      print_type     TEXT NOT NULL,
      paper_size     TEXT NOT NULL,
      copies         INTEGER NOT NULL DEFAULT 1,
      page_range     TEXT,
      notes          TEXT,
      pickup_station TEXT DEFAULT 'Purok 5 (Sitio Sapdaan - SK Treasurer)',
      is_urgent      INTEGER DEFAULT 0,
      status         TEXT NOT NULL DEFAULT 'Pending Review',
      admin_notes    TEXT,
      picked_up_at   TIMESTAMPTZ,
      user_id        INTEGER,
      user_email     TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log("✅ Tables created.");

  // ------------------------------------------------------------------
  // 2. SEED SETTINGS
  // ------------------------------------------------------------------
  const settingsSeed: [string, string][] = [
    ["barangay_budget", "7318337"],
    ["annual_budget", "731833.70"],
    ["funds_received", "731833.70"],
    ["bank_balance", "229942.70"],
    ["fiscal_year", "2026"],
    ["printing_active", "true"],
    ["estimated_pages_remaining", "4500"],
    ["printing_announcement", "Free Student Printing Program is active! SK Hall is open Mon-Fri, 8:00 AM - 5:00 PM for claim and pickup."],
    ["hall_location", "Barangay Tocok Hall, Youth Development Center"],
    ["contact_email", "sktocok.youth@gmail.com"],
    ["contact_phone", "+63 912 345 6789"],
  ];

  for (const [key, value] of settingsSeed) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO NOTHING
    `;
  }
  console.log("✅ Settings seeded.");

  // ------------------------------------------------------------------
  // 3. SEED CATEGORIES
  // ------------------------------------------------------------------
  const catCount = await sql`SELECT COUNT(*) as count FROM categories`;
  if (Number(catCount[0].count) === 0) {
    const cats = [
      ["Education & Culture", "Free student printing program, school supplies, scholarships, academic excellence awards & cultural heritage activities", "blue", 160000],
      ["Youth Employment & Livelihood", "Youth livelihood seminars, entrepreneurship grants, skills training, TESDA linkages & employment assistance", "orange", 60000],
      ["Sports Development", "Inter-Purok basketball & volleyball leagues, sports equipment, athletic tournaments & youth sports clinics", "amber", 180000],
      ["Health", "Youth mental health advocacy, teenage pregnancy prevention, medical-dental missions & nutrition seminars", "rose", 80000],
      ["Environmental Protection & Disaster Preparedness", "Clean-up drives, tree planting, river protection, ecological waste management, emergency first-aid kits & DRRM training", "emerald", 150000],
      ["Gender and Development (GAD)", "Gender sensitivity seminars, anti-VAWC campaigns, young women empowerment, Pride month youth forums & reproductive health", "purple", 50000],
      ["Peace and Order & Anti-Drug Abuse", "BADAC youth desk, drug abuse resistance education (DARE), anti-bullying forums, curfew monitoring & juvenile delinquency prevention", "cyan", 50000],
      ["Administration & Training", "SK Council mandatory capability training, leadership seminars, secretariat logistics, accounting software & council governance", "indigo", 120000],
    ];
    for (const [name, desc, color, budget] of cats) {
      await sql`
        INSERT INTO categories (name, description, color, allocated_budget)
        VALUES (${name}, ${desc}, ${color}, ${budget})
        ON CONFLICT (name) DO NOTHING
      `;
    }
    console.log("✅ Categories seeded.");
  }

  // ------------------------------------------------------------------
  // 4. SEED SK OFFICIALS
  // ------------------------------------------------------------------
  const userCount = await sql`SELECT COUNT(*) as count FROM users`;
  if (Number(userCount[0].count) === 0) {
    const cryptoMod = await import("crypto");
    const seedPassword = process.env.INITIAL_ADMIN_PASSWORD?.trim() || "";
    const officials = [
      ["HON. JELENA ROSE H. CABANLIG", "chairperson@sktocok.gov.ph", "SK Chairperson", "+63 945 558 3899", "/images/officials/cabanlig.jpg"],
      ["MS. ANNIECKA REINE C. QUINTO", "secretary@sktocok.gov.ph", "SK Secretary", "+63 927 354 2417", "/images/officials/quinto_anniecka.jpg"],
      ["MR. JOHN DAVID R. GARCIA", "treasurer@sktocok.gov.ph", "SK Treasurer", "+63 952 455 7268", "/images/officials/garcia.jpg"],
      ["HON. DOVIE ELLARES", "ellares@sktocok.gov.ph", "Education", "+63 912 777 0001", "/images/officials/ellares.jpg"],
      ["HON. DANNAH MAE M. AQUINO", "aquino@sktocok.gov.ph", "Livelihood", "+63 993 456 9089", "/images/officials/aquino.jpg"],
      ["HON. RENZ LESTER S. RAMOS", "ramos@sktocok.gov.ph", "Sports", "+63 946 728 3104", "/images/officials/ramos.jpg"],
      ["HON. ROBBIE D. BARRO", "barro@sktocok.gov.ph", "Peace & Order", "+63 951 119 4894", "/images/officials/barro.jpg"],
      ["HON. SANDRO J. QUINTO", "quinto.sandro@sktocok.gov.ph", "Health", "+63 912 777 0005", "/images/officials/quinto_sandro.jpg"],
      ["HON. ANGELA S. SERRANA", "serrana@sktocok.gov.ph", "Environment", "+63 945 432 8629", "/images/officials/serrana.jpg"],
      ["HON. BABY JULHITZ R. PICAR", "picar@sktocok.gov.ph", "GAD", "+63 956 603 0613", "/images/officials/picar.jpg"],
    ];
    for (const [name, email, role, contact, avatar] of officials) {
      const perUserPwd = seedPassword || cryptoMod.randomBytes(24).toString("base64url");
      const hash = bcrypt.hashSync(perUserPwd, 12);
      await sql`
        INSERT INTO users (name, email, password_hash, role, contact_number, avatar_url)
        VALUES (${name}, ${email}, ${hash}, ${role}, ${contact}, ${avatar})
        ON CONFLICT (email) DO NOTHING
      `;
    }
    console.log("✅ SK Officials seeded.");
  }

  // ------------------------------------------------------------------
  // 5. SEED AUTHENTIC LANDBANK DEPOSITS (REMITTANCES)
  // ------------------------------------------------------------------
  const depCount = await sql`SELECT COUNT(*) as count FROM deposits`;
  if (Number(depCount[0].count) === 0) {
    const deposits = [
      ["LBP-2026-BEG-000", "2026-01-01", 75514.44, "Barangay Tocok SK Continuing Fund (Beginning Cash in Bank)", "Beginning Cash in Bank Balance brought forward from FY 2025 unexpended youth fund (Landbank CA 4032-1016-02)"],
      ["LBP-2026-01-001", "2026-01-07", 52522.20, "Barangay Tocok NTA 10% SK Share", "January 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 13:17:45)"],
      ["LBP-2026-02-002", "2026-02-05", 65722.03, "Barangay Tocok NTA 10% SK Share", "February 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 10:46:05)"],
      ["LBP-2026-03-003", "2026-03-04", 60480.92, "Barangay Tocok NTA 10% SK Share", "March 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 11:38:48)"],
      ["LBP-2026-04-004", "2026-04-13", 57765.50, "Barangay Tocok NTA 10% SK Share", "April 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 12:56:50)"],
      ["LBP-2026-05-005", "2026-05-07", 58591.50, "Barangay Tocok NTA 10% SK Share", "May 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 11:06:59)"],
      ["LBP-2026-06-006", "2026-06-03", 57766.50, "Barangay Tocok NTA 10% SK Share", "June 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 11:35:17)"],
      ["LBP-2026-07-007", "2026-07-06", 58432.50, "Barangay Tocok NTA 10% SK Share", "July 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 12:47:42)"],
      ["LBP-2026-08-008", "2026-08-10", 57766.50, "Barangay Tocok NTA 10% SK Share", "August 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 09:54:44)"],
      ["LBP-2026-09-009", "2026-09-03", 60949.03, "Barangay Tocok NTA 10% SK Share", "September 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 13:01:18)"],
      ["LBP-2026-10-010", "2026-10-08", 60197.89, "Barangay Tocok NTA 10% SK Share", "October 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 10:03:40)"],
      ["LBP-2026-11-011", "2026-11-03", 8108.19, "Barangay Tocok NTA 10% SK Share", "November 2026 Supplemental Tranche / Youth Fund Adjustment (Landbank Check Deposit 11:12:50)"],
      ["LBP-2026-11-012", "2026-11-03", 58016.50, "Barangay Tocok NTA 10% SK Share", "November 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 11:12:08)"],
    ] as const;
    for (const [ref, date, amount, src, desc] of deposits) {
      await sql`
        INSERT INTO deposits (reference_no, source, amount, date, description, recorded_by)
        VALUES (${ref}, ${src}, ${amount}, ${date}, ${desc}, 'John David R. Garcia (SK Treasurer)')
        ON CONFLICT (reference_no) DO NOTHING
      `;
    }
    console.log("✅ Authentic monthly remittances seeded.");
  }

  // ------------------------------------------------------------------
  // 6. SEED AUTHENTIC LANDBANK CHECK DISBURSEMENTS
  // ------------------------------------------------------------------
  const expCount = await sql`SELECT COUNT(*) as count FROM expenses`;
  if (Number(expCount[0].count) === 0) {
    const expenses = [
      ["BIR 1% Expanded Tax Remittance — Dec. 2025", "BIR 1% Expanded Tax - Dec. 2025 (Check #0000124054, SKCC dated Jan 12, 2026; DOS CA DONUS 15:22:20)", "Administration & Training", 1004.00, "2026-01-12", "CK-0000124054", "LBP FAO BIR"],
      ["BIR 3% Percentage Tax Remittance — Dec. 2025", "BIR 3% Percentage Tax - Dec. 2025 (Check #0000124055, SKCC dated Jan 12, 2026; DOS CA DONUS 15:21:05)", "Administration & Training", 3012.00, "2026-01-12", "CK-0000124055", "LBP FAO BIR"],
      ["SICAP - BADAC Seminar at Newtown Plaza Hotel, Baguio City", "SICAP - BADAC Seminar at Newtown Plaza Hotel, Baguio City (Check #0000124058, SKCC dated Feb 26, 2026; ENCASHMENT 09:54:00)", "Peace and Order & Anti-Drug Abuse", 16640.00, "2026-02-26", "CK-0000124058", "Robbie D. Barro"],
      ["SK Council Honorarium — January 2026", "Honorarium - Jan 2026 under RA 11768 (Check #0000124056, SKCC received Feb 25, 2026; ENCASHMENT 14:10:57)", "Administration & Training", 14400.00, "2026-02-27", "CK-0000124056", "John David R. Garcia"],
      ["SK Council Honorarium — February 2026", "Honorarium - Feb 2026 under RA 11768 (Check #0000124057, SKCC received Feb 25, 2026; ENCASHMENT 14:10:35)", "Administration & Training", 14400.00, "2026-02-27", "CK-0000124057", "John David R. Garcia"],
      ["Check #0000124060 — Encashment (Pending SKCC)", "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 11:10:04). Awaiting SKCC/DV details.", "Administration & Training", 35360.00, "2026-03-10", "CK-0000124060", "Landbank Mangaldan Branch (Pending SKCC)"],
      ["SK Council Honorarium — March 2026", "Honorarium - March 2026 under RA 11768 (Check #0000124062, SKCC stamped Mar 25, 2026; ENCASHMENT 14:53:04)", "Administration & Training", 14400.00, "2026-03-25", "CK-0000124062", "John David R. Garcia"],
      ["SK Council Honorarium — April 2026", "Honorarium - April 2026 under RA 11768 (Check #0000124063, SKCC stamped Apr 20, 2026; ENCASHMENT 14:33:03)", "Administration & Training", 14400.00, "2026-04-20", "CK-0000124063", "John David R. Garcia"],
      ["Traveling Expenses Voucher (TEV)", "Traveling Expenses Voucher (TEV) (Check #0000124067, SKCC dated May 25, 2026; ENCASHMENT 11:29:38)", "Administration & Training", 1350.00, "2026-05-25", "CK-0000124067", "John David R. Garcia"],
      ["Reimbursement for Payment of Drug Test", "Reimburse payment of Drug Test (Check #0000124065, SKCC dated May 25, 2026; ENCASHMENT 11:28:48)", "Peace and Order & Anti-Drug Abuse", 2700.00, "2026-05-25", "CK-0000124065", "John David R. Garcia"],
      ["SK Council Honorarium — May 2026", "Honorarium - May 2026 under RA 11768 (Check #0000124064, SKCC dated May 25, 2026; ENCASHMENT 11:28:28)", "Administration & Training", 14400.00, "2026-05-25", "CK-0000124064", "John David R. Garcia"],
      ["Office Supplies Procurement", "Office Supplies (Check #0000124066, SKCC dated May 25, 2026; DOS CA DONUS 11:27:11)", "Administration & Training", 28800.00, "2026-05-25", "CK-0000124066", "YMG Consumer Goods Trading"],
      ["Referee's Fee for Badminton Tournament", "Referee's Fee for Badminton Tournament (Check #0000124070, SKCC dated Jun 5, 2026; ENCASHMENT 12:23:01)", "Sports Development", 3000.00, "2026-06-05", "CK-0000124070", "John David R. Garcia"],
      ["Referee's Fee for Volleyball Tournament", "Referee's Fee for Volleyball Tournament (Check #0000124069, SKCC dated Jun 5, 2026; ENCASHMENT 12:22:41)", "Sports Development", 5600.00, "2026-06-05", "CK-0000124069", "John David R. Garcia"],
      ["Referee's Fee for Basketball Tournament", "Referee's Fee for Basketball Tournament (Check #0000124068, SKCC dated Jun 5, 2026; ENCASHMENT 12:22:18)", "Sports Development", 10000.00, "2026-06-05", "CK-0000124068", "John David R. Garcia"],
      ["Various Materials for Sports Fest", "Various materials for Sports Fest (Check #0000124072, SKCC dated Jun 5, 2026; DOS CA DONUS 12:27:19)", "Sports Development", 15840.00, "2026-06-05", "CK-0000124072", "YMG Consumer Goods Trading"],
      ["Paint Materials for Repainting Basketball Covered Court", "Paint Materials for repainting basketball covered court (Check #0000124071, SKCC dated Jun 5, 2026; DOS CA DONUS 12:26:01)", "Sports Development", 31651.20, "2026-06-05", "CK-0000124071", "JACMG Enterprises"],
      ["School Kit Supplies for Junior High School Students", "School Kit Supplies for Junior High School Students (Check #0000124074, SKCC dated Jun 5, 2026; DOS CA DONUS 12:27:20)", "Education & Culture", 35040.00, "2026-06-05", "CK-0000124074", "YMG Consumer Goods Trading"],
      ["School Kit Supplies for Senior High School & College Students", "School Kit Supplies for Senior High School and College Students (Check #0000124073, SKCC dated Jun 5, 2026; DOS CA DONUS 12:27:19)", "Education & Culture", 35280.00, "2026-06-05", "CK-0000124073", "YMG Consumer Goods Trading"],
      ["Check #0000124075 — Encashment (Pending SKCC)", "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 12:24:11). Awaiting SKCC/DV details.", "Administration & Training", 27100.00, "2026-06-19", "CK-0000124075", "Landbank Mangaldan Branch (Pending SKCC)"],
      ["Check #0000124076 — Check Clearing (Pending SKCC)", "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:34:29). Awaiting SKCC/DV details.", "Administration & Training", 1377.00, "2026-07-03", "CK-0000124076", "Pending SKCC Verification"],
      ["Check #0000124077 — Check Clearing (Pending SKCC)", "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:33:04). Awaiting SKCC/DV details.", "Administration & Training", 2128.00, "2026-07-03", "CK-0000124077", "Pending SKCC Verification"],
      ["Check #0000124079 — Encashment (Pending SKCC)", "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 12:31:46). Awaiting SKCC/DV details.", "Administration & Training", 14400.00, "2026-07-03", "CK-0000124079", "Landbank Mangaldan Branch (Pending SKCC)"],
      ["Check #0000124078 — Check Clearing (Pending SKCC)", "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:30:32). Awaiting SKCC/DV details.", "Administration & Training", 11520.00, "2026-07-03", "CK-0000124078", "Pending SKCC Verification"],
      ["Check #0000124080 — Check Clearing (Pending SKCC)", "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:03:11). Awaiting SKCC/DV details.", "Administration & Training", 1227.20, "2026-07-10", "CK-0000124080", "Pending SKCC Verification"],
      ["Check #0000124081 — Check Clearing (Pending SKCC)", "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:02:15). Awaiting SKCC/DV details.", "Administration & Training", 3681.60, "2026-07-10", "CK-0000124081", "Pending SKCC Verification"],
      ["BIR 1% Expanded Tax — July 2026", "BIR 1% Expanded Tax - July (Check #0000124082, SKCC dated Aug 10, 2026; DOS CA DONUS 11:52:53)", "Administration & Training", 120.00, "2026-08-11", "CK-0000124082", "LBP FAO BIR"],
      ["BIR 3% Percentage Tax Remittance", "BIR 3% Percentage Tax (listed as 'Dec. 2025' on Aug 10, 2026 SKCC; Check #0000124083; DOS CA DONUS 11:51:50)", "Administration & Training", 360.00, "2026-08-11", "CK-0000124083", "LBP FAO BIR"],
      ["Check #0000124084 — Encashment (Pending SKCC)", "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 14:17:29). Awaiting SKCC/DV details.", "Administration & Training", 14400.00, "2026-08-18", "CK-0000124084", "Landbank Mangaldan Branch (Pending SKCC)"],
      ["Check #0000124085 — Encashment (Pending SKCC)", "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 14:17:44). Awaiting SKCC/DV details.", "Administration & Training", 14400.00, "2026-08-18", "CK-0000124085", "Landbank Mangaldan Branch (Pending SKCC)"],
      ["Check #0000124087 — Check Clearing (Pending SKCC)", "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 14:44:13). Awaiting SKCC/DV details.", "Administration & Training", 3840.00, "2026-08-27", "CK-0000124087", "Pending SKCC Verification"],
      ["Check #0000124086 — Check Clearing (Pending SKCC)", "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 14:42:50). Awaiting SKCC/DV details.", "Administration & Training", 38400.00, "2026-08-27", "CK-0000124086", "Pending SKCC Verification"],
      ["Check #0000124088 — Check Clearing (Pending SKCC)", "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 14:45:08). Awaiting SKCC/DV details.", "Administration & Training", 38880.00, "2026-08-27", "CK-0000124088", "Pending SKCC Verification"],
      ["Check #0000124089 — Check Clearing (Pending SKCC)", "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:42:52). Awaiting SKCC/DV details.", "Administration & Training", 845.00, "2026-09-10", "CK-0000124089", "Pending SKCC Verification"],
      ["Check #0000124090 — Check Clearing (Pending SKCC)", "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:43:52). Awaiting SKCC/DV details.", "Administration & Training", 2535.00, "2026-09-10", "CK-0000124090", "Pending SKCC Verification"],
      ["DM-ORDINARY — Landbank Bank Debit Memo", "Bank debit memo debited directly by Landbank Mangaldan Branch (DM-ORDINARY 16:10:51; e.g., checkbook / bank service charge)", "Administration & Training", 600.00, "2026-10-26", "DM-2026-10-001", "Land Bank of the Philippines (Mangaldan Branch)"],
      ["Check #0000124091 — Encashment (Pending SKCC)", "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 14:27:50). Awaiting SKCC/DV details.", "Administration & Training", 14400.00, "2026-10-26", "CK-0000124091", "Landbank Mangaldan Branch (Pending SKCC)"],
      ["Check #0000124092 — Encashment (Pending SKCC)", "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 14:27:34). Awaiting SKCC/DV details.", "Administration & Training", 14400.00, "2026-10-26", "CK-0000124092", "Landbank Mangaldan Branch (Pending SKCC)"],
    ] as const;
    for (const [title, desc, cat, amount, date, vno, payee] of expenses) {
      await sql`
        INSERT INTO expenses (title, description, category, amount, date, voucher_no, payee, created_by)
        VALUES (${title}, ${desc}, ${cat}, ${amount}, ${date}, ${vno}, ${payee}, 'John David R. Garcia (SK Treasurer)')
      `;
    }
    console.log("✅ Authentic check disbursements seeded.");
  }

  console.log("\n🎉 Database initialisation complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Init failed:", err);
  process.exit(1);
});
