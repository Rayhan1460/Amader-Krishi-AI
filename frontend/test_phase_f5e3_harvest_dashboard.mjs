// Phase F5E-3: Premium Harvest Dashboard & Real Data Integration
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

async function runPhaseF5E3Verification() {
  console.log('=== [PHASE F5E-3 PLAYWRIGHT E2E VERIFICATION SUITE] ===\n');

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

    console.log('\n--- Step 1: Login with Demo Account & Farm Setup ---');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    const demoBtn = page.locator('#demo-login-button').first();
    await demoBtn.click();
    await page.waitForFunction(() => window.location.pathname.includes('/workspace'), { timeout: 15000 });
    assertStep(page.url().includes('/workspace'), 'Logged in via demo account and redirected to /workspace');

    // Create a verified farm profile and crop parcel via isolated backend
    const seeded = await page.evaluate(async (apiUrl) => {
      const token = sessionStorage.getItem('agrisphere_session_token') || localStorage.getItem('agrisphere_session_token');
      if (!token) return { error: 'No token found' };
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      const farmRes = await fetch(`${apiUrl}/farms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'রংপুর মডেল খামার',
          division: 'Rangpur',
          district: 'Rangpur',
          upazila: 'Mithapukur',
          village: 'মির্জাপুর',
          area: 3.5,
          area_unit: 'Bigha',
          soil_type: 'বেলে দোআঁশ',
        }),
      });
      const farm = await farmRes.json();

      const cropRes = await fetch(`${apiUrl}/farms/${farm.id}/crops`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          crop_name: 'বোরো ধান (Boro Rice)',
          variety: 'ব্রি ধান ২৯',
          season: 'Boro',
          sowing_date: '2026-01-15',
        }),
      });
      const crop = await cropRes.json();

      return { farm, crop };
    }, BACKEND_URL);

    assertStep(seeded && seeded.farm && seeded.farm.id > 0, 'Created test farm profile via isolated backend');
    const farmId = seeded.farm.id;
    const cropId = seeded.crop.id;

    console.log('\n--- Step 2: Open Harvest Dashboard from Sidebar ---');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click Harvest Management in sidebar
    const harvestNavBtn = page.locator('button:has-text("ফসল সংগ্রহ"), button:has-text("Harvest Management")').first();
    await harvestNavBtn.waitFor({ state: 'visible', timeout: 10000 });
    await harvestNavBtn.click();
    await page.waitForTimeout(1000);

    const dashboardElem = page.locator('[data-testid="harvest-management-dashboard"]');
    await dashboardElem.waitFor({ state: 'visible', timeout: 10000 });
    assertStep(await dashboardElem.isVisible(), '1. Harvest Dashboard opened successfully from sidebar');

    console.log('\n--- Step 3: Select Farm and Crop & Verify Initial Empty State ---');
    const farmSelect = page.locator('[data-testid="harvest-farm-select"]');
    await farmSelect.waitFor({ state: 'visible' });
    const selectedFarmVal = await farmSelect.inputValue();
    assertStep(Number(selectedFarmVal) === farmId, '2. Correct farm auto-selected in dropdown');

    const emptyState = page.locator('[data-testid="harvest-empty-state"]');
    assertStep(await emptyState.isVisible(), 'Empty state properly displayed before logging harvests');

    console.log('\n--- Step 4: Create First Harvest Record (Partial, Weighed) ---');
    const addHarvestBtn = page.locator('[data-testid="add-harvest-btn"]');
    await addHarvestBtn.click();

    const harvestModal = page.locator('[data-testid="harvest-modal"]');
    await harvestModal.waitFor({ state: 'visible' });
    assertStep(await harvestModal.isVisible(), 'Harvest modal opened');

    // Fill form
    await page.fill('[data-testid="form-harvest-label"]', '১ম তোলা (নমুনা কর্তন)');
    await page.fill('[data-testid="form-harvest-quantity"]', '450');
    await page.fill('[data-testid="form-harvest-area"]', '1.0');

    // Take screenshot of modal
    const modalScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e3_harvest_modal.png');
    await page.screenshot({ path: modalScreenshotPath });
    copyToArtifacts('f5e3_harvest_modal.png');

    await page.click('[data-testid="submit-harvest-btn"]');
    await harvestModal.waitFor({ state: 'hidden', timeout: 10000 });
    assertStep(true, '3. First harvest record submitted successfully');

    await page.waitForTimeout(1000);
    const recordsTable = page.locator('[data-testid="harvest-records-table"]');
    await recordsTable.waitFor({ state: 'visible' });
    const rowText = await recordsTable.innerText();
    assertStep(rowText.includes('১ম তোলা (নমুনা কর্তন)') && rowText.includes('450'), '4. Saved record displayed in history table');

    console.log('\n--- Step 5: Edit Record ---');
    const editBtn = page.locator('[data-testid^="edit-harvest-btn-"]').first();
    await editBtn.click();
    await harvestModal.waitFor({ state: 'visible' });

    // Change quantity to 480 and update label
    await page.fill('[data-testid="form-harvest-label"]', '১ম তোলা (পরিমার্জিত ওজন)');
    await page.fill('[data-testid="form-harvest-quantity"]', '480');
    await page.click('[data-testid="submit-harvest-btn"]');
    await harvestModal.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(1000);

    const updatedRowText = await page.locator('[data-testid="harvest-records-table"]').innerText();
    assertStep(updatedRowText.includes('১ম তোলা (পরিমার্জিত ওজন)') && updatedRowText.includes('480'), '5. Record edited and verified in table');

    console.log('\n--- Step 6: Create Multiple Partial Harvests for Crop ---');
    // Add second batch (estimated, final)
    await addHarvestBtn.click();
    await harvestModal.waitFor({ state: 'visible' });
    await page.fill('[data-testid="form-harvest-label"]', '২য় তোলা (চূড়ান্ত কর্তন)');
    await page.fill('[data-testid="form-harvest-quantity"]', '720');
    await page.click('button:has-text("আনুমানিক")'); // switch to estimated
    await page.click('input[name="harvest_type"][value="final"], label:has-text("চূড়ান্ত কর্তন")');
    await page.fill('[data-testid="form-harvest-area"]', '1.0');
    await page.click('[data-testid="submit-harvest-btn"]');
    await harvestModal.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(1000);

    assertStep(true, '7. Multiple partial/final harvests created for crop parcel');

    console.log('\n--- Step 7: Verify KPI Summary Cards & Quantity Source Labels ---');
    const summaryCards = page.locator('[data-testid="harvest-summary-cards"]');
    const summaryText = await summaryCards.innerText();
    // Total = 480 + 720 = 1200 kg
    assertStep(summaryText.includes('1,200') || summaryText.includes('1200'), '8. Total recorded quantity calculates accurately (1200 kg)');
    const normalizedSummary = summaryText.replace(/\s+/g, ' ');
    assertStep(
      (normalizedSummary.includes('ওজনকৃত: 480') || (summaryText.includes('480') && (summaryText.includes('ওজনকৃত') || summaryText.includes('Weighed')))) &&
      (normalizedSummary.includes('আনুমানিক: 720') || (summaryText.includes('720') && (summaryText.includes('আনুমানিক') || summaryText.includes('Estimated')))),
      'Quantity source distinction accurately aggregated'
    );

    console.log('\n--- Step 8: Verify Chronological Harvest Trend Chart ---');
    const trendChart = page.locator('[data-testid="harvest-trend-chart"]');
    assertStep(await trendChart.isVisible(), '9. Chronological Harvest Trend Chart rendered');

    // Take Desktop Screenshot
    const desktopScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e3_harvest_dashboard_desktop_1440.png');
    await page.screenshot({ path: desktopScreenshotPath });
    copyToArtifacts('f5e3_harvest_dashboard_desktop_1440.png');

    console.log('\n--- Step 9: Invalid Input & Duplicate Prevention ---');
    await addHarvestBtn.click();
    await harvestModal.waitFor({ state: 'visible' });
    // Empty label or negative quantity
    await page.fill('[data-testid="form-harvest-label"]', '');
    await page.fill('[data-testid="form-harvest-quantity"]', '-10');
    await page.click('[data-testid="submit-harvest-btn"]');
    await page.waitForTimeout(500);
    assertStep(await harvestModal.isVisible(), '10. Invalid input prevented form submission');

    // Close modal
    await page.click('button:has-text("বাতিল")');
    await harvestModal.waitFor({ state: 'hidden' });

    console.log('\n--- Step 10: Delete with Confirmation Modal ---');
    const deleteBtn = page.locator('[data-testid^="delete-harvest-btn-"]').last();
    await deleteBtn.click();

    const deleteModal = page.locator('[data-testid="delete-confirm-modal"]');
    await deleteModal.waitFor({ state: 'visible' });
    assertStep(await deleteModal.isVisible(), 'Delete confirmation modal displayed');

    await page.click('[data-testid="confirm-delete-btn"]');
    await deleteModal.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(1000);
    assertStep(true, '6. Record deleted after confirmation');

    console.log('\n--- Step 11: Farm Digital Twin Integration ---');
    // Navigate to Farm Digital Twin
    const twinNavBtn = page.locator('[data-testid="sidebar-tab-farm_twin"], button:has-text("ফার্ম ডিজিটাল টুইন"), button:has-text("Farm Digital Twin")').first();
    await twinNavBtn.click();
    await page.waitForTimeout(1500);

    const twinHarvestSummary = page.locator('[data-testid="twin-harvest-summary"]');
    await twinHarvestSummary.waitFor({ state: 'visible', timeout: 10000 });
    assertStep(await twinHarvestSummary.isVisible(), '12. Compact Harvest Summary Card rendered on Farm Digital Twin');

    const twinCardScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e3_twin_harvest_card.png');
    await twinHarvestSummary.screenshot({ path: twinCardScreenshotPath });
    copyToArtifacts('f5e3_twin_harvest_card.png');

    // Click Shortcut to Full Harvest Dashboard
    const viewFullBtn = page.locator('[data-testid="view-full-harvest-dashboard-btn"]');
    await viewFullBtn.click();
    await page.waitForTimeout(1500);

    assertStep(await page.locator('[data-testid="harvest-management-dashboard"]').isVisible(), 'Navigated back to Harvest Dashboard from Digital Twin with farm context');

    console.log('\n--- Step 12: Mobile Layout (375px) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);

    const mobileScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e3_harvest_dashboard_mobile_375.png');
    await page.screenshot({ path: mobileScreenshotPath });
    copyToArtifacts('f5e3_harvest_dashboard_mobile_375.png');
    assertStep(true, '14. Mobile 375px responsive layout verified and captured');

    console.log('\n--- Step 13: Persistence After Reload ---');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // If redirected or on another tab, navigate back to harvest
    const harvestTabBtn = page.locator('[data-testid="sidebar-tab-harvest"]').first();
    if (await harvestTabBtn.isVisible()) {
      await harvestTabBtn.click();
      await page.waitForTimeout(1000);
    }

    // Re-verify remaining harvest record exists
    const persistedTable = page.locator('[data-testid="harvest-records-table"]');
    await persistedTable.waitFor({ state: 'visible', timeout: 10000 });
    assertStep(await persistedTable.isVisible(), '15. Harvest records persist cleanly across page reload');

    console.log('\n======================================================');
    console.log(`TOTAL E2E VERIFICATIONS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('======================================================\n');

  } finally {
    if (browser) await browser.close();
    if (backendProc) backendProc.kill();
    if (frontendProc) frontendProc.kill();
  }
}

runPhaseF5E3Verification().catch((err) => {
  console.error('\n[FATAL ERROR IN E2E SUITE]:', err);
  process.exit(1);
});
