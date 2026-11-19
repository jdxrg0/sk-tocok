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
      created_by  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

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
    ["barangay_budget", "8500000"],
    ["annual_budget", "850000"],
    ["bank_balance", "214800"],
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
      ["Education & Culture", "Scholarships, student supplies, free printing, academic awards & cultural activities", "blue", 200000],
      ["Sports Development", "Youth basketball & volleyball leagues, equipment, sports clinics & tournaments", "amber", 250000],
      ["Health & Anti-Drug Abuse", "Health seminars, anti-drug advocacy, mental wellness campaigns & youth fitness", "rose", 120000],
      ["Environmental Protection", "Clean-up drives, tree planting, river protection & ecological waste management", "emerald", 70000],
      ["Disaster Preparedness", "Emergency response training, first-aid kits & disaster risk reduction kits", "orange", 80000],
      ["Administration & Training", "SK Council mandatory training, capability seminars, logistics & office maintenance", "indigo", 130000],
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
    const hash = bcrypt.hashSync("TocokSK2026!", 10);
    const officials = [
      ["HON. JELENA ROSE H. CABANLIG", "chairperson@sktocok.gov.ph", "SK Chairperson", "+63 912 111 2222", "/images/officials/cabanlig.jpg"],
      ["MS. ANNIECKA REINE C. QUINTO", "secretary@sktocok.gov.ph", "SK Secretary", "+63 912 333 4444", "/images/officials/quinto_anniecka.jpg"],
      ["MR. JOHN DAVID R. GARCIA", "treasurer@sktocok.gov.ph", "SK Treasurer", "+63 912 555 6666", "/images/officials/garcia.jpg"],
      ["HON. DOVIE ELLARES", "ellares@sktocok.gov.ph", "SK Kagawad", "+63 912 777 0001", "/images/officials/ellares.jpg"],
      ["HON. DANNAH MAE M. AQUINO", "aquino@sktocok.gov.ph", "SK Kagawad", "+63 912 777 0002", "/images/officials/aquino.jpg"],
      ["HON. RENZ LESTER S. RAMOS", "ramos@sktocok.gov.ph", "SK Kagawad", "+63 912 777 0003", "/images/officials/ramos.jpg"],
      ["HON. ROBBIE D. BARRO", "barro@sktocok.gov.ph", "SK Kagawad", "+63 912 777 0004", "/images/officials/barro.jpg"],
      ["HON. SANDRO J. QUINTO", "quinto.sandro@sktocok.gov.ph", "SK Kagawad", "+63 912 777 0005", "/images/officials/quinto_sandro.jpg"],
      ["HON. ANGELA S. SERRANA", "serrana@sktocok.gov.ph", "SK Kagawad", "+63 912 777 0006", "/images/officials/serrana.jpg"],
      ["HON. BABY JULHITZ R. PICAR", "picar@sktocok.gov.ph", "SK Kagawad", "+63 912 777 0007", "/images/officials/picar.jpg"],
    ];
    for (const [name, email, role, contact, avatar] of officials) {
      await sql`
        INSERT INTO users (name, email, password_hash, role, contact_number, avatar_url)
        VALUES (${name}, ${email}, ${hash}, ${role}, ${contact}, ${avatar})
        ON CONFLICT (email) DO NOTHING
      `;
    }
    console.log("✅ SK Officials seeded.");
  }

  // ------------------------------------------------------------------
  // 5. SEED SAMPLE DEPOSITS
  // ------------------------------------------------------------------
  const depCount = await sql`SELECT COUNT(*) as count FROM deposits`;
  if (Number(depCount[0].count) === 0) {
    const deposits = [
      ["DEP-2026-01-001", "2026-01-15", "Barangay Tocok NTA 10% SK Share — January 2026 Monthly Tranche"],
      ["DEP-2026-02-002", "2026-02-16", "Barangay Tocok NTA 10% SK Share — February 2026 Monthly Tranche"],
      ["DEP-2026-03-003", "2026-03-16", "Barangay Tocok NTA 10% SK Share — March 2026 Monthly Tranche"],
      ["DEP-2026-04-004", "2026-04-15", "Barangay Tocok NTA 10% SK Share — April 2026 Monthly Tranche"],
      ["DEP-2026-05-005", "2026-05-15", "Barangay Tocok NTA 10% SK Share — May 2026 Monthly Tranche"],
      ["DEP-2026-06-006", "2026-06-16", "Barangay Tocok NTA 10% SK Share — June 2026 Monthly Tranche"],
      ["DEP-2026-07-007", "2026-07-15", "Barangay Tocok NTA 10% SK Share — July 2026 Monthly Tranche"],
      ["DEP-2026-08-008", "2026-08-17", "Barangay Tocok NTA 10% SK Share — August 2026 Monthly Tranche"],
      ["DEP-2026-09-009", "2026-09-15", "Barangay Tocok NTA 10% SK Share — September 2026 Monthly Tranche"],
    ];
    for (const [ref, date, desc] of deposits) {
      const svgPath = `/uploads/receipts/deposit_${ref.toLowerCase().replace(/[^a-z0-9]/g, "_")}.svg`;
      await sql`
        INSERT INTO deposits (reference_no, source, amount, date, description, attachment_url, recorded_by)
        VALUES (${ref}, 'Barangay Tocok Internal Revenue Allotment', 55000, ${date}, ${desc}, ${svgPath}, 'Christian Dale Soriano (Treasurer)')
        ON CONFLICT (reference_no) DO NOTHING
      `;
    }
    console.log("✅ Monthly remittances seeded.");
  }

  // ------------------------------------------------------------------
  // 6. SEED SAMPLE EXPENSES
  // ------------------------------------------------------------------
  const expCount = await sql`SELECT COUNT(*) as count FROM expenses`;
  if (Number(expCount[0].count) === 0) {
    const expenses = [
      ["Procurement of Bond Paper, Ink, & Maintenance for Free Printing Program", "Purchased 50 reams A4/Short/Long bond papers, 8 bottles continuous ink, and replacement roller pads.", "Education & Culture", 35400, "2026-09-12", "DV-2026-09-041", "Pangasinan School & Office Depot", "/uploads/receipts/voucher_dv_2026_09_041.svg", "Christian Dale Soriano (Treasurer)"],
      ["Inter-Purok Youth Basketball & Volleyball League 2026", "Funding for player jerseys, referee honoraria, championship trophies, medals, and game balls.", "Sports Development", 115000, "2026-08-20", "DV-2026-08-019", "Barangay Tocok Sports Committee", "/uploads/receipts/voucher_dv_2026_08_019.svg", "Christian Dale Soriano (Treasurer)"],
      ["Academic Excellence Awards & School Supplies Distribution", "Incentive medals, certificates, backpacks, and notebook kits for Top 10 honor students.", "Education & Culture", 28500, "2026-07-15", "DV-2026-07-005", "Victory Bookstore & Supplies", "/uploads/receipts/voucher_dv_2026_07_005.svg", "Hon. Joshua Morales (Chairperson)"],
      ["Linggo ng Kabataan: Mental Health & Drug Abuse Awareness Seminar", "Resource speaker honorarium, sound system rental, certificates, snacks for 120 youth attendees.", "Health & Anti-Drug Abuse", 42000, "2026-08-14", "DV-2026-08-009", "Catering & Youth Center Logistics", "/uploads/receipts/voucher_dv_2026_08_009.svg", "Camille Angela Rivera (Secretary)"],
      ["Barangay Clean-up Drive & Tree Planting along Riverbank", "Garbage bags, rakes, shovels, gloves, native tree seedlings, snacks for 80 youth volunteers.", "Environmental Protection", 16800, "2026-06-05", "DV-2026-06-012", "Tocok Hardware & Agro Seeds", "/uploads/receipts/voucher_dv_2026_06_012.svg", "Hon. John Paul Estrada (Councilor)"],
      ["Youth Emergency First-Aid & Basic Life Support Training Kits", "First aid jump kits, splints, bandages, CPR face shields for 35 SK youth emergency responders.", "Disaster Preparedness", 24500, "2026-05-18", "DV-2026-05-022", "Red Cross Emergency Supplies PH", "/uploads/receipts/voucher_dv_2026_05_022.svg", "Christian Dale Soriano (Treasurer)"],
      ["SK Mandatory Training & Leadership Capability Seminar Registration", "Registration and transportation for SK Council participation in DILG-mandated youth governance academy.", "Administration & Training", 18000, "2026-03-24", "DV-2026-03-004", "National Youth Commission / DILG", "/uploads/receipts/voucher_dv_2026_03_004.svg", "Hon. Joshua Morales (Chairperson)"],
    ];
    for (const [title, desc, cat, amount, date, vno, payee, receipt, by] of expenses) {
      await sql`
        INSERT INTO expenses (title, description, category, amount, date, voucher_no, payee, receipt_url, created_by)
        VALUES (${title}, ${desc}, ${cat}, ${amount}, ${date}, ${vno}, ${payee}, ${receipt}, ${by})
      `;
    }
    console.log("✅ Sample expenses seeded.");
  }

  // ------------------------------------------------------------------
  // 7. SEED SAMPLE PRINT REQUESTS
  // ------------------------------------------------------------------
  const prCount = await sql`SELECT COUNT(*) as count FROM print_requests`;
  if (Number(prCount[0].count) === 0) {
    const prs = [
      ["SK842", "Angelica May Bautista", "0917-888-9901", "Angelica Bautista", "Purok 2 (Centro)", "SFNHS", "Grade 11 - STEM", "Practical_Research_Chapter1-3_Final.pdf", "/uploads/prints/sample-doc.pdf", 1048576, "Black & White", "A4", 2, "All pages (1-18)", "For submission tomorrow morning.", "Ready for Pickup", "Printed on Desk 2. Ready at SK Office front counter."],
      ["SK619", "Mark Kenneth Datuin", "0920-555-1234", "Mark Datuin", "Purok 1", "Pangasinan State University", "3rd Year BSIT", "Capstone_Project_Proposal_Draft.pdf", "/uploads/prints/sample-doc.pdf", 2097152, "Colored", "Letter (Short)", 1, "Pages 1-12 with charts", "Please print charts in color po.", "Printing In Progress", "Currently in printer queue."],
      ["SK305", "Princess Nicole Garcia", "0908-123-9876", "Princess Garcia", "Purok 5", "MNHS", "Grade 8 - Diamond", "Science_Quarter2_Portfolio.pdf", "/uploads/prints/sample-doc.pdf", 524288, "Black & White", "A4", 1, "Pages 1 to 5", "Science assignment due on Friday.", "Pending Review", null],
    ];
    for (const [tc, sn, cn, fb, purok, school, grade, fname, fpath, fsize, ptype, psize, copies, prange, notes, status, anotes] of prs) {
      await sql`
        INSERT INTO print_requests (tracking_code, student_name, contact_number, facebook_name, purok, school, grade_level, file_name, file_path, file_size, print_type, paper_size, copies, page_range, notes, status, admin_notes)
        VALUES (${tc}, ${sn}, ${cn}, ${fb}, ${purok}, ${school}, ${grade}, ${fname}, ${fpath}, ${fsize}, ${ptype}, ${psize}, ${copies}, ${prange}, ${notes}, ${status}, ${anotes})
        ON CONFLICT (tracking_code) DO NOTHING
      `;
    }
    console.log("✅ Sample print requests seeded.");
  }

  console.log("\n🎉 Database initialisation complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Init failed:", err);
  process.exit(1);
});
