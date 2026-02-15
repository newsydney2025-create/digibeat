
const doFetch = global.fetch;

async function check() {
    try {
        const res = await doFetch('http://localhost:3000/api/debug/env');
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

check();
