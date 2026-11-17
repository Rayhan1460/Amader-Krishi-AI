// Phase F5D-2: Premium Crop Monitoring Dashboard & Cultivation Timeline
// Playwright E2E Verification Suite on Isolated Test Environment (port 8001 / 5174, e2e_test.db)
// Strictly isolated from production database (app/agri.db)

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

async function runPhaseF5D2Verification() {
  console.log('=== [PHASE F5D-2 PLAYWRIGHT E2E VERIFICATION SUITE] ===\n');

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
    }
    console.log(`✓ Isolated test backend operational on ${BACKEND_URL}`);

    // 2. Ensure test frontend is running
    const isFrontendUp = await checkHttp(FRONTEND_URL);
    if (!isFrontendUp) {
      console.log(`Starting isolated test frontend Vite server on port ${TEST_FRONTEND_PORT}...`);
      frontendProc = spawnFrontend();
      const ready = await waitForServer(FRONTEND_URL);
      if (!ready) throw new Error(`Frontend failed to start on port ${TEST_FRONTEND_PORT}`);
    }
    console.log(`✓ Isolated test frontend operational on ${FRONTEND_URL}`);

    // 3. Launch browser
    browser = await chromium.launch({
      headless: true,
      channel: 'msedge',
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('console', (msg) => {
      const txt = msg.text();
      if (!txt.includes('Failed to load resource') && !txt.includes('vite:')) {
        console.log(`[PAGE LOG] ${msg.type()}: ${txt}`);
      }
    });
    page.on('pageerror', (err) => console.error(`[PAGE ERROR] ${err.message}`));

    let passedChecks = 0;
    const assertCheck = (condition, description) => {
      if (!condition) {
        throw new Error(`Assertion failed: ${description}`);
      }
      passedChecks++;
      console.log(`  ✓ [CHECK ${passedChecks}] ${description}`);
    };

    // ------------------------------------------------------------------------
    // Step 1: Login & Navigation
    // ------------------------------------------------------------------------
    console.log('\n--- Step 1: Authenticate with Demo Account ---');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    assertCheck(await page.title().then((t) => t.length > 0), 'Login page loaded successfully');

    const demoBtn = page.locator('#demo-login-button').first();
    await demoBtn.click();
    await page.waitForFunction(() => window.location.pathname.includes('/workspace'), { timeout: 15000 });
    assertCheck(page.url().includes('/workspace'), 'Successfully navigated to authenticated /workspace');

    // ------------------------------------------------------------------------
    // Step 2: Ensure User Has Test Farms, Crops & Tasks in Test DB
    // ------------------------------------------------------------------------
    console.log('\n--- Step 2: Ensure Test Farms & Crops Exist in Isolated Database ---');
    const testData = await page.evaluate(async (apiUrl) => {
      const token = sessionStorage.getItem('agrisphere_session_token') || localStorage.getItem('agrisphere_session_token');
      if (!token) return { error: 'No token found' };
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      // List farms
      const farmsRes = await fetch(`${apiUrl}/farms`, { headers });
      let farms = await farmsRes.json();

      let farm1, farm2;
      if (!Array.isArray(farms) || farms.length === 0) {
        // Create Farm 1 (Primary for Crop Monitoring)
        const res1 = await fetch(`${apiUrl}/farms`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'ময়মনসিংহ মডেল খামার',
            division: 'Mymensingh',
            district: 'Mymensingh',
            upazila: 'Trishal',
            village: 'বৈলর',
            area: 4.0,
            area_unit: 'bigha',
            soil_type: 'উর্বর পলি দোআঁশ',
          }),
        });
        farm1 = await res1.json();

        // Create Farm 2 (Empty for testing empty states)
        const res2 = await fetch(`${apiUrl}/farms`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'রংপুর শূন্য খামার',
            division: 'Rangpur',
            district: 'Rangpur',
            upazila: 'Rangpur Sadar',
            village: 'পাগলাপীর',
            area: 2.0,
            area_unit: 'bigha',
            soil_type: 'বেলে দোআঁশ',
          }),
        });
        farm2 = await res2.json();
      } else {
        farm1 = farms[0];
        if (farms.length > 1) {
          farm2 = farms[1];
        } else {
          const res2 = await fetch(`${apiUrl}/farms`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name: 'রংপুর শূন্য খামার',
              division: 'Rangpur',
              district: 'Rangpur',
              upazila: 'Rangpur Sadar',
              village: 'পাগলাপীর',
              area: 2.0,
              area_unit: 'bigha',
              soil_type: 'বেলে দোআঁশ',
            }),
          });
          farm2 = await res2.json();
        }
      }

      // Check crops for farm1
      const cropsRes = await fetch(`${apiUrl}/farms/${farm1.id}/crops`, { headers });
      let crops = await cropsRes.json();
      if (!Array.isArray(crops) || crops.length === 0) {
        // Create Crop 1
        const cropRes1 = await fetch(`${apiUrl}/farms/${farm1.id}/crops`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            crop_name: 'ব্রি ধান২৮',
            variety: 'উফশী বোরো',
            season: 'Boro',
            sowing_date: '2026-10-15',
            status: 'active',
          }),
        });
        const crop1 = await cropRes1.json();

        // Create Crop 2
        const cropRes2 = await fetch(`${apiUrl}/farms/${farm1.id}/crops`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            crop_name: 'বারি বেগুন-১',
            variety: 'উত্তরা',
            season: 'Rabi',
            sowing_date: '2026-10-20',
            status: 'active',
          }),
        });
        const crop2 = await cropRes2.json();
        crops = [crop1, crop2];
      }

      // Check Calendar Task for farm1
      const tasksRes = await fetch(`${apiUrl}/calendar/tasks?farm_id=${farm1.id}`, { headers });
      let tasks = await tasksRes.json();
      let task1;
      if (!Array.isArray(tasks) || tasks.length === 0) {
        const taskCreateRes = await fetch(`${apiUrl}/calendar/tasks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            farm_id: farm1.id,
            crop_id: crops[0].id,
            title: 'ইউরিয়া সার প্রথম কিস্তি উপরিপ্রয়োগ',
            category: 'nutrient_management',
            due_date: '2026-11-10',
            due_time: '09:00',
            notes: 'কুশি পর্যায় শুরুর সময় ইউরিয়া প্রয়োগ করতে হবে।',
          }),
        });
        task1 = await taskCreateRes.json();
      } else {
        task1 = tasks[0];
      }

      return { farm1, farm2, crops, task1 };
    }, BACKEND_URL);

    assertCheck(!testData.error && testData.farm1 && testData.crops.length > 0, 'Test farms and crops verified on test DB');
    const { farm1, farm2, crops, task1 } = testData;
    console.log(`  Farm 1: ${farm1.name} (ID: ${farm1.id}), Crops: ${crops.length}, Task: #${task1.id}`);

    // ------------------------------------------------------------------------
    // Step 3: Open Crop Monitoring from Sidebar
    // ------------------------------------------------------------------------
    console.log('\n--- Step 3: Navigate to Crop Monitoring Dashboard ---');
    const monitoringTabBtn = page.locator('[data-testid="sidebar-tab-crop_monitoring"]');
    await monitoringTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await monitoringTabBtn.click();

    const dashboard = page.locator('[data-testid="crop-monitoring-dashboard"]');
    await dashboard.waitFor({ state: 'visible', timeout: 8000 });
    assertCheck(await dashboard.isVisible(), 'Crop Monitoring Dashboard rendered successfully');

    // ------------------------------------------------------------------------
    // Step 4: Verify Farm & Crop Selectors
    // ------------------------------------------------------------------------
    console.log('\n--- Step 4: Farm & Crop Selector Verification ---');
    const farmSelect = page.locator('[data-testid="farm-selector"]');
    await farmSelect.waitFor({ state: 'visible' });
    await farmSelect.selectOption(String(farm1.id));
    await page.waitForTimeout(600);

    const cropSelect = page.locator('[data-testid="crop-selector"]');
    await cropSelect.waitFor({ state: 'visible' });
    assertCheck(await cropSelect.isVisible(), 'Crop selector is visible and populated');

    // Select specific crop and verify active crop summary
    await cropSelect.selectOption(String(crops[0].id));
    await page.waitForTimeout(400);

    const cropSummary = page.locator('[data-testid="active-crop-summary"]');
    await cropSummary.waitFor({ state: 'visible', timeout: 5000 });
    const summaryText = await cropSummary.innerText();
    assertCheck(summaryText.includes(crops[0].crop_name), `Active crop summary displays ${crops[0].crop_name}`);

    // ------------------------------------------------------------------------
    // Step 5: Create a Cultivation Activity
    // ------------------------------------------------------------------------
    console.log('\n--- Step 5: Create Cultivation Activity ---');
    const addActBtn = page.locator('[data-testid="add-activity-btn"]');
    await addActBtn.click();

    const actModal = page.locator('[data-testid="activity-modal"]');
    await actModal.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await actModal.isVisible(), 'Activity modal opened');

    await page.locator('[data-testid="activity-crop-select"]').selectOption(String(crops[0].id));
    await page.locator('[data-testid="activity-type-select"]').selectOption('irrigation');
    await page.locator('[data-testid="activity-date-input"]').fill('2026-11-03');
    await page.locator('[data-testid="activity-title-input"]').fill('ধানক্ষেতে সেচ ও পানি নিষ্কাশন');
    await page.locator('[data-testid="activity-status-select"]').selectOption('completed');
    await page.locator('[data-testid="activity-notes-input"]').fill('মাঠে ২ ইঞ্চি সমানভাবে পানি ধরে রাখা হয়েছে।');

    await page.locator('[data-testid="save-activity-btn"]').click();
    await actModal.waitFor({ state: 'hidden', timeout: 8000 });
    assertCheck(await page.locator('text=ধানক্ষেতে সেচ ও পানি নিষ্কাশন').first().isVisible({ timeout: 5000 }), 'Cultivation activity recorded and visible on dashboard');

    // ------------------------------------------------------------------------
    // Step 6: Edit & Delete a Cultivation Activity
    // ------------------------------------------------------------------------
    console.log('\n--- Step 6: Edit and Delete Activity ---');
    // Switch to activities tab
    await page.locator('[data-testid="tab-activities"]').click();
    await page.waitForTimeout(400);

    // Click edit on the activity
    const editBtn = page.locator('button:has-text("সম্পাদনা")').first();
    await editBtn.click();
    await actModal.waitFor({ state: 'visible' });

    // Update title
    await page.locator('[data-testid="activity-title-input"]').fill('ধানক্ষেতে ২য় সেচ ও পানি নিষ্কাশন');
    await page.locator('[data-testid="save-activity-btn"]').click();
    await actModal.waitFor({ state: 'hidden', timeout: 8000 });
    assertCheck(await page.locator('text=ধানক্ষেতে ২য় সেচ ও পানি নিষ্কাশন').first().isVisible({ timeout: 5000 }), 'Activity updated successfully');

    // Create temporary activity to test delete
    await page.locator('[data-testid="add-activity-btn"]').click();
    await actModal.waitFor({ state: 'visible' });
    await page.locator('[data-testid="activity-crop-select"]').selectOption(String(crops[0].id));
    await page.locator('[data-testid="activity-title-input"]').fill('মুছে ফেলার পরীক্ষামূলক কাজ');
    await page.locator('[data-testid="save-activity-btn"]').click();
    await actModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(500);

    // Delete the temporary activity
    const tempActCard = page.locator('text=মুছে ফেলার পরীক্ষামূলক কাজ').locator('..').locator('..');
    const deleteBtn = tempActCard.locator('button:has-text("মুছুন")').first();
    await deleteBtn.click();

    const deleteModal = page.locator('[data-testid="delete-modal"]');
    await deleteModal.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await deleteModal.isVisible(), 'Delete confirmation modal displayed');

    await page.locator('[data-testid="confirm-delete-btn"]').click();
    await deleteModal.waitFor({ state: 'hidden', timeout: 8000 });
    await page.waitForTimeout(500);
    assertCheck(await page.locator('text=মুছে ফেলার পরীক্ষামূলক কাজ').count() === 0, 'Activity deleted cleanly');

    // ------------------------------------------------------------------------
    // Step 7: Create a Field Observation
    // ------------------------------------------------------------------------
    console.log('\n--- Step 7: Create Crop Field Observation ---');
    const addObsBtn = page.locator('[data-testid="add-observation-btn"]');
    await addObsBtn.click();

    const obsModal = page.locator('[data-testid="observation-modal"]');
    await obsModal.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await obsModal.isVisible(), 'Crop observation modal opened');

    await page.locator('[data-testid="observation-crop-select"]').selectOption(String(crops[0].id));
    await page.locator('[data-testid="observation-date-input"]').fill('2026-11-03');
    await page.locator('[data-testid="observation-title-input"]').fill('কুশি পর্যায়ের দৈহিক বৃদ্ধি পর্যবেক্ষণ');
    await page.locator('[data-testid="observation-condition-select"]').selectOption('minor_issue');
    await page.locator('[data-testid="observation-growth-stage-input"]').fill('কুশি পর্যায় (Tillering)');
    await page.locator('[data-testid="observation-symptoms-input"]').fill('পাতার ডগায় হালকা হলুদাভাব পরিলক্ষিত হয়েছে।');
    await page.locator('[data-testid="observation-notes-input"]').fill('সার প্রয়োগের পর পর্যবেক্ষণে রাখা হলো।');

    await page.locator('[data-testid="save-observation-btn"]').click();
    await obsModal.waitFor({ state: 'hidden', timeout: 8000 });
    await page.locator('[data-testid="tab-observations"]').click();
    await page.waitForTimeout(400);
    assertCheck(await page.locator('text=কুশি পর্যায়ের দৈহিক বৃদ্ধি পর্যবেক্ষণ').first().isVisible({ timeout: 5000 }), 'Crop observation created and displayed');

    // ------------------------------------------------------------------------
    // Step 8: Edit & Delete a Field Observation
    // ------------------------------------------------------------------------
    console.log('\n--- Step 8: Edit and Delete Crop Observation ---');
    await page.waitForTimeout(400);

    // Edit observation
    const editObsBtn = page.locator('button:has-text("সম্পাদনা")').first();
    await editObsBtn.click();
    await obsModal.waitFor({ state: 'visible' });

    await page.locator('[data-testid="observation-symptoms-input"]').fill('পাতার ডগায় হালকা হলুদাভাব (হালনাগাদকৃত)');
    await page.locator('[data-testid="save-observation-btn"]').click();
    await obsModal.waitFor({ state: 'hidden', timeout: 8000 });
    assertCheck(await page.locator('text=হালনাগাদকৃত').first().isVisible({ timeout: 5000 }), 'Observation updated successfully');

    // Create temporary observation to test delete
    await page.locator('[data-testid="add-observation-btn"]').click();
    await obsModal.waitFor({ state: 'visible' });
    await page.locator('[data-testid="observation-crop-select"]').selectOption(String(crops[0].id));
    await page.locator('[data-testid="observation-title-input"]').fill('মুছে ফেলার পর্যবেক্ষণ নোট');
    await page.locator('[data-testid="save-observation-btn"]').click();
    await obsModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(500);

    // Delete the temporary observation
    const tempObsCard = page.locator('text=মুছে ফেলার পর্যবেক্ষণ নোট').locator('..').locator('..');
    const deleteObsBtn = tempObsCard.locator('button:has-text("মুছুন")').first();
    await deleteObsBtn.click();
    await deleteModal.waitFor({ state: 'visible' });
    await page.locator('[data-testid="confirm-delete-btn"]').click();
    await deleteModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(500);
    assertCheck(await page.locator('text=মুছে ফেলার পর্যবেক্ষণ নোট').count() === 0, 'Observation deleted cleanly');

    // ------------------------------------------------------------------------
    // Step 9: Display Accurate Farmer-Reported Status & Scientific Notice
    // ------------------------------------------------------------------------
    console.log('\n--- Step 9: Accurate Farmer-Reported Condition & Disclaimers ---');
    const conditionBadge = page.locator('text=সামান্য লক্ষণ').first();
    assertCheck(await conditionBadge.isVisible(), 'Accurate farmer-reported condition badge displayed');

    const honestyNotice = page.locator('text=কৃষকের চাক্ষুষ পর্যবেক্ষণ').first();
    assertCheck(await honestyNotice.isVisible(), 'Observation honesty banner clearly displayed');

    // ------------------------------------------------------------------------
    // Step 10: Unified Timeline Filtering
    // ------------------------------------------------------------------------
    console.log('\n--- Step 10: Unified Chronological Timeline Filtering ---');
    await page.locator('[data-testid="tab-timeline"]').click();
    await page.waitForTimeout(400);

    const timelineContainer = page.locator('[data-testid="timeline-container"]');
    assertCheck(await timelineContainer.isVisible(), 'Unified timeline container visible');

    // Filter by activities only
    await page.locator('[data-testid="timeline-filter-activities"]').click();
    await page.waitForTimeout(300);
    assertCheck(await page.locator('text=ধানক্ষেতে ২য় সেচ ও পানি নিষ্কাশন').isVisible(), 'Activity item visible under Activities filter');

    // Filter by observations only
    await page.locator('[data-testid="timeline-filter-observations"]').click();
    await page.waitForTimeout(300);
    assertCheck(await page.locator('text=কুশি পর্যায়ের দৈহিক বৃদ্ধি পর্যবেক্ষণ').isVisible(), 'Observation item visible under Observations filter');

    // Reset to all
    await page.locator('[data-testid="timeline-filter-all"]').click();
    await page.waitForTimeout(300);
    assertCheck(
      await page.locator('text=ধানক্ষেতে ২য় সেচ ও পানি নিষ্কাশন').isVisible() &&
      await page.locator('text=কুশি পর্যায়ের দৈহিক বৃদ্ধি পর্যবেক্ষণ').isVisible(),
      'Both activity and observation rendered chronologically together in Unified Timeline'
    );

    // ------------------------------------------------------------------------
    // Step 11: Refresh & Verify Persistence
    // ------------------------------------------------------------------------
    console.log('\n--- Step 11: Page Reload & Persistence Verification ---');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Re-select monitoring tab if needed
    const tabCheck = page.locator('[data-testid="crop-monitoring-dashboard"]');
    if (!await tabCheck.isVisible()) {
      await page.locator('[data-testid="sidebar-tab-crop_monitoring"]').click();
      await tabCheck.waitFor({ state: 'visible' });
    }

    // Select farm1 to view its persisted records
    const farmSelectReload = page.locator('[data-testid="farm-selector"]');
    await farmSelectReload.waitFor({ state: 'visible' });
    await farmSelectReload.selectOption(String(farm1.id));
    await page.waitForTimeout(600);

    assertCheck(await page.locator('text=ধানক্ষেতে ২য় সেচ ও পানি নিষ্কাশন').first().isVisible({ timeout: 6000 }), 'Cultivation activity persisted across page reload');
    assertCheck(await page.locator('text=কুশি পর্যায়ের দৈহিক বৃদ্ধি পর্যবেক্ষণ').first().isVisible({ timeout: 6000 }), 'Crop observation persisted across page reload');

    // ------------------------------------------------------------------------
    // Step 12: CalendarTask Linkage & Non-Interference
    // ------------------------------------------------------------------------
    console.log('\n--- Step 12: Calendar Task Association & Status Non-Interference ---');
    // Create activity linked to task1
    await page.locator('[data-testid="add-activity-btn"]').click();
    await actModal.waitFor({ state: 'visible' });
    await page.locator('[data-testid="activity-crop-select"]').selectOption(String(crops[0].id));
    await page.locator('[data-testid="activity-title-input"]').fill('ইউরিয়া সার প্রয়োগের মাঠ বাস্তবায়ন');
    await page.locator('[data-testid="activity-calendar-task-select"]').selectOption(String(task1.id));
    await page.locator('[data-testid="save-activity-btn"]').click();
    await actModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(600);

    // Verify task status via API directly to confirm NO automatic completion
    const taskStatusCheck = await page.evaluate(async ({ apiUrl, taskId }) => {
      const token = sessionStorage.getItem('agrisphere_session_token') || localStorage.getItem('agrisphere_session_token');
      const res = await fetch(`${apiUrl}/calendar/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return await res.json();
    }, { apiUrl: BACKEND_URL, taskId: task1.id });

    assertCheck(taskStatusCheck.status === 'pending', 'CalendarTask status remains strictly "pending" (zero automatic completion side-effects)');

    // ------------------------------------------------------------------------
    // Step 13: Farm Digital Twin Navigation
    // ------------------------------------------------------------------------
    console.log('\n--- Step 13: Farm Digital Twin Integration & Back-Navigation ---');
    const twinTabBtn = page.locator('[data-testid="sidebar-tab-farm_twin"]');
    await twinTabBtn.click();
    await page.waitForTimeout(1000);

    // Check recent monitoring section in Farm Digital Twin
    const twinMonitoringSection = page.locator('text=সাম্প্রতিক মাঠ পর্যবেক্ষণ ও চাষাবাদ কার্যক্রম').first();
    assertCheck(await twinMonitoringSection.isVisible({ timeout: 6000 }), 'Recent field scouting & cultivation section visible in Farm Digital Twin');

    const viewMonitoringBtn = page.locator('[data-testid="twin-view-monitoring-btn"]');
    assertCheck(await viewMonitoringBtn.isVisible(), 'Digital Twin shortcut to Crop Monitoring dashboard visible');
    await viewMonitoringBtn.click();

    // Verify seamless return to Crop Monitoring
    await dashboard.waitFor({ state: 'visible', timeout: 6000 });
    assertCheck(await dashboard.isVisible(), 'Successfully returned to Crop Monitoring Dashboard via Digital Twin shortcut');

    // ------------------------------------------------------------------------
    // Step 14: Empty State on Farm 2
    // ------------------------------------------------------------------------
    console.log('\n--- Step 14: Empty State Handling ---');
    await farmSelect.selectOption(String(farm2.id));
    await page.waitForTimeout(600);
    await page.locator('[data-testid="tab-timeline"]').click();
    await page.waitForTimeout(400);

    const emptyText = page.locator('text=কোনো সময়রেখা রেকর্ড নেই').first();
    assertCheck(await emptyText.isVisible({ timeout: 5000 }), 'Graceful empty state displayed when farm has no records');

    // Switch back to farm1
    await farmSelect.selectOption(String(farm1.id));
    await page.waitForTimeout(600);

    // ------------------------------------------------------------------------
    // Step 15: Demo Mode Honesty Banner
    // ------------------------------------------------------------------------
    console.log('\n--- Step 15: Demo Mode Honesty Notice ---');
    const demoBanner = page.locator('[data-testid="demo-warning-banner"]');
    assertCheck(await demoBanner.isVisible(), 'Prominent demo mode honesty banner displayed informing farmer of ephemeral session');

    // ------------------------------------------------------------------------
    // Step 16: Screenshots & Responsiveness
    // ------------------------------------------------------------------------
    console.log('\n--- Step 16: Visual Verification & Screenshots ---');
    // 1. Desktop Dashboard Screenshot (1440px)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);
    const desktopScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5d2_crop_monitoring_desktop_1440.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    console.log(`  ✓ Desktop 1440px screenshot saved: ${desktopScreenshotPath}`);

    // 2. Timeline Screenshot
    const timelineElement = page.locator('[data-testid="crop-monitoring-dashboard"]');
    const timelineScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5d2_cultivation_timeline.png');
    await timelineElement.screenshot({ path: timelineScreenshotPath });
    console.log(`  ✓ Timeline screenshot saved: ${timelineScreenshotPath}`);

    // 3. Activity Modal Screenshot
    await page.locator('[data-testid="add-activity-btn"]').click();
    await actModal.waitFor({ state: 'visible' });
    const modalScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5d2_activity_modal.png');
    await actModal.screenshot({ path: modalScreenshotPath });
    console.log(`  ✓ Activity modal screenshot saved: ${modalScreenshotPath}`);
    await page.locator('button:has-text("বাতিল")').first().click();
    await actModal.waitFor({ state: 'hidden' });

    // 4. Mobile Responsiveness Screenshot (375px)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(600);
    const mobileScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5d2_crop_monitoring_mobile_375.png');
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    console.log(`  ✓ Mobile 375px screenshot saved: ${mobileScreenshotPath}`);

    assertCheck(fs.existsSync(desktopScreenshotPath), 'Desktop screenshot file exists');
    assertCheck(fs.existsSync(mobileScreenshotPath), 'Mobile screenshot file exists');

    console.log(`\n=======================================================`);
    console.log(`  ALL ${passedChecks} CHECKS PASSED FOR PHASE F5D-2!`);
    console.log(`=======================================================\n`);

    return { success: true, passedChecks };
  } catch (err) {
    console.error('\n❌ VERIFICATION SUITE FAILED:', err);
    throw err;
  } finally {
    if (browser) await browser.close();
    if (backendProc) backendProc.kill();
    if (frontendProc) frontendProc.kill();
  }
}

runPhaseF5D2Verification().catch(() => process.exit(1));
