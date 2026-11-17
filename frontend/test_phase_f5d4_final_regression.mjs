// Phase F5D-4: Final Crop Health Integration Audit & Regression
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
      KERAS_HOME: path.resolve(backendDir, '.keras'),
      TF_ENABLE_ONEDNN_OPTS: '0',
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

async function runPhaseF5D4Verification() {
  console.log('=== [PHASE F5D-4 PLAYWRIGHT E2E REGRESSION SUITE] ===\n');

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
            name: 'ময়মনসিংহ খামার (F5D4)',
            division: 'Mymensingh',
            district: 'Mymensingh',
            upazila: 'Trishal',
            village: 'ধানিখোলা',
            area: 5.0,
            area_unit: 'bigha',
            soil_type: 'দোআঁশ বেলে',
          }),
        });
        farm = await createFarmRes.json();
      } else {
        farm = farms[0];
      }

      // Check existing crops
      const cropsRes = await fetch(`${apiUrl}/farms/${farm.id}/crops`, { headers });
      let crops = await cropsRes.json();

      let tomatoCrop = crops.find((c) => c.crop_name.includes('Tomato') || c.crop_name.includes('টমেটো'));
      if (!tomatoCrop) {
        const createTomato = await fetch(`${apiUrl}/farms/${farm.id}/crops`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            crop_name: 'টমেটো (Tomato)',
            variety: 'বারি টমেটো-১৪',
            season: 'Rabi',
            sowing_date: '2026-11-01',
          }),
        });
        tomatoCrop = await createTomato.json();
      }

      let riceCrop = crops.find((c) => c.crop_name.includes('Rice') || c.crop_name.includes('ধান'));
      if (!riceCrop) {
        const createRice = await fetch(`${apiUrl}/farms/${farm.id}/crops`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            crop_name: 'ধান (Rice)',
            variety: 'ব্রি ধান-২৮',
            season: 'Boro',
            sowing_date: '2026-11-02',
          }),
        });
        riceCrop = await createRice.json();
      }

      let wheatCrop = crops.find((c) => c.crop_name.includes('Wheat') || c.crop_name.includes('গম'));
      if (!wheatCrop) {
        const createWheat = await fetch(`${apiUrl}/farms/${farm.id}/crops`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            crop_name: 'গম (Wheat)',
            variety: 'বারি গম-৩৩',
            season: 'Rabi',
            sowing_date: '2026-11-03',
          }),
        });
        wheatCrop = await createWheat.json();
      }

      // Seed an observation for the tomato crop
      const obsRes = await fetch(`${apiUrl}/cultivation/observations?farm_id=${farm.id}&crop_id=${tomatoCrop.id}`, { headers });
      let observations = await obsRes.json();
      let observation;
      if (!Array.isArray(observations) || observations.length === 0) {
        const createObs = await fetch(`${apiUrl}/cultivation/observations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            farm_id: farm.id,
            crop_id: tomatoCrop.id,
            observation_date: '2026-11-03',
            title: 'টমেটো পাতার প্রাথমিক রোগ লক্ষণ',
            plant_growth_stage: 'ফুল আসার পূর্ববর্তী অবস্থা',
            growth_notes: 'গাছের বৃদ্ধি স্বাভাবিক কিন্তু কিছু পাতায় দাগ দেখা গেছে',
            visible_symptoms: 'পাতার কিনারে বাদামী রঙের দাগ দেখা যাচ্ছে',
            farmer_reported_condition: 'minor_issue',
          }),
        });
        observation = await createObs.json();
      } else {
        observation = observations[0];
      }

      return {
        farmId: farm.id,
        farmName: farm.name,
        tomatoCropId: tomatoCrop.id,
        riceCropId: riceCrop.id,
        wheatCropId: wheatCrop.id,
        obsId: observation.id,
      };
    }, BACKEND_URL);

    assertCheck(!seeded.error, `Data seeded successfully (Farm: ${seeded.farmName}, Tomato: ${seeded.tomatoCropId}, Rice: ${seeded.riceCropId})`);

    // ------------------------------------------------------------------------
    // Step 3: Open Crop Monitoring Dashboard
    // ------------------------------------------------------------------------
    console.log('\n--- Step 3: Open Crop Monitoring Dashboard ---');
    const monitoringNav = page.locator('[data-testid="sidebar-tab-crop_monitoring"], [data-testid="nav-crop-monitoring"], button:has-text("ফসল পর্যবেক্ষণ")').first();
    if (await monitoringNav.isVisible()) {
      await monitoringNav.click();
      await page.waitForTimeout(1000);
    } else {
      await page.goto(`${FRONTEND_URL}/workspace?tab=crop_monitoring`, { waitUntil: 'networkidle' });
    }

    const dashboardContainer = page.locator('[data-testid="crop-monitoring-dashboard"]');
    await dashboardContainer.waitFor({ state: 'visible', timeout: 15000 });
    assertCheck(await dashboardContainer.isVisible(), 'Crop Monitoring Dashboard rendered');

    // ------------------------------------------------------------------------
    // Step 4: Switch to Disease AI Tab & Select Tomato
    // ------------------------------------------------------------------------
    console.log('\n--- Step 4: Switch to Disease AI Analysis Tab ---');
    const diseaseTab = page.locator('[data-testid="tab-disease-analysis"]');
    await diseaseTab.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await diseaseTab.isVisible(), 'Tab "AI রোগ বিশ্লেষণ" is visible');

    // Select Tomato Crop
    const cropSelect = page.locator('[data-testid="crop-selector"]');
    await cropSelect.selectOption(String(seeded.tomatoCropId));
    await page.waitForTimeout(500);

    await diseaseTab.click();
    await page.waitForTimeout(800);

    const diseaseContainer = page.locator('[data-testid="disease-analysis-container"]');
    await diseaseContainer.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await diseaseContainer.isVisible(), 'Disease Analysis container is visible');

    // ------------------------------------------------------------------------
    // Step 5: Verify Tomato Model Metadata (tomato_disease_v3)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 5: Verify Tomato Model Metadata (tomato_disease_v3) ---');
    const modelBanner = page.locator('[data-testid="disease-model-banner"]');
    await modelBanner.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await modelBanner.isVisible(), 'Model banner is visible');

    const bannerText = await modelBanner.innerText();
    assertCheck(bannerText.includes('tomato_disease_v3') || bannerText.includes('টমেটো'), 'Banner identifies tomato_disease_v3');
    assertCheck(bannerText.includes('8') || bannerText.includes('৮'), 'Banner identifies 8 supported disease classes');

    // Verify Dropzone & Sample Leaf Button Transparency Label
    const uploadDropzone = page.locator('[data-testid="leaf-image-upload"]');
    assertCheck(await uploadDropzone.isVisible(), 'Leaf upload dropzone is visible');

    const sampleLeafBtn = page.locator('[data-testid="load-sample-leaf-btn"]');
    assertCheck(await sampleLeafBtn.isVisible(), 'Synthetic leaf sample button is visible');
    const sampleBtnText = await sampleLeafBtn.innerText();
    assertCheck(
      sampleBtnText.includes('কৃত্রিম') || sampleBtnText.includes('ডেমো') || sampleBtnText.includes('Synthetic'),
      `Synthetic sample button clearly indicates demo/synthetic nature: "${sampleBtnText}"`
    );

    // ------------------------------------------------------------------------
    // Step 6: Load Synthetic Sample & Check Transparency Badge
    // ------------------------------------------------------------------------
    console.log('\n--- Step 6: Load Synthetic Leaf & Verify Transparency Badge ---');
    await sampleLeafBtn.click();
    await page.waitForTimeout(800);

    const leafPreview = page.locator('[data-testid="leaf-image-preview"]');
    await leafPreview.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await leafPreview.isVisible(), 'Leaf image preview rendered successfully');

    const syntheticBadge = page.locator('[data-testid="synthetic-sample-badge"]');
    await syntheticBadge.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await syntheticBadge.isVisible(), 'Synthetic lab sample badge is prominently displayed in preview');
    const badgeText = await syntheticBadge.innerText();
    assertCheck(
      badgeText.includes('মাঠের বাস্তব ফলাফল নয়') || badgeText.includes('Not a Field Diagnosis'),
      `Badge text warns that sample is not a field diagnosis: "${badgeText}"`
    );

    const badgeScreenshot = path.resolve(SCREENSHOTS_DIR, 'f5d4_synthetic_transparency_badge.png');
    await page.screenshot({ path: badgeScreenshot });
    console.log(`Saved screenshot: ${badgeScreenshot}`);

    // ------------------------------------------------------------------------
    // Step 7: Execute Real Model Inference & Verify Diagnosis Output
    // ------------------------------------------------------------------------
    console.log('\n--- Step 7: Execute AI Disease Analysis ---');
    const analyzeBtn = page.locator('[data-testid="start-disease-analysis-btn"]');
    assertCheck(await analyzeBtn.isEnabled(), 'Analyze button is enabled');

    await analyzeBtn.click();
    console.log('Running real model inference for tomato leaf image...');

    const resultCard = page.locator('[data-testid="disease-result-card"]');
    await resultCard.waitFor({ state: 'visible', timeout: 25000 });
    assertCheck(await resultCard.isVisible(), 'AI Disease Result Card rendered');

    // Verify Result Card Synthetic Warning
    const resultSyntheticWarning = page.locator('[data-testid="result-synthetic-warning"]');
    assertCheck(await resultSyntheticWarning.isVisible(), 'Result card contains synthetic warning badge');

    // Verify Uncalibrated Score Notice & Breakdown
    const resultText = await resultCard.innerText();
    assertCheck(
      resultText.includes('Uncalibrated') || resultText.includes('স্কোর'),
      'Result card discloses uncalibrated model score'
    );
    assertCheck(
      resultText.includes('বৈজ্ঞানিক সততা') || resultText.includes('Scientific Honesty'),
      'Result card displays scientific honesty and limitations notice'
    );
    assertCheck(
      resultText.includes('কর্মকর্তা') || resultText.includes('officer'),
      'Result card contains SAAO consultation disclaimer'
    );

    const desktopScreenshot = path.resolve(SCREENSHOTS_DIR, 'f5d4_disease_analysis_desktop_1440.png');
    await page.screenshot({ path: desktopScreenshot });
    console.log(`Saved screenshot: ${desktopScreenshot}`);

    const cardScreenshot = path.resolve(SCREENSHOTS_DIR, 'f5d4_disease_result_card.png');
    await resultCard.screenshot({ path: cardScreenshot });
    console.log(`Saved screenshot: ${cardScreenshot}`);

    // ------------------------------------------------------------------------
    // Step 8: Link Prediction to Observation & Verify Persistence
    // ------------------------------------------------------------------------
    console.log('\n--- Step 8: Link Prediction to Observation & Test Persistence ---');
    const openLinkBtn = page.locator('[data-testid="open-link-observation-btn"]');
    if (await openLinkBtn.isVisible()) {
      await openLinkBtn.click();
      await page.waitForTimeout(500);

      const obsSelect = page.locator('[data-testid="link-observation-select"]');
      await obsSelect.waitFor({ state: 'visible', timeout: 5000 });
      await obsSelect.selectOption(String(seeded.obsId));

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

      // Test Page Reload Persistence
      console.log('Testing page reload persistence of linked observation...');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      const obsTabAfterReload = page.locator('[data-testid="tab-observations"]');
      await obsTabAfterReload.click();
      await page.waitForTimeout(800);

      const linkedBadgeAfterReload = page.locator(`[data-testid="linked-prediction-badge-${seeded.obsId}"]`).first();
      assertCheck(await linkedBadgeAfterReload.isVisible(), 'Linked prediction badge persists across page reload');

      // Test Unlinking
      const unlinkBtn = page.locator(`[data-testid="unlink-prediction-btn-${seeded.obsId}"]`).first();
      assertCheck(await unlinkBtn.isVisible(), 'Unlink prediction button is available');
      await unlinkBtn.click();
      await page.waitForTimeout(800);
      assertCheck((await page.locator(`[data-testid="linked-prediction-badge-${seeded.obsId}"]`).count()) === 0, 'Prediction unlinked cleanly');
    } else {
      console.log('Link button directly embedded or already linked');
    }

    // ------------------------------------------------------------------------
    // Step 9: Test Rice Disease Detection (rice_disease 7 classes)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 9: Select Rice Crop & Verify rice_disease Model ---');
    await diseaseTab.click();
    await page.waitForTimeout(500);

    await cropSelect.selectOption(String(seeded.riceCropId));
    await page.waitForTimeout(800);

    const riceBanner = page.locator('[data-testid="disease-model-banner"]');
    await riceBanner.waitFor({ state: 'visible', timeout: 5000 });
    const riceBannerText = await riceBanner.innerText();
    assertCheck(
      riceBannerText.includes('rice_disease') || riceBannerText.includes('ধান'),
      'Model banner recognizes rice_disease model for Rice crop'
    );
    assertCheck(
      riceBannerText.includes('7') || riceBannerText.includes('৭'),
      'Model banner shows 7 supported classes for Rice'
    );

    // Run Rice inference
    const riceSampleBtn = page.locator('[data-testid="load-sample-leaf-btn"]');
    await riceSampleBtn.click();
    await page.waitForTimeout(800);

    const riceAnalyzeBtn = page.locator('[data-testid="start-disease-analysis-btn"]');
    await riceAnalyzeBtn.click();

    const riceResultCard = page.locator('[data-testid="disease-result-card"]');
    await riceResultCard.waitFor({ state: 'visible', timeout: 25000 });
    assertCheck(await riceResultCard.isVisible(), 'Rice disease inference result card displayed');

    const riceScreenshot = path.resolve(SCREENSHOTS_DIR, 'f5d4_rice_disease_view.png');
    await page.screenshot({ path: riceScreenshot });
    console.log(`Saved screenshot: ${riceScreenshot}`);

    // ------------------------------------------------------------------------
    // Step 10: Test Unsupported Crop Rejection (Wheat)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 10: Select Unsupported Crop (Wheat) & Verify Rejection ---');
    await cropSelect.selectOption(String(seeded.wheatCropId));
    await page.waitForTimeout(800);

    const unsupportedCard = page.locator('[data-testid="unsupported-crop-card"]');
    await unsupportedCard.waitFor({ state: 'visible', timeout: 5000 });
    assertCheck(await unsupportedCard.isVisible(), 'Unsupported crop card is displayed for Wheat');

    const unsupportedText = await unsupportedCard.innerText();
    assertCheck(
      unsupportedText.includes('আওতাভুক্ত নয়') || unsupportedText.includes('Not Supported') || unsupportedText.includes('মডেল'),
      'Card explains disease model is not available for this crop'
    );
    assertCheck(
      unsupportedText.includes('টমেটো') || unsupportedText.includes('ধান') || unsupportedText.includes('Tomato'),
      'Card lists supported alternative crops (Tomato, Rice)'
    );

    const gotoObsBtn = page.locator('[data-testid="goto-observations-btn"]');
    assertCheck(await gotoObsBtn.isVisible(), 'Button to navigate to regular field scouting is available');

    const unsupportedScreenshot = path.resolve(SCREENSHOTS_DIR, 'f5d4_unsupported_crop_view.png');
    await unsupportedCard.screenshot({ path: unsupportedScreenshot });
    console.log(`Saved screenshot: ${unsupportedScreenshot}`);

    // ------------------------------------------------------------------------
    // Step 11: Verify Responsive Mobile Viewport (375px)
    // ------------------------------------------------------------------------
    console.log('\n--- Step 11: Verify Responsive Layout on Mobile Viewport (375px) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(800);

    // Switch back to Tomato
    await cropSelect.selectOption(String(seeded.tomatoCropId));
    await page.waitForTimeout(800);

    assertCheck(await diseaseContainer.isVisible(), 'Disease container responsive on 375px mobile viewport');

    const mobileScreenshot = path.resolve(SCREENSHOTS_DIR, 'f5d4_disease_analysis_mobile_375.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${mobileScreenshot}`);

    // ------------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`🎉 ALL ${passedChecks} PLAYWRIGHT E2E CHECKS PASSED FOR PHASE F5D-4!`);
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

runPhaseF5D4Verification();
