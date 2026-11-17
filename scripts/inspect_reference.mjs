import pkg from '../frontend/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs';
import path from 'path';

async function inspectReference() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navigating to https://snapshot-buddy-pro.lovable.app...');
  await page.goto('https://snapshot-buddy-pro.lovable.app', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const refDir = path.resolve('docs/reference_inspect');
  if (!fs.existsSync(refDir)) {
    fs.mkdirSync(refDir, { recursive: true });
  }

  // 1. Take desktop screenshot
  await page.screenshot({ path: path.join(refDir, '01_reference_desktop.png'), fullPage: true });
  console.log('Saved 01_reference_desktop.png');

  // 2. Mobile screenshot
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(refDir, '02_reference_mobile.png'), fullPage: true });
  console.log('Saved 02_reference_mobile.png');

  // Back to desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);

  // Extract page title, HTML structure, computed styles, fonts, colors, navigation items
  const details = await page.evaluate(() => {
    const title = document.title;
    const allLinks = Array.from(document.querySelectorAll('a, button, nav *')).map(el => ({
      text: el.textContent?.trim(),
      tag: el.tagName,
      className: el.className
    })).filter(x => x.text);

    // Look for sidebar
    const sidebars = Array.from(document.querySelectorAll('aside, [class*="sidebar"], [class*="nav"]')).map(el => ({
      className: el.className,
      width: el.getBoundingClientRect().width,
      bgColor: window.getComputedStyle(el).backgroundColor
    }));

    // Find images / SVGs
    const images = Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      alt: img.alt,
      width: img.width,
      height: img.height
    }));

    // Extract body styles
    const bodyStyle = window.getComputedStyle(document.body);

    return {
      title,
      bodyBg: bodyStyle.backgroundColor,
      bodyColor: bodyStyle.color,
      bodyFont: bodyStyle.fontFamily,
      images,
      sidebars,
      sampleLinks: allLinks.slice(0, 40)
    };
  });

  fs.writeFileSync(path.join(refDir, 'details.json'), JSON.stringify(details, null, 2));
  console.log('Extracted details:', JSON.stringify(details, null, 2));

  // Save the full HTML
  const html = await page.content();
  fs.writeFileSync(path.join(refDir, 'index.html'), html);
  console.log('Saved index.html');

  await browser.close();
}

inspectReference().catch(err => {
  console.error('Reference inspection error:', err);
  process.exit(1);
});
