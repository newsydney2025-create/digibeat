
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const baseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1';

async function check() {
    const username = 'gowithjessie5';

    // 1. Get Account ID
    // filter=username.ilike.gowithjessie5
    const accountUrl = `${baseUrl}/tiktok_accounts?username=ilike.${username}&select=id,video_count,username`;

    try {
        const accRes = await fetch(accountUrl, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        const accounts = await accRes.json();

        if (!accounts || accounts.length === 0) {
            console.log(`Account ${username} not found.`);
            return;
        }

        const account = accounts[0];
        console.log(`Account: ${account.username} (ID: ${account.id})`);
        console.log(`Reported Video Count: ${account.video_count}`);

        // 2. Count History
        // HEAD request to get count
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // 2026-02-12
        const historyUrl = `${baseUrl}/tiktok_video_history?account_id=eq.${account.id}&date=eq.${today}&select=*`;

        const histRes = await fetch(historyUrl, {
            method: 'HEAD',
            headers: {
                'apikey': key,
                'Authorization': 'Bearer ' + key,
                'Prefer': 'count=exact'
            }
        });

        const range = histRes.headers.get('content-range');
        // Content-Range: 0-999/1234  or */1234
        console.log(`Content-Range Header: ${range}`);

    } catch (err) {
        console.error(err);
    }
}

check();
