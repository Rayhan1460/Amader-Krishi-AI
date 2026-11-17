// Phase F5E-4A Automated Playwright E2E Verification Suite
// Platform: আমাদের কৃষি AI
// Scope: Regional Crop Yield AI Integration & Scientific Honesty

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const BACKEND_PORT = 8001;
const FRONTEND_PORT = 5174;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

const SCREENSHOTS_DIR = path.resolve(PROJECT_ROOT, 'docs', 'screenshots');
const ARTIFACT_DIR = 'C:\\Users\\hp\\.gemini\\antigravity\\brain\\05578b8e-8852-45be-b1d8-7d64d799ac59';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function copyToArtifacts(filename) {
  const src = path.resolve(SCREENSHOTS_DIR, filename);
  const dest = path.resolve(ARTIFACT_DIR, filename);
  if (fs.existsSync(src)) {
    try {
      fs.copyFileSync(src, dest);
      console.log(`[ARTIFACT COPY] ${filename} copied to brain artifact directory`);
    } catch (e) {
      console.error(`[ARTIFACT ERROR] Failed to copy ${filename}:`, e.message);
    }
  }
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404 || res.status === 200) {
        return true;
      }
    } catch (e) {
      // wait
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout waiting for server at ${url}`);
}

async function runPhaseF5E4AVerification() {
  console.log('=== [PHASE F5E-4A PLAYWRIGHT E2E VERIFICATION SUITE] ===\n');

  let backendProc = null;
  let frontendProc = null;
  let browser = null;

  try {
    // 1. Start Isolated Backend Server on port 8001
    console.log('Starting isolated test backend server on port 8001...');
    const backendDir = path.resolve(PROJECT_ROOT, 'backend');
    const pythonExe = path.resolve(backendDir, '.venv2', 'Scripts', 'python.exe');
    const runServerPy = path.resolve(backendDir, 'run_test_server.py');
    const testDbPath = path.resolve(backendDir, 'tests', 'e2e_test.db');

    backendProc = spawn(pythonExe, ['-u', runServerPy], {
      cwd: backendDir,
      env: {
        ...process.env,
        DATABASE_URL: `sqlite:///${testDbPath.replace(/\\/g, '/')}`,
        ENVIRONMENT: 'testing',
        TEST_PORT: String(BACKEND_PORT),
        PYTHONUNBUFFERED: '1',
      },
      stdio: 'pipe',
    });

    backendProc.stdout.on('data', (d) => process.stdout.write(`[BACKEND] ${d}`));
    backendProc.stderr.on('data', (d) => process.stderr.write(`[BACKEND ERR] ${d}`));

    await waitForServer(`${BACKEND_URL}/health`);
    console.log('  ✓ Backend server healthy on port 8001');

    // 2. Start Isolated Frontend Server on port 5174
    console.log('Starting isolated test frontend server on port 5174...');
    const frontendDir = path.resolve(PROJECT_ROOT, 'frontend');
    const viteBin = path.resolve(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');

    frontendProc = spawn('node', [viteBin, '--host', '127.0.0.1', '--port', String(FRONTEND_PORT), '--mode', 'test'], {
      cwd: frontendDir,
      env: {
        ...process.env,
        VITE_API_BASE_URL: BACKEND_URL,
        VITE_API_URL: BACKEND_URL,
        VITE_BACKEND_PROXY_TARGET: BACKEND_URL,
      },
      stdio: 'pipe',
    });

    frontendProc.stdout.on('data', (d) => process.stdout.write(`[FRONTEND] ${d}`));
    frontendProc.stderr.on('data', (d) => process.stderr.write(`[FRONTEND ERR] ${d}`));

    await waitForServer(FRONTEND_URL);
    console.log('  ✓ Frontend server ready on port 5174');

    // 3. Launch Edge/Chromium Browser
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

    // --- Step 1: Login with Demo Account ---
    console.log('\n--- Step 1: Login with Demo Account ---');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    const demoBtn = page.locator('#demo-login-button').first();
    await demoBtn.click();
    await page.waitForFunction(() => window.location.pathname.includes('/workspace'), { timeout: 15000 });
    assertStep(page.url().includes('/workspace'), '1. Demo login successful and routed to /workspace');

    // --- Step 2: Harvest Management Integration & Navigation Link ---
    console.log('\n--- Step 2: Harvest Management Integration & Navigation Link ---');
    const harvestTab = page.locator('[data-testid="sidebar-tab-harvest"]').first();
    await harvestTab.click();
    await page.waitForTimeout(1000);

    const researchBanner = page.locator('[data-testid="regional-yield-research-banner"]');
    await researchBanner.waitFor({ state: 'visible', timeout: 8000 });
    assertStep(await researchBanner.isVisible(), '2. Regional Yield Research banner rendered on Harvest Dashboard');

    const bannerText = await researchBanner.innerText();
    assertStep(
      bannerText.includes('গবেষণামূলক') && bannerText.includes('প্রকৃত ফসল সংগ্রহের তথ্য'),
      '3. Banner explicitly distinguishes actual harvest records from AI research'
    );

    const bannerScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e4a_harvest_ai_separation_banner.png');
    await researchBanner.screenshot({ path: bannerScreenshotPath });
    copyToArtifacts('f5e4a_harvest_ai_separation_banner.png');

    // Click banner action button
    const gotoYieldBtn = page.locator('[data-testid="goto-regional-yield-btn"]');
    await gotoYieldBtn.click();
    await page.waitForTimeout(1000);

    const yieldTool = page.locator('[data-testid="regional-yield-tool"]');
    await yieldTool.waitFor({ state: 'visible', timeout: 8000 });
    assertStep(await yieldTool.isVisible(), '4. Navigated smoothly to Regional Yield Tool from Harvest Dashboard');

    // --- Step 3: Scientific Honesty Banner & Limitations ---
    console.log('\n--- Step 3: Scientific Honesty Banner & Limitations ---');
    const toolText = await yieldTool.innerText();
    assertStep(
      toolText.includes('গবেষণামূলক আঞ্চলিক ধান ফলন পূর্বাভাস') || toolText.includes('Regional Rice Yield AI Research Model'),
      '5. Tool header displays clear research model branding'
    );
    assertStep(
      toolText.includes('ব্যক্তিগত খামারের বা কোনো নির্দিষ্ট প্লটের নিশ্চিত ফলন') || toolText.includes('NOT an individual-farm harvest guarantee'),
      '6. Explicit scientific honesty disclaimer discloses macro limitations'
    );

    // --- Step 4: Verify 18 Supported Districts & 3 Rice Seasons ---
    console.log('\n--- Step 4: Verify 18 Supported Districts & 3 Rice Seasons ---');
    const districtSelect = page.locator('[data-testid="input-district"]');
    const districtOptions = await districtSelect.locator('option').allInnerTexts();
    const cleanDistricts = districtOptions.filter(d => !d.includes('--'));
    assertStep(cleanDistricts.length === 18, `7. Exact 18 trained districts present in dropdown (found ${cleanDistricts.length})`);
    assertStep(cleanDistricts.includes('Bogura') && cleanDistricts.includes('Dinajpur') && cleanDistricts.includes('Comilla'), 'Supported districts include Bogura, Dinajpur, Comilla');
    assertStep(!cleanDistricts.includes('Gazipur') && !cleanDistricts.includes('Dhaka'), 'Unindexed districts (Gazipur, Dhaka) strictly excluded');

    const seasonSelect = page.locator('[data-testid="input-season"]');
    const seasonOptions = await seasonSelect.locator('option').allInnerTexts();
    const cleanSeasons = seasonOptions.filter(s => !s.includes('--'));
    assertStep(cleanSeasons.length === 3, '8. Exact 3 rice seasons present (Aman, Aus, Boro)');

    // --- Step 5: Missing Inputs Validation & No Fabricated Defaults ---
    console.log('\n--- Step 5: Missing Inputs Validation & No Fabricated Defaults ---');
    const clearBtn = page.locator('[data-testid="clear-inputs-btn"]');
    await clearBtn.click();
    await page.waitForTimeout(500);

    const warningBox = page.locator('[data-testid="missing-inputs-warning"]');
    await warningBox.waitFor({ state: 'visible', timeout: 5000 });
    assertStep(await warningBox.isVisible(), '9. Missing inputs warning appears when fields are cleared');

    const warningText = await warningBox.innerText();
    assertStep(warningText.includes('২০টি'), '10. Warning indicates missing input count among 20 features');

    const submitBtn = page.locator('[data-testid="submit-yield-btn"]');
    assertStep(await submitBtn.isDisabled(), '11. Run prediction button is disabled when inputs are missing');

    // --- Step 6: Load Verified Historical Benchmark Preset (Bogura Aman) ---
    console.log('\n--- Step 6: Load Verified Historical Benchmark Preset ---');
    const boguraPresetBtn = page.locator('[data-testid="preset-bogura-btn"]');
    await boguraPresetBtn.click();
    await page.waitForTimeout(500);

    assertStep(!(await warningBox.isVisible()), '12. Warning disappears after loading complete benchmark');
    assertStep(await submitBtn.isEnabled(), '13. Prediction button enabled with complete 20 features');

    // --- Step 7: Real ML Model Inference & Result Card ---
    console.log('\n--- Step 7: Real ML Model Inference & Result Card ---');
    await submitBtn.click();

    const resultCard = page.locator('[data-testid="yield-result-card"]');
    await resultCard.waitFor({ state: 'visible', timeout: 12000 });
    assertStep(await resultCard.isVisible(), '14. Real ML inference executed and result card rendered');

    const yieldValueText = await page.locator('[data-testid="yield-output-value"]').innerText();
    const yieldNum = parseFloat(yieldValueText);
    assertStep(!isNaN(yieldNum) && yieldNum > 0.5 && yieldNum < 10.0, `15. Predicted yield is realistic positive value (${yieldNum} t/ha)`);

    const unitText = await page.locator('[data-testid="yield-output-unit"]').innerText();
    assertStep(unitText.includes('টন / হেক্টর') || unitText.includes('tonnes/ha'), '16. Output unit correctly displays tonnes/ha');

    const cardDisclaimer = page.locator('[data-testid="yield-scientific-disclaimer"]');
    assertStep(await cardDisclaimer.isVisible(), '17. Scientific honesty notice displayed prominently on result card');

    const desktopScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e4a_regional_yield_desktop_1440.png');
    await page.screenshot({ path: desktopScreenshotPath });
    copyToArtifacts('f5e4a_regional_yield_desktop_1440.png');

    // --- Step 8: Verify Complete 20-Feature Input Audit Drawer ---
    console.log('\n--- Step 8: Complete 20-Feature Input Audit Drawer ---');
    const auditToggleBtn = page.locator('button:has-text("২০টি ইনপুট উপাত্তের অডিট")');
    await auditToggleBtn.click();
    await page.waitForTimeout(500);

    const auditTable = page.locator('[data-testid="inputs-audit-table"]');
    await auditTable.waitFor({ state: 'visible', timeout: 5000 });
    assertStep(await auditTable.isVisible(), '18. Complete 20-feature input audit drawer expanded');

    const auditRows = await auditTable.locator('tbody tr').count();
    assertStep(auditRows === 20, `19. Audit table lists all 20 submitted features (found ${auditRows})`);

    const auditScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e4a_regional_yield_audit_drawer.png');
    await page.screenshot({ path: auditScreenshotPath });
    copyToArtifacts('f5e4a_regional_yield_audit_drawer.png');

    // --- Step 9: Verify Mobile Layout (375x812) ---
    console.log('\n--- Step 9: Verify Mobile Layout (375x812) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(800);

    assertStep(await yieldTool.isVisible(), '20. Regional Yield Research panel responsive on 375px mobile viewport');

    const mobileScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e4a_regional_yield_mobile_375.png');
    await page.screenshot({ path: mobileScreenshotPath });
    copyToArtifacts('f5e4a_regional_yield_mobile_375.png');

    // --- Step 10: Harvest vs AI Separation Check ---
    console.log('\n--- Step 10: Harvest vs AI Separation Check ---');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);

    await harvestTab.click();
    await page.waitForTimeout(1000);

    const harvestEmptyState = page.locator('[data-testid="harvest-empty-state"]');
    // If no harvest records were logged, empty state or zero records should persist
    const tableVisible = await page.locator('[data-testid="harvest-records-table"]').isVisible();
    assertStep(!tableVisible, '21. Zero harvest records created by running regional AI yield model (strict separation preserved)');

    console.log('\n======================================================');
    console.log(`TOTAL E2E VERIFICATIONS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('======================================================\n');
  } finally {
    if (browser) await browser.close();
    if (backendProc) backendProc.kill();
    if (frontendProc) frontendProc.kill();
  }
}

runPhaseF5E4AVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN E2E SUITE]:', err);
  process.exit(1);
});