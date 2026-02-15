
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const baseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1/';

async function check() {
    try {
        const res = await fetch(baseUrl, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        // Root returns OAS (Swagger) JSON description of API
        if (res.ok) {
            const data = await res.json();
            // Log keys (definitions)
            console.log('Definitions:', Object.keys(data.definitions || {}));
            console.log('Paths:', Object.keys(data.paths || {}));
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
