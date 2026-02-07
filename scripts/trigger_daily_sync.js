const http = require('http');

const data = JSON.stringify({
    platform: 'all',
    is_daily: true // FORCE daily snapshot generation
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

console.log('Triggering OFFICIAL Daily Sync (is_daily: true)...');

const req = http.request(options, (res) => {
    let responseBody = '';

    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log('Response:', responseBody);
        if (res.statusCode === 200) {
            console.log('\nSUCCESS: Daily snapshots have been generated.');
        } else {
            console.log('\nFAILED: Check server logs.');
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(data);
req.end();
