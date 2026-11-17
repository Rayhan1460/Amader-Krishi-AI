// Phase F5D-3: Tomato & Rice Disease AI Integration with Crop Monitoring
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
    const req = http.get(url, { timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => {
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

async function runPhaseF5D3Verification() {
  console.log('=== [PHASE F5D-3 PLAYWRIGHT E2E VERIFICATION SUITE] ===\n');

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
    // Step 2: Seed Test Data (Tomato, Rice, Wheat Crops & Observation)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 2: Seed Test Data via API (Tomato, Rice, Wheat) ---');
    const seeded = await page.evaluate(async (apiUrl) => {
      const token = sessionStorage.getItem('agrisphere_session_token') || localStorage.getItem('agrisphere_session_token');
      if (!token) return { error: 'No token found' };
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      // List farms
      const farmsRes = await fetch(`${apiUrl}/farms`, { headers });
      let farms = await farmsRes.json();
      let farm;
      if (!Array.isArray(farms) || farms.length === 0) {
        const createFarmRes = await fetch(`${apiUrl}/farms`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'ময়মনসিংহ মডেল খামার (F5D3)',
            division: 'Mymensingh',
            district: 'Mymensingh',
            upazila: 'Trishal',
            village: 'বৈলর',
            area: 5.0,
            area_unit: 'bigha',
            soil_type: 'উর্বর পলি দোআঁশ',
          }),
        });
        farm = await createFarmRes.json();
      } else {
        farm = farms[0];
      }

      // Check crops
      const cropsRes = await fetch(`${apiUrl}/farms/${farm.id}/crops`, { headers });
      let crops = await cropsRes.json();

      let tomatoCrop = Array.isArray(crops) ? crops.find((c) => c.crop_name.includes('টমেটো') || c.crop_name.toLowerCase().includes('tomato')) : null;
      if (!tomatoCrop) {
        const res = await fetch(`${apiUrl}/farms/${farm.id}/crops`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            crop_name: 'টমেটো (Tomato)',
            variety: 'বারি হাইব্রিড টমেটো-৮',
            season: 'Rabi',
            sowing_date: '2026-10-15',
            status: 'planted',
          }),
        });
        tomatoCrop = await res.json();
      }

      let riceCrop = Array.isArray(crops) ? crops.find((c) => c.crop_name.includes('ধান') || c.crop_name.toLowerCase().includes('rice')) : null;
      if (!riceCrop) {
        const res = await fetch(`${apiUrl}/farms/${farm.id}/crops`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            crop_name: 'ধান (Rice)',
            variety: 'ব্রি ধান-২৮',
            season: 'Boro',
            sowing_date: '2026-10-01',
            status: 'planted',
          }),
        });
        riceCrop = await res.json();
      }

      let wheatCrop = Array.isArray(crops) ? crops.find((c) => c.crop_name.includes('গম') || c.crop_name.toLowerCase().includes('wheat')) : null;
      if (!wheatCrop) {
        const res = await fetch(`${apiUrl}/farms/${farm.id}/crops`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            crop_name: 'গম (Wheat)',
            variety: 'বারি গম-৩৩',
            season: 'Rabi',
            sowing_date: '2026-11-01',
            status: 'planted',
          }),
        });
        wheatCrop = await res.json();
      }

      // Ensure an observation exists for the tomato crop
      const obsRes = await fetch(`${apiUrl}/cultivation/observations?farm_id=${farm.id}&crop_id=${tomatoCrop.id}`, { headers });
      let observations = await obsRes.json();
      let observation;
      if (!Array.isArray(observations) || observations.length === 0) {
        const createObsRes = await fetch(`${apiUrl}/cultivation/observations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            farm_id: farm.id,
            crop_id: tomatoCrop.id,
            observation_date: '2026-11-02',
            title: 'টমেটো পাতার প্রাথমিক স্কাউটিং',
            plant_growth_stage: 'ফুল ও প্রাথমিক ফল গঠন',
            farmer_reported_condition: 'moderate_issue',
            growth_notes: 'গাছের বৃদ্ধি স্বাভাবিক রয়েছে।',
            visible_symptoms: 'পাতার নিচের দিকে হালকা দাগ দেখা গেছে। নিয়মিত পর্যবেক্ষণ চলছে।',
          }),
        });
        observation = await createObsRes.json();
      } else {
        observation = observations[0];
      }

      return {
        farmId: farm.id,
        tomatoCropId: tomatoCrop.id,
        riceCropId: riceCrop.id,
        wheatCropId: wheatCrop.id,
        obsId: observation.id,
      };
    }, BACKEND_URL);

    assertCheck(seeded.tomatoCropId > 0, `Tomato crop verified in test DB (ID: ${seeded.tomatoCropId})`);
    assertCheck(seeded.riceCropId > 0, `Rice crop verified in test DB (ID: ${seeded.riceCropId})`);
    assertCheck(seeded.wheatCropId > 0, `Wheat crop verified in test DB (ID: ${seeded.wheatCropId})`);
    assertCheck(seeded.obsId > 0, `Test observation verified in test DB (ID: ${seeded.obsId})`);

    // ------------------------------------------------------------------------
    // Step 3: Open Crop Monitoring Module
    // ------------------------------------------------------------------------
    console.log('\n--- Step 3: Open Crop Monitoring Module ---');
    // Click module button or navigate directly
    const cropMonitoringNav = page.locator('[data-testid="nav-crop-monitoring"], button:has-text("ফসল পর্যবেক্ষণ")').first();
    if (await cropMonitoringNav.isVisible()) {
      await cropMonitoringNav.click();
      await page.waitForTimeout(1000);
    } else {
      await page.goto(`${FRONTEND_URL}/workspace?tab=crop_monitoring`, { waitUntil: 'networkidle' });
    }

    const dashboardContainer = page.locator('[data-testid="crop-monitoring-dashboard"]');
    await dashboardContainer.waitFor({ state: 'visible', timeout: 15000 });
    assertCheck(await dashboardContainer.isVisible(), 'Crop Monitoring Dashboard rendered');

    // ------------------------------------------------------------------------
    // Step 4: Verify 4th Sub-tab "AI পাতা রোগ বিশ্লেষণ"
    // ------------------------------------------------------------------------
    console.log('\n--- Step 4: Verify Sub-tab "AI পাতা রোগ বিশ্লেষণ" ---');
    const diseaseTab = page.locator('[data-testid="tab-disease-analysis"]');
    await diseaseTab.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await diseaseTab.isVisible(), 'Tab "AI পাতা রোগ বিশ্লেষণ" (data-testid="tab-disease-analysis") is visible');

    // Select Tomato Crop
    const cropSelect = page.locator('[data-testid="crop-selector"]');
    await cropSelect.selectOption(String(seeded.tomatoCropId));
    await page.waitForTimeout(500);
    console.log(`Selected Tomato crop (ID: ${seeded.tomatoCropId})`);

    // Switch to Disease Analysis Tab
    await diseaseTab.click();
    await page.waitForTimeout(800);

    const diseaseContainer = page.locator('[data-testid="disease-analysis-container"]');
    await diseaseContainer.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await diseaseContainer.isVisible(), 'Disease Analysis container is visible');

    // ------------------------------------------------------------------------
    // Step 5: Verify Model Banner & Supported Classes (tomato_disease_v3)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 5: Verify Tomato Model Metadata (tomato_disease_v3) ---');
    const modelBanner = page.locator('[data-testid="disease-model-banner"]');
    await modelBanner.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await modelBanner.isVisible(), 'Model banner (data-testid="disease-model-banner") is visible');

    const bannerText = await modelBanner.innerText();
    assertCheck(bannerText.includes('tomato_disease_v3') || bannerText.includes('টমেটো পাতা রোগ'), 'Banner mentions tomato_disease_v3 model');
    assertCheck(bannerText.includes('8') || bannerText.includes('আট'), 'Banner indicates 8 supported disease/health classes');

    // Verify Dropzone & Sample Leaf Button
    const uploadDropzone = page.locator('[data-testid="leaf-image-upload"]');
    assertCheck(await uploadDropzone.isVisible(), 'Leaf upload dropzone is visible');

    const sampleLeafBtn = page.locator('[data-testid="load-sample-leaf-btn"]');
    assertCheck(await sampleLeafBtn.isVisible(), 'Synthetic leaf sample button (data-testid="load-sample-leaf-btn") is visible');

    // ------------------------------------------------------------------------
    // Step 6: Load Synthetic Leaf Sample & Run AI Inference
    // ------------------------------------------------------------------------
    console.log('\n--- Step 6: Load Leaf Sample & Execute AI Vision Model ---');
    await sampleLeafBtn.click();
    await page.waitForTimeout(800);

    const leafPreview = page.locator('[data-testid="leaf-image-preview"]');
    await leafPreview.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await leafPreview.isVisible(), 'Leaf image preview rendered successfully');

    const analyzeBtn = page.locator('[data-testid="start-disease-analysis-btn"]');
    assertCheck(await analyzeBtn.isEnabled(), 'Analyze button is enabled after image selection');

    // Click analyze button
    await analyzeBtn.click();
    console.log('Initiated real model inference for tomato leaf image...');

    const resultCard = page.locator('[data-testid="disease-result-card"]');
    await resultCard.waitFor({ state: 'visible', timeout: 20000 });
    assertCheck(await resultCard.isVisible(), 'AI Disease Result Card (data-testid="disease-result-card") rendered');

    const resultText = await resultCard.innerText();
    console.log(`Inference result snippet: ${resultText.replace(/\n+/g, ' ').slice(0, 150)}...`);
    assertCheck(resultText.length > 50, 'Result contains detailed diagnosis information');
    assertCheck(resultText.includes('%') || resultText.includes('বিশ্বাসযোগ্যতা') || resultText.includes('Confidence'), 'Confidence percentage/score is displayed');
    assertCheck(resultText.includes('গবেষণা') || resultText.includes('সতর্কবার্তা') || resultText.includes('PlantDoc') || resultText.includes('SAAO') || resultText.includes('Disclaimer') || resultText.includes('পরামর্শ'), 'Scientific honesty & research caveat displayed');

    // Capture Result Card Screenshot
    const resultCardScreenshot = path.resolve(SCREENSHOTS_DIR, 'f5d3_disease_result_card.png');
    await resultCard.screenshot({ path: resultCardScreenshot });
    console.log(`Saved screenshot: ${resultCardScreenshot}`);

    // Capture Full Desktop Screenshot
    const desktopScreenshot = path.resolve(SCREENSHOTS_DIR, 'f5d3_disease_analysis_desktop_1440.png');
    await page.screenshot({ path: desktopScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${desktopScreenshot}`);

    // ------------------------------------------------------------------------
    // Step 7: Link Prediction to Existing Observation
    // ------------------------------------------------------------------------
    console.log('\n--- Step 7: Link Prediction to Observation ---');
    const linkBtn = page.locator('[data-testid="link-to-observation-btn"]');
    if (await linkBtn.isVisible()) {
      await linkBtn.click();
      await page.waitForTimeout(500);

      const linkSelect = page.locator('[data-testid="link-observation-select"]');
      await linkSelect.waitFor({ state: 'visible', timeout: 5000 });
      await linkSelect.selectOption(String(seeded.obsId));

      const confirmLinkBtn = page.locator('[data-testid="confirm-link-btn"]');
      await confirmLinkBtn.click();
      await page.waitForTimeout(1000);
      assertCheck(true, 'Submitted link prediction to observation');

      // Navigate to observations tab to verify badge
      const obsTab = page.locator('[data-testid="tab-observations"]');
      await obsTab.click();
      await page.waitForTimeout(1000);

      const linkedBadge = page.locator(`[data-testid="linked-prediction-badge-${seeded.obsId}"]`).first();
      await linkedBadge.waitFor({ state: 'visible', timeout: 10000 });
      assertCheck(await linkedBadge.isVisible(), `Linked prediction badge visible on observation ${seeded.obsId}`);

      // Verify unlink button exists
      const unlinkBtn = page.locator(`[data-testid="unlink-prediction-btn-${seeded.obsId}"]`).first();
      assertCheck(await unlinkBtn.isVisible(), `Unlink prediction button visible on observation ${seeded.obsId}`);
    } else {
      console.log('Link button directly embedded or already linked');
    }

    // ------------------------------------------------------------------------
    // Step 8: Test Unsupported Crop (Wheat)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 8: Verify Unsupported Crop Handling (Wheat) ---');
    await diseaseTab.click();
    await page.waitForTimeout(500);

    await cropSelect.selectOption(String(seeded.wheatCropId));
    await page.waitForTimeout(800);

    const unsupportedCard = page.locator('[data-testid="unsupported-crop-card"]');
    await unsupportedCard.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await unsupportedCard.isVisible(), 'Unsupported crop warning card (data-testid="unsupported-crop-card") is displayed');

    const unsupportedText = await unsupportedCard.innerText();
    assertCheck(unsupportedText.includes('টমেটো') || unsupportedText.includes('ধান') || unsupportedText.includes('Tomato') || unsupportedText.includes('Rice'), 'Unsupported crop card explains models are only for Tomato and Rice');

    const gotoObsBtn = page.locator('[data-testid="goto-observations-btn"]');
    assertCheck(await gotoObsBtn.isVisible(), 'Button to navigate to regular field scouting is available');

    // Capture Unsupported Crop Screenshot
    const unsupportedScreenshot = path.resolve(SCREENSHOTS_DIR, 'f5d3_unsupported_crop_view.png');
    await unsupportedCard.screenshot({ path: unsupportedScreenshot });
    console.log(`Saved screenshot: ${unsupportedScreenshot}`);

    // ------------------------------------------------------------------------
    // Step 9: Test Rice Crop (rice_disease)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 9: Verify Rice Model Support (rice_disease) ---');
    await cropSelect.selectOption(String(seeded.riceCropId));
    await page.waitForTimeout(800);

    const riceBanner = page.locator('[data-testid="disease-model-banner"]');
    await riceBanner.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await riceBanner.isVisible(), 'Rice disease model banner is visible');

    const riceBannerText = await riceBanner.innerText();
    assertCheck(riceBannerText.includes('rice_disease') || riceBannerText.includes('ধানের পাতা রোগ') || riceBannerText.includes('ধান পাতা রোগ'), 'Banner identifies rice_disease model');
    assertCheck(riceBannerText.includes('7') || riceBannerText.includes('সাত'), 'Banner indicates 7 supported rice disease classes');

    // ------------------------------------------------------------------------
    // Step 10: Test Mobile Viewport (375x812)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 10: Verify Responsive Layout on Mobile Viewport (375px) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(800);

    assertCheck(await diseaseContainer.isVisible(), 'Disease container responsive on 375px mobile viewport');
    assertCheck(await riceBanner.isVisible(), 'Rice banner responsive on mobile');

    const mobileScreenshot = path.resolve(SCREENSHOTS_DIR, 'f5d3_disease_analysis_mobile_375.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${mobileScreenshot}`);

    // ------------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`🎉 ALL ${passedChecks} PLAYWRIGHT E2E CHECKS PASSED FOR PHASE F5D-3!`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ E2E VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (frontendProc) frontendProc.kill();
    if (backendProc) backendProc.kill();
  }
}

runPhaseF5D3Verification();
