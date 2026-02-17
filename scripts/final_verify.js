
const fs = require('fs');
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const baseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1';
const logFile = 'final_verify_log.txt';

function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

async function verify() {
    const url = `${baseUrl}/tiktok_accounts?username=ilike.*lightmoments*&select=id,username,video_count`;

    try {
        const accRes = await fetch(url, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
        const accounts = await accRes.json();

        log(`Accounts found matching *lightmoments*: ${accounts.length}`);
        accounts.forEach(a => log(`${a.username}: ${a.id}`));

        const target = accounts.find(a => a.username === 'ave.lightmoments') || accounts[0];
        if (!target) { log('No target account found.'); return; }

        log(`Using account: ${target.username} (${target.id})`);

        const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // 2026-02-12
        const snapRes = await fetch(`${baseUrl}/daily_snapshots?account_id=eq.${target.id}&date=eq.${date}&select=*`, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        const snaps = await snapRes.json();
        const snapshot_gain = snaps[0]?.gain_views || 0;
        log(`Snapshot Gain: ${snapshot_gain}`);

        const d = new Date(date);
        d.setDate(d.getDate() - 1);
        const yesterday = d.toISOString().split('T')[0];

        const histRes = await fetch(`${baseUrl}/tiktok_video_history?account_id=eq.${target.id}&date=eq.${date}&select=video_id,play_count`, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        const history = await histRes.json();

        const prevRes = await fetch(`${baseUrl}/tiktok_video_history?account_id=eq.${target.id}&date=eq.${yesterday}&select=video_id,play_count`, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        const prevHistory = await prevRes.json();
        const prevMap = new Map();
        if (prevHistory) prevHistory.forEach(h => prevMap.set(h.video_id, h));

        let sum = 0;
        for (const h of history) {
            const prev = prevMap.get(h.video_id);
            const gain = Math.max(0, (h.play_count || 0) - (prev?.play_count || 0));
            sum += gain;
            if (gain > 0) log(`Video ${h.video_id}: +${gain} (Curr: ${h.play_count}, Prev: ${prev?.play_count || 0})`);
        }
        log(`Calculated Sum: ${sum}`);

        if (snapshot_gain === sum) log('MATCHED');
        else log('MISMATCH');

    } catch (err) {
        log('Error: ' + err.message);
    }
}

verify();
