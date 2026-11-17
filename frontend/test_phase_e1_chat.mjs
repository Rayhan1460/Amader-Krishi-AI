// Phase E1 Playwright Verification Suite for AgriSphere AI Chat Provider & Tool Integration
// Browser: Microsoft Edge via Playwright automation

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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHttp(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function generateCredentials(prefix = 'e1_farmer') {
  const suffix = Math.random().toString(36).substring(2, 8);
  const username = `${prefix}_${suffix}`;
  const password = `Agr!Chat_${Math.random().toString(36).substring(2, 8)}7Z`;
  const email = `${username}@agrisphere.test`;
  return { username, password, email };
}

async function runPhaseE1QA() {
  console.log('===============================================================');
  console.log('  AGRISPHERE AI — PHASE E1 REAL CHAT PROVIDER VERIFICATION');
  console.log('  Browser: Microsoft Edge (via Playwright)');
  console.log('===============================================================\n');

  let backendProc = null;
  let frontendProc = null;
  let browser = null;

  try {
    // 1. Ensure Backend is Running
    console.log('[1/6] Checking FastAPI Backend status on port 8000...');
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

      const ready = await waitForServer(`${BACKEND_URL}/health`);
      if (!ready) throw new Error('FastAPI backend failed to start on 127.0.0.1:8000');
      console.log('FastAPI backend is ONLINE.');
    } else {
      console.log('FastAPI backend is already ONLINE.');
    }

    // 2. Query /chat/provider API Endpoint
    console.log('\n[2/6] Verifying /chat/provider API metadata contract...');
    const providerMeta = await fetchJson(`${BACKEND_URL}/chat/provider`);
    console.log('Configured Chat Provider Details:');
    console.log(`  • Provider Identifier: ${providerMeta.provider}`);
    console.log(`  • Mode Label:          ${providerMeta.mode_label}`);
    console.log(`  • External LLM Ready:  ${providerMeta.is_external_llm_configured}`);
    console.log(`  • Model Name:          ${providerMeta.model || '(none)'}`);
    console.log(`  • Supported Languages: ${providerMeta.supported_languages?.join(', ')}`);
    console.log(`  • Description:         ${providerMeta.description}`);

    if (providerMeta.is_external_llm_configured) {
      console.log('  => STATUS: REAL GENERATIVE AI CHAT VERIFIED (External Provider Configured)');
    } else {
      console.log('  => STATUS: IMPLEMENTED — LIVE PROVIDER TEST BLOCKED: KEY REQUIRED');
      console.log('  => ACTIVE FALLBACK: Local Agronomic Advisory Engine (Offline Heuristics)');
    }

    // 3. Ensure Frontend is Running
    console.log('\n[3/6] Checking Vite Frontend dev server status on port 5173...');
    const frontendUp = await checkHttp(FRONTEND_URL);
    if (!frontendUp) {
      console.log('Spawning Vite Frontend dev server...');
      const frontendDir = path.resolve(ROOT_DIR, 'frontend');
      frontendProc = spawn('npx.cmd', ['vite', '--host', '127.0.0.1', '--port', '5173'], {
        cwd: frontendDir,
        stdio: 'pipe',
        shell: true,
      });

      const ready = await waitForServer(FRONTEND_URL);
      if (!ready) throw new Error('Vite dev server failed to start on 127.0.0.1:5173');
      console.log('Vite Frontend dev server is ONLINE.');
    } else {
      console.log('Vite Frontend dev server is already ONLINE.');
    }

    // 4. Launch Edge Browser
    console.log('\n[4/6] Launching Microsoft Edge browser...');
    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    // 5. Register and Enter Workspace
    console.log('\n[5/6] Authenticating fresh user and entering Chat view...');
    await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'networkidle' });
    const testUser = generateCredentials('chat_tester');
    await page.fill('#username', testUser.username);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirm-password', testUser.password);
    await page.click('button[type="submit"]:has-text("Create Account")');
    await page.waitForURL('**/workspace', { timeout: 10000 });

    // Navigate to Chat Co-Pilot
    await page.click('aside button:has-text("AI Co-Pilot Chat")');
    await page.waitForSelector('text=Welcome to AgriSphere AI', { timeout: 15000 });
    console.log('Chat session established.');

    // Verify Provider Status Badge in Chat Header
    const expectedBadgeText = providerMeta.is_external_llm_configured
      ? providerMeta.mode_label
      : 'Local Agronomic Advisory Engine';
    await page.waitForSelector(`text=${expectedBadgeText}`, { timeout: 10000 });
    console.log(`Verified Provider Badge in UI Header: "${expectedBadgeText}"`);

    // 6. Test Multi-Turn Agronomic Inquiries
    console.log('\n[6/6] Testing Agronomic Multi-Turn Conversation...');

    // Test A: English Tomato Pathology Query
    console.log('A. Testing English Tomato Disease Inquiry...');
    await page.fill('textarea', 'What are early symptoms of tomato blight and how can I diagnose it?');
    await page.click('button[aria-label="Send message"]');
    await page.waitForSelector('text=Tomato Health Advisory', { timeout: 15000 });
    console.log('✓ Verified English Tomato Pathology Guidance.');

    // Test B: Bangla Rice Crop Inquiry
    console.log('B. Testing Bangla Rice Pathology Inquiry...');
    await page.fill('textarea', 'ধানের ব্লাস্ট ও টুংরো রোগের লক্ষণ এবং প্রতিকার কী?');
    await page.click('button[aria-label="Send message"]');
    await page.waitForSelector('text=ধান চাষ ও রোগ ব্যবস্থাপনা', { timeout: 15000 });
    console.log('✓ Verified Bangla Rice Pathology Guidance.');

    // Test C: Wholesale Price Inquiry with Baseline Priority
    console.log('C. Testing Wholesale Market Price Inquiry & Baseline Policy...');
    await page.fill('textarea', 'What is the current weekly wholesale market price benchmark for tomato in BDT?');
    await page.click('button[aria-label="Send message"]');
    await page.waitForSelector('text=Last-Observed Price Baseline', { timeout: 15000 });
    console.log('✓ Verified Wholesale Price Benchmark & Baseline Policy Disclosure.');

    // Test D: Multi-Session Creation & Context Switching
    console.log('D. Testing Multi-Session Creation & Conversation Switching...');
    await page.click('button:has-text("New Consultation")');
    await page.waitForTimeout(800);

    await page.fill('textarea', 'What soil nutrients and N-P-K ratios are recommended for crops?');
    await page.click('button[aria-label="Send message"]');
    await page.waitForSelector('text=মাটি ও উপযুক্ত ফসল নির্বাচন', { timeout: 15000 });
    console.log('✓ Verified Session #2 Soil & Crop Guidance.');

    // Switch back to Session #1
    const sessionTabs = page.locator('div.overflow-x-auto > div[class*="rounded-xl"]');
    const count = await sessionTabs.count();
    console.log(`Total consultation sessions visible: ${count}`);
    if (count >= 2) {
      await sessionTabs.nth(1).click();
      await page.waitForTimeout(600);
      await page.waitForSelector('text=Tomato Health Advisory', { timeout: 5000 });
      console.log('✓ Switched back to Session #1: conversation history verified intact.');
    }

    // Capture visual snapshot of the Chat Co-Pilot with provider badge
    const screenshotPath = path.resolve(SCREENSHOTS_DIR, '18_chat_provider_verified.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`\nVisual QA Screenshot saved to: ${screenshotPath}`);

    await browser.close();

    console.log('\n===============================================================');
    console.log('>>> PHASE E1 CHAT PROVIDER VERIFICATION SUITE: PASSED <<<');
    console.log('===============================================================');

  } catch (err) {
    console.error('\n❌ PHASE E1 VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
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

runPhaseE1QA();

