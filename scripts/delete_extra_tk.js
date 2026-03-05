const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const extrasToDelete = [
    'cozylightdiary',
    'dadventures_au',
    'energracie',
    'gowithjessie',
    'hey.lexi3',
    'leoafterhours1',
    'sophie.miller86',
    'sydneymomdiary',
    'techwithjonny',
    'we2insydney'
];

async function main() {
    // 1. Get account IDs for extras
    const { data: accounts } = await supabase
        .from('tiktok_accounts')
        .select('id, username')
        .in('username', extrasToDelete);

    if (!accounts || accounts.length === 0) {
        console.log('No extra accounts found to delete');
        return;
    }

    console.log(`Found ${accounts.length} accounts to delete`);
    const accountIds = accounts.map(a => a.id);

    // 2. Delete associated tiktok_video_history
    const { error: histErr, count: histCount } = await supabase
        .from('tiktok_video_history')
        .delete({ count: 'exact' })
        .in('account_id', accountIds);
    console.log(`Deleted video history: ${histCount || 0} rows ${histErr ? '(ERROR: ' + histErr.message + ')' : 'OK'}`);

    // 3. Delete associated tiktok_videos
    const { error: vidErr, count: vidCount } = await supabase
        .from('tiktok_videos')
        .delete({ count: 'exact' })
        .in('account_id', accountIds);
    console.log(`Deleted videos: ${vidCount || 0} rows ${vidErr ? '(ERROR: ' + vidErr.message + ')' : 'OK'}`);

    // 4. Delete associated daily_snapshots
    const { error: snapErr, count: snapCount } = await supabase
        .from('daily_snapshots')
        .delete({ count: 'exact' })
        .in('account_id', accountIds);
    console.log(`Deleted snapshots: ${snapCount || 0} rows ${snapErr ? '(ERROR: ' + snapErr.message + ')' : 'OK'}`);

    // 5. Delete account_group_members referencing these accounts
    const { error: grpErr, count: grpCount } = await supabase
        .from('account_group_members')
        .delete({ count: 'exact' })
        .in('account_id', accountIds);
    console.log(`Deleted group members: ${grpCount || 0} rows ${grpErr ? '(ERROR: ' + grpErr.message + ')' : 'OK'}`);

    // 6. Delete the accounts themselves
    const { error: accErr, count: accCount } = await supabase
        .from('tiktok_accounts')
        .delete({ count: 'exact' })
        .in('id', accountIds);
    console.log(`Deleted accounts: ${accCount || 0} rows ${accErr ? '(ERROR: ' + accErr.message + ')' : 'OK'}`);

    // 7. Verify final count
    const { data: remaining, count: totalCount } = await supabase
        .from('tiktok_accounts')
        .select('*', { count: 'exact', head: true });
    console.log(`\nFinal TikTok account count: ${totalCount}`);
}

main().catch(console.error);
