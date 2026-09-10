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
  // Holding the action button across the deadline must not award a late hit
  // or let the ensuing native click start an unintended new round.
  await page.locator('#start').hover(); await page.mouse.down();
  await phase(page,'results');
  await page.mouse.up(); await phase(page,'results');
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
  // Default quick=false: failed audio must choose the three-second countdown.
  assert.equal(await fallback.locator('#quick').isChecked(), false);
  await fallback.locator('#start').click(); await phase(fallback,'intro');
  const silentIntroStarted = await fallback.evaluate(() => performance.now());
  await fallback.waitForFunction(() => document.querySelector('.game-panel').dataset.phase === 'playing', null, {timeout:4500});
  const silentIntroMs = await fallback.evaluate(() => performance.now()) - silentIntroStarted;
  assert.ok(silentIntroMs < 4500, `silent intro took ${silentIntroMs}ms`);
  await fallback.keyboard.press('Space'); await phase(fallback,'results');
  await fallback.locator('#name').fill('LOCAL'); await fallback.locator('#score-form button').click();
  assert.match(await fallback.locator('#save-status').textContent(),/tylko/);
  assert.match(await fallback.locator('#leaderboard').textContent(),/LOCAL10/);
  await blocked.close();

  const regression = await browser.newContext({viewport:{width:1440,height:1050}});
  const topTen = Array.from({length:10}, (_,i) => ({name:`P${i}`,value:1000-i*100}));
  await regression.addInitScript(scores => {
    localStorage.setItem('kd.scores.v2', JSON.stringify(scores));
    localStorage.setItem('kd.settings.v2', JSON.stringify({quick:true}));
  }, topTen);
  const probe = await regression.newPage(); check(probe);
  // A paused browser clock makes the 999ms/one-second boundary reproducible.
  // The desktop scenario above still plays a full round using real time.
  const clockStart = new Date('2026-01-01T00:00:00Z');
  await probe.clock.install({time:clockStart}); await probe.clock.pauseAt(clockStart);
  await probe.goto(base); await phase(probe,'idle');
  await probe.locator('#start').click(); await phase(probe,'intro');
  await probe.clock.runFor(3100); await phase(probe,'playing');
  await probe.evaluate(() => {
    Element.prototype.setPointerCapture = () => { throw new DOMException('Pointer no longer active', 'NotFoundError'); };
  });
  await probe.locator('#arena').click({position:{x:170,y:150}});
  assert.match(await probe.locator('#score').textContent(),/^010/, 'capture failure must not swallow the hit');
  await probe.locator('#start').hover(); await probe.mouse.down();
  await probe.clock.fastForward(9000); await phase(probe,'results');
  assert.equal(await probe.locator('#start').isEnabled(), false, 'restart is disabled at the end');
  await probe.mouse.up();
  // Click spam and Space during the pause neither start nor queue another round.
  for (let i=0; i<5; i++) { await probe.mouse.click(620,420); await probe.keyboard.press('Space'); }
  await probe.locator('#start').dispatchEvent('click', {detail:1});
  await phase(probe,'results');
  await probe.clock.runFor(999);
  await probe.keyboard.press('Space');
  assert.equal(await probe.locator('#start').isEnabled(), false, 'all of the first 999ms are protected');
  await phase(probe,'results');
  // A gesture beginning inside the pause must not restart on a late release.
  await probe.locator('#start').hover(); await probe.mouse.down();
  await probe.clock.runFor(33);
  assert.equal(await probe.locator('#start').isEnabled(), true, 'restart returns after one second');
  await probe.mouse.up(); await phase(probe,'results');
  await probe.locator('#name').fill('ME'); await probe.locator('#score-form button').click();
  assert.match(await probe.locator('#save-status').textContent(), /nie trafił do TOP 10/);
  assert.doesNotMatch(await probe.locator('#leaderboard').textContent(), /ME/);
  assert.deepEqual(await probe.evaluate(() => JSON.parse(localStorage.getItem('kd.scores.v2'))), topTen);
  await probe.locator('#start').click(); await phase(probe,'intro');
  await probe.clock.runFor(3100); await phase(probe,'playing');
  await probe.locator('#arena').focus(); await probe.keyboard.down('Space');
  await probe.clock.fastForward(9000); await phase(probe,'results');
  await probe.clock.runFor(1100);
  await probe.keyboard.down('Space'); await probe.keyboard.up('Space');
  await phase(probe,'results');
  assert.equal(await probe.locator('#result-score').textContent(),'0', 'late key release does not count');
  await probe.keyboard.press('Space'); await phase(probe,'intro');
  await probe.clock.runFor(3100); await phase(probe,'playing');
  await probe.clock.fastForward(9000); await phase(probe,'results');
  await probe.keyboard.down('Space'); // new keydown during the protected second
  await probe.clock.runFor(1100);
  await probe.keyboard.down('Space'); await probe.keyboard.up('Space');
  await phase(probe,'results');
  await probe.keyboard.press('Space'); await phase(probe,'intro');
  await regression.close();

  const touchGuard = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await touchGuard.addInitScript(() => localStorage.setItem('kd.settings.v2', JSON.stringify({quick:true})));
  const tapProbe = await touchGuard.newPage(); check(tapProbe);
  await tapProbe.clock.install({time:clockStart}); await tapProbe.clock.pauseAt(clockStart);
  await tapProbe.goto(base); await phase(tapProbe,'idle');
  await tapProbe.locator('#start').tap(); await phase(tapProbe,'intro');
  await tapProbe.clock.runFor(3100); await phase(tapProbe,'playing');
  await tapProbe.locator('#arena').tap({position:{x:170,y:150}});
  await tapProbe.clock.fastForward(9000); await phase(tapProbe,'results');
  const startBox = await tapProbe.locator('#start').boundingBox();
  for (let i=0;i<5;i++) await tapProbe.touchscreen.tap(startBox.x+startBox.width/2, startBox.y+startBox.height/2);
  await phase(tapProbe,'results');
  await tapProbe.clock.runFor(1100);
  await phase(tapProbe,'results');
  await tapProbe.locator('#start').tap(); await phase(tapProbe,'intro');
  await touchGuard.close();
  assert.deepEqual(errors,[],'no uncaught browser errors');
  console.log('PASS: desktop round, 13 audio assets, animation, keyboard/mouse, score persistence, visibility, touch, blocked storage/audio, TOP 10 rejection, pointer capture failure, one-second restart guard and held inputs.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
