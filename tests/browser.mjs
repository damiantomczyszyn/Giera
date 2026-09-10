import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('build/site');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript',
  '.svg':'image/svg+xml','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const server = createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const content = await readFile(path);
    res.writeHead(200, {'Content-Type': types[extname(path)] || 'text/plain', 'Cache-Control':'no-store'}).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.GAME_URL || `http://127.0.0.1:${server.address().port}/`;
let browser;
const errors = [];
const check = (page) => page.on('pageerror', e => errors.push(e.message));
const phase = (page, expected) => page.waitForFunction(value => document.querySelector('.game-panel').dataset.phase === value, expected, {timeout:20000});
try {
  browser = await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
  const context = await browser.newContext({viewport:{width:1440,height:1050}});
  const page = await context.newPage(); check(page);
  const responses = [];
  page.on('response', r => { if (r.url().includes('/assets/sounds/') && r.ok()) responses.push(r.url()); });
  await page.goto(base); await phase(page,'idle');
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  assert.equal(await page.locator('#character').evaluate(img => img.complete && img.naturalWidth > 0),true);
  await page.locator('#start').click(); await phase(page,'intro');
  assert.equal(new Set(responses).size, 13, 'all 13 audio clips fetched and decoded by intro');
  await page.locator('#skip-intro').click(); await phase(page,'playing');
  await page.keyboard.down('Space');
  assert.ok((await page.locator('#character').getAttribute('src')).endsWith('active.svg'));
  assert.match(await page.locator('#score').textContent(),/^000/);
  await page.keyboard.down('Space'); await page.keyboard.up('Space');
  assert.match(await page.locator('#score').textContent(),/^010/);
  for (let i=0;i<9;i++) await page.keyboard.press('Space');
  assert.match(await page.locator('#score').textContent(),/^100/);
  assert.equal(await page.locator('.hit-bar .lit').count(),1);
  await page.mouse.click(620,420);
  assert.match(await page.locator('#score').textContent(),/^110/);
  await page.screenshot({path:'test-results/playing.png'});
  await phase(page,'results');
  assert.equal(await page.locator('#result-score').textContent(),'110');
  assert.equal(await page.locator('#timer').textContent(),'0.00');
  await page.locator('#name').fill('TEST'); await page.locator('#score-form button').click();
  assert.match(await page.locator('#leaderboard').textContent(),/TEST110/);
  await page.screenshot({path:'test-results/result.png'});
  await page.reload(); await phase(page,'idle');
  assert.match(await page.locator('#leaderboard').textContent(),/TEST110/);
  assert.equal(await page.locator('#personal-best').textContent(),'110');
  await page.locator('summary').click(); await page.locator('#quick').check();
  await page.locator('#mute').click(); assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');
  await page.locator('#start').click(); await phase(page,'playing');
  const another = await context.newPage(); await another.goto(base); await another.bringToFront();
  // Headless Chromium does not reliably mark background tabs hidden; dispatch the
  // real visibility event with the platform state overridden for this branch.
  await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange')); });
  await phase(page,'aborted');
  assert.equal(await page.locator('#rounds').textContent(),'1','aborted round was not recorded');
  await context.close();

  const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const phone = await mobile.newPage(); check(phone); await phone.goto(base); await phase(phone,'idle');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,'no horizontal overflow');
  await phone.screenshot({path:'test-results/mobile.png',fullPage:true});
  await phone.locator('summary').click(); await phone.locator('#quick').check();
  await phone.locator('#start').tap(); await phase(phone,'playing');
  await phone.locator('#arena').tap({position:{x:170,y:150}});
  assert.match(await phone.locator('#score').textContent(),/^010/);
  await mobile.close();

  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}}); });
  const fallback = await blocked.newPage(); check(fallback);
  await fallback.route('**/assets/sounds/**', r => r.abort());
  await fallback.goto(base); await phase(fallback,'idle');
  await fallback.locator('summary').click(); await fallback.locator('#quick').check();
  await fallback.locator('#start').click(); await phase(fallback,'playing');
  await fallback.keyboard.press('Space'); await phase(fallback,'results');
  await fallback.locator('#name').fill('LOCAL'); await fallback.locator('#score-form button').click();
  assert.match(await fallback.locator('#save-status').textContent(),/tylko/);
  assert.match(await fallback.locator('#leaderboard').textContent(),/LOCAL10/);
  await blocked.close();
  assert.deepEqual(errors,[],'no uncaught browser errors');
  console.log('PASS: desktop round, 13 audio assets, animation, keyboard/mouse, score persistence, restart, visibility, touch, blocked storage/audio.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
