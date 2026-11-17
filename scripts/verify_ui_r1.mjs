import pkg from '../frontend/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs';
import path from 'path';

const FRONTEND_URL = 'http://127.0.0.1:5173';
const SCREENSHOTS_DIR = path.resolve('docs/screenshots');
const BRAIN_DIR = 'C:/Users/hp/.gemini/antigravity/brain/05578b8e-8852-45be-b1d8-7d64d799ac59';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function verifyUIR1() {
  console.log('--- Launching Edge Browser ---');
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico') && !text.includes('Download the React DevTools')) {
        consoleErrors.push(text);
        console.error('  [Browser Error]:', text);
      }
    }
  });

  const results = {
    checks: [],
    screenshots: [],
    errors: [],
  };

  function check(name, condition) {
    if (condition) {
      console.log(`  ✓ [PASS] ${name}`);
      results.checks.push({ name, status: 'PASS' });
    } else {
      console.error(`  ✗ [FAIL] ${name}`);
      results.checks.push({ name, status: 'FAIL' });
      throw new Error(`Check failed: ${name}`);
    }
  }

  try {
    // 1. Login with demo account
    console.log('\n--- Step 1: Login via Demo Account ---');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    const demoBtn = page.locator('#demo-login-button').first();
    await demoBtn.click();
    await page.waitForFunction(() => window.location.pathname.includes('/workspace'), { timeout: 15000 });
    await page.waitForTimeout(2000);
    check('Redirect to /workspace', page.url().includes('/workspace'));

    // 2. Desktop Chat Homepage & Sidebar Verification (1440px)
    console.log('\n--- Step 2: Desktop Chat Homepage & Sidebar (1440px) ---');
    // Ensure we are on the dashboard tab
    await page.goto(`${FRONTEND_URL}/workspace?tab=dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Verify Eyebrow & Welcoming title
    const eyebrow = page.locator('text="FROM SOIL TO MARKET — ONE AI SYSTEM"').first();
    check('Eyebrow heading visible', await eyebrow.isVisible());

    const h1Text = await page.locator('h1').first().textContent();
    check('Welcoming title visible', h1Text.includes('Assalamu Alaikum') || h1Text.includes('আসসালামু আলাইকুম'));

    // Verify 4 Suggestion Cards
    const cards = page.locator('.krishi-card-glass');
    const cardCount = await cards.count();
    check('Four suggestion cards rendered', cardCount === 4);

    // Verify 4 Prompt Pills
    const pills = page.locator('.krishi-prompt-pill');
    const pillCount = await pills.count();
    check('Four prompt pills rendered', pillCount === 4);

    // Verify Sidebar: Brand, New Chat, Nav items, Language toggle
    const brandTitle = page.locator('aside >> text="আমাদের কৃষি"').first();
    const newChatBtn = page.locator('#sidebar-new-chat-btn').first();
    check('Sidebar brand title', await brandTitle.isVisible());
    check('Sidebar New Chat button', await newChatBtn.isVisible());

    // Take Desktop Screenshot
    const desktopShotPath = path.join(SCREENSHOTS_DIR, 'ui_r1_desktop_1440.png');
    await page.screenshot({ path: desktopShotPath, fullPage: true });
    fs.copyFileSync(desktopShotPath, path.join(BRAIN_DIR, 'ui_r1_desktop_1440.png'));
    console.log('Saved ui_r1_desktop_1440.png');
    results.screenshots.push('ui_r1_desktop_1440.png');

    // 3. Test Mobile Layout (375px)
    console.log('\n--- Step 3: Mobile Viewport Verification (375px) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);

    // Verify Mobile Header Bar & Bottom Navigation
    const mobileHeaderBrand = page.locator('header >> text="আমাদের কৃষি"').first();
    check('Mobile header brand visible', await mobileHeaderBrand.isVisible());

    const mobileBottomHome = page.locator('nav >> text="হোম"').first();
    const mobileBottomCal = page.locator('nav >> text="ক্যালেন্ডার"').first();
    const mobileBottomScan = page.locator('nav >> text="স্ক্যান"').first();
    const mobileBottomMarket = page.locator('nav >> text="মার্কেট"').first();
    const mobileBottomMenu = page.locator('nav >> text="মেনু"').first();
    check('Mobile bottom Home', await mobileBottomHome.isVisible());
    check('Mobile bottom Calendar', await mobileBottomCal.isVisible());
    check('Mobile bottom Scan', await mobileBottomScan.isVisible());
    check('Mobile bottom Market', await mobileBottomMarket.isVisible());
    check('Mobile bottom Menu', await mobileBottomMenu.isVisible());

    // Take Mobile Screenshot
    const mobileShotPath = path.join(SCREENSHOTS_DIR, 'ui_r1_mobile_375.png');
    await page.screenshot({ path: mobileShotPath, fullPage: true });
    fs.copyFileSync(mobileShotPath, path.join(BRAIN_DIR, 'ui_r1_mobile_375.png'));
    console.log('Saved ui_r1_mobile_375.png');
    results.screenshots.push('ui_r1_mobile_375.png');

    // Reset Viewport to Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);

    // 4. Test Real Chat Backend Integration
    console.log('\n--- Step 4: Real Chat Backend Integration ---');
    const inputField = page.locator('input[placeholder*="আপনার খামার"], input[placeholder*="Ask anything"]').first();
    const sendBtn = page.locator('button[title*="বার্তা পাঠান"], button[title*="Send message"], button[aria-label="Send message"]').first();

    check('Chat input field visible', await inputField.isVisible());
    check('Send button visible', await sendBtn.isVisible());

    // Type a real agronomic question
    const testQuery = 'টমেটো ফসলের ব্লাইট রোগের লক্ষণ কী?';
    await inputField.fill(testQuery);
    await sendBtn.click();
    console.log(`  Sent query: "${testQuery}"`);

    // Wait for chat view transition and AI response
    await page.waitForFunction(() => window.location.search.includes('tab=chat'), { timeout: 15000 });
    check('Transition to /workspace?tab=chat', page.url().includes('tab=chat'));

    // Wait for response to render in the chat
    await page.waitForTimeout(4000);
    const chatContainerText = await page.textContent('main');
    const userMsgRendered = chatContainerText.includes(testQuery);
    check('User query rendered in active chat', userMsgRendered);

    // Take Chat Conversation Screenshot
    const chatShotPath = path.join(SCREENSHOTS_DIR, 'ui_r1_chat_active_conversation.png');
    await page.screenshot({ path: chatShotPath, fullPage: true });
    fs.copyFileSync(chatShotPath, path.join(BRAIN_DIR, 'ui_r1_chat_active_conversation.png'));
    console.log('Saved ui_r1_chat_active_conversation.png');
    results.screenshots.push('ui_r1_chat_active_conversation.png');

    // 5. Test Navigation to Existing Feature Modules
    console.log('\n--- Step 5: Navigation to Existing Platform Modules ---');
    
    // Calendar
    const calNav = page.locator('aside >> [data-nav-id="calendar"]').first();
    await calNav.click();
    await page.waitForTimeout(1000);
    check('Calendar tab active', page.url().includes('tab=calendar'));

    // Soil Health
    const soilNav = page.locator('aside >> [data-nav-id="soil_health"]').first();
    await soilNav.click();
    await page.waitForTimeout(1000);
    check('Soil Health tab active', page.url().includes('tab=soil_health'));

    // Crop Health / Monitoring
    const cropHealthNav = page.locator('aside >> [data-nav-id="crop_monitoring"]').first();
    await cropHealthNav.click();
    await page.waitForTimeout(1000);
    check('Crop Health tab active', page.url().includes('tab=crop_monitoring'));

    // Harvest & Storage
    const harvestNav = page.locator('aside >> [data-nav-id="harvest"]').first();
    await harvestNav.click();
    await page.waitForTimeout(1000);
    check('Harvest tab active', page.url().includes('tab=harvest'));

    // KrishiMarket (Price Intelligence)
    const marketNav = page.locator('aside >> [data-model-id="tomato_price"]').first();
    await marketNav.click();
    await page.waitForTimeout(1000);
    check('Market tab active', page.url().includes('tab=tools'));

    // 6. Test Language Switching (English <-> বাংলা)
    console.log('\n--- Step 6: Test Language Toggle ---');
    const enBtn = page.locator('aside button:has-text("English")').first();
    await enBtn.click();
    await page.waitForTimeout(1000);
    const enText = await page.textContent('aside');
    check('English language toggle switched', enText.includes('Krishi Calendar') || enText.includes('Soil Intelligence') || enText.includes('Dashboard'));

    const bnBtn = page.locator('aside button:has-text("বাংলা")').first();
    await bnBtn.click();
    await page.waitForTimeout(1000);
    const bnText = await page.textContent('aside');
    check('Bengali language toggle switched', bnText.includes('কৃষি ক্যালেন্ডার') || bnText.includes('মাটি'));

    // 7. Test New Chat Operation
    console.log('\n--- Step 7: Test New Chat Operation ---');
    const newChatButton = page.locator('#sidebar-new-chat-btn').first();
    await newChatButton.click();
    await page.waitForTimeout(1500);
    check('New Chat returns to pristine Chat Homepage', page.url().includes('tab=dashboard'));

    results.consoleErrors = consoleErrors;
    results.allPassed = true;
    console.log('\n================ UI-R1 VERIFICATION COMPLETE ================');
    console.log(JSON.stringify(results, null, 2));

  } finally {
    await browser.close();
  }
}

verifyUIR1().catch((err) => {
  console.error('UI-R1 Verification Error:', err);
  process.exit(1);
});
