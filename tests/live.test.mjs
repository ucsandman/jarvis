import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveFrames,frameChanged} from '../public/live.js';
const frame=value=>new Uint8ClampedArray(160*90*4).fill(value);
test('live frames wait for settled changes, rate limit sends, and skip unchanged input',()=>{
  const gate=new LiveFrames(),a=frame(0),b=frame(100);
  assert.equal(gate.inspect(a,0,30000),'drawing');
  assert.equal(gate.inspect(a,2999,30000),'drawing');
  assert.equal(gate.inspect(a,3000,30000),'ready');gate.accept(a,3000);
  assert.equal(gate.inspect(a,90000,30000),'unchanged');
  assert.equal(gate.inspect(b,10000,30000),'drawing');
  assert.equal(gate.inspect(b,13000,30000),'cooldown');
  assert.equal(gate.inspect(b,33000,30000),'ready');
});
test('continuous drawing resets quiet time and newest frame replaces older candidates',()=>{
  const gate=new LiveFrames();
  for(let i=0;i<5;i++) assert.equal(gate.inspect(frame(i*40),i*2000,30000),'drawing');
  assert.equal(gate.inspect(frame(160),10999,30000),'drawing');
  assert.equal(gate.inspect(frame(160),11000,30000),'ready');
  gate.accept(frame(160),11000);
  assert.equal(gate.inspect(frame(160),50000,30000),'unchanged');
});
test('local thumbnail comparison ignores tiny cursor noise but detects design changes',()=>{
  const a=frame(0),b=a.slice();b[0]=255;
  assert.equal(frameChanged(a,b),false);
  b.fill(255,0,400);
  assert.equal(frameChanged(a,b),true);
  assert.equal(frameChanged(null,a),true);
});
