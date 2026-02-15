
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const { pathToFileURL } = require('url');

const inputPath = path.join(__dirname, '..', 'docs', 'USER_GUIDE.md');
const outputPath = path.join(__dirname, '..', 'docs', 'USER_GUIDE.pdf');

async function convert() {
    console.log('Reading Markdown...');
    const markdown = fs.readFileSync(inputPath, 'utf8');

    // Parse Markdown (Default Renderer)
    console.log('Parsing Markdown...');
    let htmlContent = marked.parse(markdown);

    // Regex replace Mermaid code blocks
    // marked default output: <pre><code class="language-mermaid">...</code></pre>
    // We want: <div class="mermaid">...</div>
    // We also handle potential newlines or different attributes structure if necessary.
    // The previous debug showed [object Object] so we know custom renderer failed.
    // Now we rely on default. Default should give string.

    htmlContent = htmlContent.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
        console.log('Found Mermaid block. Converting to div.');
        return `<div class="mermaid">${code}</div>`;
    });

    // Also try simple 'mermaid' class if language- prefix is omitted by some versions? 
    // But 'marked' usually adds language- prefix.

    // Fix Images
    const docsDir = path.dirname(inputPath);
    htmlContent = htmlContent.replace(/src="([^"]+)"/g, (match, src) => {
        if (!src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('file:') && !src.startsWith('//')) {
            const absPath = path.resolve(docsDir, src);
            const fileUrl = pathToFileURL(absPath).href;
            console.log(`Rewriting image: ${src} -> ${fileUrl}`);
            return `src="${fileUrl}"`;
        }
        return match;
    });

    // Determine Base Path for CSS/Assets
    const baseHref = pathToFileURL(docsDir).href + '/';

    const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <base href="${baseHref}">
        <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
        <script>mermaid.initialize({startOnLoad:true});</script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            
            body { 
                font-family: 'Microsoft YaHei', 'SimHei', 'Inter', sans-serif; 
                line-height: 1.6; 
                color: #334155; 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 40px;
            }
            
            /* Cover Page */
            .cover {
                height: 900px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
                color: white;
                margin: -40px -40px 40px -40px;
                padding: 40px;
                page-break-after: always;
            }
            /* ... same CSS as before ... */
            .cover h1 { border: none; font-size: 4em; margin: 0; text-shadow: 0 4px 6px rgba(0,0,0,0.2); }
            .cover p { font-size: 1.5em; opacity: 0.9; }
            .cover .version { margin-top: 20px; font-family: monospace; opacity: 0.7; }

            h1 { font-size: 2.5em; color: #0f172a; border-bottom: 3px solid #06b6d4; padding-bottom: 10px; margin-top: 2em; }
            h2 { font-size: 1.8em; color: #1e293b; margin-top: 1.5em; display: flex; align-items: center; gap: 10px; }
            h3 { font-size: 1.4em; color: #334155; margin-top: 1.2em; }
            p { margin-bottom: 1em; }
            img { max-width: 100%; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); margin: 20px 0; border: 1px solid #e2e8f0; }
            pre { background: #1e293b; color: #e2e8f0; padding: 20px; border-radius: 8px; overflow-x: auto; }
            blockquote { border-left: 4px solid #06b6d4; background: #f0f9ff; padding: 1rem; border-radius: 0 8px 8px 0; margin: 0; color: #0c4a6e; }
            .mermaid { display: flex; justify-content: center; margin: 30px 0; }
        </style>
    </head>
    <body>
        <div class="cover">
            <h1>DIGIBEAT</h1>
            <p>Social Media Analytics Dashboard</p>
            <p class="version">User Guide v1.0 (CN)</p>
        </div>
        
        ${htmlContent}
    </body>
    </html>
    `;

    // Write Debug HTML
    fs.writeFileSync('debug.html', fullHtml);

    console.log('Launching Puppeteer...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    console.log('Rendering HTML...');
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for Mermaid
    try {
        await page.waitForSelector('.mermaid svg', { timeout: 5000 });
        console.log('Mermaid diagrams rendered.');
    } catch (e) {
        console.log('No Mermaid diagrams found or timeout (check content).');
    }

    console.log('Generating PDF...');
    await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' }
    });

    await browser.close();
    console.log(`PDF created at: ${outputPath}`);
}

convert();
