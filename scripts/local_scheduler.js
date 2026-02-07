const http = require('http');

// Configuration
const TARGET_HOUR = 9; // 09:00 AM
const TARGET_MINUTE = 0;
const TIMEZONE = 'Australia/Sydney';

console.log(`[Local Scheduler] Started. Waiting for ${TARGET_HOUR}:${TARGET_MINUTE.toString().padStart(2, '0')} ${TIMEZONE}...`);

function triggerSync() {
    console.log(`[${new Date().toLocaleString()}] Triggering Daily Sync...`);

    const data = JSON.stringify({
        platform: 'all',
        is_daily: true
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

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log(`[${new Date().toLocaleString()}] Sync Response: ${res.statusCode}`);
            if (res.statusCode !== 200) console.log(body);
        });
    });

    req.on('error', (e) => console.error(`[Error] Sync failed: ${e.message}`));
    req.write(data);
    req.end();
}

// Check time every minute
setInterval(() => {
    const now = new Date();
    // Get time in Sydney
    const sydTimeStr = now.toLocaleString('en-US', { timeZone: TIMEZONE, hour12: false });
    const sydTime = new Date(sydTimeStr);

    const h = sydTime.getHours();
    const m = sydTime.getMinutes();

    // Trigger if it matches target time (and we haven't run it this minute yet - simplistic lock)
    // To prevent multi-trigger, we can just check if second is < 60, but since interval is 60s, it might drift.
    // Better: store "last run date".
}, 60 * 1000);

// Better implementation with state
let lastRunDate = '';

function checkTime() {
    const now = new Date();
    const sydneyDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));

    const currentHour = sydneyDate.getHours();
    const currentMinute = sydneyDate.getMinutes();
    const currentDateStr = sydneyDate.toDateString();

    // Check if it's 9:00 AM and we haven't run today
    if (currentHour === TARGET_HOUR && currentMinute === TARGET_MINUTE && lastRunDate !== currentDateStr) {
        triggerSync();
        lastRunDate = currentDateStr;
    }
}

// Run immediately on start if it's currently 9:00 AM (edge case) or just start loop
setInterval(checkTime, 30 * 1000); // Check every 30 seconds
checkTime(); // Initial check

console.log('Scheduler is running. Do not close this window.');
