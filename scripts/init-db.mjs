/**
 * SK TOCOK TRANSPARENCY PROGRAM - DATABASE INITIALISATION & SEED SCRIPT
 * 
 * Works with Neon Postgres / Vercel Postgres.
 * Run locally or in CI:
 *   node scripts/init-db.mjs
 * 
 * Automatically loads .env.local if present, or reads DATABASE_URL from environment.
 */

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

// 1. Load .env.local if present
if (fs.existsSync(".env.local")) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env.local");
  } else {
    // Fallback parser for older node
    const envContent = fs.readFileSync(".env.local", "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL environment variable is missing.");
  console.error("Please add your Neon/Vercel Postgres connection string to .env.local or your environment:");
  console.error('DATABASE_URL="postgres://username:password@ep-xyz.neon.tech/neondb?sslmode=require"\n');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("🚀 Connecting to Neon Postgres database...");

  // 1. CREATE TABLES
  console.log("📦 Creating schema tables if they don't exist...");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id                SERIAL PRIMARY KEY,
      name              TEXT NOT NULL,
      email             TEXT UNIQUE NOT NULL,
      password_hash     TEXT NOT NULL DEFAULT '',
      role              TEXT NOT NULL,
      contact_number    TEXT,
      avatar_url        TEXT,
      auth_provider     TEXT DEFAULT 'email',
      google_id         TEXT,
      theme_preference  TEXT,
      accent_preference TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_preference TEXT`;

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

  await sql`
    CREATE TABLE IF NOT EXISTS stored_files (
      id         TEXT PRIMARY KEY,
      folder     TEXT NOT NULL,
      file_name  TEXT NOT NULL,
      mime_type  TEXT NOT NULL,
      file_size  INTEGER NOT NULL,
      data       BYTEA NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id            SERIAL PRIMARY KEY,
      title         TEXT NOT NULL,
      activity_type TEXT NOT NULL DEFAULT 'Regular Session',
      session_date  TEXT NOT NULL,
      location      TEXT,
      description   TEXT,
      recorded_by   TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id         SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status     TEXT NOT NULL DEFAULT 'Absent',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (session_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date
    ON attendance_sessions (session_date DESC, id DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_attendance_records_session
    ON attendance_records (session_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_attendance_records_user
    ON attendance_records (user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS anonymous_messages (
      id             SERIAL PRIMARY KEY,
      tracking_code  TEXT UNIQUE NOT NULL,
      alias          TEXT DEFAULT 'Anonymous Youth',
      category       TEXT NOT NULL,
      purok          TEXT,
      subject        TEXT NOT NULL,
      message        TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'pending',
      is_public      BOOLEAN DEFAULT FALSE,
      is_pinned      BOOLEAN DEFAULT FALSE,
      admin_reply    TEXT,
      replied_by     TEXT,
      replied_at     TIMESTAMPTZ,
      likes_count    INTEGER DEFAULT 0,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_anonymous_messages_status
    ON anonymous_messages (status, is_public, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_anonymous_messages_tracking
    ON anonymous_messages (tracking_code)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_anonymous_messages_pinned
    ON anonymous_messages (is_pinned, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS anonymous_device_identities (
      id                 SERIAL PRIMARY KEY,
      device_id          VARCHAR(100) UNIQUE NOT NULL,
      alias              VARCHAR(100) NOT NULL,
      ip_hash            VARCHAR(100),
      device_fingerprint VARCHAR(100),
      user_agent         TEXT,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      last_seen_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_device_identities_device_id
    ON anonymous_device_identities (device_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_device_identities_fingerprint
    ON anonymous_device_identities (device_fingerprint)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_device_identities_alias
    ON anonymous_device_identities (alias)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
      user_email     TEXT,
      endpoint       TEXT UNIQUE NOT NULL,
      p256dh         TEXT NOT NULL,
      auth           TEXT NOT NULL,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_push_subs_user_id
    ON push_subscriptions (user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_push_subs_user_email
    ON push_subscriptions (user_email)
  `;

  // CSE Applications Table
  await sql`
    CREATE TABLE IF NOT EXISTS cse_applications (
      id                          SERIAL PRIMARY KEY,
      tracking_code               TEXT UNIQUE NOT NULL,
      full_name                   TEXT NOT NULL,
      contact_number              TEXT NOT NULL,
      email                       TEXT,
      facebook_name               TEXT,
      purok                       TEXT NOT NULL,
      birthdate                   TEXT NOT NULL,
      age                         INTEGER NOT NULL,
      school_or_employment        TEXT,
      
      exam_level                  TEXT NOT NULL,
      exam_date                   TEXT NOT NULL,
      is_first_time               BOOLEAN DEFAULT TRUE,
      
      payout_preference           TEXT NOT NULL DEFAULT 'Barangay Hall Cash Pickup',
      gcash_number                TEXT,
      gcash_account_name          TEXT,
      
      valid_id_url                TEXT NOT NULL,
      csc_receipt_url             TEXT NOT NULL,
      csc_receipt_no              TEXT,
      exam_schedule_proof_url     TEXT NOT NULL,
      
      reimbursement_status        TEXT NOT NULL DEFAULT 'Pending Review',
      reimbursement_amount        NUMERIC NOT NULL DEFAULT 500,
      disbursement_voucher_no     TEXT,
      reimbursed_at               TIMESTAMPTZ,
      reimbursed_by               TEXT,
      payout_station_or_method    TEXT,
      admin_notes                 TEXT,
      
      attendance_status           TEXT NOT NULL DEFAULT 'Not Yet Taken',
      exam_attendance_proof_url   TEXT,
      exam_attendance_notes       TEXT,
      attendance_verified_at      TIMESTAMPTZ,
      
      exam_result_status          TEXT NOT NULL DEFAULT 'Awaiting Results',
      rating                      NUMERIC,
      result_proof_url            TEXT,
      is_featured_in_hall_of_fame BOOLEAN DEFAULT TRUE,
      result_verified_at          TIMESTAMPTZ,
      user_id                     INTEGER,
      user_email                  TEXT,
      
      created_at                  TIMESTAMPTZ DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE cse_applications ADD COLUMN IF NOT EXISTS user_id INTEGER`;
  await sql`ALTER TABLE cse_applications ADD COLUMN IF NOT EXISTS user_email TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cse_tracking ON cse_applications(tracking_code)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cse_status ON cse_applications(reimbursement_status, exam_result_status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cse_purok ON cse_applications(purok)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cse_user_id ON cse_applications(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cse_user_email ON cse_applications(user_email)`;

  console.log("✅ Tables verified.");

  // 2. SEED SETTINGS
  console.log("⚙️  Checking default settings...");
  const settingsSeed = [
    ["barangay_budget", "8500000"],
    ["annual_budget", "850000"],
    ["funds_received", "495000"],
    ["bank_balance", "214800"],
    ["fiscal_year", "2026"],
    ["printing_active", "true"],
    ["monthly_paper_budget", "15000"],
    ["estimated_pages_remaining", "4500"],
    ["printing_announcement", "Free Student Printing Program is active! SK Hall is open Mon-Fri, 8:00 AM - 5:00 PM for claim and pickup."],
    ["hall_location", "Barangay Tocok Hall, Youth Development Center"],
    ["contact_email", "sktocok.youth@gmail.com"],
    ["contact_phone", "+63 912 345 6789"],
    ["cse_program_active", "true"],
    ["cse_slot_quota", "20"],
    ["cse_annual_budget", "10000"],
    ["cse_target_exam_batch", "March 2027 CSE-PPT"],
  ];

  for (const [key, value] of settingsSeed) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO NOTHING
    `;
  }

  // Update batch to 2027 launch batch
  await sql`
    UPDATE settings 
    SET value = 'March 2027 CSE-PPT' 
    WHERE key = 'cse_target_exam_batch'
  `;

  // 3. SEED CATEGORIES
  console.log("🏷️  Checking default budget categories...");
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
  }

  // 4. SEED SK OFFICIALS
  console.log("👥 Checking SK Officials roster...");
  const userCount = await sql`SELECT COUNT(*) as count FROM users`;
  if (Number(userCount[0].count) === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync("TocokSK2026!", salt);

    const officials = [
      ["JELENA ROSE H. CABANLIG", "chairperson@sktocok.gov.ph", "SK Chairperson", "+63 912 111 2222", "/images/officials/cabanlig.jpg"],
      ["ANNIECKA REINE C. QUINTO", "secretary@sktocok.gov.ph", "SK Secretary", "+63 912 333 4444", "/images/officials/quinto_anniecka.jpg"],
      ["JOHN DAVID R. GARCIA", "treasurer@sktocok.gov.ph", "SK Treasurer", "+63 912 555 6666", "/images/officials/garcia.jpg"],
      ["DOVIE ELLARES", "ellares@sktocok.gov.ph", "Education", "+63 912 777 0001", "/images/officials/ellares.jpg"],
      ["DANNAH MAE M. AQUINO", "aquino@sktocok.gov.ph", "Livelihood", "+63 912 777 0002", "/images/officials/aquino.jpg"],
      ["RENZ LESTER S. RAMOS", "ramos@sktocok.gov.ph", "Sports", "+63 912 777 0003", "/images/officials/ramos.jpg"],
      ["ROBBIE D. BARRO", "barro@sktocok.gov.ph", "SK Kagawad", "+63 912 777 0004", "/images/officials/barro.jpg"],
      ["SANDRO J. QUINTO", "quinto.sandro@sktocok.gov.ph", "Health", "+63 912 777 0005", "/images/officials/quinto_sandro.jpg"],
      ["ANGELA S. SERRANA", "serrana@sktocok.gov.ph", "SK Kagawad", "+63 912 777 0006", "/images/officials/serrana.jpg"],
      ["BABY JULHITZ R. PICAR", "picar@sktocok.gov.ph", "GAD", "+63 912 777 0007", "/images/officials/picar.jpg"],
    ];

    for (const [name, email, role, contact, avatar] of officials) {
      await sql`
        INSERT INTO users (name, email, password_hash, role, contact_number, avatar_url)
        VALUES (${name}, ${email}, ${hash}, ${role}, ${contact}, ${avatar})
        ON CONFLICT (email) DO NOTHING
      `;
    }
  }

  // 5. SEED MONTHLY REMITTANCES
  console.log("💰 Checking recorded NTA monthly remittances...");
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
  }

  // 6. SEED EXPENSES
  console.log("📋 Checking recorded expenses...");
  const expCount = await sql`SELECT COUNT(*) as count FROM expenses`;
  if (Number(expCount[0].count) === 0) {
    const expenses = [
      ["Procurement of Bond Paper, Ink, & Maintenance for Free Printing Program", "Purchased 50 reams A4/Short/Long bond papers, 8 bottles continuous ink, and replacement roller pads.", "Education & Culture", 35400, "2026-09-12", "DV-2026-09-041", "Pangasinan School & Office Depot", "/uploads/receipts/voucher_dv_2026_09_041.svg", "Christian Dale Soriano (Treasurer)"],
      ["Inter-Purok Youth Basketball & Volleyball League 2026", "Funding for player jerseys, referee honoraria, championship trophies, medals, and game balls.", "Sports Development", 115000, "2026-08-20", "DV-2026-08-019", "Barangay Tocok Sports Committee", "/uploads/receipts/voucher_dv_2026_08_019.svg", "Christian Dale Soriano (Treasurer)"],
      ["Academic Excellence Awards & School Supplies Distribution", "Incentive medals, certificates, backpacks, and notebook kits for Top 10 honor students.", "Education & Culture", 28500, "2026-07-15", "DV-2026-07-005", "Victory Bookstore & Supplies", "/uploads/receipts/voucher_dv_2026_07_005.svg", "Joshua Morales (Chairperson)"],
      ["Linggo ng Kabataan: Mental Health & Drug Abuse Awareness Seminar", "Resource speaker honorarium, sound system rental, certificates, snacks for 120 youth attendees.", "Health & Anti-Drug Abuse", 42000, "2026-08-14", "DV-2026-08-009", "Catering & Youth Center Logistics", "/uploads/receipts/voucher_dv_2026_08_009.svg", "Camille Angela Rivera (Secretary)"],
      ["Barangay Clean-up Drive & Tree Planting along Riverbank", "Garbage bags, rakes, shovels, gloves, native tree seedlings, snacks for 80 youth volunteers.", "Environmental Protection", 16800, "2026-06-05", "DV-2026-06-012", "Tocok Hardware & Agro Seeds", "/uploads/receipts/voucher_dv_2026_06_012.svg", "John Paul Estrada (Councilor)"],
      ["Youth Emergency First-Aid & Basic Life Support Training Kits", "First aid jump kits, splints, bandages, CPR face shields for 35 SK youth emergency responders.", "Disaster Preparedness", 24500, "2026-05-18", "DV-2026-05-022", "Red Cross Emergency Supplies PH", "/uploads/receipts/voucher_dv_2026_05_022.svg", "Christian Dale Soriano (Treasurer)"],
      ["SK Mandatory Training & Leadership Capability Seminar Registration", "Registration and transportation for SK Council participation in DILG-mandated youth governance academy.", "Administration & Training", 18000, "2026-03-24", "DV-2026-03-004", "National Youth Commission / DILG", "/uploads/receipts/voucher_dv_2026_03_004.svg", "Joshua Morales (Chairperson)"],
    ];
    for (const [title, desc, cat, amount, date, vno, payee, receipt, by] of expenses) {
      await sql`
        INSERT INTO expenses (title, description, category, amount, date, voucher_no, payee, receipt_url, created_by)
        VALUES (${title}, ${desc}, ${cat}, ${amount}, ${date}, ${vno}, ${payee}, ${receipt}, ${by})
      `;
    }
  }

  // 7. SEED PRINT REQUESTS
  console.log("🖨️  Checking sample student print requests...");
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
  }

  // 8. SEED SAMPLE 2026 SK ATTENDANCE SESSIONS & ACTIVITIES
  console.log("📋 Checking SK Officials attendance sessions...");
  const attCount = await sql`SELECT COUNT(*) as count FROM attendance_sessions`;
  if (Number(attCount[0].count) === 0) {
    const officialUsers = await sql`
      SELECT id, name, role FROM users
      WHERE LOWER(COALESCE(role, '')) != 'student'
      ORDER BY id ASC
    `;

    if (officialUsers.length > 0) {
      // Sample 2026 sessions & activities (deletable via the UI once real records are entered)
      // absentIndices references 0-based index into officialUsers (id ASC)
      const sampleSessions = [
        {
          title: "1st Regular Session — Annual Budget & Calendar of Activities",
          activity_type: "Regular Session",
          session_date: "2026-01-18",
          location: "Barangay Tocok SK Hall",
          description: "Adoption of 2026 Annual Barangay Youth Investment Program (ABYIP) and monthly committee schedules.",
          absentIndices: [8],
        },
        {
          title: "Free Student Printing Program Setup & Orientation",
          activity_type: "Youth Program",
          session_date: "2026-02-07",
          location: "Purok 5 Youth Center",
          description: "Printer calibration, paper inventory check, and volunteer shift scheduling for student print requests.",
          absentIndices: [5, 8],
        },
        {
          title: "2nd Regular Session — Q1 Committee Progress Review",
          activity_type: "Regular Session",
          session_date: "2026-02-15",
          location: "Barangay Tocok SK Hall",
          description: "Review of Q1 disbursements, youth registration updates, and upcoming sports league preparations.",
          absentIndices: [6],
        },
        {
          title: "3rd Regular Session — Mandatory Training & Seminar Planning",
          activity_type: "Regular Session",
          session_date: "2026-03-15",
          location: "Barangay Tocok SK Hall",
          description: "Finalization of SK Council delegation for DILG capability seminar and first-quarter audit.",
          absentIndices: [7, 8],
        },
        {
          title: "SK Leadership & Governance Capability Seminar",
          activity_type: "Seminar & Training",
          session_date: "2026-03-24",
          location: "San Fabian Municipal Auditorium",
          description: "DILG-mandated capacity building on RA 10742 financial transparency and youth project management.",
          absentIndices: [4, 7, 8],
        },
        {
          title: "4th Regular Session — Emergency Preparedness & Health Month",
          activity_type: "Regular Session",
          session_date: "2026-04-19",
          location: "Barangay Tocok SK Hall",
          description: "Budget resolution for Basic Life Support kits and coordination with Barangay Health Workers.",
          absentIndices: [8],
        },
        {
          title: "Youth Emergency First-Aid & Basic Life Support Training",
          activity_type: "Seminar & Training",
          session_date: "2026-05-18",
          location: "Barangay Tocok Covered Court",
          description: "Hands-on CPR and emergency triage workshop with 35 Barangay Tocok youth responders.",
          absentIndices: [5, 7, 8],
        },
        {
          title: "Barangay Riverbank Clean-up Drive & Tree Planting",
          activity_type: "Community Activity",
          session_date: "2026-06-05",
          location: "Tocok Riverbank & Purok 1–3",
          description: "Joint coastal and riverbank clean-up with 80 youth volunteers and planting of 150 native seedlings.",
          absentIndices: [6, 8],
        },
        {
          title: "5th Regular Session — Mid-Year Financial Audit & Sports League",
          activity_type: "Regular Session",
          session_date: "2026-07-19",
          location: "Barangay Tocok SK Hall",
          description: "Mid-year review of Land Bank remittances, academic awards distribution, and Inter-Purok League rules.",
          absentIndices: [7],
        },
        {
          title: "Inter-Purok Youth Basketball & Volleyball League Opening",
          activity_type: "Youth Program",
          session_date: "2026-08-20",
          location: "Barangay Tocok Covered Court",
          description: "Opening parade, team registration, jersey distribution, and exhibition matches across all puroks.",
          absentIndices: [8],
        },
        {
          title: "6th Regular Session — Linggo ng Kabataan & Q3 Assessment",
          activity_type: "Regular Session",
          session_date: "2026-09-20",
          location: "Barangay Tocok SK Hall",
          description: "Post-event liquidation of Linggo ng Kabataan activities and Q4 transparency portal planning.",
          absentIndices: [5, 8],
        },
        {
          title: "Special Session — Q4 Transparency & Year-End Youth Assembly Prep",
          activity_type: "Special Session",
          session_date: "2026-10-18",
          location: "Barangay Tocok SK Hall",
          description: "Preparation of year-end Katipunan ng Kabataan (KK) assembly report and attendance summary.",
          absentIndices: [],
        },
      ];

      for (const s of sampleSessions) {
        const inserted = await sql`
          INSERT INTO attendance_sessions (title, activity_type, session_date, location, description, recorded_by)
          VALUES (
            ${s.title},
            ${s.activity_type},
            ${s.session_date},
            ${s.location},
            ${s.description},
            'ANNIECKA REINE C. QUINTO (SK Secretary)'
          )
          RETURNING id
        `;
        const sessionId = Number(inserted[0].id);
        const absentSet = new Set(s.absentIndices);

        for (let i = 0; i < officialUsers.length; i++) {
          const official = officialUsers[i];
          const status = absentSet.has(i) ? "Absent" : "Present";
          await sql`
            INSERT INTO attendance_records (session_id, user_id, status)
            VALUES (${sessionId}, ${official.id}, ${status})
            ON CONFLICT (session_id, user_id) DO NOTHING
          `;
        }
      }
    }
  }

  console.log("\n🎉 Database setup and seeding complete!");
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
