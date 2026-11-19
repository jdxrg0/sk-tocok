import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const env = fs.readFileSync('.env.local', 'utf8');
const line = env.split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
const url = line.replace('DATABASE_URL=', '').trim().replace(/^['"]|['"]$/g, '');

const sql = neon(url);
const users = await sql`SELECT id, name, email, role, auth_provider, google_id, created_at FROM users WHERE id IN (11, 12)`;
console.log(JSON.stringify(users, null, 2));
