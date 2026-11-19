import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const OFFICIAL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// 31 realistic sessions for 2026
const SESSIONS = [
  // --- JANUARY 2026 ---
  {
    title: "1st Regular Session — FY 2026 Annual Budget & AYDP Adoption",
    activity_type: "Regular Session",
    session_date: "2026-01-11",
    location: "Barangay Tocok SK Hall",
    description: "Deliberation and official adoption of the 2026 Annual Youth Development Plan (AYDP) and initial allocation of the 10% SK fund.",
    // absences for this session: [official_id, ...]
    absent: [9], // Angela
  },
  {
    title: "2nd Regular Session — Committee Action Plans & Q1 Projects",
    activity_type: "Regular Session",
    session_date: "2026-01-25",
    location: "Barangay Tocok SK Hall",
    description: "Presentation of action plans by the Committees on Education, Sports, Health, and Environmental Protection.",
    absent: [8], // Sandro
  },

  // --- FEBRUARY 2026 ---
  {
    title: "3rd Regular Session — Free Printing Program Expansion",
    activity_type: "Regular Session",
    session_date: "2026-02-08",
    location: "Barangay Tocok SK Hall",
    description: "Review of supply procurement and ink allocations for the Free Student Printing & Educational Assistance Program.",
    absent: [], // Full attendance
  },
  {
    title: "Barangay Tocok Youth Leadership & Team Building",
    activity_type: "Youth Program",
    session_date: "2026-02-14",
    location: "Barangay Tocok Covered Court",
    description: "Interactive team-building and leadership development workshops for Purok youth coordinators and SK council members.",
    absent: [6, 9], // Renz, Angela
  },
  {
    title: "4th Regular Session — Printing Program Operations & Budget",
    activity_type: "Regular Session",
    session_date: "2026-02-22",
    location: "Barangay Tocok SK Hall",
    description: "Monthly evaluation of printing service logbooks, inventory maintenance, and student feedback analysis.",
    absent: [7], // Robbie
  },

  // --- MARCH 2026 ---
  {
    title: "5th Regular Session — Women's Month Youth Forum Planning",
    activity_type: "Regular Session",
    session_date: "2026-03-08",
    location: "Barangay Tocok SK Hall",
    description: "Planning and resource assignment for Women's Month advocacy seminars focusing on young women in governance.",
    absent: [8], // Sandro
  },
  {
    title: "SK Capability Development & Governance Training",
    activity_type: "Seminar & Training",
    session_date: "2026-03-21",
    location: "San Fabian Municipal Auditorium",
    description: "Municipal capability-building seminar on DILG-NYC financial guidelines, public procurement, and citizen charter compliance.",
    absent: [9, 10], // Angela, Baby
  },
  {
    title: "6th Regular Session — Q1 Accomplishment & Financial Audit",
    activity_type: "Regular Session",
    session_date: "2026-03-29",
    location: "Barangay Tocok SK Hall",
    description: "Formal review of Q1 financial reports, bank reconciliations, and physical accomplishment validation.",
    absent: [3], // John David (accounting board review)
  },

  // --- APRIL 2026 ---
  {
    title: "7th Regular Session — Summer Youth Festival & Sports League",
    activity_type: "Regular Session",
    session_date: "2026-04-12",
    location: "Barangay Tocok SK Hall",
    description: "Discussion of guidelines, rulebooks, and logistics for the upcoming Barangay Tocok Inter-Purok Youth Tournament.",
    absent: [2], // Anniecka (university midterms)
  },
  {
    title: "8th Regular Session — Katipunan ng Kabataan Assembly Prep",
    activity_type: "Regular Session",
    session_date: "2026-04-26",
    location: "Barangay Tocok SK Hall",
    description: "Finalizing program agenda, invitation notices, and venue arrangements for the first KK Assembly of 2026.",
    absent: [5], // Dannah Mae
  },

  // --- MAY 2026 ---
  {
    title: "1st Katipunan ng Kabataan (KK) General Assembly 2026",
    activity_type: "Community Activity",
    session_date: "2026-05-03",
    location: "Barangay Tocok Covered Court",
    description: "General assembly of all youth residents aged 15-30: reporting Q1 financial transparency and open floor consultations.",
    absent: [], // Full attendance!
  },
  {
    title: "9th Regular Session — Inter-Purok Sports Tournament Opening",
    activity_type: "Regular Session",
    session_date: "2026-05-10",
    location: "Barangay Tocok SK Hall",
    description: "Official kickoff and schedule coordination for the Purok 1 to Purok 7 basketball and volleyball divisions.",
    absent: [6], // Renz
  },
  {
    title: "10th Regular Session — Sports League Progress & Mid-Year Plan",
    activity_type: "Regular Session",
    session_date: "2026-05-24",
    location: "Barangay Tocok SK Hall",
    description: "Monitoring of referee allowances, medical standby teams, and safety protocols during the summer tournament.",
    absent: [8, 9], // Sandro, Angela
  },

  // --- JUNE 2026 ---
  {
    title: "11th Regular Session — Back-to-School Assistance Project",
    activity_type: "Regular Session",
    session_date: "2026-06-07",
    location: "Barangay Tocok SK Hall",
    description: "Resolution approving the procurement of school supply kits for underprivileged elementary and high school students in Tocok.",
    absent: [7], // Robbie
  },
  {
    title: "Barangay Tocok Riverbank Clean-Up & Tree Planting",
    activity_type: "Community Activity",
    session_date: "2026-06-20",
    location: "Tocok Riverbank & Purok 1–3",
    description: "Environmental greening campaign: planting bamboo and native fruit trees along the riverbanks to curb soil erosion.",
    absent: [4, 9], // Dovie, Angela
  },
  {
    title: "12th Regular Session — School Supplies Distribution Review",
    activity_type: "Regular Session",
    session_date: "2026-06-28",
    location: "Barangay Tocok SK Hall",
    description: "Evaluation of the beneficiary validation process and inventory turnover for school distribution week.",
    absent: [6], // Renz
  },

  // --- JULY 2026 ---
  {
    title: "13th Regular Session — National Nutrition Month Program",
    activity_type: "Regular Session",
    session_date: "2026-07-12",
    location: "Barangay Tocok SK Hall",
    description: "Coordination with Barangay Health Workers (BHW) for supplementary feeding and adolescent nutritional awareness seminars.",
    absent: [1], // Jelena Rose (Attending Pederasyon meeting at municipal hall)
  },
  {
    title: "14th Regular Session — Q2 Financial Transparency Review",
    activity_type: "Regular Session",
    session_date: "2026-07-26",
    location: "Barangay Tocok SK Hall",
    description: "Detailed review of mid-year expenditures, remaining budget balances, and posting of updated financial statements on transparency boards.",
    absent: [8], // Sandro
  },

  // --- AUGUST 2026 ---
  {
    title: "15th Regular Session — Linggo ng Kabataan 2026 Planning",
    activity_type: "Regular Session",
    session_date: "2026-08-02",
    location: "Barangay Tocok SK Hall",
    description: "Detailed programming and committee assignments for the annual Youth Week festivities, cultural shows, and youth night.",
    absent: [], // Full attendance
  },
  {
    title: "Linggo ng Kabataan 2026 Opening & Cultural Showcase",
    activity_type: "Youth Program",
    session_date: "2026-08-12",
    location: "Barangay Tocok Covered Court",
    description: "Grand opening parade, youth talents showcase, spoken word poetry competition, and acoustic band exhibition.",
    absent: [7], // Robbie
  },
  {
    title: "Youth Leadership Summit & Anti-Drug (BKD) Symposium",
    activity_type: "Seminar & Training",
    session_date: "2026-08-16",
    location: "Barangay Tocok SK Hall",
    description: "Educational seminar on drug abuse prevention, mental health peer-support groups, and youth civic engagement.",
    absent: [9, 10], // Angela, Baby
  },
  {
    title: "16th Regular Session — Post-Youth Week Evaluation & Awards",
    activity_type: "Regular Session",
    session_date: "2026-08-30",
    location: "Barangay Tocok SK Hall",
    description: "Liquidation of Youth Week expenses, acknowledging tournament champions, and compiling official photo documentation.",
    absent: [5], // Dannah Mae
  },

  // --- SEPTEMBER 2026 ---
  {
    title: "17th Regular Session — Disaster Risk Reduction Workshop",
    activity_type: "Regular Session",
    session_date: "2026-09-13",
    location: "Barangay Tocok SK Hall",
    description: "Collaboration with the MDRRMO on training youth volunteers in emergency evacuation, flood response, and basic CPR.",
    absent: [6, 8], // Renz, Sandro
  },
  {
    title: "18th Regular Session — Q3 Project Implementation Review",
    activity_type: "Regular Session",
    session_date: "2026-09-27",
    location: "Barangay Tocok SK Hall",
    description: "Status report on the maintenance of SK facilities, community wifi access points, and library resource requests.",
    absent: [9], // Angela
  },

  // --- OCTOBER 2026 ---
  {
    title: "19th Regular Session — 2nd KK General Assembly Prep",
    activity_type: "Regular Session",
    session_date: "2026-10-11",
    location: "Barangay Tocok SK Hall",
    description: "Drafting the agenda and logistical plans for the October Katipunan ng Kabataan Assembly and Youth Transparency Expo.",
    absent: [4], // Dovie
  },
  {
    title: "2nd Katipunan ng Kabataan (KK) Assembly & Transparency Expo",
    activity_type: "Community Activity",
    session_date: "2026-10-18",
    location: "Barangay Tocok Covered Court",
    description: "Semi-annual general meeting with youth constituents to present fund utilization, project milestones, and solicit upcoming proposals.",
    absent: [], // Full attendance!
  },
  {
    title: "20th Regular Session — Preliminary FY 2027 Budget Consultation",
    activity_type: "Regular Session",
    session_date: "2026-10-25",
    location: "Barangay Tocok SK Hall",
    description: "Initial consolidation of youth priority projects gathered from purok consultations for the next fiscal year's investment plan.",
    absent: [7, 8], // Robbie, Sandro
  },

  // --- NOVEMBER 2026 ---
  {
    title: "21st Regular Session — National Children's Month Advocacy",
    activity_type: "Regular Session",
    session_date: "2026-11-08",
    location: "Barangay Tocok SK Hall",
    description: "Co-organizing educational storytelling, anti-bullying workshops, and gift-giving for day-care and elementary pupils.",
    absent: [3], // John David
  },
  {
    title: "22nd Regular Session — Mental Health & Youth Wellness Workshop",
    activity_type: "Regular Session",
    session_date: "2026-11-22",
    location: "Barangay Tocok SK Hall",
    description: "Discussion of youth stress management seminars and planning the December community evaluation activities.",
    absent: [6, 9], // Renz, Angela
  },

  // --- DECEMBER 2026 ---
  {
    title: "23rd Regular Session — FY 2027 Annual Investment Plan (ABYIP)",
    activity_type: "Regular Session",
    session_date: "2026-12-06",
    location: "Barangay Tocok SK Hall",
    description: "Final council reading and resolution passing the 2027 Annual Barangay Youth Investment Program (ABYIP).",
    absent: [10], // Baby
  },
  {
    title: "24th Regular Session — Year-End Evaluation & Youth Gala",
    activity_type: "Regular Session",
    session_date: "2026-12-20",
    location: "Barangay Tocok SK Hall",
    description: "Annual accomplishment review, recognition of outstanding youth volunteers, and ceremonial turnover of annual audit packets.",
    absent: [8], // Sandro
  },
];

