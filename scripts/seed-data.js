const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const receiptsDir = path.join(process.cwd(), "public", "uploads", "receipts");
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const dbPath = path.join(process.cwd(), "data", "sk_tocok.db");
const db = new Database(dbPath);

function formatPHP(amount) {
  return Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function createVoucherSvg(v) {
  const amtFormatted = formatPHP(v.amount);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1080" width="800" height="1080" style="background:#fcfdfd; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
    <!-- Border -->
    <rect x="15" y="15" width="770" height="1050" fill="#ffffff" stroke="#1e293b" stroke-width="2" rx="4"/>
    <rect x="22" y="22" width="756" height="1036" fill="none" stroke="#94a3b8" stroke-width="0.75" rx="2"/>

    <!-- Header -->
    <text x="400" y="55" text-anchor="middle" font-size="12" font-weight="600" fill="#475569" letter-spacing="1">REPUBLIC OF THE PHILIPPINES</text>
    <text x="400" y="72" text-anchor="middle" font-size="11" font-weight="500" fill="#64748b">PROVINCE OF PANGASINAN • MUNICIPALITY OF SAN FABIAN</text>
    <text x="400" y="94" text-anchor="middle" font-size="15" font-weight="800" fill="#0f172a" letter-spacing="0.5">BARANGAY TOCOK — SANGGUNIANG KABATAAN</text>
    <line x1="50" y1="108" x2="750" y2="108" stroke="#0f172a" stroke-width="1.5"/>

    <rect x="50" y="118" width="700" height="38" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="3"/>
    <text x="400" y="143" text-anchor="middle" font-size="16" font-weight="900" fill="#0f172a" letter-spacing="2">OFFICIAL DISBURSEMENT VOUCHER</text>

    <!-- Meta Grid -->
    <rect x="50" y="165" width="700" height="80" fill="none" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="450" y1="165" x2="450" y2="245" stroke="#cbd5e1" stroke-width="1"/>

    <!-- Left Meta -->
    <text x="65" y="185" font-size="10" font-weight="bold" fill="#64748b">PAYEE / CREDITOR:</text>
    <text x="65" y="206" font-size="13" font-weight="bold" fill="#0f172a">${v.payee}</text>
    <text x="65" y="228" font-size="10" fill="#475569">Address: San Fabian, Pangasinan • Registered Youth Partner / Supplier</text>

    <!-- Right Meta -->
    <text x="465" y="187" font-size="10" font-weight="bold" fill="#64748b">VOUCHER NO.:</text>
    <text x="565" y="187" font-size="11" font-weight="bold" font-family="monospace" fill="#0f172a">${v.voucher_no}</text>

    <text x="465" y="207" font-size="10" font-weight="bold" fill="#64748b">DATE ISSUED:</text>
    <text x="565" y="207" font-size="11" font-weight="bold" font-family="monospace" fill="#0f172a">${v.date}</text>

    <text x="465" y="227" font-size="10" font-weight="bold" fill="#64748b">FUND ALLOCATION:</text>
    <text x="565" y="227" font-size="10" font-weight="700" fill="#1e40af">10% SK Youth Dev. Fund (RA 10742)</text>

    <!-- Particulars Header -->
    <rect x="50" y="255" width="700" height="28" fill="#1e293b" stroke="#1e293b" stroke-width="1"/>
    <text x="210" y="274" text-anchor="middle" font-size="11" font-weight="bold" fill="#ffffff">PARTICULARS / EXPENDITURE DETAILS</text>
    <text x="510" y="274" text-anchor="middle" font-size="11" font-weight="bold" fill="#ffffff">COMMITTEE &amp; ABYIP CODE</text>
    <text x="680" y="274" text-anchor="middle" font-size="11" font-weight="bold" fill="#ffffff">AMOUNT (PHP)</text>

    <!-- Particulars Body -->
    <rect x="50" y="283" width="700" height="350" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="390" y1="283" x2="390" y2="633" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="620" y1="283" x2="620" y2="633" stroke="#cbd5e1" stroke-width="1"/>

    <!-- Details -->
    <text x="65" y="315" font-size="13" font-weight="bold" fill="#0f172a">${v.title}</text>
    
    <foreignObject x="65" y="330" width="310" height="150">
      <p xmlns="http://www.w3.org/1999/xhtml" style="font-size: 11px; color: #475569; line-height: 1.55; margin: 0;">
        ${v.description}
      </p>
    </foreignObject>

    <text x="65" y="495" font-size="10" font-weight="bold" fill="#64748b">SUPPORTING DOCUMENTS AUDITED &amp; ATTACHED:</text>
    <text x="65" y="515" font-size="10" fill="#334155">✓ Official Sales Invoice &amp; Official Receipt (OR)</text>
    <text x="65" y="532" font-size="10" fill="#334155">✓ SK Council Resolution &amp; Approved Activity Design</text>
    <text x="65" y="549" font-size="10" fill="#334155">✓ Certificate of Inspection and Acceptance</text>
    <text x="65" y="566" font-size="10" fill="#334155">✓ Participant Attendance Sheets &amp; Photo Documentation</text>

    <!-- Category Column -->
    <text x="405" y="315" font-size="12" font-weight="bold" fill="#1e40af">${v.category}</text>
    <text x="405" y="335" font-size="10" fill="#64748b">Statutory Committee Program</text>
    <text x="405" y="355" font-size="10" fill="#64748b">FY 2026 ABYIP Line Item</text>
    <text x="405" y="375" font-size="10" fill="#059669">Status: Fully Audited &amp; Liquidated</text>

    <!-- Amount Column -->
    <text x="735" y="318" text-anchor="end" font-size="15" font-weight="900" font-family="monospace" fill="#0f172a">₱${amtFormatted}</text>

    <!-- Total Row -->
    <rect x="50" y="633" width="700" height="38" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
    <text x="390" y="658" text-anchor="end" font-size="12" font-weight="bold" fill="#0f172a">NET DISBURSED AMOUNT:</text>
    <text x="735" y="659" text-anchor="end" font-size="16" font-weight="900" font-family="monospace" fill="#047857">₱${amtFormatted}</text>

    <!-- Box A: Certification by SK Treasurer -->
    <rect x="50" y="682" width="340" height="175" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
    <text x="60" y="702" font-size="10" font-weight="bold" fill="#475569">BOX A: CERTIFICATION BY SK TREASURER</text>
    <text x="60" y="722" font-size="9.5" fill="#64748b">I hereby certify that funds are available in the official SK</text>
    <text x="60" y="737" font-size="9.5" fill="#64748b">depository bank account, that expenses are supported by</text>
    <text x="60" y="752" font-size="9.5" fill="#64748b">valid receipts, and proper accounting procedures were followed.</text>
    
    <text x="220" y="818" text-anchor="middle" font-size="12" font-weight="bold" fill="#0f172a">CHRISTIAN DALE SORIANO</text>
    <line x1="80" y1="823" x2="360" y2="823" stroke="#475569" stroke-width="1"/>
    <text x="220" y="838" text-anchor="middle" font-size="9.5" fill="#64748b">SK Treasurer, Barangay Tocok</text>

    <!-- Box B: Approval by SK Chairperson -->
    <rect x="410" y="682" width="340" height="175" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
    <text x="420" y="702" font-size="10" font-weight="bold" fill="#475569">BOX B: APPROVAL BY SK CHAIRPERSON</text>
    <text x="420" y="722" font-size="9.5" fill="#64748b">I hereby approve the disbursement of youth funds in</text>
    <text x="420" y="737" font-size="9.5" fill="#64748b">accordance with RA 10742 and the duly enacted Annual</text>
    <text x="420" y="752" font-size="9.5" fill="#64748b">Barangay Youth Investment Program (ABYIP).</text>
    
    <text x="580" y="818" text-anchor="middle" font-size="12" font-weight="bold" fill="#0f172a">HON. JOSHUA MORALES</text>
    <line x1="440" y1="823" x2="720" y2="823" stroke="#475569" stroke-width="1"/>
    <text x="580" y="838" text-anchor="middle" font-size="9.5" fill="#64748b">SK Chairperson / Punong Kabataan</text>

    <!-- Box C: Receipt Acknowledgment -->
    <rect x="50" y="868" width="700" height="135" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
    <text x="60" y="888" font-size="10" font-weight="bold" fill="#475569">BOX C: RECEIPT ACKNOWLEDGMENT / SETTLEMENT</text>
    <text x="60" y="908" font-size="10" fill="#64748b">Received from Sangguniang Kabataan of Barangay Tocok the sum of ₱${amtFormatted} in full payment of the claim.</text>

    <text x="180" y="966" text-anchor="middle" font-size="11" font-weight="bold" fill="#0f172a">${v.payee}</text>
    <line x1="60" y1="971" x2="300" y2="971" stroke="#475569" stroke-width="1"/>
    <text x="180" y="985" text-anchor="middle" font-size="9" fill="#64748b">Signature of Payee / Authorized Representative</text>

    <text x="430" y="966" text-anchor="middle" font-size="11" font-family="monospace" fill="#0f172a">${v.date}</text>
    <line x1="360" y1="971" x2="500" y2="971" stroke="#475569" stroke-width="1"/>
    <text x="430" y="985" text-anchor="middle" font-size="9" fill="#64748b">Date Received</text>

    <text x="620" y="966" text-anchor="middle" font-size="11" font-family="monospace" fill="#0f172a">Land Bank ADA / Check</text>
    <line x1="530" y1="971" x2="710" y2="971" stroke="#475569" stroke-width="1"/>
    <text x="620" y="985" text-anchor="middle" font-size="9" fill="#64748b">Mode of Payment</text>

    <!-- Watermark Stamp -->
    <g transform="translate(540, 470) rotate(-12)">
      <rect x="0" y="0" width="180" height="65" fill="#f0fdf4" fill-opacity="0.85" stroke="#059669" stroke-width="2" stroke-dasharray="5,2" rx="4"/>
      <text x="90" y="26" text-anchor="middle" font-size="13" font-weight="900" fill="#059669" letter-spacing="1">COA AUDITED</text>
      <text x="90" y="44" text-anchor="middle" font-size="9" font-weight="bold" fill="#059669">VERIFIED &amp; POSTED</text>
      <text x="90" y="56" text-anchor="middle" font-size="8" font-family="monospace" fill="#059669">BARANGAY TOCOK SK</text>
    </g>

    <!-- Footer Security Note -->
    <text x="400" y="1030" text-anchor="middle" font-size="9" fill="#94a3b8">SK Tocok Public Transparency Portal • RA 10742 Republic Act • Public Record • Digitally Signed &amp; Audited</text>
  </svg>`;
}

function createDepositSlipSvg(d) {
  const amtFormatted = formatPHP(d.amount);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" style="background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
    <!-- Container -->
    <rect x="20" y="20" width="760" height="560" fill="#ffffff" stroke="#0284c7" stroke-width="2.5" rx="6"/>
    
    <!-- Header Band -->
    <rect x="20" y="20" width="760" height="70" fill="#0369a1" rx="4"/>
    <text x="40" y="48" font-size="14" font-weight="bold" fill="#bae6fd" letter-spacing="1">LAND BANK OF THE PHILIPPINES • OFFICIAL BANK DEPOSIT SLIP</text>
    <text x="40" y="68" font-size="11" fill="#e0f2fe">Account: SANGGUNIANG KABATAAN NG BARANGAY TOCOK • Depository Branch: San Fabian, Pangasinan</text>

    <!-- Stamp -->
    <rect x="630" y="32" width="130" height="46" fill="#0284c7" stroke="#38bdf8" stroke-width="1" rx="3"/>
    <text x="695" y="52" text-anchor="middle" font-size="11" font-weight="bold" fill="#ffffff">BANK VALIDATED</text>
    <text x="695" y="68" text-anchor="middle" font-size="9" font-family="monospace" fill="#e0f2fe">${d.date}</text>

    <!-- Body Content -->
    <g transform="translate(50, 115)">
      <!-- Details Table -->
      <rect x="0" y="0" width="700" height="310" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="4"/>
      
      <text x="25" y="35" font-size="11" font-weight="bold" fill="#64748b">TRANSACTION REFERENCE:</text>
      <text x="220" y="35" font-size="13" font-weight="bold" font-family="monospace" fill="#0f172a">${d.reference_no}</text>

      <line x1="20" y1="50" x2="680" y2="50" stroke="#e2e8f0" stroke-width="1"/>

      <text x="25" y="80" font-size="11" font-weight="bold" fill="#64748b">DEPOSIT DATE:</text>
      <text x="220" y="80" font-size="13" font-weight="bold" font-family="monospace" fill="#0f172a">${d.date}</text>

      <line x1="20" y1="95" x2="680" y2="95" stroke="#e2e8f0" stroke-width="1"/>

      <text x="25" y="125" font-size="11" font-weight="bold" fill="#64748b">REMITTING ENTITY / SOURCE:</text>
      <text x="220" y="125" font-size="13" font-weight="bold" fill="#0284c7">${d.source}</text>

      <line x1="20" y1="140" x2="680" y2="140" stroke="#e2e8f0" stroke-width="1"/>

      <text x="25" y="170" font-size="11" font-weight="bold" fill="#64748b">PARTICULARS / REMARKS:</text>
      <text x="220" y="170" font-size="12" fill="#334155">${d.description}</text>

      <line x1="20" y1="185" x2="680" y2="185" stroke="#e2e8f0" stroke-width="1"/>

      <text x="25" y="215" font-size="11" font-weight="bold" fill="#64748b">LEGAL BASIS / ALLOCATION:</text>
      <text x="220" y="215" font-size="12" fill="#334155">10% Mandated SK Youth Fund under Section 20, RA 10742</text>

      <line x1="20" y1="230" x2="680" y2="230" stroke="#e2e8f0" stroke-width="1"/>

      <!-- Amount Highlight -->
      <rect x="20" y="245" width="660" height="50" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1.5" rx="4"/>
      <text x="40" y="276" font-size="13" font-weight="bold" fill="#065f46">NET DEPOSITED TO SK ACCOUNT:</text>
      <text x="660" y="278" text-anchor="end" font-size="20" font-weight="900" font-family="monospace" fill="#047857">₱${amtFormatted}</text>
    </g>

    <!-- Signatures -->
    <g transform="translate(50, 455)">
      <text x="140" y="30" text-anchor="middle" font-size="11" font-weight="bold" fill="#0f172a">BARANGAY TREASURER</text>
      <line x1="30" y1="35" x2="250" y2="35" stroke="#475569" stroke-width="1"/>
      <text x="140" y="50" text-anchor="middle" font-size="10" fill="#64748b">Remitting Officer • Barangay Tocok</text>

      <text x="560" y="30" text-anchor="middle" font-size="11" font-weight="bold" fill="#0f172a">LAND BANK TELLER / VALIDATOR</text>
      <line x1="450" y1="35" x2="670" y2="35" stroke="#475569" stroke-width="1"/>
      <text x="560" y="50" text-anchor="middle" font-size="10" fill="#64748b">San Fabian Branch • Stamp &amp; Signature</text>
    </g>

    <!-- Footer -->
    <text x="400" y="560" text-anchor="middle" font-size="9" fill="#94a3b8">Official Bank Record • SK Tocok Transparency Portal • RA 10742 Compliance</text>
  </svg>`;
}

// 1. Create deposits table
db.exec(`
  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_no TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    attachment_url TEXT,
    recorded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 2. Add allocated_budget to categories if not exists
try {
  db.exec("ALTER TABLE categories ADD COLUMN allocated_budget REAL DEFAULT 0;");
  console.log("Added allocated_budget column to categories table");
} catch (e) {
  // column already exists
}

// 3. Update category budgets (Total: 850,000)
const categoryBudgets = [
  { name: "Education & Culture", budget: 200000 },
  { name: "Sports Development", budget: 250000 },
  { name: "Health & Anti-Drug Abuse", budget: 120000 },
  { name: "Environmental Protection", budget: 70000 },
  { name: "Disaster Preparedness", budget: 80000 },
  { name: "Administration & Training", budget: 130000 },
];

const updateCatStmt = db.prepare("UPDATE categories SET allocated_budget = ? WHERE name = ?");
categoryBudgets.forEach((c) => {
  updateCatStmt.run(c.budget, c.name);
});
console.log("Updated category allocated budgets");

// 4. Seed 9 monthly remittances (Jan to Sep 2026, ₱55,000 each = ₱495,000)
const remittances = [
  { ref: "DEP-2026-01-001", date: "2026-01-15", desc: "Barangay Tocok NTA 10% SK Share — January 2026 Monthly Tranche" },
  { ref: "DEP-2026-02-002", date: "2026-02-16", desc: "Barangay Tocok NTA 10% SK Share — February 2026 Monthly Tranche" },
  { ref: "DEP-2026-03-003", date: "2026-03-16", desc: "Barangay Tocok NTA 10% SK Share — March 2026 Monthly Tranche" },
  { ref: "DEP-2026-04-004", date: "2026-04-15", desc: "Barangay Tocok NTA 10% SK Share — April 2026 Monthly Tranche" },
  { ref: "DEP-2026-05-005", date: "2026-05-15", desc: "Barangay Tocok NTA 10% SK Share — May 2026 Monthly Tranche" },
  { ref: "DEP-2026-06-006", date: "2026-06-16", desc: "Barangay Tocok NTA 10% SK Share — June 2026 Monthly Tranche" },
  { ref: "DEP-2026-07-007", date: "2026-07-15", desc: "Barangay Tocok NTA 10% SK Share — July 2026 Monthly Tranche" },
  { ref: "DEP-2026-08-008", date: "2026-08-17", desc: "Barangay Tocok NTA 10% SK Share — August 2026 Monthly Tranche" },
  { ref: "DEP-2026-09-009", date: "2026-09-15", desc: "Barangay Tocok NTA 10% SK Share — September 2026 Monthly Tranche" },
];

const insertDeposit = db.prepare(`
  INSERT OR IGNORE INTO deposits (reference_no, source, amount, date, description, attachment_url, recorded_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

remittances.forEach((r) => {
  const depositSvg = createDepositSlipSvg({
    reference_no: r.ref,
    source: "Barangay Tocok Internal Revenue Allotment",
    amount: 55000,
    date: r.date,
    description: r.desc,
  });
  const filename = `deposit_${r.ref.toLowerCase().replace(/[^a-z0-9]/g, "_")}.svg`;
  fs.writeFileSync(path.join(receiptsDir, filename), depositSvg);
  const attachment_url = `/uploads/receipts/${filename}`;

  insertDeposit.run(
    r.ref,
    "Barangay Tocok Internal Revenue Allotment",
    55000,
    r.date,
    r.desc,
    attachment_url,
    "Christian Dale Soriano (Treasurer)"
  );
});
console.log("Seeded 9 monthly remittances and deposit slip SVG files");

// 5. Generate official disbursement voucher SVGs for existing expenses and update receipt_url
const expenses = db.prepare("SELECT * FROM expenses").all();
const updateExpense = db.prepare("UPDATE expenses SET receipt_url = ? WHERE id = ?");

expenses.forEach((e) => {
  const svg = createVoucherSvg(e);
  const filename = `voucher_${(e.voucher_no || `dv_${e.id}`).toLowerCase().replace(/[^a-z0-9]/g, "_")}.svg`;
  fs.writeFileSync(path.join(receiptsDir, filename), svg);
  const receipt_url = `/uploads/receipts/${filename}`;
  updateExpense.run(receipt_url, e.id);
});
console.log(`Generated official voucher SVGs for ${expenses.length} expenses and updated receipt_url`);

// Check totals
const depSum = db.prepare("SELECT SUM(amount) as t FROM deposits").get().t;
const expSum = db.prepare("SELECT SUM(amount) as t FROM expenses").get().t;
const cashInBank = depSum - expSum;

console.log("------------------------------------------");
console.log(`Total Deposited: ₱${formatPHP(depSum)}`);
console.log(`Total Disbursed: ₱${formatPHP(expSum)}`);
console.log(`Cash in Bank:    ₱${formatPHP(cashInBank)}`);
console.log("------------------------------------------");
