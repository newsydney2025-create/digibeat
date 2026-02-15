
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const baseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1';

async function check() {
    const url = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1/information_schema/tables?table_name=eq.daily_snapshots&select=*';
    // Note: REST API might not expose information_schema directly unless configured.
    // But worth a try with service_role.

    try {
        const res = await fetch(url, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        if (res.ok) {
            const data = await res.json();
            console.table(data);
        } else {
            console.log(`Error: ${res.status} ${res.statusText}`);
            const txt = await res.text();
            console.log(txt);
        }
    } catch (e) {
        console.error(e);
    }
}

check();
