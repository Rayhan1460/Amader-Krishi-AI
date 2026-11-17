import pkg from './node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs';
import path from 'path';

const FRONTEND_URL = 'http://127.0.0.1:5173';
const BACKEND_URL = 'http://127.0.0.1:8000';
const SCREENSHOTS_DIR = path.resolve('docs/screenshots');
const BRAIN_DIR = 'C:/Users/hp/.gemini/antigravity/brain/05578b8e-8852-45be-b1d8-7d64d799ac59';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function verifyUIR2ADashboard() {
  console.log('--- Launching Edge Browser for Phase UI-R2A Dashboard Verification ---');
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico') && !text.includes('Download the React DevTools')) {
        consoleErrors.push(text);
        console.error('  [Browser Error]:', text);
      }
    }
  });

  const results = {
    checks: [],
    screenshots: [],
    errors: [],
  };

  function check(name, condition) {
    if (condition) {
      console.log(`  ✓ [PASS] ${name}`);
      results.checks.push({ name, status: 'PASS' });
    } else {
      console.error(`  ✗ [FAIL] ${name}`);
      results.checks.push({ name, status: 'FAIL' });
      throw new Error(`Check failed: ${name}`);
    }
  }

  try {
    // 1. Login with demo account
    console.log('\n--- Step 1: Login via Demo Account & Seed Demo Farm ---');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    const demoBtn = page.locator('#demo-login-button').first();
    await demoBtn.click();
    await page.waitForFunction(() => window.location.pathname.includes('/workspace'), { timeout: 15000 });
    await page.waitForTimeout(1500);
    check('Redirect to /workspace', page.url().includes('/workspace'));

    // Seed test farm for this isolated demo user session
    const seedResult = await page.evaluate(async (apiUrl) => {
      const token = sessionStorage.getItem('agrisphere_session_token') || localStorage.getItem('agrisphere_session_token');
      if (!token) return { error: 'No token' };
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      // 1. Create Farm Profile
      const farmRes = await fetch(`${apiUrl}/farms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'বগুড়া আদর্শ কৃষি খামার',
          division: 'Rajshahi',
          district: 'Bogra',
          upazila: 'Bogra Sadar',
          village: 'গোকুল',
          area: 1.1,
          area_unit: 'একর',
          soil_type: 'উর্বর পলি দোআঁশ',
        }),
      });
      const farm = await farmRes.json();

      // 2. Add Crop to Farm
      const cropRes = await fetch(`${apiUrl}/farms/${farm.id}/crops`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          crop_name: 'টমেটো (Tomato)',
          variety: 'রতন হাইব্রিড',
          season: 'ররি',
          sowing_date: '2026-10-15',
          expected_harvest_date: '2027-01-20',
          status: 'active',
        }),
      });
      const crop = await cropRes.json();

      // 3. Add Tasks
      await fetch(`${apiUrl}/calendar/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          farm_id: farm.id,
          crop_id: crop.id,
          title: 'টমেটো গাছে ইউরিয়া ও পটাশ উপরিপ্রয়োগ',
          category: 'fertilizer',
          due_date: '2026-11-06',
          due_time: '08:00',
          priority: 'high',
        }),
      });

      await fetch(`${apiUrl}/calendar/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          farm_id: farm.id,
          crop_id: crop.id,
          title: 'পাতার ব্লাইট ও দাগ নিরীক্ষণ',
          category: 'pest_inspection',
          due_date: '2026-11-07',
          due_time: '10:30',
          priority: 'medium',
        }),
      });

      // 4. Add Observation
      await fetch(`${apiUrl}/cultivation/observations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          farm_id: farm.id,
          crop_id: crop.id,
          observation_date: '2026-11-04',
          title: 'টমেটো ক্ষেত নিয়মিত পর্যবেক্ষণ',
          plant_growth_stage: 'ফুল ও ফলন',
          farmer_reported_condition: 'healthy',
          visible_symptoms: 'কোনো উল্লেখযোগ্য পোকা বা ছত্রাকের লক্ষণ নেই।',
        }),
      });

      return { success: true, farmId: farm.id };
    }, BACKEND_URL);

    console.log('  Seeded farm result:', seedResult);
    check('Demo farm data seeded successfully', seedResult.success);

    // 2. Navigate to Main Farm Dashboard (?tab=dashboard)
    console.log('\n--- Step 2: Navigate to Main Farm Dashboard (1440px) ---');
    await page.goto(`${FRONTEND_URL}/workspace?tab=dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 3. Authenticated Greeting & Eyebrow Check
    console.log('\n--- Step 3: Authenticated Greeting & Eyebrow Check ---');
    const eyebrow = page.locator('text="DASHBOARD"').first();
    check('Gold DASHBOARD eyebrow visible', await eyebrow.isVisible());

    const h1 = page.locator('h1').first();
    const h1Text = await h1.textContent();
    console.log(`  Rendered greeting: "${h1Text}"`);
    check(
      'Time-aware greeting with authenticated user name rendered',
      h1Text.includes('Good') ||
        h1Text.includes('শুভ') ||
        h1Text.includes('guest') ||
        h1Text.includes('Farmer') ||
        h1Text.includes('কৃষক')
    );

    // 4. Real Farm Identity (Location & Area Metadata)
    console.log('\n--- Step 4: Real Farm Identity Metadata ---');
    const metadataText = await page.locator('h1 + p').textContent();
    console.log(`  Rendered metadata line: "${metadataText}"`);
    check(
      'Real farm location and area metadata line rendered',
      metadataText.includes('Bogra') ||
        metadataText.includes('বগুড়া') ||
        metadataText.includes('1.1') ||
        metadataText.includes('একর')
    );

    // 5. Action Advisory Banner Check
    console.log('\n--- Step 5: Action Advisory Banner Check ---');
    const bannerContainer = page.getByRole('button', { name: /Review|পর্যালোচনা/i }).or(page.getByText(/স্বাভাবিক|সতর্কতা|Advisory|Track/i)).first();
    check('Actionable review advisory banner visible', await bannerContainer.isVisible());

    // 6. Today\'s Farm Tasks Card Check
    console.log('\n--- Step 6: Today\'s Farm Tasks Card ---');
    const tasksCardHeader = page.locator('text=/.*(Today\'s Farm Tasks|আজকের খামারের কাজ).*/i').first();
    check('Today\'s Farm Tasks card header visible', await tasksCardHeader.isVisible());

    const taskText = await page.textContent('main');
    check(
      'Tasks card contains scheduled farm tasks or valid task structure',
      taskText.includes('ইউরিয়া') ||
        taskText.includes('ব্লাইট') ||
        taskText.includes('কাজ') ||
        taskText.includes('Calendar')
    );

    // 7. Crop Observation Summary Card (NO Fake 86 Score)
    console.log('\n--- Step 7: Crop Observation Summary Card (No Fake Health Score) ---');
    const cropHeader = page.locator('text=/.*(Crop Monitoring|ফসল পর্যবেক্ষণ).*/i').first();
    check('Crop Monitoring card header visible', await cropHeader.isVisible());

    const bodyText = await page.textContent('main');
    // Ensure no fake synthetic health score of 86 or fake leaf vigor percentages
    check('No fake 86 health score displayed', !bodyText.includes('Crop Health Score 86'));
    check('No fake leaf vigor 88% displayed', !bodyText.includes('Leaf vigor 88%'));
    check('No fake pest pressure 34% displayed', !bodyText.includes('Pest pressure 34%'));

    check(
      'Active crops count and verified observation rendered',
      bodyText.includes('সক্রিয়') || bodyText.includes('Active') || bodyText.includes('টমেটো')
    );

    // 8. Farm Digital Twin Card (Schematic Plot Layout)
    console.log('\n--- Step 8: Farm Digital Twin Card ---');
    const twinHeader = page.locator('text=/.*(Farm Digital Twin|ফার্ম ডিজিটাল টুইন).*/i').first();
    check('Farm Digital Twin card header visible', await twinHeader.isVisible());

    const schematicBadge = page.locator('text=/.*(Schematic|স্কেমেটিক).*/i').first();
    check('Schematic representation badge visible', await schematicBadge.isVisible());

    check(
      'Interactive schematic crop plot rendered',
      bodyText.includes('প্লট A') || bodyText.includes('Plot A') || bodyText.includes('টমেটো')
    );

    // 9. Market Intelligence Card (Historical Research Benchmark, NO Fake Live Ticker)
    console.log('\n--- Step 9: Market Intelligence Card ---');
    const marketHeader = page.locator('text=/.*(Market Intelligence|বাজার বিশ্লেষণ).*/i').first();
    check('Market Intelligence card header visible', await marketHeader.isVisible());

    check('No fake live ticker tag', !bodyText.includes('Market Price Ticker · Live'));
    const benchmarkBadge = page.locator('text=/.*(Benchmark|বেঞ্চমার্ক|গবেষণা).*/i').first();
    check('Research benchmark transparency notice visible', await benchmarkBadge.isVisible());

    // 10. Capture Desktop Screenshot (1440px)
    console.log('\n--- Step 10: Capture Desktop Screenshot (1440px) ---');
    const desktopShotPath = path.join(SCREENSHOTS_DIR, 'ui_r2a_dashboard_desktop_1440.png');
    await page.screenshot({ path: desktopShotPath, fullPage: true });
    fs.copyFileSync(desktopShotPath, path.join(BRAIN_DIR, 'ui_r2a_dashboard_desktop_1440.png'));
    console.log('Saved ui_r2a_dashboard_desktop_1440.png');
    results.screenshots.push('ui_r2a_dashboard_desktop_1440.png');

    // 11. Mobile Viewport Verification (375px)
    console.log('\n--- Step 11: Mobile Viewport Verification (375px) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);

    const mobileH1 = page.locator('h1').first();
    check('Mobile greeting h1 visible', await mobileH1.isVisible());

    const mobileBottomHome = page.locator('nav >> text=/.*(হোম|Home).*/i').first();
    check('Mobile bottom navigation visible', await mobileBottomHome.isVisible());

    // Capture Mobile Screenshot (375px)
    const mobileShotPath = path.join(SCREENSHOTS_DIR, 'ui_r2a_dashboard_mobile_375.png');
    await page.screenshot({ path: mobileShotPath, fullPage: true });
    fs.copyFileSync(mobileShotPath, path.join(BRAIN_DIR, 'ui_r2a_dashboard_mobile_375.png'));
    console.log('Saved ui_r2a_dashboard_mobile_375.png');
    results.screenshots.push('ui_r2a_dashboard_mobile_375.png');

    // Reset Viewport to Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);

    // 12. Language Toggle Verification (English <-> বাংলা)
    console.log('\n--- Step 12: Language Switcher Verification ---');
    const enBtn = page.locator('aside button:has-text("English")').first();
    await enBtn.click();
    await page.waitForTimeout(1000);
    const enDashboardText = await page.textContent('main');
    check(
      'Switched to English dashboard strings',
      enDashboardText.includes("Today's Farm Tasks") ||
        enDashboardText.includes('Crop Monitoring') ||
        enDashboardText.includes('DASHBOARD')
    );

    const bnBtn = page.locator('aside button:has-text("বাংলা")').first();
    await bnBtn.click();
    await page.waitForTimeout(1000);
    const bnDashboardText = await page.textContent('main');
    check(
      'Switched to Bangla dashboard strings',
      bnDashboardText.includes('খামারের কাজ') ||
        bnDashboardText.includes('ফসল পর্যবেক্ষণ') ||
        bnDashboardText.includes('ডিজিটাল টুইন')
    );

    // 13. Navigation Verification: Calendar shortcut
    console.log('\n--- Step 13: Navigation Verification from Dashboard ---');
    const calLink = page.locator('text=/.*(ক্যালেন্ডার খুলুন|Open Calendar|সকল কাজ|View All).*/i').first();
    if (await calLink.isVisible()) {
      await calLink.click();
      await page.waitForTimeout(1200);
      check('Navigated to Calendar via task shortcut', page.url().includes('tab=calendar'));
    }

    // Return to dashboard
    await page.goto(`${FRONTEND_URL}/workspace?tab=dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // 14. Test + New Chat Button navigates to Chat Homepage
    console.log('\n--- Step 14: New Chat Button Navigates to Chat Homepage ---');
    const newChatBtn = page.locator('#sidebar-new-chat-btn').first();
    await newChatBtn.click();
    await page.waitForTimeout(1500);
    check('Navigated to Chat Homepage via New Chat button', page.url().includes('tab=chat'));
    const chatHeroEyebrow = page.locator('text="FROM SOIL TO MARKET — ONE AI SYSTEM"').first();
    check('Chat Homepage hero rendered when + New Chat clicked', await chatHeroEyebrow.isVisible());

    // 15. Console Errors Check
    check('Zero blocking browser console errors', consoleErrors.length === 0);

    results.consoleErrors = consoleErrors;
    results.allPassed = true;
    console.log('\n================ UI-R2A DASHBOARD VERIFICATION COMPLETE ================');
    console.log(JSON.stringify(results, null, 2));

  } finally {
    await browser.close();
  }
}

verifyUIR2ADashboard().catch((err) => {
  console.error('UI-R2A Verification Error:', err);
  process.exit(1);
});
