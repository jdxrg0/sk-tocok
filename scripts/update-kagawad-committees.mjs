import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const env = fs.readFileSync('.env.local', 'utf8');
const line = env.split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
const url = line.replace('DATABASE_URL=', '').trim().replace(/^['"]|['"]$/g, '');

const sql = neon(url);

console.log("Fixing and updating Kagawad committee roles in database...");

// Make sure executive officers stay correct
await sql`UPDATE users SET role = 'SK Chairperson' WHERE email = 'a@b.c' OR email = 'chairperson@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'SK Secretary' WHERE email = 'secretary@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'SK Treasurer' WHERE email = 'treasurer@sktocok.gov.ph'`;

// Update Kagawads specifically by email/name
await sql`UPDATE users SET role = 'Education' WHERE email = 'ellares@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'Livelihood' WHERE email = 'aquino@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'Sports' WHERE email = 'ramos@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'Health' WHERE email = 'quinto.sandro@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'GAD' WHERE email = 'picar@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'SK Kagawad' WHERE email = 'barro@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'SK Kagawad' WHERE email = 'serrana@sktocok.gov.ph'`;

const updatedOfficials = await sql`SELECT id, name, email, role FROM users WHERE LOWER(role) NOT IN ('student', 'guest') ORDER BY id ASC`;
console.log("Updated Officials:", updatedOfficials);
