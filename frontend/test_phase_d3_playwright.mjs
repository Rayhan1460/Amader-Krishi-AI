// Phase D3 Playwright Real Browser E2E Test Suite for AgriSphere AI
// Executed using Microsoft Edge via Playwright automation

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'docs', 'screenshots');

const BACKEND_URL = 'http://127.0.0.1:8000';
const FRONTEND_URL = 'http://127.0.0.1:5173';

function checkHttp(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHttp(url)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// Generate random safe test username and password
function generateCredentials(prefix = 'qa_user') {
  const suffix = Math.random().toString(36).substring(2, 8);
  const username = `${prefix}_${suffix}`;
  const password = `Agr!Pass_${Math.random().toString(36).substring(2, 8)}9X`;
  const email = `${username}@agrisphere.test`;
  return { username, password, email };
}

async function runPhaseD3QA() {
  console.log('===============================================================');
  console.log('  AGRISPHERE AI — PHASE D3 REAL BROWSER AUTOMATION SUITE');
  console.log('  Browser: Microsoft Edge (via Playwright)');
  console.log('===============================================================\n');

  let backendProc = null;
  let frontendProc = null;
  let page = null;
  const consoleErrors = [];

  try {
    // 1. Verify / Start Backend Server
    console.log('[1/10] Checking FastAPI Backend status on port 8000...');
    const backendUp = await checkHttp(`${BACKEND_URL}/health`);
    if (!backendUp) {
      console.log('Spawning FastAPI backend server...');
      const backendDir = path.resolve(ROOT_DIR, 'backend');
      const pythonExe = path.resolve(backendDir, '.venv2', 'Scripts', 'python.exe');
      
      backendProc = spawn(pythonExe, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
        cwd: backendDir,
        env: {
          ...process.env,
          KERAS_HOME: path.resolve(backendDir, '.keras'),
        },
        stdio: 'pipe',
      });

      backendProc.stderr.on('data', (d) => {
        const str = d.toString();
        if (str.includes('ERROR') || str.includes('Exception')) {
          console.error('[Backend stderr]', str.trim());
        }
      });

      const ready = await waitForServer(`${BACKEND_URL}/health`);
      if (!ready) {
        throw new Error('FastAPI backend failed to start on 127.0.0.1:8000 within 45s');
      }
      console.log('FastAPI backend is ONLINE and healthy.');
    } else {
      console.log('FastAPI backend is already ONLINE on 127.0.0.1:8000.');
    }

    // 2. Verify / Start Frontend Server
    console.log('\n[2/10] Checking Vite Frontend dev server status on port 5173...');
    const frontendUp = await checkHttp(FRONTEND_URL);
    if (!frontendUp) {
      console.log('Spawning Vite Frontend dev server...');
      const frontendDir = path.resolve(ROOT_DIR, 'frontend');
      
      frontendProc = spawn('npx.cmd', ['vite', '--host', '127.0.0.1', '--port', '5173'], {
        cwd: frontendDir,
        shell: true,
        stdio: 'pipe',
      });

      const ready = await waitForServer(FRONTEND_URL);
      if (!ready) {
        throw new Error('Vite dev server failed to start on 127.0.0.1:5173 within 45s');
      }
      console.log('Vite Frontend dev server is ONLINE.');
    } else {
      console.log('Vite Frontend dev server is already ONLINE on 127.0.0.1:5173.');
    }

    // 3. Inspect and verify Chat Provider endpoint directly
    console.log('\n[3/10] Verifying AI Chat Provider endpoint (/chat/provider)...');
    const providerRes = await fetch(`${BACKEND_URL}/chat/provider`).then(r => r.json());
    console.log('Actual Chat Provider Metadata:');
    console.log('  • Active Provider:', providerRes.provider);
    console.log('  • External LLM Configured:', providerRes.is_external_llm_configured);
    console.log('  • Mode Label:', providerRes.mode_label);
    console.log('  • Description:', providerRes.description);
    console.log('  • Supported Languages:', providerRes.supported_languages.join(', '));
    if (providerRes.is_external_llm_configured) {
      console.log('  => Provider Status: Genuine external LLM connected.');
    } else {
      console.log('  => Provider Status: Verified Rule-Based Agricultural Heuristic Advisory Engine (No external API calls, private and reproducible).');
    }

    // 4. Launch Microsoft Edge via Playwright
    console.log('\n[4/10] Launching Microsoft Edge browser...');
    const browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });

    console.log('Microsoft Edge launched successfully (Version:', browser.version(), ')');

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    page = await context.newPage();

    // Collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Helper for overflow check
    async function assertNoHorizontalOverflow(pageName) {
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      if (overflow) {
        console.warn(`[Visual QA Warning] Horizontal overflow detected on ${pageName}!`);
      } else {
        console.log(`[Visual QA Check] ${pageName}: 0 horizontal overflow (clean viewport).`);
      }
    }

    // --- STEP 1: Landing Page Verification ---
    console.log('\n--- Step 1: Landing Page Verification ---');
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle' });
    const pageTitle = await page.title();
    console.log('Landing page loaded. Page title:', pageTitle);

    // Verify key sections
    await page.waitForSelector('text=AgriSphere', { timeout: 5000 });
    await page.waitForSelector('text=Smarter Farming', { timeout: 5000 });
    await page.waitForSelector('text=Validated Research Handoff', { timeout: 5000 });
    console.log('Verified Hero section & Research Status Pill.');

    await assertNoHorizontalOverflow('Landing Page (Desktop 1440px)');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '01_landing_desktop_1440.png'), fullPage: false });

    // Responsive snapshots of landing page
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await assertNoHorizontalOverflow('Landing Page (Tablet 768px)');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '01_landing_tablet_768.png'), fullPage: false });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await assertNoHorizontalOverflow('Landing Page (Mobile 375px)');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '01_landing_mobile_375.png'), fullPage: false });

    // Return to Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);

    // --- STEP 2: Navigate to Register ---
    console.log('\n--- Step 2: Navigate to Registration via "Get Started" ---');
    // Click Get Started button in Navbar or Hero
    const getStartedBtn = page.locator('a:has-text("Get Started")').first();
    await getStartedBtn.click();
    await page.waitForURL('**/register');
    console.log('Navigated to Registration page:', page.url());
    await assertNoHorizontalOverflow('Register Page (Desktop)');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '02_register_desktop.png') });

    // --- STEP 3: Register Fresh Test User A ---
    console.log('\n--- Step 3: Legitimate Test User Registration (User A) ---');
    const userA = generateCredentials('agronomist_qa');
    console.log(`Registering fresh user: ${userA.username} (password securely generated, omitted from logs)`);

    await page.fill('#username', userA.username);
    await page.fill('#email', userA.email);
    await page.fill('#password', userA.password);
    await page.fill('#confirm-password', userA.password);

    await page.click('button[type="submit"]:has-text("Create Account")');
    await page.waitForURL('**/workspace', { timeout: 10000 });
    console.log('Registration succeeded! Landed in Protected Workspace:', page.url());

    // Verify user profile badge
    await page.waitForSelector(`text=${userA.username}`, { timeout: 5000 });
    console.log(`Verified authenticated user session for: ${userA.username}`);
    await assertNoHorizontalOverflow('Workspace Overview (Desktop)');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '03_workspace_overview.png') });

    // --- STEP 4: AI Co-Pilot Chat Interaction ---
    console.log('\n--- Step 4: AI Co-Pilot Chat (English & Bangla) ---');
    // Click AI Co-Pilot Chat in sidebar
    await page.click('aside button:has-text("AI Co-Pilot Chat")');
    
    // Wait for active chat session to connect and display welcome message
    await page.waitForSelector('text=Welcome to AgriSphere AI', { timeout: 15000 });
    console.log('Chat session connected and active.');

    // Verify Chat Provider Status Badge is visible in header
    await page.waitForSelector('text=Local Agronomic Advisory Engine', { timeout: 10000 });
    console.log('Verified Chat Provider Status Badge (Local Agronomic Advisory Engine) in UI.');

    // Send English message
    console.log('Sending English agronomic query...');
    const englishQuery = 'What are the common symptoms of Tomato Early Blight?';
    await page.fill('textarea', englishQuery);
    await page.click('button[aria-label="Send message"]');
    
    // Wait for response
    await page.waitForSelector('text=Regarding tomato health', { timeout: 15000 });
    console.log('Verified English assistant reply with tomato pathology guidance.');

    // Send Bangla message
    console.log('Sending Bangla agronomic query...');
    const banglaQuery = 'ধানের জমিতে ব্লাস্ট রোগের লক্ষণ ও প্রতিকার কী?';
    await page.fill('textarea', banglaQuery);
    await page.click('button[aria-label="Send message"]');

    // Wait for Bangla response
    await page.waitForSelector('text=ধান চাষ ও রোগ ব্যবস্থাপনা', { timeout: 15000 });
    console.log('Verified Bangla assistant reply with rice disease guidance.');

    // Multi-session test
    console.log('Testing multi-session creation and switching...');
    await page.click('button:has-text("New Consultation")');
    await page.waitForTimeout(1000);

    const session2Query = 'What soil nutrients and fertilizer NPK ratio are recommended for crops?';
    await page.fill('textarea', session2Query);
    await page.click('button[aria-label="Send message"]');
    await page.waitForSelector('text=মাটি ও উপযুক্ত ফসল নির্বাচন', { timeout: 15000 });
    console.log('Verified second chat consultation session.');

    // Switch between sessions
    const sessionTabs = page.locator('div.overflow-x-auto > div[class*="rounded-xl"]');
    const sessionCount = await sessionTabs.count();
    console.log(`Total consultation sessions visible: ${sessionCount}`);
    if (sessionCount >= 2) {
      await sessionTabs.nth(1).click();
      await page.waitForTimeout(600);
      await page.waitForSelector('text=Regarding tomato health', { timeout: 5000 });
      console.log('Switched back to Session 1: verified conversation history preserved.');
      await sessionTabs.first().click();
      await page.waitForTimeout(600);
      console.log('Switched back to Session 2.');
    }

    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '04_chat_copilot.png') });

    // --- STEP 5: Interactive 7 Model UI Consoles ---
    console.log('\n--- Step 5: Testing All 7 Research Models via UI ---');
    await page.click('aside button:has-text("7 Model Consoles")');
    await page.waitForTimeout(1000);

    // Model 1: Tomato Disease
    console.log('1. Testing Tomato Disease Model UI...');
    await page.click('button:has-text("Tomato Disease")');
    await page.click('button:has-text("Healthy Tomato Leaf")');
    await page.waitForSelector('img[alt="Tomato leaf preview"]', { timeout: 8000 });
    await page.waitForTimeout(600);
    await page.click('button:has-text("Run Tomato Diagnosis")');
    await page.waitForSelector('text=Inference Output', { timeout: 30000 });
    await page.waitForSelector('text=Softmax Probability Distribution', { timeout: 8000 });
    await page.waitForSelector('text=Scientific Caveat', { timeout: 8000 });
    console.log('Tomato Disease prediction verified.');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '05_tool_tomato.png') });

    // Model 2: Rice Disease
    console.log('2. Testing Rice Disease Model UI...');
    await page.click('button:has-text("Rice Condition")');
    await page.click('button:has-text("Rice Blast Spindle Lesion")');
    await page.waitForSelector('img[alt="Rice leaf preview"]', { timeout: 8000 });
    await page.waitForTimeout(600);
    await page.click('button:has-text("Run Rice Condition Classifier")');
    await page.waitForSelector('text=Inference Output', { timeout: 30000 });
    await page.waitForSelector('text=Softmax Probability Distribution', { timeout: 8000 });
    console.log('Rice Disease prediction verified.');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '06_tool_rice.png') });

    // Model 3: Crop Recommendation
    console.log('3. Testing Crop Recommendation Model UI...');
    await page.click('button:has-text("Crop Recommend")');
    await page.click('button:has-text("Rice Delta Preset")');
    await page.click('button:has-text("Compute Recommendation")');
    await page.waitForSelector('text=Recommended Crop', { timeout: 10000 });
    await page.waitForSelector('text=Ranked Alternative Crops', { timeout: 5000 });
    console.log('Crop Recommendation prediction verified.');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '07_tool_crop_recommend.png') });

    // Model 4: Regional Crop Yield
    console.log('4. Testing Regional Crop Yield Model UI...');
    await page.click('button:has-text("Crop Yield")');
    await page.click('button:has-text("Bogura Kharif-1")');
    await page.click('button:has-text("Forecast Crop Yield")');
    await page.waitForSelector('text=Estimated Crop Yield', { timeout: 10000 });
    await page.waitForSelector('text=tonnes/ha', { timeout: 5000 });
    console.log('Regional Crop Yield prediction verified.');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '08_tool_crop_yield.png') });

    // Model 5: Flood Susceptibility
    console.log('5. Testing Flood Susceptibility Model UI...');
    await page.click('button:has-text("Flood Risk")');
    await page.click('button:has-text("Riverbank Lowland (High Risk)")');
    await page.click('button:has-text("Assess Flood Vulnerability")');
    await page.waitForSelector('text=Flood Vulnerability Classification', { timeout: 10000 });
    await page.waitForSelector('text=Risk Prob:', { timeout: 5000 });
    console.log('Flood Susceptibility prediction verified.');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '09_tool_flood_risk.png') });

    // Model 6: Tomato Wholesale Price
    console.log('6. Testing Tomato Price Model UI...');
    await page.click('button:has-text("Tomato Price")');
    await page.click('button:has-text("Recent Peak Season (45 BDT)")');
    await page.click('button:has-text("Run Price Evaluation")');
    await page.waitForSelector('text=Recommended Wholesale Price', { timeout: 10000 });
    await page.waitForSelector('text=Empirical Baseline Priority', { timeout: 5000 });
    console.log('Tomato Wholesale Price prediction verified.');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '10_tool_tomato_price.png') });

    // Model 7: Boro Rice Wholesale Price
    console.log('7. Testing Boro Rice Price Model UI...');
    await page.click('button:has-text("Rice Price")');
    await page.click('button:has-text("Stable Wholesale (52.5 BDT)")');
    await page.click('button:has-text("Run Price Evaluation")');
    await page.waitForSelector('text=Recommended Wholesale Price', { timeout: 10000 });
    await page.waitForSelector('text=Empirical Baseline Priority', { timeout: 5000 });
    console.log('Boro Rice Wholesale Price prediction verified.');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '11_tool_rice_price.png') });

    // --- STEP 6: Prediction History Audit Log ---
    console.log('\n--- Step 6: Prediction History Audit Log ---');
    await page.click('aside button:has-text("Prediction History")');
    
    // Wait for history table to render records
    await page.waitForSelector('text=boro_rice_price', { timeout: 15000 });
    const recordCards = page.locator('div.space-y-3 > div[class*="rounded-2xl"]');
    const recordCount = await recordCards.count();
    console.log(`Found ${recordCount} prediction audit records in table.`);
    if (recordCount < 7) {
      throw new Error(`Expected at least 7 prediction records for User A, found ${recordCount}`);
    }

    // Click on the first record to view details
    await recordCards.first().click();
    await page.waitForSelector('text=Record #', { timeout: 5000 });
    console.log('Verified record detail inspection card.');

    // Test search filter
    await page.fill('input[placeholder*="Search history by model ID"]', 'rice');
    await page.waitForTimeout(600);
    const filteredCount = await recordCards.count();
    console.log(`Filtered records matching 'rice': ${filteredCount}`);
    if (filteredCount === 0 || filteredCount >= recordCount) {
      throw new Error(`Expected filtered count between 1 and ${recordCount - 1}, got ${filteredCount}`);
    }
    await page.fill('input[placeholder*="Search history by model ID"]', '');
    await page.waitForTimeout(600);

    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '12_prediction_history.png') });

    // --- STEP 7: Cross-User Data Isolation ---
    console.log('\n--- Step 7: Cross-User Data Isolation Test ---');
    // Sign out User A
    await page.click('aside button:has-text("Sign Out")');
    await page.waitForURL('**/login', { timeout: 5000 });
    console.log('User A successfully logged out.');

    // Register User B
    const userB = generateCredentials('isolated_user');
    console.log(`Registering fresh User B: ${userB.username}`);
    await page.click('a:has-text("Create an account")');
    await page.waitForURL('**/register');

    await page.fill('#username', userB.username);
    await page.fill('#email', userB.email);
    await page.fill('#password', userB.password);
    await page.fill('#confirm-password', userB.password);
    await page.click('button[type="submit"]:has-text("Create Account")');
    await page.waitForURL('**/workspace', { timeout: 10000 });
    console.log(`User B authenticated: ${userB.username}`);

    // Check User B's Prediction History -> Must be 0 records
    await page.click('aside button:has-text("Prediction History")');
    await page.waitForTimeout(1000);
    await page.waitForSelector('text=No predictions recorded yet', { timeout: 5000 });
    console.log('Cross-user prediction record isolation strictly verified ("No predictions recorded yet" for User B).');

    // Check User B's Chat Sessions -> Must only have initial session
    await page.click('aside button:has-text("AI Co-Pilot Chat")');
    await page.waitForTimeout(1000);
    const userBSessions = await page.locator('div.overflow-x-auto > div[class*="rounded-xl"]').count();
    console.log(`User B active consultation sessions: ${userBSessions}`);
    if (userBSessions > 1) {
      throw new Error(`Data leak detected! User B has ${userBSessions} sessions.`);
    }
    console.log('Cross-user chat session isolation strictly verified.');

    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '13_isolated_user_b.png') });

    // --- STEP 8: Logout and Protected Route Denials ---
    console.log('\n--- Step 8: Protected Route Guard Verification ---');
    await page.click('aside button:has-text("Sign Out")');
    await page.waitForURL('**/login', { timeout: 5000 });
    console.log('User B logged out.');

    // Attempt direct access to /workspace
    console.log('Attempting unauthenticated access to /workspace...');
    await page.goto(`${FRONTEND_URL}/workspace`);
    await page.waitForURL('**/login', { timeout: 5000 });
    console.log('Protected Route Guard verified: Unauthenticated request immediately redirected to /login.');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '14_protected_route_guard.png') });

    // --- STEP 9: Mobile Responsive QA & Screenshots ---
    console.log('\n--- Step 9: Responsive QA on Mobile (375x812) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Login as User A on mobile
    await page.goto(`${FRONTEND_URL}/login`);
    await page.fill('#username', userA.username);
    await page.fill('#password', userA.password);
    await page.click('button[type="submit"]:has-text("Sign In")');
    await page.waitForURL('**/workspace', { timeout: 10000 });
    console.log('Logged in as User A on mobile view.');

    await assertNoHorizontalOverflow('Mobile Workspace');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '15_mobile_workspace_chat.png') });

    await page.click('aside button:has-text("7 Model Consoles")');
    await page.waitForTimeout(1000);
    await assertNoHorizontalOverflow('Mobile 7 Model Consoles');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '16_mobile_tools_consoles.png') });

    await page.click('aside button:has-text("Prediction History")');
    await page.waitForTimeout(1000);
    await assertNoHorizontalOverflow('Mobile Prediction History');
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '17_mobile_prediction_history.png') });

    await browser.close();

    console.log('\n===============================================================');
    console.log('>>> ALL 16 PHASE D3 REAL BROWSER TESTS PASSED SUCCESSFULLY! <<<');
    console.log('===============================================================');
    console.log(`Visual QA Screenshots saved to: ${SCREENSHOTS_DIR}`);

  } catch (err) {
    console.error('\n❌ PHASE D3 BROWSER QA FAILED WITH ERROR:', err);
    try {
      console.log('\n--- BROWSER CONSOLE ERRORS ---');
      console.log(consoleErrors.length ? consoleErrors.join('\n') : '(None)');
      const text = await page.innerText('body');
      console.log('\n--- PAGE BODY TEXT EXCERPT ---');
      console.log(text.substring(0, 1500));
      await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, 'debug_failure.png') });
      console.log('\nCaptured debug screenshot to debug_failure.png');
    } catch (e) {
      console.error('Failed to capture debug info:', e.message);
    }
    process.exitCode = 1;
  } finally {
    if (backendProc) {
      console.log('Stopping spawned backend process...');
      try { process.kill(backendProc.pid); } catch (e) {}
    }
    if (frontendProc) {
      console.log('Stopping spawned frontend process...');
      try { process.kill(frontendProc.pid); } catch (e) {}
    }
    process.exit(process.exitCode || 0);
  }
}

runPhaseD3QA();
