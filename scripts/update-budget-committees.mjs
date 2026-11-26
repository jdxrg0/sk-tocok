import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const env = fs.readFileSync('.env.local', 'utf8');
const line = env.split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
const url = line.replace('DATABASE_URL=', '').trim().replace(/^['"]|['"]$/g, '');
const sql = neon(url);

console.log("🔄 Updating categories and budget allocations in Neon database...");

// 1. Update existing expenses to use the correct committee names
// Merge "Environmental Protection" & "Disaster Preparedness" -> "Environmental Protection & Disaster Preparedness"
await sql`
  UPDATE expenses 
  SET category = 'Environmental Protection & Disaster Preparedness'
  WHERE category = 'Environmental Protection' OR category = 'Disaster Preparedness'
`;

// "Health & Anti-Drug Abuse" -> "Health"
await sql`
  UPDATE expenses 
  SET category = 'Health'
  WHERE category = 'Health & Anti-Drug Abuse'
`;

// 2. Clear old categories and replace with the 8 statutory committees with non-duplicated colors
await sql`DELETE FROM categories`;

const newCategories = [
  {
    name: "Education & Culture",
    description: "Free student printing program, school supplies, scholarships, academic excellence awards & cultural heritage activities",
    color: "blue",
    allocated_budget: 160000
  },
  {
    name: "Youth Employment & Livelihood",
    description: "Youth livelihood seminars, entrepreneurship grants, skills training, TESDA linkages & employment assistance",
    color: "orange",
    allocated_budget: 60000
  },
  {
    name: "Sports Development",
    description: "Inter-Purok basketball & volleyball leagues, sports equipment, athletic tournaments & youth sports clinics",
    color: "amber",
    allocated_budget: 180000
  },
  {
    name: "Health",
    description: "Youth mental health advocacy, teenage pregnancy prevention, medical-dental missions & nutrition seminars",
    color: "rose",
    allocated_budget: 80000
  },
  {
    name: "Environmental Protection & Disaster Preparedness",
    description: "Clean-up drives, tree planting, river protection, ecological waste management, emergency first-aid kits & DRRM training",
    color: "emerald",
    allocated_budget: 150000
  },
  {
    name: "Gender and Development (GAD)",
    description: "Gender sensitivity seminars, anti-VAWC campaigns, young women empowerment, Pride month youth forums & reproductive health",
    color: "purple",
    allocated_budget: 50000
  },
  {
    name: "Peace and Order & Anti-Drug Abuse",
    description: "BADAC youth desk, drug abuse resistance education (DARE), anti-bullying forums, curfew monitoring & juvenile delinquency prevention",
    color: "cyan",
    allocated_budget: 50000
  },
  {
    name: "Administration & Training",
    description: "SK Council mandatory capability training, leadership seminars, secretariat logistics, accounting software & council governance",
    color: "indigo",
    allocated_budget: 120000
  }
];

for (const cat of newCategories) {
  await sql`
    INSERT INTO categories (name, description, color, allocated_budget)
    VALUES (${cat.name}, ${cat.description}, ${cat.color}, ${cat.allocated_budget})
  `;
}

console.log("✅ Updated categories inserted successfully.");

const verifiedCategories = await sql`
  SELECT 
    c.id, 
    c.name, 
    c.color, 
    c.allocated_budget, 
    COALESCE(SUM(e.amount), 0) AS total_spent, 
    COUNT(e.id) AS expense_count
  FROM categories c
  LEFT JOIN expenses e ON e.category = c.name
  GROUP BY c.id, c.name, c.color, c.allocated_budget
  ORDER BY c.id ASC
`;

console.log("Verified Categories in DB:\n", JSON.stringify(verifiedCategories, null, 2));

const totalBudget = verifiedCategories.reduce((sum, c) => sum + Number(c.allocated_budget), 0);
console.log(`Total Allocated Budget: ₱${totalBudget.toLocaleString()} (Target: ₱850,000)`);
