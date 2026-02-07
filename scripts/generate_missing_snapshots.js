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

async function run() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
    console.log(`Generating snapshots for date: ${today}`);

    // 1. Get all accounts
    const { data: accounts } = await supabase.from('tiktok_accounts').select('id, username');
    console.log(`Total Accounts: ${accounts.length}`);

    let generated = 0;

    for (const account of accounts) {
        // Check if snapshot exists
        const { data: existing } = await supabase
            .from('daily_snapshots')
            .select('id')
            .eq('account_id', account.id)
            .eq('date', today)
            .single();

        if (!existing) {
            // Calculate totals from videos (recent 20)
            const { data: videos } = await supabase
                .from('tiktok_videos')
                .select('*')
                .eq('account_id', account.id)
                .order('create_time', { ascending: false })
                .limit(20);

            if (videos && videos.length > 0) {
                const totals = videos.reduce((acc, v) => ({
                    views: acc.views + (v.play_count || 0),
                    likes: acc.likes + (v.digg_count || 0),
                    comments: acc.comments + (v.comment_count || 0),
                    shares: acc.shares + (v.share_count || 0)
                }), { views: 0, likes: 0, comments: 0, shares: 0 });

                // Insert snapshot
                const { error } = await supabase.from('daily_snapshots').insert({
                    account_id: account.id,
                    date: today,
                    total_views: totals.views,
                    total_likes: totals.likes,
                    total_comments: totals.comments,
                    total_shares: totals.shares,
                    video_count: videos.length,
                    created_at: new Date().toISOString()
                });

                if (error) console.error(`Failed for ${account.username}:`, error.message);
                else {
                    generated++;
                    // console.log(`Generated for ${account.username}`);
                }
            } else {
                // If no videos, insert zero snapshot to ensure chart point exists
                await supabase.from('daily_snapshots').insert({
                    account_id: account.id,
                    date: today,
                    total_views: 0,
                    total_likes: 0,
                    total_comments: 0,
                    total_shares: 0,
                    video_count: 0,
                    created_at: new Date().toISOString()
                });
                generated++;
            }
        }
    }
    console.log(`Generated ${generated} new snapshots.`);
}

run();
