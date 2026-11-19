// Capture only the public registration menu in a fresh, signed-out browser.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
const local = path => fileURLToPath(new URL(path, import.meta.url));
const browser = await chromium.launch();
try {
    const page = await browser.newPage({viewport:{width:1280,height:820},deviceScaleFactor:1});
    await page.goto('https://regssb.sis.clemson.edu/StudentRegistrationSsb/ssb/registration');
    const menu = page.locator('#landing-paths');
    await page.locator('#classSearchLink .title').filter({hasText:'Browse Classes'}).waitFor();
    const out = local('./assets/');
    await mkdir(out,{recursive:true});
    await menu.screenshot({path:out+'hub-before.png'});
    await page.addStyleTag({path:local('../../banner-restyler.css')});
    await page.addScriptTag({path:local('../../banner-restyler.js')});
    await menu.screenshot({path:out+'hub-after.png'});
} finally { await browser.close(); }
