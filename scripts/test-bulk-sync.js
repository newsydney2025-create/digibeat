
// Use native fetch
const doFetch = global.fetch;

async function trigger() {
    const secret = 'mytestsecret123';
    // Use proven valid runIds from today
    const runs = [
        { platform: 'tiktok', runId: '4JnGWa6tren7oVYKc' },
        { platform: 'instagram', runId: 'ketWTKbMALsGkv1yX' }
    ];

    for (const { platform, runId } of runs) {
        console.log(`Testing Bulk Sync for ${platform} (Run ${runId})...`);
        const start = Date.now();

        try {
            const response = await doFetch(`http://localhost:3000/api/webhook/apify?platform=${platform}&secret=${secret}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventType: 'ACTOR.RUN.SUCCEEDED',
                    resource: { id: runId }
                })
            });

            const text = await response.text();
            const duration = (Date.now() - start) / 1000;
            console.log(`Status: ${response.status}`);
            console.log(`Response: ${text}`);
            console.log(`Duration: ${duration.toFixed(2)}s`);

            if (response.status === 200) {
                console.log('✅ Success!');
            } else {
                console.log('❌ Failed');
            }
        } catch (e) {
            console.error('Error:', e);
        }
        console.log('---');
    }
}

trigger();
