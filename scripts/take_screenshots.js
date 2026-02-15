
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'docs', 'screenshots');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function run() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: { width: 1440, height: 900 }
    });
    const page = await browser.newPage();

    try {
        console.log('Navigating to Landing Page...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 60000 });

        // Click Start Button
        console.log('Clicking Start...');
        // Button class 'neon-btn'
        const startBtn = await page.waitForSelector('button.neon-btn', { timeout: 5000 });
        await startBtn.click();

        // Wait for Dashboard
        console.log('Waiting for Dashboard...');
        // Wait for ECharts canvas
        await page.waitForSelector('canvas', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 5000)); // Allow animations/Fetch to settle

        console.log('Taking Home screenshot...');
        await page.screenshot({ path: path.join(outputDir, 'home_timeline.png'), fullPage: false });

        // Scroll down for Grid
        console.log('Scrolling...');
        await page.evaluate(() => window.scrollBy(0, 600));
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(outputDir, 'home_grid.png') });

        // Click First Mini Chart
        console.log('Clicking Mini Chart...');
        // Selector: div[id^="mini-chart-"] parent
        // We look for the mini-chart div, then click its parent
        const miniChart = await page.$('div[id^="mini-chart-"]');
        if (miniChart) {
            // Parent is the card
            const card = await miniChart.evaluateHandle(el => el.parentElement);
            await card.click();

            console.log('Waiting for Modal...');
            try {
                await page.waitForSelector('.glass-panel', { timeout: 5000 });
                await new Promise(r => setTimeout(r, 1000));
                await page.screenshot({ path: path.join(outputDir, 'detail_modal.png') });
            } catch (e) {
                console.log('Modal timeout/fail:', e.message);
            }
        } else {
            console.log('No mini chart found to click.');
        }

    } catch (e) {
        console.error('Error during capture:', e);
    } finally {
        await browser.close();
        console.log('Done.');
    }
}

run();
