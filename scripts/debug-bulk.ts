
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
// Use relative path to lib/sync
import { processTikTokDataBulk } from '../src/lib/sync';

// Load .env.local manually since dotenv is not improved
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    console.log('Loading .env.local...');
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            if (key && val && !key.startsWith('#')) {
                process.env[key] = val;
            }
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars: URL or KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Testing processTikTokDataBulk with empty array...');
    try {
        // @ts-ignore
        await processTikTokDataBulk(supabase, [], true);
        console.log('✅ Success! Function is importable and runnable.');
    } catch (e) {
        console.error('❌ Error executing function:', e);
    }
}

run();
