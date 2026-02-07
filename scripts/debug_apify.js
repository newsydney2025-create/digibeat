const https = require('https');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'debug_apify_log.txt');
const DATA_FILE = path.join(__dirname, 'debug_apify_data.json');

function log(msg) {
    const time = new Date().toISOString();
    const line = `[${time}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

function loadEnv() {
    try {
        const envPath = path.join(__dirname, '..', '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                if (key && val && !key.startsWith('#')) {
                    env[key] = val;
                }
            }
        });
        return env;
    } catch (e) {
        log('Failed to load .env.local: ' + e);
        return {};
    }
}

const env = loadEnv();
const API_TOKEN = env.APIFY_API_TOKEN;

if (!API_TOKEN) {
    log('ERROR: APIFY_API_TOKEN not found in .env.local');
    process.exit(1);
}

log('Token loaded: ' + API_TOKEN.substring(0, 5) + '...');

const TARGET_URL = 'https://www.instagram.com/hellen_nguyen01/';

function httpsRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, data: json });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function run() {
    log(`Starting scraper for ${TARGET_URL} using directUrls...`);

    const startUrl = `https://api.apify.com/v2/acts/shu8hvrXbJbY3Eb9W/runs?token=${API_TOKEN}`;
    const payload = JSON.stringify({
        directUrls: [TARGET_URL],
        resultsType: 'posts',
        resultsLimit: 5,
        searchLimit: 1
    });

    try {
        const startRes = await httpsRequest(startUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, payload);

        if (startRes.statusCode !== 201) {
            log('Failed to start run: ' + JSON.stringify(startRes));
            return;
        }

        const runId = startRes.data.data.id;
        log('Run started with ID: ' + runId);

        let status = 'RUNNING';
        while (status === 'RUNNING' || status === 'READY') {
            await new Promise(r => setTimeout(r, 5000));
            const statusRes = await httpsRequest(`https://api.apify.com/v2/actor-runs/${runId}?token=${API_TOKEN}`, { method: 'GET' });
            status = statusRes.data.data.status;
            log('Status: ' + status);
        }

        if (status === 'SUCCEEDED') {
            const itemsRes = await httpsRequest(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${API_TOKEN}`, { method: 'GET' });
            log('Items found: ' + itemsRes.data.length);
            fs.writeFileSync(DATA_FILE, JSON.stringify(itemsRes.data, null, 2));
            log('Data saved to ' + DATA_FILE);

            if (itemsRes.data.length > 0) {
                log('First item sample: ' + JSON.stringify(itemsRes.data[0]).substring(0, 200) + '...');
            }

        } else {
            const logRes = await httpsRequest(`https://api.apify.com/v2/actor-runs/${runId}/log?token=${API_TOKEN}`, { method: 'GET' });
            log('Run Failed/Aborted. Log excerpt: ' + JSON.stringify(logRes.data).substring(0, 500));
        }

    } catch (e) {
        log('Error: ' + e);
    }
}

run();
