const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.join(__dirname, '..', '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        // Simple manual parsing
        const env = {};
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                if (key && !key.startsWith('#')) env[key] = val;
            }
        });
        return env;
    } catch (e) { return {}; }
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log('Checking IG Thumbnail URLs...');
    const { data: reels } = await supabase
        .from('instagram_reels')
        .select('short_code, thumbnail_url, updated_at')
        .order('updated_at', { ascending: false })
        .limit(3);

    if (!reels || reels.length === 0) {
        console.log('No reels found.');
        return;
    }

    reels.forEach(r => {
        console.log(`\nReel [${r.short_code}] Updated: ${r.updated_at}`);
        console.log(`URL: ${r.thumbnail_url}`);
    });
}

check();
