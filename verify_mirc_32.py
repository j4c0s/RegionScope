import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 850})
        await page.goto("http://localhost:8085")
        await page.wait_for_selector("#pktLog")
        await asyncio.sleep(2)
        await page.screenshot(path="/home/jules/verification/mirc_32_feed.png")
        print("Screenshot captured at /home/jules/verification/mirc_32_feed.png")
        await browser.close()

asyncio.run(main())
