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
                if (key && !key.startsWith('#')) env[key] = val;
            }
        });
        return env;
    } catch (e) { return {}; }
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { count: nullCount } = await supabase
        .from('instagram_reels')
        .select('*', { count: 'exact', head: true })
        .is('thumbnail_url', null);

    const { count: totalCount } = await supabase
        .from('instagram_reels')
        .select('*', { count: 'exact', head: true });

    console.log(`Total Reels: ${totalCount}`);
    console.log(`Reels with NULL thumbnail: ${nullCount}`);

    if (totalCount > 0 && totalCount !== nullCount) {
        const { data: valid } = await supabase.from('instagram_reels').select('thumbnail_url').not('thumbnail_url', 'is', null).limit(1);
        console.log('Sample Valid URL:', valid[0].thumbnail_url);
    }
}

check();
