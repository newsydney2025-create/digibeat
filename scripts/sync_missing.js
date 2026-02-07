const http = require('http');

const missing = [
    'jacko.explores',
    'storiesof.ehtanella',
    'iris.in.syd', // Note: Case sensitivity might be an issue, normalizing
    'mayathompson01',
    'cozylightdairy',
    'sophiessydneydiary'
];

// Normalize to match what the API expects (API handles array)
// But wait, the API reads from SCRAPING_TARGETS usually?
// No, the new sync logic reads from SCRAPING_TARGETS *server side*.
// So running 'platform: tiktok' again SHOULD pick them up if they are in the file.
// But they failed last time.
// Let's force them by temporarily creating a dedicated script that calls the internal function? 
// No, can't easily do that.
// The best way is to call the API again.
// The API loop has try/catch blocks.

const data = JSON.stringify({
    platform: 'tiktok',
    is_daily: false
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/sync',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Retrying TikTok Sync (Force for missing)...');
// Note: This will re-scan ALL 44 because the API implementation scans the whole list.
// That's fine, it will skip existing ones if they haven't changed much, or update them.
// The key is that the previous run might have timed out or hit a transient error.

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('Response:', body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
