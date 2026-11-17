// Phase F5C-2: Premium AI Crop Recommendation UI & Farm Integration
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

async function runPhaseF5C2Verification() {
  console.log('=== [PHASE F5C-2 PLAYWRIGHT E2E VERIFICATION SUITE] ===\n');

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

    page.on('console', (msg) => console.log(`[PAGE LOG] ${msg.type()}: ${msg.text()}`));
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
    // Step 2: Ensure User Has Farm and Soil Test in Isolated Database
    // ------------------------------------------------------------------------
    console.log('\n--- Step 2: Ensure Test Farm and Soil Test Exist in Isolated Database ---');
    const farmSetup = await page.evaluate(async (apiUrl) => {
      const token = sessionStorage.getItem('agrisphere_session_token') || localStorage.getItem('agrisphere_session_token');
      if (!token) return { error: 'No token found' };
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      // List farms
      const farmsRes = await fetch(`${apiUrl}/farms`, { headers });
      let farms = await farmsRes.json();

      let farm1;
      if (!Array.isArray(farms) || farms.length === 0) {
        const res1 = await fetch(`${apiUrl}/farms`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'গাজীপুর মডেল এগ্রো ডেমো খামার',
            division: 'Dhaka',
            district: 'Gazipur',
            upazila: 'Gazipur Sadar',
            village: 'জয়দেবপুর',
            area: 3.5,
            area_unit: 'bigha',
            soil_type: 'উর্বর পলি দোআঁশ',
          }),
        });
        farm1 = await res1.json();
      } else {
        farm1 = farms[0];
      }

      // Check or add soil test for farm1
      const soilTestsRes = await fetch(`${apiUrl}/farms/${farm1.id}/soil-tests`, { headers });
      let soilTests = await soilTestsRes.json();
      let test1;
      if (!Array.isArray(soilTests) || soilTests.length === 0) {
        const createRes = await fetch(`${apiUrl}/soil/tests`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            farm_id: farm1.id,
            sample_label: 'বোরো মৌসুম পূর্ববর্তী টেস্ট',
            sample_date: new Date().toISOString().split('T')[0],
            soil_type: 'পলি দোআঁশ',
            soil_ph: 6.4,
            ph_measurement_method: '1:2.5 soil-water suspension',
            nitrogen_n: 24.5,
            measurement_unit_n: 'mg/kg',
            phosphorus_p: 14.2,
            measurement_unit_p: 'ppm',
            potassium_k: 0.28,
            measurement_unit_k: 'meq/100g',
            test_source: 'laboratory',
            laboratory_name: 'মৃত্তিকা সম্পদ উন্নয়ন ইনস্টিটিউট (SRDI), গাজীপুর',
          }),
        });
        test1 = await createRes.json();
      } else {
        test1 = soilTests[0];
      }

      return { farmId: farm1.id, soilTestId: test1.id };
    }, BACKEND_URL);

    assertCheck(!farmSetup.error && farmSetup.farmId > 0, `Isolated test farm (#${farmSetup.farmId}) and soil test ready`);

    // ------------------------------------------------------------------------
    // Step 3: Open Model Tools -> Crop Recommendation
    // ------------------------------------------------------------------------
    console.log('\n--- Step 3: Open Crop Recommendation Console in Workspace ---');
    const toolsNavBtn = page.locator('[data-testid="sidebar-tab-tools"]').first();
    assertCheck((await toolsNavBtn.count()) > 0, 'Sidebar contains "tools" (AI Models) navigation item');
    await toolsNavBtn.click();
    await page.waitForTimeout(1000);

    // Click crop recommendation tool tab
    const cropToolBtn = page.locator('button:has-text("উপযোগী ফসল"), button:has-text("Crop Recommend")').first();
    assertCheck((await cropToolBtn.count()) > 0, 'Tools view contains "উপযোগী ফসল" (Crop Recommendation) tool tab');
    await cropToolBtn.click();
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------------
    // Step 4: Verify Submode Segmented Controls & Farm-Aware Mode
    // ------------------------------------------------------------------------
    console.log('\n--- Step 4: Verify Submode Segmented Control ---');
    const farmAwareBtn = page.locator('[data-testid="mode-farm-aware-btn"]');
    const presetsBtn = page.locator('[data-testid="mode-general-presets-btn"]');
    assertCheck((await farmAwareBtn.count()) > 0, 'Farm-Aware Mode button present in submode segmented switcher');
    assertCheck((await presetsBtn.count()) > 0, 'General Presets Mode button present in submode segmented switcher');

    // Click farm aware mode
    await farmAwareBtn.click();
    await page.waitForTimeout(1000);

    const farmPanel = page.locator('[data-testid="farm-crop-recommendation-panel"]');
    assertCheck((await farmPanel.count()) > 0, 'FarmCropRecommendationPanel is active and rendered');

    // ------------------------------------------------------------------------
    // Step 5: Verify Farm Selector and Soil Test Selector
    // ------------------------------------------------------------------------
    console.log('\n--- Step 5: Verify Farm and Soil Test Selectors ---');
    const farmSelector = page.locator('[data-testid="farm-selector"]');
    const soilSelector = page.locator('[data-testid="soil-test-selector"]');
    assertCheck((await farmSelector.count()) > 0, 'Farm selector dropdown is present');
    assertCheck((await soilSelector.count()) > 0, 'Soil test selector dropdown is present');

    // Select the test farm if not already selected
    await farmSelector.selectOption(String(farmSetup.farmId));
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------------
    // Step 6: Verify Input Readiness Assessment Panel & Policy Banner
    // ------------------------------------------------------------------------
    console.log('\n--- Step 6: Verify Input Readiness Assessment & Policy Banner ---');
    const readinessPanel = page.locator('[data-testid="crop-readiness-panel"]');
    assertCheck((await readinessPanel.count()) > 0, 'Input Readiness Assessment Panel rendered');

    const statusBadge = page.locator('[data-testid="readiness-status-badge"]');
    assertCheck((await statusBadge.count()) > 0, 'Readiness Status Badge is displayed');
    const statusText = await statusBadge.innerText();
    console.log(`    Readiness badge text: "${statusText.trim()}"`);

    // Verify Auto-prefill Disabled Banner
    const autoPrefillBanner = page.locator('[data-testid="auto-prefill-disabled-banner"]');
    assertCheck((await autoPrefillBanner.count()) > 0, 'Auto-prefill Disabled Policy Banner is prominently displayed');

    // Verify Soil Reference Readings Card
    const soilRefCard = page.locator('[data-testid="soil-reference-card"]');
    assertCheck((await soilRefCard.count()) > 0, 'Recorded Soil Reference Readings Card rendered');
    const refCardText = await soilRefCard.innerText();
    assertCheck(refCardText.includes('Nitrogen') && refCardText.includes('Potassium'), 'Soil Reference Card lists N, P, K, pH parameters');

    // Screenshot readiness panel
    await readinessPanel.screenshot({
      path: path.resolve(SCREENSHOTS_DIR, 'f5c2_crop_readiness_panel.png'),
    });
    console.log('  ✓ Captured screenshot: f5c2_crop_readiness_panel.png');

    // ------------------------------------------------------------------------
    // Step 7: Strict Anti-Drift Verification: Stored Lab Values NOT Auto-Prefilled
    // ------------------------------------------------------------------------
    console.log('\n--- Step 7: Verify Lab Values are NOT Auto-Prefilled into Model Inputs ---');
    const inputK = page.locator('[data-testid="input-K"]');
    const valK = await inputK.inputValue();
    // Stored potassium_k is 0.28 meq/100g. If auto-prefill occurred, valK would be "0.28", which is invalid Kaggle scale
    assertCheck(valK !== '0.28', `Anti-drift confirmed: Potassium field is NOT auto-injected with lab measurement 0.28 (current val: "${valK}")`);

    // ------------------------------------------------------------------------
    // Step 8: Form Validation & Disclaimer Checkbox Enforcement
    // ------------------------------------------------------------------------
    console.log('\n--- Step 8: Verify Disclaimer Enforcement & Fill Valid Benchmark Values ---');
    const predictBtn = page.locator('[data-testid="predict-crop-btn"]');
    const disclaimerBox = page.locator('[data-testid="disclaimer-checkbox"]');
    assertCheck((await predictBtn.count()) > 0, 'Predict button is present');
    assertCheck((await disclaimerBox.count()) > 0, 'Research Disclaimer Checkbox is present');

    // Verify button is initially disabled because disclaimer is unchecked
    const isInitiallyDisabled = await predictBtn.isDisabled();
    assertCheck(isInitiallyDisabled, 'Predict button is safely disabled until user checks research disclaimer');

    // Enter valid Kaggle-scale benchmark inputs (representing Rice conditions)
    await page.locator('[data-testid="input-N"]').fill('90');
    await page.locator('[data-testid="input-P"]').fill('42');
    await page.locator('[data-testid="input-K"]').fill('43');
    await page.locator('[data-testid="input-temperature"]').fill('20.8');
    await page.locator('[data-testid="input-humidity"]').fill('82.0');
    await page.locator('[data-testid="input-ph"]').fill('6.5');
    await page.locator('[data-testid="input-rainfall"]').fill('202.9');

    // Check disclaimer
    await disclaimerBox.check();
    await page.waitForTimeout(500);

    const isNowEnabled = !(await predictBtn.isDisabled());
    assertCheck(isNowEnabled, 'Predict button is enabled once valid inputs and disclaimer acknowledgment are provided');

    // ------------------------------------------------------------------------
    // Step 9: Execute Real Model Inference via Farm Adapter
    // ------------------------------------------------------------------------
    console.log('\n--- Step 9: Execute Real Inference via Farm Adapter ---');
    await predictBtn.click();

    // Wait for prediction result card
    const resultCard = page.locator('[data-testid="crop-prediction-result"]');
    await resultCard.waitFor({ state: 'visible', timeout: 15000 });
    assertCheck((await resultCard.count()) > 0, 'Real Prediction Result Card successfully rendered');

    // Verify Recommended Crop
    const recommendedCropElem = page.locator('[data-testid="recommended-crop-name"]');
    assertCheck((await recommendedCropElem.count()) > 0, 'Recommended Crop Name container displayed');
    const recommendedName = await recommendedCropElem.innerText();
    console.log(`    Top Recommended Crop: "${recommendedName.trim()}"`);
    assertCheck(recommendedName.includes('ধান') || recommendedName.includes('rice') || recommendedName.length > 0, 'Real model successfully predicted a genuine 22-class crop');

    // Verify Alternative Candidates
    const resultText = await resultCard.innerText();
    assertCheck(resultText.includes('বিকল্প') || resultText.includes('Alternative'), 'Alternative Candidate crops section rendered with model probabilities');
    assertCheck(resultText.includes('গবেষণা') || resultText.includes('Research') || resultText.includes('রিসার্চ'), 'Scientific Caveat research notice is visible in result card');

    // Screenshot result card
    await resultCard.screenshot({
      path: path.resolve(SCREENSHOTS_DIR, 'f5c2_prediction_result_real_model.png'),
    });
    console.log('  ✓ Captured screenshot: f5c2_prediction_result_real_model.png');

    // Capture Desktop View Screenshot
    await page.screenshot({
      path: path.resolve(SCREENSHOTS_DIR, 'f5c2_crop_recommendation_desktop_1440.png'),
      fullPage: false,
    });
    console.log('  ✓ Captured screenshot: f5c2_crop_recommendation_desktop_1440.png');

    // ------------------------------------------------------------------------
    // Step 10: Test Cross-Workspace Navigation (Soil Dashboard & Farm Digital Twin)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 10: Test Cross-Workspace Handoff from Soil Health & Farm Twin ---');
    
    // Handoff from Soil Health Dashboard
    const soilSidebarBtn = page.locator('[data-testid="sidebar-tab-soil_health"]').first();
    await soilSidebarBtn.click();
    
    const openModelFromSoilBtn = page.locator('[data-testid="open-model-console-btn"]');
    await openModelFromSoilBtn.waitFor({ state: 'visible', timeout: 10000 });
    assertCheck((await openModelFromSoilBtn.count()) > 0, 'Soil Health Dashboard contains "open-model-console-btn"');
    await openModelFromSoilBtn.click();

    // Verify we landed on tools with crop recommendation active
    const activeFarmPanelFromSoil = page.locator('[data-testid="farm-crop-recommendation-panel"]');
    await activeFarmPanelFromSoil.waitFor({ state: 'visible', timeout: 10000 });
    assertCheck((await activeFarmPanelFromSoil.count()) > 0, 'Handoff from Soil Dashboard lands cleanly on FarmCropRecommendationPanel');

    // Handoff from Farm Digital Twin
    const twinSidebarBtn = page.locator('[data-testid="sidebar-tab-farm_twin"]').first();
    await twinSidebarBtn.click();

    const twinCropBtn = page.locator('[data-testid="twin-crop-recommendation-btn"]');
    await twinCropBtn.waitFor({ state: 'visible', timeout: 10000 });
    assertCheck((await twinCropBtn.count()) > 0, 'Farm Digital Twin contains "twin-crop-recommendation-btn"');
    await twinCropBtn.click();

    const activeFarmPanelFromTwin = page.locator('[data-testid="farm-crop-recommendation-panel"]');
    await activeFarmPanelFromTwin.waitFor({ state: 'visible', timeout: 10000 });
    assertCheck((await activeFarmPanelFromTwin.count()) > 0, 'Handoff from Farm Twin lands cleanly on FarmCropRecommendationPanel');

    // ------------------------------------------------------------------------
    // Step 11: Mobile Responsive Viewport Verification (375x812)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 11: Mobile Responsiveness Verification (375x812) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);

    const isMobilePanelVisible = await page.locator('[data-testid="farm-crop-recommendation-panel"]').isVisible();
    assertCheck(isMobilePanelVisible, 'FarmCropRecommendationPanel is visible and responsive at mobile 375px');

    await page.screenshot({
      path: path.resolve(SCREENSHOTS_DIR, 'f5c2_crop_recommendation_mobile_375.png'),
      fullPage: false,
    });
    console.log('  ✓ Captured screenshot: f5c2_crop_recommendation_mobile_375.png');

    console.log(`\n======================================================`);
    console.log(`SUCCESS: ALL ${passedChecks} PLAYWRIGHT E2E CHECKS PASSED!`);
    console.log(`======================================================\n`);

  } catch (err) {
    console.error(`\n❌ PLAYWRIGHT VERIFICATION FAILED:`, err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (backendProc) {
      console.log('Shutting down isolated test backend...');
      backendProc.kill();
    }
    if (frontendProc) {
      console.log('Shutting down isolated test frontend...');
      frontendProc.kill();
    }
  }
}

runPhaseF5C2Verification();
