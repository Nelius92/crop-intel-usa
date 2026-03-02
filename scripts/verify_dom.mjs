import puppeteer from 'puppeteer';

(async () => {
    console.log("Launching headless browser to inspect DOM at http://localhost:5174/ ...");
    const browser = await puppeteer.launch();
    try {
        const page = await browser.newPage();

        // Attempt connections on common Vite ports
        const ports = [5174, 5173, 5175];
        let connected = false;
        for (const port of ports) {
            try {
                await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0', timeout: 10000 });
                console.log(`Successfully connected to http://localhost:${port}/`);
                connected = true;
                break;
            } catch (e) {
                console.log(`Port ${port} not active, trying next...`);
            }
        }

        if (!connected) {
            console.error("Could not connect to the local dev server.");
            process.exit(1);
        }

        // Wait for the map to mount
        await page.waitForSelector('.mapboxgl-canvas', { timeout: 10000 });
        console.log("✅ Mapbox canvas successfully found in the DOM!");

        // Inspect the DOM for specific elements
        const domInfo = await page.evaluate(() => {
            return {
                title: document.title,
                hasMapbox: document.querySelector('.mapboxgl-map') !== null,
                canvasCount: document.querySelectorAll('.mapboxgl-canvas').length,
                hasControls: document.querySelector('.mapboxgl-control-container') !== null,
                bodyHtmlSnippet: document.body.innerHTML.substring(0, 150) + "..."
            };
        });

        console.log("DOM Inspection Results:", JSON.stringify(domInfo, null, 2));

    } catch (error) {
        console.error("Error inspecting DOM:", error);
    } finally {
        await browser.close();
    }
})();
