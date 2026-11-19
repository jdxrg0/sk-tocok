import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const env = fs.readFileSync('.env.local', 'utf8');
const line = env.split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
const url = line.replace('DATABASE_URL=', '').trim().replace(/^['"]|['"]$/g, '');

const sql = neon(url);
const requests = await sql`SELECT id, tracking_code, student_name, user_id, user_email, status, created_at FROM print_requests LIMIT 10`;
console.log("Print requests sample:", requests);
