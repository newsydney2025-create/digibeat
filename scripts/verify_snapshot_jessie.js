
const fs = require('fs');
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const baseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1';
const logFile = 'verify_log.txt';

function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

async function verify() {
    const username = 'gowithjessie';
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // 2026-02-12
    log(`Verifying for ${username} on ${date}`);

    // 1. Get Account (Broader filter)
    const accRes = await fetch(`${baseUrl}/tiktok_accounts?username=ilike.*jessie*&select=id,username`, {
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    const accounts = await accRes.json();
    const account = accounts.find(a => a.username.toLowerCase() === username.toLowerCase());
    const accountId = account?.id;

    if (!accountId) {
        log(`Account not found in list. Found: ${JSON.stringify(accounts.map(a => a.username))}`);
        return;
    }
    log(`Account ID: ${accountId}`);

    // 2. Get Snapshot
    const snapRes = await fetch(`${baseUrl}/daily_snapshots?account_id=eq.${accountId}&date=eq.${date}&select=*`, {
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    const snaps = await snapRes.json();
    const snapshot_gain = snaps[0]?.gain_views || 0;
    log(`Snapshot Gain: ${snapshot_gain}`);

    // 3. Get History
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];

    const histRes = await fetch(`${baseUrl}/tiktok_video_history?account_id=eq.${accountId}&date=eq.${date}&select=video_id,play_count`, {
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    const history = await histRes.json();
    log(`Found ${history.length} history entries for today.`);

    const prevRes = await fetch(`${baseUrl}/tiktok_video_history?account_id=eq.${accountId}&date=eq.${yesterday}&select=video_id,play_count`, {
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    const prevHistory = await prevRes.json();
    const prevMap = new Map();
    if (prevHistory) prevHistory.forEach(h => prevMap.set(h.video_id, h));

    // 4. Sum Gains
    let sumGains = 0;
    log('Detailed Video Gains:');
    for (const h of history) {
        const prev = prevMap.get(h.video_id);
        const gain = Math.max(0, (h.play_count || 0) - (prev?.play_count || 0));
        if (gain > 0) {
            log(`- Video ${h.video_id}: +${gain} (Curr: ${h.play_count}, Prev: ${prev?.play_count || 0})`);
        }
        sumGains += gain;
    }
    log(`Sum of Individual Gains: ${sumGains}`);

    if (Math.abs(snapshot_gain - sumGains) < 2) { // Allow tiny diff? Ints should match.
        log('MATCHED!');
    } else {
        log(`MISMATCH! Snapshot: ${snapshot_gain}, Calculated: ${sumGains}`);
    }
}

verify();
