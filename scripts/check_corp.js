const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

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
                if (key && !key.startsWith('#')) env[key] = val;
            }
        });
        return env;
    } catch (e) { return {}; }
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: reels } = await supabase
        .from('instagram_reels')
        .select('thumbnail_url')
        .not('thumbnail_url', 'is', null)
        .limit(1);

    if (reels && reels.length > 0) {
        const url = reels[0].thumbnail_url;
        console.log(`URL: ${url}`);

        https.get(url, (res) => {
            console.log(`CORP Header: ${res.headers['cross-origin-resource-policy']}`);
            console.log(`Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin']}`);
        }).on('error', (e) => {
            console.error(e);
        });
    }
}

check();