async function seed() {
  console.log("Beginning realistic attendance reseeding...");

  // Clear existing attendance records and sessions
  await sql`DELETE FROM attendance_records`;
  await sql`DELETE FROM attendance_sessions`;
  console.log("Cleared old attendance tables.");

  let totalRecordsInserted = 0;

  for (const session of SESSIONS) {
    const [insertedSession] = await sql`
      INSERT INTO attendance_sessions (
        title, activity_type, session_date, location, description, recorded_by, created_at, updated_at
      ) VALUES (
        ${session.title},
        ${session.activity_type},
        ${session.session_date},
        ${session.location},
        ${session.description},
        'SK Secretary Anniecka Reine C. Quinto',
        NOW(),
        NOW()
      )
      RETURNING id
    `;

    const sid = insertedSession.id;
    const absentSet = new Set(session.absent || []);

    for (const uid of OFFICIAL_IDS) {
      const status = absentSet.has(uid) ? "Absent" : "Present";
      await sql`
        INSERT INTO attendance_records (session_id, user_id, status, updated_at)
        VALUES (${sid}, ${uid}, ${status}, NOW())
      `;
      totalRecordsInserted++;
    }
  }

  console.log(`Successfully seeded ${SESSIONS.length} sessions with ${totalRecordsInserted} attendance records!`);

  // Verify and print summary per official
  const stats = await sql`
    SELECT 
      u.id, 
      u.name, 
      u.role,
      COUNT(ar.id) as total_sessions,
      COUNT(CASE WHEN ar.status = 'Present' THEN 1 END) as attended,
      ROUND((COUNT(CASE WHEN ar.status = 'Present' THEN 1 END)::numeric / COUNT(ar.id)::numeric) * 100, 1) as attendance_rate
    FROM users u
    JOIN attendance_records ar ON u.id = ar.user_id
    JOIN attendance_sessions s ON ar.session_id = s.id
    WHERE u.id = ANY(${OFFICIAL_IDS})
    GROUP BY u.id, u.name, u.role
    ORDER BY u.id ASC
  `;

  console.log("\n--- OFFICIAL ATTENDANCE SUMMARY ---");
  for (const row of stats) {
    console.log(`${row.id}. ${row.name} (${row.role}): ${row.attended}/${row.total_sessions} (${row.attendance_rate}%)`);
  }
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
