import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd(), '..');
const screenshots = path.join(root, 'docs', 'screenshots');
fs.mkdirSync(screenshots, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
const chatRequests = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('request', (request) => { if (/\/chat/.test(request.url())) chatRequests.push({ method: request.method(), url: request.url() }); });

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, passed: Boolean(ok), detail });

await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
const demoButton = page.getByRole('button', { name: /এক ক্লিকে ডেমো প্রবেশ|Demo|এক্সপ্লোর/i }).first();
await demoButton.click();
await page.waitForURL(/\/workspace/, { timeout: 15000 });
await page.waitForTimeout(2500);

const homeBody = await page.locator('body').innerText();
check('homepage loaded', /আমাদের কৃষি|Amader Krishi/i.test(homeBody));
check('fake metrics absent', !['82%', '12%', '94%', '৳85/kg', '৮২%', '১২%', '৯৪%', '৳৮৫/কেজি'].some((value) => homeBody.includes(value)));
check('neutral location fallback or real farm', /খামার নির্বাচন করুন|Select your farm/.test(homeBody) || /,/ .test(homeBody));

const logoImages = page.locator('img[src="/amader_krishi_OFFICIAL_LOGO.png"]');
const visibleLogoImages = page.locator('img[src="/amader_krishi_OFFICIAL_LOGO.png"]:visible');
await visibleLogoImages.first().waitFor({ state: 'visible', timeout: 10000 });
const logoCount = await visibleLogoImages.count();
const logoLoaded = await visibleLogoImages.evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0));
check('official logo renders', logoCount > 0 && logoLoaded, `count=${logoCount}`);

await page.screenshot({ path: path.join(screenshots, 'ui_r11_home_desktop_1440.png'), fullPage: false });
check('desktop screenshot', fs.existsSync(path.join(screenshots, 'ui_r11_home_desktop_1440.png')));
check('desktop no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

const englishButton = page.getByRole('button', { name: /English/i }).first();
if (await englishButton.count()) {
  await englishButton.click();
  await page.waitForTimeout(400);
  check('English switch', /Open dashboard|Historical market price/.test(await page.locator('body').innerText()));
  const banglaButton = page.getByRole('button', { name: /বাংলা/i }).first();
  await banglaButton.click();
  await page.waitForTimeout(400);
  check('Bangla switch', /মাটির স্বাস্থ্য/.test(await page.locator('body').innerText()));
}

const newChat = page.getByRole('button', { name: /নতুন চ্যাট|New Chat/i }).first();
if (await newChat.count()) {
  await newChat.click();
  await page.waitForTimeout(800);
}

const input = page.getByPlaceholder(/Ask anything|যেকোনো প্রশ্ন/i).first();
await input.waitFor({ state: 'visible', timeout: 10000 });
await input.fill('ধানের মৌসুমি পরিচর্যা সংক্ষেপে বলুন');
await input.press('Enter');
await page.waitForTimeout(4000);
check('real chat API requested', chatRequests.some((item) => item.url.includes('/chat') && item.method === 'POST'), JSON.stringify(chatRequests));
check('homepage navigated to chat', /tab=chat/.test(page.url()) || !/কৃষি পরামর্শ/ .test(await page.locator('body').innerText()));

await page.screenshot({ path: path.join(screenshots, 'ui_r11_chat_desktop_1440.png'), fullPage: false });

await page.goto('http://127.0.0.1:5173/workspace', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const advancedToggle = page.getByRole('button', { name: /৩৬০° প্ল্যাটফর্ম ফিচার|360° MORE MODULES/i }).first();
if (await advancedToggle.count()) await advancedToggle.click();
await page.waitForTimeout(300);
const modelConsole = page.getByRole('button', { name: /৭টি AI মডেল কনসোল|7 AI Models Console/i }).first();
check('seven AI model console accessible in sidebar', await modelConsole.count() > 0);
if (await modelConsole.count()) await modelConsole.click();
await page.waitForTimeout(500);

await page.goto('http://127.0.0.1:5173/workspace?tab=dashboard', { waitUntil: 'networkidle' });
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(screenshots, 'ui_r11_home_mobile_375.png'), fullPage: false });
check('mobile screenshot', fs.existsSync(path.join(screenshots, 'ui_r11_home_mobile_375.png')));
check('mobile no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

console.log(JSON.stringify({ checks, passed: checks.filter((item) => item.passed).length, failed: checks.filter((item) => !item.passed).length, chatRequests, consoleErrors: errors }, null, 2));
await browser.close();
process.exit(checks.every((item) => item.passed) ? 0 : 1);
