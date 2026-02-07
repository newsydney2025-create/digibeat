const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.join(__dirname, '..', '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                if (key && val && !key.startsWith('#')) {
                    env[key] = val;
                }
            }
        });
        return env;
    } catch (e) {
        return {};
    }
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log('Checking IG Reels Thumbnails...');
    const { data: reels, error } = await supabase
        .from('instagram_reels')
        .select('short_code, thumbnail_url, url')
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (reels.length === 0) {
        console.log('No reels found.');
    } else {
        reels.forEach(r => {
            console.log(`\nReel [${r.short_code}]:`);
            console.log(`  Thumbnail: ${r.thumbnail_url ? r.thumbnail_url.substring(0, 100) + '...' : 'NULL'}`);
            console.log(`  URL: ${r.url}`);
        });
    }
}

check();
