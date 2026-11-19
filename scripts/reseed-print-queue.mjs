import { neon } from "@neondatabase/serverless";
import fs from "fs";

// Load environment variables
if (fs.existsSync(".env.local")) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env.local");
  } else {
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
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("🧹 Clearing existing print requests from print_requests table...");
  const deleteResult = await sql`DELETE FROM print_requests RETURNING id`;
  console.log(`✅ Cleared ${deleteResult.length} old print request record(s).`);

  console.log("🌱 Repopulating print queue with realistic SK student tickets...");

  // Reset sequence if possible so IDs stay clean
  try {
    await sql`ALTER SEQUENCE print_requests_id_seq RESTART WITH 1`;
  } catch (err) {
    console.log("Note: Sequence reset skipped:", err.message);
  }

  // Realistic sample requests spaced across the last 48 hours
  // Ordered from oldest to newest so newest gets highest ID and appears at the top
  const now = Date.now();
  const minutesAgo = (m) => new Date(now - m * 60 * 1000).toISOString();

  const printJobs = [
    {
      tracking_code: "SK679",
      student_name: "Danielle Cruz",
      contact_number: "0915-778-2231",
      facebook_name: "Danielle Cruz",
      purok: "Purok 4 (Sitio Buatan)",
      school: "SFNHS",
      grade_level: "Grade 12 - ABM",
      file_name: "Business_Finance_Worksheet_Q2.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 524288,
      print_type: "Black & White",
      paper_size: "A4",
      copies: 1,
      page_range: "Pages 1-4",
      notes: "Accounting worksheets for prelim examination.",
      pickup_station: "Purok 5 Station — Sitio Sapdaan (SK Treasurer)",
      is_urgent: 0,
      status: "Completed",
      admin_notes: "Successfully claimed by student with student ID.",
      created_at: minutesAgo(2880), // 2 days ago
      picked_up_at: minutesAgo(1440),
    },
    {
      tracking_code: "SK415",
      student_name: "Jasmine Rose De Vera",
      contact_number: "0928-334-9102",
      facebook_name: "Jasmine De Vera",
      purok: "Purok 3 (Sitio Boquig)",
      school: "MNHS",
      grade_level: "Grade 9 - Molave",
      file_name: "Araling_Panlipunan_Project_Report.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 1153433,
      print_type: "Colored",
      paper_size: "Letter (Short)",
      copies: 1,
      page_range: "All pages (1-7)",
      notes: "AP project on Southeast Asian cultures.",
      pickup_station: "Purok 1 Station — Sitio Bio, Sitio Sagur, Sitio Baybay (SK Chairperson)",
      is_urgent: 0,
      status: "Completed",
      admin_notes: "Claimed at SK Chairperson station.",
      created_at: minutesAgo(2400),
      picked_up_at: minutesAgo(960),
    },
    {
      tracking_code: "SK890",
      student_name: "Adrian Luis Soriano",
      contact_number: "0919-445-6677",
      facebook_name: "Adrian Soriano",
      purok: "Purok 5 (Sitio Sapdaan)",
      school: "PCLU",
      grade_level: "3rd Year BS Civil Engineering",
      file_name: "Structural_Analysis_ProblemSet_4.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 2202009,
      print_type: "Black & White",
      paper_size: "Letter (Short)",
      copies: 1,
      page_range: "All pages (1-16)",
      notes: "Engineering problem set calculation sheets.",
      pickup_station: "Purok 5 Station — Sitio Sapdaan (SK Treasurer)",
      is_urgent: 0,
      status: "Completed",
      admin_notes: "Picked up at Sitio Sapdaan desk.",
      created_at: minutesAgo(1920),
      picked_up_at: minutesAgo(600),
    },
    {
      tracking_code: "SK263",
      student_name: "Sophia Isabel Morales",
      contact_number: "0930-112-4455",
      facebook_name: "Sophia Morales",
      purok: "Purok 1 (Sitio Bio, Sitio Sagur, Sitio Baybay)",
      school: "SFNHS",
      grade_level: "Grade 10 - Rizal",
      file_name: "Math10_Quarterly_Assessment_Review.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 655360,
      print_type: "Black & White",
      paper_size: "Letter (Short)",
      copies: 1,
      page_range: "Pages 1-5",
      notes: "Reviewer for tomorrow's second quarter exam.",
      pickup_station: "Purok 1 Station — Sitio Bio, Sitio Sagur, Sitio Baybay (SK Chairperson)",
      is_urgent: 0,
      status: "Ready for Pickup",
      admin_notes: "Printed on Desk 1. Ready at SK Chairperson counter.",
      created_at: minutesAgo(720),
      picked_up_at: null,
    },
    {
      tracking_code: "SK551",
      student_name: "Kevin Troy Aquino",
      contact_number: "0945-881-2299",
      facebook_name: "Kevin Aquino",
      purok: "Purok 2 (Centro)",
      school: "UL",
      grade_level: "2nd Year BS Customs Administration",
      file_name: "Tariff_and_Customs_Code_Summary.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 798720,
      print_type: "Black & White",
      paper_size: "Legal (Long)",
      copies: 1,
      page_range: "All pages (1-14)",
      notes: "Double-sided if possible po. Maraming salamat SK!",
      pickup_station: "Purok 1 Station — Sitio Bio, Sitio Sagur, Sitio Baybay (SK Chairperson)",
      is_urgent: 0,
      status: "Ready for Pickup",
      admin_notes: "Printed and bundled in envelope. Claim at Purok 1 station.",
      created_at: minutesAgo(540),
      picked_up_at: null,
    },
    {
      tracking_code: "SK736",
      student_name: "Maria Elena Villanueva",
      contact_number: "0917-234-8890",
      facebook_name: "Elena Villanueva",
      purok: "Purok 7 (Sitio Torres)",
      school: "UDD",
      grade_level: "4th Year BS Nursing",
      file_name: "Community_Health_Nursing_DutyLog.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 1572864,
      print_type: "Colored",
      paper_size: "A4",
      copies: 2,
      page_range: "All pages (1-6)",
      notes: "Clinical duty requirements with hospital color headers.",
      pickup_station: "Purok 5 Station — Sitio Sapdaan (SK Treasurer)",
      is_urgent: 0,
      status: "Ready for Pickup",
      admin_notes: "Ready in Tray 3 at Sitio Sapdaan station.",
      created_at: minutesAgo(420),
      picked_up_at: null,
    },
    {
      tracking_code: "SK182",
      student_name: "Joshua Emmanuel Cayabyab",
      contact_number: "0998-654-3210",
      facebook_name: "Joshua Cayabyab",
      purok: "Purok 6 (Sitio Cabanlig, Sitio Biek)",
      school: "UPANG",
      grade_level: "1st Year BS Criminology",
      file_name: "Criminal_Law_Book1_Reviewer.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 3250585,
      print_type: "Black & White",
      paper_size: "Letter (Short)",
      copies: 1,
      page_range: "Pages 1-25",
      notes: "Midterm exam reviewer. Need for evening study group.",
      pickup_station: "Purok 5 Station — Sitio Sapdaan (SK Treasurer)",
      is_urgent: 0,
      status: "Printing In Progress",
      admin_notes: "Page 14/25 currently printing on Epson L3210.",
      created_at: minutesAgo(280),
      picked_up_at: null,
    },
    {
      tracking_code: "SK478",
      student_name: "Bea Clarisse Ramos",
      contact_number: "0921-998-3344",
      facebook_name: "Bea Ramos",
      purok: "Purok 3 (Sitio Boquig)",
      school: "SFNHS",
      grade_level: "Grade 12 - HUMSS",
      file_name: "Creative_Nonfiction_Anthology.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 942080,
      print_type: "Black & White",
      paper_size: "Legal (Long)",
      copies: 1,
      page_range: "Pages 1-8",
      notes: "Urgent deadline for 1:30 PM class today. Thank you so much!",
      pickup_station: "Purok 1 Station — Sitio Bio, Sitio Sagur, Sitio Baybay (SK Chairperson)",
      is_urgent: 1,
      status: "Printing In Progress",
      admin_notes: "Urgent request prioritized. In progress.",
      created_at: minutesAgo(180),
      picked_up_at: null,
    },
    {
      tracking_code: "SK924",
      student_name: "Christian John Fernandez",
      contact_number: "0909-555-7890",
      facebook_name: "CJ Fernandez",
      purok: "Purok 4 (Sitio Buatan)",
      school: "DMMMSU",
      grade_level: "2nd Year BS Agriculture",
      file_name: "Agronomy_Field_Report_Module3.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 1887436,
      print_type: "Black & White",
      paper_size: "Letter (Short)",
      copies: 1,
      page_range: "All pages (1-12)",
      notes: "For Friday lab submission.",
      pickup_station: "Purok 5 Station — Sitio Sapdaan (SK Treasurer)",
      is_urgent: 0,
      status: "Pending Review",
      admin_notes: null,
      created_at: minutesAgo(120),
      picked_up_at: null,
    },
    {
      tracking_code: "SK305",
      student_name: "Princess Nicole Garcia",
      contact_number: "0908-123-9876",
      facebook_name: "Princess Garcia",
      purok: "Purok 5 (Sitio Sapdaan)",
      school: "MNHS",
      grade_level: "Grade 8 - Diamond",
      file_name: "Science_Quarter2_Portfolio_Garcia.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 870400,
      print_type: "Black & White",
      paper_size: "Letter (Short)",
      copies: 1,
      page_range: "All pages (1-10)",
      notes: "Science module compilation portfolio.",
      pickup_station: "Purok 5 Station — Sitio Sapdaan (SK Treasurer)",
      is_urgent: 0,
      status: "Pending Review",
      admin_notes: null,
      created_at: minutesAgo(75),
      picked_up_at: null,
    },
    {
      tracking_code: "SK619",
      student_name: "Mark Kenneth Datuin",
      contact_number: "0920-555-1234",
      facebook_name: "Mark Datuin",
      purok: "Purok 1 (Sitio Bio, Sitio Sagur, Sitio Baybay)",
      school: "PSU",
      grade_level: "3rd Year BSIT",
      file_name: "Capstone_Project_Proposal_Draft.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 2516582,
      print_type: "Colored",
      paper_size: "Letter (Short)",
      copies: 1,
      page_range: "Pages 1-15",
      notes: "Colored charts on pages 8-12 please.",
      pickup_station: "Purok 1 Station — Sitio Bio, Sitio Sagur, Sitio Baybay (SK Chairperson)",
      is_urgent: 0,
      status: "Pending Review",
      admin_notes: null,
      created_at: minutesAgo(35),
      picked_up_at: null,
    },
    {
      tracking_code: "SK842",
      student_name: "Angelica May Bautista",
      contact_number: "0917-888-9901",
      facebook_name: "Angelica Bautista",
      purok: "Purok 2 (Centro)",
      school: "SFNHS",
      grade_level: "Grade 11 - STEM",
      file_name: "Practical_Research_Chapter1-3_Final.pdf",
      file_path: "/uploads/prints/sample-doc.pdf",
      file_size: 1258291,
      print_type: "Black & White",
      paper_size: "A4",
      copies: 2,
      page_range: "All pages (1-18)",
      notes: "Needed for research defense tomorrow 8:00 AM. Thank you SK Tocok!",
      pickup_station: "Purok 1 Station — Sitio Bio, Sitio Sagur, Sitio Baybay (SK Chairperson)",
      is_urgent: 1,
      status: "Pending Review",
      admin_notes: null,
      created_at: minutesAgo(10),
      picked_up_at: null,
    },
  ];

  for (const job of printJobs) {
    await sql`
      INSERT INTO print_requests (
        tracking_code,
        student_name,
        contact_number,
        facebook_name,
        purok,
        school,
        grade_level,
        file_name,
        file_path,
        file_size,
        print_type,
        paper_size,
        copies,
        page_range,
        notes,
        pickup_station,
        is_urgent,
        status,
        admin_notes,
        picked_up_at,
        created_at,
        updated_at
      ) VALUES (
        ${job.tracking_code},
        ${job.student_name},
        ${job.contact_number},
        ${job.facebook_name},
        ${job.purok},
        ${job.school},
        ${job.grade_level},
        ${job.file_name},
        ${job.file_path},
        ${job.file_size},
        ${job.print_type},
        ${job.paper_size},
        ${job.copies},
        ${job.page_range},
        ${job.notes},
        ${job.pickup_station},
        ${job.is_urgent},
        ${job.status},
        ${job.admin_notes},
        ${job.picked_up_at},
        ${job.created_at},
        ${job.created_at}
      )
    `;
    console.log(`  + Seeded [${job.tracking_code}] - ${job.student_name} (${job.status})`);
  }

  const finalCount = await sql`SELECT COUNT(*) as count FROM print_requests`;
  console.log(`\n🎉 Successfully cleared and repopulated print_requests! Total active tickets: ${finalCount[0].count}`);
}

main().catch((err) => {
  console.error("❌ Reseeding failed:", err);
  process.exit(1);
});
