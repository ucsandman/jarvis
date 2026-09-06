import test from 'node:test';
import assert from 'node:assert/strict';
import { eyeOffset, eyeCenters, EYE_TRAVEL, STATIC_RIGHT } from '../public/eyes.js';

const mark={size:64,left:100,top:100};
const close=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} vs ${b}`);

test('no cursor or reduced motion: the static sidelong look', () => {
  assert.deepEqual(eyeOffset({...mark,cursor:null}),STATIC_RIGHT);
  assert.deepEqual(eyeOffset({...mark,cursor:{x:0,y:0},reducedMotion:true}),STATIC_RIGHT);
});

test('cursor inside the mark: eyes centred', () => {
  assert.deepEqual(eyeOffset({...mark,cursor:{x:132,y:132}}),{dx:0,dy:0});
  assert.deepEqual(eyeOffset({...mark,cursor:{x:100,y:163}}),{dx:0,dy:0});
});

test('far cursor turns the eyes fully, never past the travel', () => {
  const right=eyeOffset({...mark,cursor:{x:2000,y:132}});
  close(right.dx,EYE_TRAVEL);close(right.dy,0);
  const upLeft=eyeOffset({...mark,cursor:{x:-1000,y:-1000}});
  close(Math.hypot(upLeft.dx,upLeft.dy),EYE_TRAVEL);
  assert.ok(upLeft.dx<0&&upLeft.dy<0);
});

test('near cursor turns the eyes in proportion to distance, scaled by mark size', () => {
  // 60 grid units away at size 64 is half the reach.
  const half=eyeOffset({...mark,cursor:{x:132+60,y:132}});
  close(half.dx,EYE_TRAVEL/2);
  // The same pixel distance on a 32px mark is twice the grid distance, so fully turned.
  const small=eyeOffset({size:32,left:100,top:100,cursor:{x:116+60,y:116}});
  close(small.dx,EYE_TRAVEL);
});

test('eye centres are the home points plus the offset', () => {
  assert.deepEqual(eyeCenters({dx:5,dy:0}),[[31,32],[43,32]]);
  assert.deepEqual(eyeCenters({dx:0,dy:0}),[[26,32],[38,32]]);
});
