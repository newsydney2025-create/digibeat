
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const baseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1';

async function list() {
    const url = `${baseUrl}/tiktok_accounts?username=ilike.*jessie*&select=username,video_count,id`;

    try {
        const res = await fetch(url, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        const accounts = await res.json();
        console.log(JSON.stringify(accounts, null, 2));
    } catch (err) {
        console.error(err);
    }
}

list();
