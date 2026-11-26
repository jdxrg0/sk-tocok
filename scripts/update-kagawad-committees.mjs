import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const env = fs.readFileSync('.env.local', 'utf8');
const line = env.split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
const url = line.replace('DATABASE_URL=', '').trim().replace(/^['"]|['"]$/g, '');

const sql = neon(url);

console.log("Updating official roles and mobile numbers in database...");

// 1. Executive Officers
await sql`UPDATE users SET role = 'SK Chairperson', contact_number = '+63 945 558 3899' WHERE email = 'chairperson@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'SK Secretary', contact_number = '+63 927 354 2417' WHERE email = 'secretary@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'SK Treasurer', contact_number = '+63 952 455 7268' WHERE email = 'treasurer@sktocok.gov.ph'`;

// 2. Kagawads
await sql`UPDATE users SET role = 'Education' WHERE email = 'ellares@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'Livelihood', contact_number = '+63 993 456 9089' WHERE email = 'aquino@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'Sports', contact_number = '+63 946 728 3104' WHERE email = 'ramos@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'Health' WHERE email = 'quinto.sandro@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'GAD', contact_number = '+63 956 603 0613' WHERE email = 'picar@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'Peace & Order', contact_number = '+63 951 119 4894' WHERE email = 'barro@sktocok.gov.ph'`;
await sql`UPDATE users SET role = 'Environment', contact_number = '+63 945 432 8629' WHERE email = 'serrana@sktocok.gov.ph'`;

const updatedOfficials = await sql`SELECT id, name, email, role, contact_number FROM users WHERE LOWER(role) NOT IN ('student', 'guest') ORDER BY id ASC`;
console.log("Updated Officials:", updatedOfficials);
