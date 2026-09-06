import test from 'node:test';
import assert from 'node:assert/strict';
import {Follow,QUIET_MS} from '../public/follow.js';
const gmail={title:'Inbox – Gmail',process:'brave',id:'11'},word={title:'Letter – Word',process:'WINWORD',id:'22'};
const pixels=value=>new Uint8ClampedArray(160*90*4).fill(value);

test('a click on a new window refits the deck; a click inside the same window does not',()=>{
  const f=new Follow();f.start({snapshots:false,now:0,expires:600000});
  assert.equal(f.click({front:gmail,element:{name:'Send',type:'button'},now:100}),'deck');
  assert.equal(f.click({front:gmail,element:{name:'Compose',type:'button'},now:200}),'idle');
  assert.deepEqual(f.state.element,{name:'Compose',type:'button'});
  assert.equal(f.click({front:word,now:300}),'deck');
});

test('with snapshots on, a capture is due 3 quiet seconds after the last click, once',()=>{
  const f=new Follow();f.start({snapshots:true,now:0,expires:600000});
  f.click({front:gmail,now:1000});
  assert.equal(f.tick(1000+QUIET_MS-1),'skip');
  assert.equal(f.tick(1000+QUIET_MS),'capture');
  assert.equal(f.tick(1000+QUIET_MS+50),'skip','one capture in flight');
  f.click({front:gmail,now:2000});
  assert.equal(f.tick(2000+QUIET_MS),'skip','the in-flight capture must land first');
  assert.equal(f.captured(pixels(0),5100),true,'first frame always lands');
  assert.equal(f.tick(5100+QUIET_MS),'capture','the click during flight is honoured after landing');
});

test('an unchanged window does not replace the chip; a removed chip waits for a different window',()=>{
  const f=new Follow();f.start({snapshots:true,now:0,expires:600000});
  f.click({front:gmail,now:0});f.tick(QUIET_MS);f.captured(pixels(0),QUIET_MS+10);
  f.click({front:gmail,now:5000});f.tick(5000+QUIET_MS);
  assert.equal(f.captured(pixels(0),8100),false,'same pixels, keep the chip as it is');
  f.chipRemoved();
  f.click({front:gmail,now:9000});assert.equal(f.tick(9000+QUIET_MS),'skip','same window after × stays quiet');
  f.click({front:word,now:10000});assert.equal(f.tick(10000+QUIET_MS),'capture');
});

test('next() names the one deadline to wait for, so the page needs no polling timer',()=>{
  const f=new Follow();
  assert.equal(f.next(0),null,'nothing to wait for while off');
  f.start({snapshots:false,now:0,expires:600000});
  assert.equal(f.next(1000),599000,'following alone waits for the lease end');
  f.click({front:gmail,now:1000});
  assert.equal(f.next(1000),599000,'a click without snapshots schedules no capture');
  f.stop();f.start({snapshots:true,now:0,expires:600000});
  f.click({front:gmail,now:1000});
  assert.equal(f.next(1000),QUIET_MS,'with snapshots the capture deadline comes first');
  assert.equal(f.next(1000+QUIET_MS+500),0,'a deadline in the past is due now');
  assert.equal(f.tick(1000+QUIET_MS),'capture');
  assert.equal(f.next(1000+QUIET_MS),600000-1000-QUIET_MS,'in flight, only the lease end remains');
  f.captured(pixels(0),5000);
  assert.equal(f.next(5000),595000,'landed, nothing pending');
});

test('a due capture waits through a busy page without being lost or doubled',()=>{
  const f=new Follow();f.start({snapshots:true,now:0,expires:600000});
  f.click({front:gmail,now:1000});
  assert.equal(f.tick(1000+QUIET_MS,true),'busy','busy keeps the deadline');
  assert.equal(f.state.captureDue,1000+QUIET_MS,'the deadline is untouched');
  assert.equal(f.inFlight,false,'nothing is marked in flight');
  assert.equal(f.next(1000+QUIET_MS+200),0,'still due');
  assert.equal(f.tick(1000+QUIET_MS+200,true),'busy','asked twice while busy, still one deadline');
  assert.equal(f.tick(1000+QUIET_MS+400),'capture','the first free tick takes it');
  assert.equal(f.tick(1000+QUIET_MS+401),'skip','and only once');
  assert.equal(f.tick(600000,true),'expired','expiry wins over busy');
});

test('the countdown formats and the lease ends on its own',()=>{
  const f=new Follow();f.start({snapshots:false,now:0,expires:600000});
  assert.equal(f.remaining(18000),'9:42');
  assert.equal(f.remaining(599000),'0:01');
  assert.equal(f.tick(600000),'expired');
  assert.equal(f.state.on,false);
  assert.equal(f.remaining(600001),'');
  assert.equal(f.click({front:gmail,now:600002}),'idle','clicks after expiry do nothing');
});
