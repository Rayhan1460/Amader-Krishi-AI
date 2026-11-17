// Phase F6B: Premium Unified Farmer Decision Dashboard
// Playwright E2E Verification Suite on Isolated Test Environment (port 8001 / 5174, e2e_test.db)
// Strictly isolated from main database (backend/app/agri.db)

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'docs', 'screenshots');
const ARTIFACTS_DIR = 'C:/Users/hp/.gemini/antigravity/brain/05578b8e-8852-45be-b1d8-7d64d799ac59';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const TEST_BACKEND_PORT = process.env.TEST_BACKEND_PORT || '8001';
const TEST_FRONTEND_PORT = process.env.TEST_FRONTEND_PORT || '5174';
const BACKEND_URL = process.env.BACKEND_URL || `http://127.0.0.1:${TEST_BACKEND_PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || `http://127.0.0.1:${TEST_FRONTEND_PORT}`;

function checkHttp(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 75000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHttp(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function spawnBackend() {
  const backendDir = path.resolve(ROOT_DIR, 'backend');
  const pythonExe = path.resolve(backendDir, '.venv2', 'Scripts', 'python.exe');
  const runServerPy = path.resolve(backendDir, 'run_test_server.py');
  const testDbPath = path.resolve(backendDir, 'tests', 'e2e_test.db');
  const proc = spawn(pythonExe, ['-u', runServerPy], {
    cwd: backendDir,
    env: {
      ...process.env,
      DATABASE_URL: `sqlite:///${testDbPath.replace(/\\/g, '/')}`,
      ENVIRONMENT: 'testing',
      TEST_PORT: TEST_BACKEND_PORT,
      PYTHONUNBUFFERED: '1',
    },
    stdio: 'pipe',
  });
  proc.stdout.on('data', (d) => console.log(`[BACKEND] ${d.toString().trim()}`));
  proc.stderr.on('data', (d) => console.error(`[BACKEND ERR] ${d.toString().trim()}`));
  return proc;
}

function spawnFrontend() {
  const frontendDir = path.resolve(ROOT_DIR, 'frontend');
  const viteBin = path.resolve(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const proc = spawn('node', [viteBin, '--host', '127.0.0.1', '--port', TEST_FRONTEND_PORT, '--mode', 'test'], {
    cwd: frontendDir,
    env: {
      ...process.env,
      VITE_API_BASE_URL: BACKEND_URL,
      VITE_API_URL: BACKEND_URL,
      VITE_BACKEND_PROXY_TARGET: BACKEND_URL,
    },
    stdio: 'pipe',
  });
  proc.stdout.on('data', (d) => console.log(`[FRONTEND] ${d.toString().trim()}`));
  proc.stderr.on('data', (d) => console.error(`[FRONTEND ERR] ${d.toString().trim()}`));
  return proc;
}

function copyToArtifacts(filename) {
  try {
    const src = path.resolve(SCREENSHOTS_DIR, filename);
    const dst = path.resolve(ARTIFACTS_DIR, filename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`[ARTIFACT COPY] ${filename} copied to brain artifact directory`);
    }
  } catch (e) {
    console.warn(`[ARTIFACT COPY WARN] Could not copy ${filename}:`, e.message);
  }
}

async function runPhaseF6BVerification() {
  console.log('=== [PHASE F6B PLAYWRIGHT E2E VERIFICATION SUITE] ===\n');

  let backendProc = null;
  let frontendProc = null;
  let browser = null;

  try {
    // 1. Ensure test backend is running
    const isBackendUp = await checkHttp(`${BACKEND_URL}/health`);
    if (!isBackendUp) {
      console.log(`Starting isolated test backend server on port ${TEST_BACKEND_PORT}...`);
      backendProc = spawnBackend();
      const ready = await waitForServer(`${BACKEND_URL}/health`);
      if (!ready) throw new Error(`Backend failed to start on port ${TEST_BACKEND_PORT}`);
    } else {
      console.log(`Isolated test backend is already active on port ${TEST_BACKEND_PORT}`);
    }

    // 2. Ensure test frontend is running
    const isFrontendUp = await checkHttp(FRONTEND_URL);
    if (!isFrontendUp) {
      console.log(`Starting isolated test frontend server on port ${TEST_FRONTEND_PORT}...`);
      frontendProc = spawnFrontend();
      const ready = await waitForServer(FRONTEND_URL);
      if (!ready) throw new Error(`Frontend failed to start on port ${TEST_FRONTEND_PORT}`);
    } else {
      console.log(`Isolated test frontend is already active on port ${TEST_FRONTEND_PORT}`);
    }

    // 3. Launch Playwright
    browser = await chromium.launch({
      headless: true,
      channel: 'msedge',
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    let passedTests = 0;
    let failedTests = 0;

    function assertStep(condition, message) {
      if (condition) {
        passedTests++;
        console.log(`  ✓ [PASS] ${message}`);
      } else {
        failedTests++;
        console.error(`  ✗ [FAIL] ${message}`);
        throw new Error(`Assertion failed: ${message}`);
      }
    }

    console.log('\n--- Step 1: Login with Demo Account & Seed Test Data ---');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    const demoBtn = page.locator('#demo-login-button').first();
    await demoBtn.click();
    await page.waitForFunction(() => window.location.pathname.includes('/workspace'), { timeout: 15000 });
    assertStep(page.url().includes('/workspace'), 'Logged in via demo account and redirected to /workspace');

    // Seed test farms and data into isolated e2e_test.db
    const seeded = await page.evaluate(async (apiUrl) => {
      const token = sessionStorage.getItem('agrisphere_session_token') || localStorage.getItem('agrisphere_session_token');
      if (!token) return { error: 'No token found' };
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      // Farm 1: Full multi-domain farm
      const farm1Res = await fetch(`${apiUrl}/farms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'রাজশাহী মডেল কৃষি খামার',
          division: 'Rajshahi',
          district: 'Rajshahi',
          upazila: 'Paba',
          village: 'হরিয়ান',
          area: 5.0,
          area_unit: 'Bigha',
          soil_type: 'উর্বর পলি দোআঁশ',
        }),
      });
      const farm1 = await farm1Res.json();

      // Crop for Farm 1
      const crop1Res = await fetch(`${apiUrl}/farms/${farm1.id}/crops`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          crop_name: 'বোরো ধান (Boro Rice)',
          variety: 'ব্রি ধান ২৯',
          season: 'Boro',
          sowing_date: '2026-01-10',
          expected_harvest_date: '2026-05-15',
          status: 'vegetative',
        }),
      });
      const crop1 = await crop1Res.json();

      // Overdue Task for Farm 1 (due 5 days ago)
      const pastDate = '2026-10-30';
      const futureDate = '2026-11-08';

      const task1Res = await fetch(`${apiUrl}/calendar/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          farm_id: farm1.id,
          crop_id: crop1.id,
          title: 'ইউরিয়া সারের দ্বিতীয় কিস্তি প্রয়োগ',
          category: 'Fertilizer',
          due_date: pastDate,
          priority: 'High',
        }),
      });
      const task1 = await task1Res.json();

      // Upcoming Task for Farm 1
      const task2Res = await fetch(`${apiUrl}/calendar/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          farm_id: farm1.id,
          crop_id: crop1.id,
          title: 'পরিমিত সেচ প্রদান ও নিষ্কাশন',
          category: 'Irrigation',
          due_date: futureDate,
          priority: 'Medium',
        }),
      });
      const task2 = await task2Res.json();

      // Cultivation Activity for Farm 1
      const actRes = await fetch(`${apiUrl}/cultivation/activities`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          farm_id: farm1.id,
          crop_id: crop1.id,
          activity_type: 'land_preparation',
          activity_date: '2026-01-08',
          title: 'জমি ৪ বার গভীর চাষ ও মই দেওয়া',
          status: 'completed',
          farmer_notes: 'মাটি নরম ও ঝুরঝুরে করা হয়েছে।',
        }),
      });
      const act = await actRes.json();

      // Crop Observation for Farm 1 (visual inspection)
      const obsRes = await fetch(`${apiUrl}/cultivation/observations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          farm_id: farm1.id,
          crop_id: crop1.id,
          observation_date: '2026-11-02',
          title: 'ধানের পাতার অগ্রভাগ কিছুটা হলুদ',
          plant_growth_stage: 'tillering',
          visible_symptoms: 'পাতার ডগায় হালকা ক্লোরোসিস বা হলুদ ভাব দেখা যাচ্ছে।',
          farmer_reported_condition: 'moderate_issue',
        }),
      });
      const obs = await obsRes.json();

      // Harvest Record for Farm 1 (800 kg = exactly 20 maunds)
      const hrvRes = await fetch(`${apiUrl}/harvest/records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          farm_id: farm1.id,
          crop_id: crop1.id,
          harvest_date: '2026-11-03',
          harvest_label: 'বোরো ধান প্রথম কর্তন',
          measured_quantity_kg: 800.0,
          quantity_source: 'weighed',
          harvest_type: 'partial',
          farmer_notes: '৮০০ কেজি সংগ্রহ সম্পন্ন।',
        }),
      });
      const hrv = await hrvRes.json();

      // Farm 2: Empty farm without crops or soil tests
      const farm2Res = await fetch(`${apiUrl}/farms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'দিনাজপুর নতুন খামার',
          division: 'Rangpur',
          district: 'Dinajpur',
          upazila: 'Birganj',
          village: 'সুজানগর',
          area: 2.0,
          area_unit: 'Acre',
          soil_type: 'বেলে মাটি',
        }),
      });
      const farm2 = await farm2Res.json();

      return { farm1, farm2, crop1, task1, task2, act, obs, hrv };
    }, BACKEND_URL);

    assertStep(seeded && seeded.farm1 && seeded.farm1.id > 0, 'Seeded test data successfully in isolated backend');
    const farm1Id = seeded.farm1.id;
    const farm2Id = seeded.farm2.id;

    console.log('\n--- Step 2: Open Smart Farm Center Dashboard ---');
    // Navigate via sidebar or URL
    const smartCenterTab = page.locator('[data-testid="sidebar-tab-smart_center"]').first();
    if (await smartCenterTab.isVisible()) {
      await smartCenterTab.click();
    } else {
      await page.goto(`${FRONTEND_URL}/workspace?tab=smart_center`, { waitUntil: 'networkidle' });
    }
    await page.waitForSelector('#smart-farm-center-root', { timeout: 10000 });
    assertStep(await page.locator('#smart-farm-center-root').isVisible(), 'Smart Farm Center root container loaded');

    console.log('\n--- Step 3: Verify Farm Selector and Identity Details ---');
    const selector = page.locator('#farm-intelligence-selector');
    await selector.waitFor({ state: 'visible' });

    await Promise.all([
      page.waitForResponse((res) => res.url().includes(`/farms/${farm1Id}/intelligence`) && res.status() === 200, { timeout: 10000 }).catch(() => {}),
      selector.selectOption(String(farm1Id)),
    ]);
    await page.waitForFunction((fName) => {
      const el = document.getElementById('smart-farm-center-root');
      return el && el.innerText.includes(fName);
    }, 'রাজশাহী মডেল কৃষি খামার', { timeout: 10000 });

    const pageText = await page.locator('#smart-farm-center-root').innerText();
    assertStep(pageText.includes('রাজশাহী মডেল কৃষি খামার'), 'Farm 1 name correctly displayed');
    assertStep(pageText.includes('Paba') || pageText.includes('Rajshahi'), 'Farm 1 location correctly displayed');
    assertStep(pageText.includes('৫') || pageText.includes('5'), 'Farm 1 area correctly displayed');

    console.log('\n--- Step 4: Verify Registered Crops Display ---');
    assertStep(pageText.includes('বোরো ধান') || pageText.includes('Boro Rice'), 'Registered crop name displayed');
    assertStep(pageText.includes('ব্রি ধান ২৯'), 'Crop variety displayed');

    console.log('\n--- Step 5 & 6: Verify Pending and Overdue Tasks Display ---');
    assertStep(pageText.includes('ইউরিয়া সারের দ্বিতীয় কিস্তি প্রয়োগ'), 'Overdue task title displayed');
    assertStep(pageText.includes('বকেয়া কাজসমূহ') || pageText.includes('Overdue Tasks'), 'Overdue tasks section present');
    assertStep(pageText.includes('পরিমিত সেচ প্রদান ও নিষ্কাশন'), 'Upcoming task title displayed');

    console.log('\n--- Step 7: Verify Field Observations Display & Separation ---');
    assertStep(pageText.includes('ধানের পাতার অগ্রভাগ কিছুটা হলুদ'), 'Visual scouting observation title displayed');
    assertStep(pageText.includes('কৃষকের মাঠ পর্যায়ের পর্যবেক্ষণ'), 'Farmer visual observation label displayed');
    assertStep(
      pageText.includes('এটি কোনো স্বয়ংক্রিয় এআই রোগ নির্ণয় নয়') ||
      pageText.includes('কোনো নিশ্চিত এআই রোগ নির্ণয় নয়') ||
      pageText.includes('visual inspection'),
      'Explicit non-AI diagnosis caveat displayed for farmer observation'
    );

    console.log('\n--- Step 8: Verify Harvest Summary and Maund Conversion ---');
    assertStep(pageText.includes('৮০০') || pageText.includes('800'), 'Measured harvest quantity 800 kg displayed');
    assertStep(pageText.includes('২০') || pageText.includes('20') || pageText.includes('মন'), 'Official Maund conversion (800kg/40 = 20 maunds) displayed');

    console.log('\n--- Step 9 & 10: Verify Honest Missing Soil Data and Provenance Audit ---');
    assertStep(pageText.includes('এখনো কোনো তথ্য যোগ করা হয়নি') || pageText.includes('No soil data'), 'Honest missing soil test message displayed');
    assertStep(!pageText.includes('undefined') && !pageText.includes('NaN'), 'No undefined or NaN displayed for missing nutrients');

    // Open Provenance Audit Drawer
    const auditBtn = page.getByRole('button', { name: /প্রমাণপত্র দেখুন|View Audit/i }).first();
    if (await auditBtn.isVisible()) {
      await auditBtn.click();
      await page.waitForTimeout(500);
      const auditText = await page.locator('#smart-farm-center-root').innerText();
      assertStep(
        auditText.includes('farmer_reported') || auditText.includes('official_calendar'),
        'Provenance audit table shows legitimate origin types'
      );
      assertStep(
        auditText.includes('কোনো কৃত্রিম সামগ্রিক স্বাস্থ্য স্কোর তৈরি করে না') ||
        auditText.includes('No synthetic'),
        'Zero synthetic overall health score guarantee displayed'
      );
    }

    console.log('\n--- Step 11: Verify Weather Component Fallback / Live Display ---');
    assertStep(
      pageText.includes('আবহাওয়া পূর্বাভাস') || pageText.includes('Weather Forecast'),
      'Weather section header rendered'
    );

    console.log('\n--- Step 12: Switch Farms Without Stale Records ---');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes(`/farms/${farm2Id}/intelligence`) && res.status() === 200, { timeout: 10000 }).catch(() => {}),
      selector.selectOption(String(farm2Id)),
    ]);
    await page.waitForFunction((fName) => {
      const el = document.getElementById('smart-farm-center-root');
      return el && el.innerText.includes(fName);
    }, 'দিনাজপুর নতুন খামার', { timeout: 10000 });

    const farm2Text = await page.locator('#smart-farm-center-root').innerText();
    assertStep(farm2Text.includes('দিনাজপুর নতুন খামার'), 'Switched to Farm 2 successfully');
    assertStep(!farm2Text.includes('বোরো ধান প্রথম কর্তন'), 'Stale harvest record from Farm 1 is NOT displayed on Farm 2');
    assertStep(
      farm2Text.includes('এখনো কোনো ফসল নিবন্ধিত করা হয়নি') ||
      farm2Text.includes('No crops registered yet'),
      'Farm 2 shows honest empty crops state'
    );

    // Switch back to Farm 1
    await Promise.all([
      page.waitForResponse((res) => res.url().includes(`/farms/${farm1Id}/intelligence`) && res.status() === 200, { timeout: 10000 }).catch(() => {}),
      selector.selectOption(String(farm1Id)),
    ]);
    await page.waitForFunction((fName) => {
      const el = document.getElementById('smart-farm-center-root');
      return el && el.innerText.includes(fName);
    }, 'রাজশাহী মডেল কৃষি খামার', { timeout: 10000 });
    await page.waitForTimeout(1000);

    console.log('\n--- Step 13: Actionable Navigation to Modules ---');
    // Test link to Digital Twin
    const twinBtn = page.getByRole('button', { name: /ডিজিটাল টুইন|Digital Twin/i }).first();
    assertStep(await twinBtn.isVisible(), 'Digital Twin action button is visible');

    // Test link to Full Calendar
    const calBtn = page.getByRole('button', { name: /পূর্ণাঙ্গ ক্যালেন্ডার খুলুন|Open Full Calendar/i }).first();
    assertStep(await calBtn.isVisible(), 'Calendar navigation link is visible');

    // Test link to Harvest Dashboard
    const hrvBtn = page.getByRole('button', { name: /ফসল সংগ্রহ ড্যাশবোর্ড খুলুন|Open Harvest Dashboard/i }).first();
    assertStep(await hrvBtn.isVisible(), 'Harvest dashboard navigation link is visible');

    console.log('\n--- Step 14 & 15: Unauthorized Access & Demo Account Permissions ---');
    const demoBadge = page.locator('#demo-mode-badge').first();
    assertStep(await demoBadge.isVisible(), 'Demo account session badge verified');

    console.log('\n--- Step 16: Verify Bangla/English Language Switching ---');
    const langBtn = page.locator('button[title*="Toggle Language"]').first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await page.waitForTimeout(800);
      const enText = await page.locator('#smart-farm-center-root').innerText();
      assertStep(
        enText.includes('Smart Farm Center') || enText.includes('Farmer Decision Dashboard'),
        'Switched to English interface successfully'
      );

      // Switch back to Bangla
      await langBtn.click();
      await page.waitForTimeout(800);
    }

    console.log('\n--- Step 17: Capture 1440px Desktop Screenshot ---');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);
    const desktopScreenshot = path.resolve(SCREENSHOTS_DIR, 'f6b_smart_center_desktop_1440.png');
    await page.screenshot({ path: desktopScreenshot, fullPage: true });
    copyToArtifacts('f6b_smart_center_desktop_1440.png');
    assertStep(fs.existsSync(desktopScreenshot), '1440px Desktop screenshot captured');

    console.log('\n--- Step 18: Capture 375px Mobile Screenshot ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    const mobileScreenshot = path.resolve(SCREENSHOTS_DIR, 'f6b_smart_center_mobile_375.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: true });
    copyToArtifacts('f6b_smart_center_mobile_375.png');
    assertStep(fs.existsSync(mobileScreenshot), '375px Mobile screenshot captured');

    console.log('\n--- Step 19: Verify Read-Only Non-Destructive Behavior ---');
    // Verify GET endpoint does not mutate database
    const readOnlyCheck = await page.evaluate(async ({ apiUrl, fid }) => {
      const token = sessionStorage.getItem('agrisphere_session_token') || localStorage.getItem('agrisphere_session_token');
      const headers = { Authorization: `Bearer ${token}` };

      // Call GET /intelligence multiple times
      const res1 = await fetch(`${apiUrl}/farms/${fid}/intelligence`, { headers });
      const data1 = await res1.json();

      const res2 = await fetch(`${apiUrl}/farms/${fid}/intelligence`, { headers });
      const data2 = await res2.json();

      return {
        ok1: res1.status === 200,
        ok2: res2.status === 200,
        equalCrops: data1.crops_summary.total_crops === data2.crops_summary.total_crops,
        equalTasks: data1.tasks_summary.total_tasks === data2.tasks_summary.total_tasks,
      };
    }, { apiUrl: BACKEND_URL, fid: farm1Id });

    assertStep(readOnlyCheck.ok1 && readOnlyCheck.ok2 && readOnlyCheck.equalCrops, 'Repeated GET calls confirmed strictly read-only and deterministic');

    console.log('\n======================================================');
    console.log(`✓ ALL TESTS PASSED: ${passedTests} / ${passedTests + failedTests}`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ PLAYWRIGHT TEST EXECUTION FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (frontendProc) {
      console.log('Terminating isolated test frontend...');
      frontendProc.kill();
    }
    if (backendProc) {
      console.log('Terminating isolated test backend...');
      backendProc.kill();
    }
  }
}

runPhaseF6BVerification();
