import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const LIVE_URL = 'https://aether-mesh-frontend-lrb6b41gy-revhaven.vercel.app/';
const SCREENSHOT_DIR = 'C:/Users/shubh/.gemini/antigravity/brain/df31862d-e11b-4a2f-8fef-9a571eb3c9bd/screenshots/gemini_live';

async function testLiveGemini() {
  console.log('========================================================================');
  console.log(`🤖 LIVE REAL GEMINI INFERENCE TEST: ${LIVE_URL}`);
  console.log('========================================================================\n');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('1. Loading live Vercel dashboard...');
    await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    console.log('2. Navigating to Live Inference Dispatch tab...');
    await page.click('button:has-text("Live Inference Dispatch")');
    await page.waitForTimeout(500);

    // Enter a distinct prompt that requires real generative reasoning
    const testPrompt = 'What is the capital of France and what is 15 multiplied by 4? Answer directly in one sentence.';
    console.log(`3. Entering custom prompt: "${testPrompt}"`);
    
    const textarea = page.locator('textarea');
    await textarea.fill(testPrompt);

    // Select Gemini model
    const modelSelect = page.locator('select').first();
    await modelSelect.selectOption('gemini-3.7-flash-edge');

    console.log('4. Clicking "Dispatch Inference"...');
    await page.click('button[type="submit"]:has-text("Dispatch")');

    console.log('5. Waiting for live response stream...');
    await page.waitForSelector('text=Response Stream', { timeout: 15000 });
    await page.waitForTimeout(1500);

    const streamText = await page.locator('text=Response Stream').locator('../..').textContent();
    console.log('\n========================================================================');
    console.log('🎉 LIVE INFERENCE RESPONSE STREAM CAPTURED:');
    console.log('========================================================================');
    console.log(streamText?.replace(/\s+/g, ' ').trim());
    console.log('========================================================================\n');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_live_gemini_response.png'), fullPage: true });

  } catch (err: any) {
    console.error('Test Error:', err.message);
  } finally {
    await browser.close();
  }
}

testLiveGemini().catch(console.error);
