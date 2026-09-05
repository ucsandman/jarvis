import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {WindowsComputer} from '../lib/computer.mjs';
if(process.platform!=='win32'){console.log('SKIP: native computer verification requires Windows.');process.exit(0);}
await mkdir('.artifacts',{recursive:true});
const path=resolve('.artifacts/computer-fixture.cs');
await writeFile(path,`using System;using System.Windows.Forms;using System.Drawing;
class Fixture { [STAThread] static void Main(){
var f=new Form {Text="Computer verification fixture",Width=500,Height=340,TopMost=true};
var t=new TextBox {AccessibleName="Fixture input",Location=new Point(25,30),Width=350};
var b=new Button {Text="Apply fixture",Location=new Point(25,90),Width=180};
b.Click+=(s,e)=>f.Text=t.Text=="Verified desktop input"?"Computer verification complete":"Incorrect input";var stop=new Button {Text="Stop fixture control",Location=new Point(25,150),Width=180};stop.Click+=(s,e)=>SendKeys.SendWait("^+{F12}");f.Controls.Add(stop);f.Controls.Add(t);f.Controls.Add(b);Application.Run(f);
}}`);
const exe=resolve('.artifacts/computer-fixture.exe');
execFileSync((process.env.WINDIR||'C:/Windows')+'/Microsoft.NET/Framework64/v4.0.30319/csc.exe',['/nologo','/target:winexe','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/out:'+exe,path],{stdio:'pipe',windowsHide:true});
const fixture=spawn(exe,[],{windowsHide:false,stdio:'ignore'});
const native=new WindowsComputer();let count=0;
try{
  assert.equal((await native.call({op:'status'})).armed,false);count++;
  await assert.rejects(native.call({op:'act',kind:'launch',app:'calculator'}));count++;
  await native.call({op:'arm'});let windows=[];
  for(let i=0;i<15;i++){windows=(await native.call({op:'windows'})).windows;if(windows.some(w=>w.title==='Computer verification fixture'))break;await new Promise(r=>setTimeout(r,200));}
  const window=windows.find(w=>w.title==='Computer verification fixture');assert.ok(window);count++;
  const snap=await native.call({op:'snapshot',window:window.id});
  const input=snap.elements.find(e=>e.name==='Fixture input'),button=snap.elements.find(e=>e.name==='Apply fixture');assert.ok(input&&button);count++;
  const base={op:'act',window:window.id,title:window.title};
  await native.call({...base,kind:'type',element:input.id,name:input.name,type:input.type,automationId:input.automationId,context:input.context,state:input.state,text:'Verified desktop input'});count++;
  await assert.rejects(native.call({...base,kind:'click',element:button.id,name:'stale label'}));count++;
  await assert.rejects(native.call({...base,kind:'type',element:input.id,name:input.name,type:input.type,automationId:input.automationId,context:input.context,state:input.state,text:'Do not overwrite changed value'}));count++;
  await assert.rejects(native.call({...base,kind:'click',element:button.id,name:button.name,type:button.type,automationId:button.automationId,context:'different parent',state:button.state}));count++;
  await native.call({...base,kind:'click',element:button.id,name:button.name,type:button.type,automationId:button.automationId,context:button.context,state:button.state});
  assert.equal((await native.call({op:'snapshot',window:window.id})).title,'Computer verification complete');count++;
  await assert.rejects(native.call({...base,kind:'click',element:button.id,name:button.name,type:button.type,automationId:button.automationId,context:button.context,state:button.state}));count++;
  const after=await native.call({op:'snapshot',window:window.id});const stop=after.elements.find(e=>e.name==='Stop fixture control');let hotkey=false;native.onStop=()=>{hotkey=true;};
  await native.call({op:'act',kind:'click',window:window.id,title:after.title,element:stop.id,name:stop.name,type:stop.type,automationId:stop.automationId,context:stop.context,state:stop.state});
  for(let i=0;i<20&&!hotkey;i++)await new Promise(r=>setTimeout(r,50));assert.ok(hotkey);count++;
  assert.equal((await native.call({op:'status'})).armed,false);count++;
  if(process.argv.includes('--live')){
    const {Computer}=await import('../lib/computer.mjs');const computer=new Computer({native});const {owner}=await computer.handle({op:'enable',consent:true});
    const started=Date.now();const result=await computer.handle({op:'propose',owner,consent:true,model:'fable',effort:'low',task:'Read the fixture input. If it contains Verified desktop input, report done. Do not change anything.',window:window.id});
    assert.equal(result.proposal.kind,'done');console.log('PASS: real Fable subscription planned from native window, elapsedMs='+ (Date.now()-started));computer.stop();
  }
  await native.call({op:'stop'});assert.equal((await native.call({op:'status'})).armed,false);count++;
  await assert.rejects(native.call({op:'act',kind:'launch',app:'notepad'}));count++;
  console.log(`PASS: ${count} native Windows checks; owned fixture inspected, typed and clicked; stale targets and stopped actions refused.`);
}finally{native.close();fixture.kill();}
