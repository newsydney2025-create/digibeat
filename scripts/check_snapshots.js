
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const baseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1';

async function check() {
    const username = 'ave.lightmoments';
    console.log(`Checking snapshots for ${username}`);

    // 1. Get Account
    const accRes = await fetch(`${baseUrl}/tiktok_accounts?username=ilike.*lightmoments*&select=id`, {
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    const accounts = await accRes.json();
    const accountId = accounts[0]?.id;
    if (!accountId) { console.log('Account not found'); return; }
    console.log(`Account ID: ${accountId}`);

    // 2. Get Snapshots
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // 2026-02-12
    console.log(`Date: ${date}`);

    const snapRes = await fetch(`${baseUrl}/daily_snapshots?account_id=eq.${accountId}&date=eq.${date}&select=*`, {
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    const snaps = await snapRes.json();

    console.log(`Found ${snaps.length} snapshots for today:`);
    console.log(JSON.stringify(snaps, null, 2));
}

check();
