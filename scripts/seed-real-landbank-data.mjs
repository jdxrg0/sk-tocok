/**
 * Migration Script: Clear mock data and populate authentic Landbank statement data
 * Account No: 4032-1016-02 (Current Account, Landbank Mangaldan Branch)
 * Source: Official Landbank weAccess Account Statement (CY 2026)
 */
import { neon } from "@neondatabase/serverless";
import fs from "fs";

if (fs.existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

const sql = neon(process.env.DATABASE_URL);

// 1. Official Bank Remittances (Credits / Deposits)
// 12 Monthly & Supplemental check deposits from Barangay Tocok 10% SK Youth Fund Allotment
const realDeposits = [
  {
    reference_no: "LBP-2026-01-001",
    date: "2026-01-07",
    amount: 52522.20,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "January 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 13:17:45)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-02-002",
    date: "2026-02-05",
    amount: 65722.03,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "February 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 10:46:05)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-03-003",
    date: "2026-03-04",
    amount: 60480.92,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "March 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 11:38:48)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-04-004",
    date: "2026-04-13",
    amount: 57765.50,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "April 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 12:56:50)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-05-005",
    date: "2026-05-07",
    amount: 58591.50,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "May 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 11:06:59)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-06-006",
    date: "2026-06-03",
    amount: 57766.50,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "June 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 11:35:17)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-07-007",
    date: "2026-07-06",
    amount: 58432.50,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "July 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 12:47:42)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-08-008",
    date: "2026-08-10",
    amount: 57766.50,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "August 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 09:54:44)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-09-009",
    date: "2026-09-03",
    amount: 60949.03,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "September 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 13:01:18)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-10-010",
    date: "2026-10-08",
    amount: 60197.89,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "October 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 10:03:40)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-11-011",
    date: "2026-11-03",
    amount: 8108.19,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "November 2026 Supplemental Tranche / Youth Fund Adjustment (Landbank Check Deposit 11:12:50)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    reference_no: "LBP-2026-11-012",
    date: "2026-11-03",
    amount: 58016.50,
    source: "Barangay Tocok NTA 10% SK Share",
    description: "November 2026 SK Share Monthly Remittance (Landbank On-Us Check Deposit 11:12:08)",
    recorded_by: "John David R. Garcia (SK Treasurer)"
  }
];

// 2. Official Check Disbursements & Debit Memo (Debits / Expenses)
// 38 authentic check disbursements & bank charges cleared against Landbank CA 4032-1016-02
// 20 entries enriched with exact Payee & Purpose from SK Chairperson's Certifications (SKCCs);
// 17 entries awaiting corresponding SKCC scans; 1 Landbank DM-ORDINARY debit memo.
const realExpenses = [
  {
    title: "BIR 1% Expanded Tax Remittance — Dec. 2025",
    description: "BIR 1% Expanded Tax - Dec. 2025 (Check #0000124054, SKCC dated Jan 12, 2026; DOS CA DONUS 15:22:20)",
    category: "Administration & Training",
    amount: 1004.00,
    date: "2026-01-12",
    voucher_no: "CK-0000124054",
    payee: "LBP FAO BIR",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "BIR 3% Percentage Tax Remittance — Dec. 2025",
    description: "BIR 3% Percentage Tax - Dec. 2025 (Check #0000124055, SKCC dated Jan 12, 2026; DOS CA DONUS 15:21:05)",
    category: "Administration & Training",
    amount: 3012.00,
    date: "2026-01-12",
    voucher_no: "CK-0000124055",
    payee: "LBP FAO BIR",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "SICAP - BADAC Seminar at Newtown Plaza Hotel, Baguio City",
    description: "SICAP - BADAC Seminar at Newtown Plaza Hotel, Baguio City (Check #0000124058, SKCC dated Feb 26, 2026; ENCASHMENT 09:54:00)",
    category: "Peace and Order & Anti-Drug Abuse",
    amount: 16640.00,
    date: "2026-02-26",
    voucher_no: "CK-0000124058",
    payee: "Robbie D. Barro",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "SK Council Honorarium — January 2026",
    description: "Honorarium - Jan 2026 under RA 11768 (Check #0000124056, SKCC received Feb 25, 2026; ENCASHMENT 14:10:57)",
    category: "Administration & Training",
    amount: 14400.00,
    date: "2026-02-27",
    voucher_no: "CK-0000124056",
    payee: "John David R. Garcia",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "SK Council Honorarium — February 2026",
    description: "Honorarium - Feb 2026 under RA 11768 (Check #0000124057, SKCC received Feb 25, 2026; ENCASHMENT 14:10:35)",
    category: "Administration & Training",
    amount: 14400.00,
    date: "2026-02-27",
    voucher_no: "CK-0000124057",
    payee: "John David R. Garcia",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124060 — Encashment (Pending SKCC)",
    description: "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 11:10:04). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 35360.00,
    date: "2026-03-10",
    voucher_no: "CK-0000124060",
    payee: "Landbank Mangaldan Branch (Pending SKCC)",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "SK Council Honorarium — March 2026",
    description: "Honorarium - March 2026 under RA 11768 (Check #0000124062, SKCC stamped Mar 25, 2026; ENCASHMENT 14:53:04)",
    category: "Administration & Training",
    amount: 14400.00,
    date: "2026-03-25",
    voucher_no: "CK-0000124062",
    payee: "John David R. Garcia",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "SK Council Honorarium — April 2026",
    description: "Honorarium - April 2026 under RA 11768 (Check #0000124063, SKCC stamped Apr 20, 2026; ENCASHMENT 14:33:03)",
    category: "Administration & Training",
    amount: 14400.00,
    date: "2026-04-20",
    voucher_no: "CK-0000124063",
    payee: "John David R. Garcia",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Traveling Expenses Voucher (TEV)",
    description: "Traveling Expenses Voucher (TEV) (Check #0000124067, SKCC dated May 25, 2026; ENCASHMENT 11:29:38)",
    category: "Administration & Training",
    amount: 1350.00,
    date: "2026-05-25",
    voucher_no: "CK-0000124067",
    payee: "John David R. Garcia",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Reimbursement for Payment of Drug Test",
    description: "Reimburse payment of Drug Test (Check #0000124065, SKCC dated May 25, 2026; ENCASHMENT 11:28:48)",
    category: "Peace and Order & Anti-Drug Abuse",
    amount: 2700.00,
    date: "2026-05-25",
    voucher_no: "CK-0000124065",
    payee: "John David R. Garcia",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "SK Council Honorarium — May 2026",
    description: "Honorarium - May 2026 under RA 11768 (Check #0000124064, SKCC dated May 25, 2026; ENCASHMENT 11:28:28)",
    category: "Administration & Training",
    amount: 14400.00,
    date: "2026-05-25",
    voucher_no: "CK-0000124064",
    payee: "John David R. Garcia",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Office Supplies Procurement",
    description: "Office Supplies (Check #0000124066, SKCC dated May 25, 2026; DOS CA DONUS 11:27:11)",
    category: "Administration & Training",
    amount: 28800.00,
    date: "2026-05-25",
    voucher_no: "CK-0000124066",
    payee: "YMG Consumer Goods Trading",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Referee's Fee for Badminton Tournament",
    description: "Referee's Fee for Badminton Tournament (Check #0000124070, SKCC dated Jun 5, 2026; ENCASHMENT 12:23:01)",
    category: "Sports Development",
    amount: 3000.00,
    date: "2026-06-05",
    voucher_no: "CK-0000124070",
    payee: "John David R. Garcia",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Referee's Fee for Volleyball Tournament",
    description: "Referee's Fee for Volleyball Tournament (Check #0000124069, SKCC dated Jun 5, 2026; ENCASHMENT 12:22:41)",
    category: "Sports Development",
    amount: 5600.00,
    date: "2026-06-05",
    voucher_no: "CK-0000124069",
    payee: "John David R. Garcia",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Referee's Fee for Basketball Tournament",
    description: "Referee's Fee for Basketball Tournament (Check #0000124068, SKCC dated Jun 5, 2026; ENCASHMENT 12:22:18)",
    category: "Sports Development",
    amount: 10000.00,
    date: "2026-06-05",
    voucher_no: "CK-0000124068",
    payee: "John David R. Garcia",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Various Materials for Sports Fest",
    description: "Various materials for Sports Fest (Check #0000124072, SKCC dated Jun 5, 2026; DOS CA DONUS 12:27:19)",
    category: "Sports Development",
    amount: 15840.00,
    date: "2026-06-05",
    voucher_no: "CK-0000124072",
    payee: "YMG Consumer Goods Trading",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Paint Materials for Repainting Basketball Covered Court",
    description: "Paint Materials for repainting basketball covered court (Check #0000124071, SKCC dated Jun 5, 2026; DOS CA DONUS 12:26:01)",
    category: "Sports Development",
    amount: 31651.20,
    date: "2026-06-05",
    voucher_no: "CK-0000124071",
    payee: "JACMG Enterprises",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "School Kit Supplies for Junior High School Students",
    description: "School Kit Supplies for Junior High School Students (Check #0000124074, SKCC dated Jun 5, 2026; DOS CA DONUS 12:27:20)",
    category: "Education & Culture",
    amount: 35040.00,
    date: "2026-06-05",
    voucher_no: "CK-0000124074",
    payee: "YMG Consumer Goods Trading",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "School Kit Supplies for Senior High School & College Students",
    description: "School Kit Supplies for Senior High School and College Students (Check #0000124073, SKCC dated Jun 5, 2026; DOS CA DONUS 12:27:19)",
    category: "Education & Culture",
    amount: 35280.00,
    date: "2026-06-05",
    voucher_no: "CK-0000124073",
    payee: "YMG Consumer Goods Trading",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124075 — Encashment (Pending SKCC)",
    description: "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 12:24:11). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 27100.00,
    date: "2026-06-19",
    voucher_no: "CK-0000124075",
    payee: "Landbank Mangaldan Branch (Pending SKCC)",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124076 — Check Clearing (Pending SKCC)",
    description: "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:34:29). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 1377.00,
    date: "2026-07-03",
    voucher_no: "CK-0000124076",
    payee: "Pending SKCC Verification",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124077 — Check Clearing (Pending SKCC)",
    description: "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:33:04). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 2128.00,
    date: "2026-07-03",
    voucher_no: "CK-0000124077",
    payee: "Pending SKCC Verification",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124079 — Encashment (Pending SKCC)",
    description: "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 12:31:46). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 14400.00,
    date: "2026-07-03",
    voucher_no: "CK-0000124079",
    payee: "Landbank Mangaldan Branch (Pending SKCC)",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124078 — Check Clearing (Pending SKCC)",
    description: "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:30:32). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 11520.00,
    date: "2026-07-03",
    voucher_no: "CK-0000124078",
    payee: "Pending SKCC Verification",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124080 — Check Clearing (Pending SKCC)",
    description: "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:03:11). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 1227.20,
    date: "2026-07-10",
    voucher_no: "CK-0000124080",
    payee: "Pending SKCC Verification",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124081 — Check Clearing (Pending SKCC)",
    description: "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:02:15). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 3681.60,
    date: "2026-07-10",
    voucher_no: "CK-0000124081",
    payee: "Pending SKCC Verification",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "BIR 1% Expanded Tax — July 2026",
    description: "BIR 1% Expanded Tax - July (Check #0000124082, SKCC dated Aug 10, 2026; DOS CA DONUS 11:52:53)",
    category: "Administration & Training",
    amount: 120.00,
    date: "2026-08-11",
    voucher_no: "CK-0000124082",
    payee: "LBP FAO BIR",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "BIR 3% Percentage Tax Remittance",
    description: "BIR 3% Percentage Tax (listed as 'Dec. 2025' on Aug 10, 2026 SKCC; Check #0000124083; DOS CA DONUS 11:51:50)",
    category: "Administration & Training",
    amount: 360.00,
    date: "2026-08-11",
    voucher_no: "CK-0000124083",
    payee: "LBP FAO BIR",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124084 — Encashment (Pending SKCC)",
    description: "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 14:17:29). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 14400.00,
    date: "2026-08-18",
    voucher_no: "CK-0000124084",
    payee: "Landbank Mangaldan Branch (Pending SKCC)",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124085 — Encashment (Pending SKCC)",
    description: "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 14:17:44). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 14400.00,
    date: "2026-08-18",
    voucher_no: "CK-0000124085",
    payee: "Landbank Mangaldan Branch (Pending SKCC)",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124087 — Check Clearing (Pending SKCC)",
    description: "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 14:44:13). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 3840.00,
    date: "2026-08-27",
    voucher_no: "CK-0000124087",
    payee: "Pending SKCC Verification",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124086 — Check Clearing (Pending SKCC)",
    description: "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 14:42:50). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 38400.00,
    date: "2026-08-27",
    voucher_no: "CK-0000124086",
    payee: "Pending SKCC Verification",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124088 — Check Clearing (Pending SKCC)",
    description: "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 14:45:08). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 38880.00,
    date: "2026-08-27",
    voucher_no: "CK-0000124088",
    payee: "Pending SKCC Verification",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124089 — Check Clearing (Pending SKCC)",
    description: "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:42:52). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 845.00,
    date: "2026-09-10",
    voucher_no: "CK-0000124089",
    payee: "Pending SKCC Verification",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124090 — Check Clearing (Pending SKCC)",
    description: "Official check clearing at Landbank Mangaldan Branch (DOS CA DONUS 12:43:52). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 2535.00,
    date: "2026-09-10",
    voucher_no: "CK-0000124090",
    payee: "Pending SKCC Verification",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "DM-ORDINARY — Landbank Bank Debit Memo",
    description: "Bank debit memo debited directly by Landbank Mangaldan Branch (DM-ORDINARY 16:10:51; e.g., checkbook / bank service charge)",
    category: "Administration & Training",
    amount: 600.00,
    date: "2026-10-26",
    voucher_no: "DM-2026-10-001",
    payee: "Land Bank of the Philippines (Mangaldan Branch)",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124091 — Encashment (Pending SKCC)",
    description: "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 14:27:50). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 14400.00,
    date: "2026-10-26",
    voucher_no: "CK-0000124091",
    payee: "Landbank Mangaldan Branch (Pending SKCC)",
    created_by: "John David R. Garcia (SK Treasurer)"
  },
  {
    title: "Check #0000124092 — Encashment (Pending SKCC)",
    description: "Check encashment cleared at Landbank Mangaldan Branch (ENCASHMENT 14:27:34). Awaiting SKCC/DV details.",
    category: "Administration & Training",
    amount: 14400.00,
    date: "2026-10-26",
    voucher_no: "CK-0000124092",
    payee: "Landbank Mangaldan Branch (Pending SKCC)",
    created_by: "John David R. Garcia (SK Treasurer)"
  }
];

async function run() {
  console.log("🌊 Commencing database reset with authentic Landbank data...");

  // 1. Wipe existing mock deposits & expenses
  console.log("🧹 Clearing mock deposits and expenses...");
  await sql`DELETE FROM expenses`;
  await sql`DELETE FROM deposits`;

  // 2. Insert Beginning Balance entry so bank reconciliation is exact to the centavo
  // Balance before 01/07/2026 was ₱75,514.44 (128,036.64 - 52,522.20)
  await sql`
    INSERT INTO deposits (reference_no, source, amount, date, description, attachment_url, recorded_by)
    VALUES (
      'LBP-2026-BEG-000',
      'Barangay Tocok SK Continuing Fund (Beginning Cash in Bank)',
      75514.44,
      '2026-01-01',
      'Beginning Cash in Bank Balance brought forward from FY 2025 unexpended youth fund (Landbank CA 4032-1016-02)',
      NULL,
      'John David R. Garcia (SK Treasurer)'
    )
  `;
  console.log("✅ Seeded beginning cash in bank balance (₱75,514.44).");

  // 3. Insert 12 authentic deposits
  for (const dep of realDeposits) {
    await sql`
      INSERT INTO deposits (reference_no, source, amount, date, description, recorded_by)
      VALUES (${dep.reference_no}, ${dep.source}, ${dep.amount}, ${dep.date}, ${dep.description}, ${dep.recorded_by})
    `;
  }
  console.log(`✅ Seeded ${realDeposits.length} authentic monthly remittances (Total: ₱656,319.26).`);

  // 4. Insert 38 authentic check disbursements
  for (const exp of realExpenses) {
    await sql`
      INSERT INTO expenses (title, description, category, amount, date, voucher_no, payee, created_by)
      VALUES (${exp.title}, ${exp.description}, ${exp.category}, ${exp.amount}, ${exp.date}, ${exp.voucher_no}, ${exp.payee}, ${exp.created_by})
    `;
  }
  console.log(`✅ Seeded ${realExpenses.length} authentic check disbursements (Total: ₱501,891.00).`);

  // 5. Update settings with authentic balances
  const totalInflow = 75514.44 + 656319.26; // 731,833.70
  const totalSpent = 501891.00;
  const currentBankBalance = totalInflow - totalSpent; // 229,942.70

  const settingsUpdates = [
    ["bank_balance", currentBankBalance.toFixed(2)],
    ["funds_received", totalInflow.toFixed(2)],
    ["annual_budget", "731833.70"],
    ["barangay_budget", "7318337.00"],
    ["fiscal_year", "2026"]
  ];

  for (const [k, v] of settingsUpdates) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${k}, ${v})
      ON CONFLICT (key) DO UPDATE SET value = ${v}
    `;
  }
  console.log("✅ Updated settings: bank_balance = ₱229,942.70, funds_received = ₱731,833.70.");

  console.log("🎉 Migration completed successfully!");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
