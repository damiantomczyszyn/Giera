import test from 'node:test';
import assert from 'node:assert/strict';
import { Round, cleanScores, addScore, readJSON, rank } from '../web/game.js';

test('only complete presses earn points; holding, repeats and orphan releases do not', () => {
  const r = new Round(); r.start(0);
  assert.equal(r.release('key', 50), false);
  assert.equal(r.press('key', 100), true);
  for (let i = 0; i < 100; i++) assert.equal(r.press('key', 200+i), false);
  assert.equal(r.score, 0);
  assert.equal(r.release('key', 500), true);
  assert.equal(r.release('key', 600), false);
  assert.equal(r.score, 10);
});
test('different pointer or keyboard cannot complete an owned press', () => {
  const r = new Round(); r.start(1000); r.press('pointer:1', 1010);
  assert.equal(r.press('keyboard', 1020), false);
  assert.equal(r.release('pointer:2', 1030), false);
  assert.equal(r.release('keyboard', 1040), false);
  assert.equal(r.release('pointer:1', 1050), true);
  assert.equal(r.score, 10);
});
test('deadline is exactly 9000ms and input checks time without a frame', () => {
  const r = new Round(); r.start(1000); r.press('k', 9998); r.release('k', 9999);
  r.press('k', 9999); assert.equal(r.release('k', 10000), false);
  assert.equal(r.score, 10); assert.equal(r.phase, 'finished');
  assert.equal(r.press('k', 10001), false); assert.equal(r.remaining(20000), 0);
});
test('cancelled input, aborted rounds and resets cannot carry points', () => {
  const r = new Round(); r.start(0); r.press('k', 1); r.cancelPress();
  assert.equal(r.release('k', 2), false); r.abort(); assert.equal(r.press('k', 3), false);
  r.start(10); r.press('k', 11); r.release('k', 12); r.start(20);
  assert.equal(r.score, 0); assert.equal(r.owner, null); assert.deepEqual(r.hits, []);
});
test('statistics use nine seconds and one-second bins', () => {
  const r = new Round(); r.start(100);
  for (let i=0;i<9;i++) { r.press('k',101+i*1000); r.release('k',102+i*1000); }
  r.tick(9100); assert.equal(r.cps, 1); assert.deepEqual(r.bins, Array(9).fill(1));
});
test('ranking handles corrupt, hostile and oversized storage safely', () => {
  assert.deepEqual(cleanScores({}), []);
  const raw = [null, {}, {name:'bad', value:-5}, {name:'bad',value:'20'}, {name:'bad',value:15},
    {name:'abcdef',value:90}, {name:'ąę',value:10}, {name:'bad',value:Infinity}];
  assert.deepEqual(cleanScores(raw), [{name:'ABCDE',value:90},{name:'ĄĘ',value:10}]);
  assert.equal(cleanScores(Array.from({length:20},(_,i)=>({name:'ok',value:i*10}))).length,10);
  assert.equal(readJSON({getItem(){throw Error('blocked');}}, 'x', 12),12);
  assert.equal(readJSON({getItem(){return '{bad';}}, 'x', 12),12);
});
test('rank thresholds are consistent with the 100-point power steps', () => {
  assert.equal(rank(0)[0], 'REKRUT'); assert.equal(rank(300)[0], 'KOSMICZNY KOZAK');
  assert.equal(rank(600)[0], 'KAPITAN'); assert.equal(rank(900)[0], 'LEGENDA KURVIX');
});

test('full top ten rejects lower scores and ties without changing existing entries', () => {
  const scores = cleanScores(Array.from({length:10}, (_,i) => ({name:`P${i}`,value:100+i*100})));
  for (const entry of [{name:'ME',value:10}, {name:'ME',value:100}, {...scores[9]}]) {
    const result = addScore(scores, entry);
    assert.equal(result.accepted, false);
    assert.deepEqual(result.scores, scores);
  }
  const result = addScore(scores, {name:'ME',value:110});
  assert.equal(result.accepted, true);
  assert.equal(result.scores.length, 10);
  assert.deepEqual(result.scores[9], {name:'ME',value:110});
  assert.equal(scores[9].value, 100, 'submission does not mutate the stored ranking');
});

test('accepted ranking entries preserve ties and repeated names for separate rounds', () => {
  const scores = [{name:'SAME',value:20}, {name:'NEXT',value:20}];
  const result = addScore(scores, {name:'SAME',value:20});
  assert.equal(result.accepted, true);
  assert.deepEqual(result.scores, [...scores, scores[0]]);
  assert.equal(addScore(scores, {name:'BAD',value:-10}).accepted, false);
  assert.equal(addScore([], {name:'NEW',value:0}).accepted, true);
});
