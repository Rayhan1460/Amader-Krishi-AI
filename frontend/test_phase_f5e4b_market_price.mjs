// Phase F5E-4B Automated Playwright E2E Verification Suite
// Platform: আমাদের কৃষি AI
// Scope: Historical Market Price Intelligence (Tomato & Boro Rice) with Baseline Supremacy

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

async function runPhaseF5E4BVerification() {
  console.log('=== [PHASE F5E-4B PLAYWRIGHT E2E VERIFICATION SUITE] ===\n');

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

    // --- Step 2: Harvest Management Integration & Market Intelligence Banner ---
    console.log('\n--- Step 2: Harvest Management Integration & Market Intelligence Banner ---');
    const harvestTab = page.locator('[data-testid="sidebar-tab-harvest"]').first();
    await harvestTab.click();
    await page.waitForTimeout(1000);

    const marketBanner = page.locator('[data-testid="market-price-intelligence-banner"]');
    await marketBanner.waitFor({ state: 'visible', timeout: 8000 });
    assertStep(await marketBanner.isVisible(), '2. Market Price Intelligence banner rendered on Harvest Dashboard');

    const bannerText = await marketBanner.innerText();
    assertStep(
      bannerText.includes('ঐতিহাসিক পাইকারি বাজারদর') && bannerText.includes('পৃথক রাখা হয়েছে'),
      '3. Banner explicitly distinguishes actual harvest records from market price benchmarks'
    );

    const bannerScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e4b_harvest_market_separation_banner.png');
    await marketBanner.screenshot({ path: bannerScreenshotPath });
    copyToArtifacts('f5e4b_harvest_market_separation_banner.png');

    // Click banner action button to navigate
    const gotoMarketBtn = page.locator('[data-testid="goto-market-price-btn"]');
    await gotoMarketBtn.click();
    await page.waitForTimeout(1000);

    // Verify Market Price tool is active
    const tomatoCommodityBtn = page.locator('[data-testid="tomato-commodity-btn"]');
    await tomatoCommodityBtn.waitFor({ state: 'visible', timeout: 8000 });
    assertStep(await tomatoCommodityBtn.isVisible(), '4. Navigated smoothly to Market Price Tool from Harvest Dashboard');

    // --- Step 3: Historical Cutoff (Feb 22, 2026) & Baseline Superiority Banner ---
    console.log('\n--- Step 3: Historical Cutoff Notice & Baseline Superiority Banner ---');
    const cutoffText = await page.locator('text=২২ ফেব্রুয়ারি, ২০২৬').first().isVisible();
    assertStep(cutoffText, '5. Explicit historical series cutoff date (Feb 22, 2026) displayed');

    const baselineBanner = page.locator('[data-testid="baseline-superiority-banner"]');
    assertStep(await baselineBanner.isVisible(), '6. Baseline superiority banner explains why naive baseline is primary advice');

    const baselineBannerText = await baselineBanner.innerText();
    assertStep(
      baselineBannerText.includes('৫.৮৪') || baselineBannerText.includes('5.84'),
      '7. Tomato baseline test MAE (5.84 BDT/kg) displayed prominently'
    );

    // --- Step 4: Commodity Switcher (Tomato vs Boro Rice) ---
    console.log('\n--- Step 4: Commodity Switcher (Tomato vs Boro Rice) ---');
    const riceCommodityBtn = page.locator('[data-testid="rice-commodity-btn"]');
    await riceCommodityBtn.click();
    await page.waitForTimeout(600);

    const boroInput = page.locator('[data-testid="input-lag_1"]');
    const boroVal = await boroInput.inputValue();
    assertStep(boroVal === '29.2', `8. Switched to Boro Rice and loaded Boro default benchmark (lag_1 = 29.2, got ${boroVal})`);

    // Switch back to Tomato
    await tomatoCommodityBtn.click();
    await page.waitForTimeout(600);
    const tomatoVal = await boroInput.inputValue();
    assertStep(tomatoVal === '45.0', `9. Switched back to Tomato and loaded Tomato benchmark (lag_1 = 45.0, got ${tomatoVal})`);

    // --- Step 5: Clear Inputs, Missing Inputs Warning & Submit Disabled ---
    console.log('\n--- Step 5: Clear Inputs, Missing Inputs Warning & Submit Disabled ---');
    const clearBtn = page.locator('[data-testid="clear-inputs-btn"]');
    await clearBtn.click();
    await page.waitForTimeout(400);

    const missingWarning = page.locator('[data-testid="missing-inputs-warning"]');
    await missingWarning.waitFor({ state: 'visible', timeout: 5000 });
    assertStep(await missingWarning.isVisible(), '10. Missing inputs warning appears when all inputs are cleared');

    const submitBtn = page.locator('[data-testid="submit-market-price-btn"]');
    assertStep(await submitBtn.isDisabled(), '11. Submit button is disabled when inputs are missing');

    // --- Step 6: Load Verified Historical Benchmark Preset ---
    console.log('\n--- Step 6: Load Verified Historical Benchmark Preset ---');
    const peakPresetBtn = page.locator('[data-testid="preset-tomato_peak"]');
    await peakPresetBtn.click();
    await page.waitForTimeout(400);

    assertStep(!(await missingWarning.isVisible()), '12. Missing inputs warning disappears after loading preset');
    assertStep(await submitBtn.isDisabled(), '13. Submit button remains disabled until disclaimer checkbox is accepted');

    // Accept disclaimer checkbox
    const disclaimerBox = page.locator('[data-testid="market-disclaimer-checkbox"]');
    await disclaimerBox.check();
    await page.waitForTimeout(300);
    assertStep(await submitBtn.isEnabled(), '14. Submit button enabled after disclaimer accepted');

    // --- Step 7: Real ML Model Inference & Dedicated Baseline-Dominant Result Card ---
    console.log('\n--- Step 7: Real ML Model Inference & Dedicated Baseline-Dominant Result Card ---');
    await submitBtn.click();

    const resultCard = page.locator('[data-testid="market-price-result-card"]');
    await resultCard.waitFor({ state: 'visible', timeout: 12000 });
    assertStep(await resultCard.isVisible(), '15. Market price evaluation result card rendered');

    const recommendedPriceElem = page.locator('[data-testid="recommended-price-value"]');
    const recPriceText = await recommendedPriceElem.innerText();
    assertStep(recPriceText.includes('45.00'), `16. Primary recommended price is baseline lag_1 (45.00 BDT/kg, got ${recPriceText})`);

    // Verify baseline comparison card
    const comparisonCard = page.locator('[data-testid="baseline-comparison-card"]');
    await comparisonCard.waitFor({ state: 'visible', timeout: 5000 });
    assertStep(await comparisonCard.isVisible(), '17. Dedicated Baseline vs ML comparison card visible');

    const compText = await comparisonCard.innerText();
    assertStep(
      (compText.includes('Naive Baseline') || compText.includes('নেটিভ বেসলাইন')) &&
      (compText.includes('Random Forest') || compText.includes('র‍্যান্ডম ফরেস্ট')),
      '18. Comparison card displays both Naive Baseline and Random Forest Regressor'
    );

    const desktopScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e4b_market_price_desktop_1440.png');
    await page.screenshot({ path: desktopScreenshotPath });
    copyToArtifacts('f5e4b_market_price_desktop_1440.png');

    const compScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e4b_baseline_comparison_card.png');
    await comparisonCard.screenshot({ path: compScreenshotPath });
    copyToArtifacts('f5e4b_baseline_comparison_card.png');

    // --- Step 8: Expandable 10-Feature Inputs Audit Drawer ---
    console.log('\n--- Step 8: Expandable 10-Feature Inputs Audit Drawer ---');
    const auditToggleBtn = page.locator('[data-testid="toggle-audit-drawer-btn"]');
    await auditToggleBtn.click();
    await page.waitForTimeout(500);

    const auditTable = page.locator('[data-testid="inputs-audit-table"]');
    await auditTable.waitFor({ state: 'visible', timeout: 5000 });
    assertStep(await auditTable.isVisible(), '19. 10-Feature inputs audit drawer expanded');

    const auditRows = await auditTable.locator('tbody tr').count();
    assertStep(auditRows === 10, `20. Audit table lists all 10 features (found ${auditRows})`);

    const auditScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e4b_market_price_audit_drawer.png');
    await page.screenshot({ path: auditScreenshotPath });
    copyToArtifacts('f5e4b_market_price_audit_drawer.png');

    // --- Step 9: Verify Mobile Layout (375x812) ---
    console.log('\n--- Step 9: Verify Mobile Layout (375x812) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(800);

    assertStep(await resultCard.isVisible(), '21. Result card responsive and visible on 375px mobile viewport');

    const mobileScreenshotPath = path.resolve(SCREENSHOTS_DIR, 'f5e4b_market_price_mobile_375.png');
    await page.screenshot({ path: mobileScreenshotPath });
    copyToArtifacts('f5e4b_market_price_mobile_375.png');

    // --- Step 10: Strict Harvest vs Market Separation Check ---
    console.log('\n--- Step 10: Strict Harvest vs Market Separation Check ---');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);

    // Fetch harvest records count via backend API before/after
    const token = await page.evaluate(() => 
      sessionStorage.getItem('agrisphere_session_token') || 
      localStorage.getItem('agrisphere_session_token') || 
      localStorage.getItem('access_token')
    );
    const harvestRes = await fetch(`${BACKEND_URL}/harvest/records`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const harvestRecords = await harvestRes.json();
    assertStep(
      Array.isArray(harvestRecords),
      '22. Harvest records API query succeeds'
    );
    assertStep(
      harvestRecords.length === 0,
      `23. Running market price predictions generated 0 harvest records (records count = ${harvestRecords.length})`
    );

    console.log('\n======================================================');
    console.log(`TOTAL E2E VERIFICATIONS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('======================================================\n');
  } finally {
    if (browser) await browser.close();
    if (backendProc) backendProc.kill();
    if (frontendProc) frontendProc.kill();
  }
}

runPhaseF5E4BVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN E2E SUITE]:', err);
  process.exit(1);
});
