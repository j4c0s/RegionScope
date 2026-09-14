const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8085');
  await page.waitForTimeout(4000);

  // Open brokers modal
  await page.click('#openBrokersModalBtn');
  await page.waitForTimeout(1000);

  // Fill in sample broker
  await page.fill('#inputHost', 'mqtt.example.com');
  await page.click('#addBrokerForm button[type="submit"]');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/tmp/verification3.png', fullPage: true });
  await browser.close();
  console.log('Verification screenshot saved to /tmp/verification3.png');
})();
