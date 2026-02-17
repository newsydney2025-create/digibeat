
// Use native fetch (Node 18+)
const doFetch = global.fetch;

async function trigger() {
    const secret = 'mytestsecret123';
    const runId = '4JnGWa6tren7oVYKc'; // TikTok run ID from 10:03 AM
    const platform = 'tiktok';

    console.log(`Triggering webhook for ${platform} run ${runId}...`);

    try {
        const response = await doFetch(`http://localhost:3000/api/webhook/apify?platform=${platform}&secret=${secret}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                eventType: 'ACTOR.RUN.SUCCEEDED',
                resource: { id: runId }
            })
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);
    } catch (e) {
        console.error('Error:', e);
    }
}

trigger();
