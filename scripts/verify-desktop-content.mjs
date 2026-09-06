import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import net from 'node:net';
import {browserTools} from './browser.mjs';
if(process.platform!=='win32')throw Error('This verifier requires Windows.');
const {version}=JSON.parse(await readFile('package.json','utf8'));
const probe=net.createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(4317,'127.0.0.1',resolve);});await new Promise(resolve=>probe.close(resolve));
const debug=net.createServer();await new Promise(resolve=>debug.listen(0,'127.0.0.1',resolve));const port=debug.address().port;await new Promise(resolve=>debug.close(resolve));
const profile=resolve('.artifacts/native-content-'+Date.now());await mkdir(profile,{recursive:true});
const powershell=join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const fixtureSource=join(profile,'Fixture.cs'),fixtureExe=join(profile,'Fixture.exe');
await writeFile(fixtureSource,`using System;using System.Drawing;using System.Windows.Forms;using System.Runtime.InteropServices;
class Fixture{[DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr h);[STAThread]static void Main(){Application.EnableVisualStyles();var f=new Form{Text="Jarvis capture verification",Width=540,Height=320,StartPosition=FormStartPosition.CenterScreen,BackColor=Color.Beige};f.Controls.Add(new Label{Text="A safe desktop reference",Font=new Font("Segoe UI",22),Location=new Point(25,25),AutoSize=true});f.Controls.Add(new TextBox{Text="Only this fixture should be captured.",Location=new Point(25,100),Width=430});f.Shown+=(s,e)=>SetForegroundWindow(f.Handle);Application.Run(f);}}`);
execFileSync(join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:winexe','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/out:'+fixtureExe,fixtureSource],{windowsHide:true,stdio:'pipe'});
// Official Playwright WebView2 integration: https://playwright.dev/docs/webview2
// Debugging is scoped to this isolated verifier child, never a persisted app setting.
const child=spawn(resolve(`.artifacts/windows-${version}/Jarvis-${version}-Windows-x64.exe`),[],{windowsHide:false,stdio:'ignore',env:{...process.env,LOCALAPPDATA:profile,WEBVIEW2_USER_DATA_FOLDER:join(profile,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1 --use-fake-device-for-media-stream --use-fake-ui-for-media-stream --auto-select-desktop-capture-source="Jarvis capture verification"`}});
const {chromium}=browserTools();let browser,fixture;const checks=[],errors=[];
try{
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){try{const response=await fetch(`http://127.0.0.1:${port}/json/version`);if(response.ok)break;}catch{}if(child.exitCode!==null)throw Error('Desktop host exited before debugging became available.');await new Promise(resolve=>setTimeout(resolve,300));}
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context=browser.contexts()[0];let page;
  for(let i=0;i<100;i++){page=context.pages().find(p=>p.url().startsWith('http://127.0.0.1:4317/'));if(page)break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(page,'Packaged app loaded its trusted root');page.on('pageerror',e=>errors.push(e.message));
  await page.locator('#companion-input').waitFor();await page.locator('#companion-welcome h1').waitFor();checks.push('packaged companion DOM rendered in real WebView2');
  await page.screenshot({path:'.artifacts/native-companion.png'});
  await context.route('**/api/session',async route=>{
    const local=await page.request.get('http://127.0.0.1:4317/api/local-session',{headers:route.request().headers()});
    const connection=await local.json();
    await route.fulfill({json:{...connection,configured:true,cli:true,model:'gpt-6-astra',remaining:60,dictation:true}});
  });
  await page.waitForFunction(()=>!document.getElementById('recheck').disabled);
  assert.match(await page.locator('#companion-status').innerText(),/^screen & mic off$/i);
  const edge=await page.evaluate(()=>screenX+outerWidth);
  await page.locator('#companion-settings').click();await page.locator('#companion-expand').click();await page.locator('.app-shell').waitFor();await page.waitForFunction(()=>innerWidth>=1180);
  assert.ok(Math.abs(await page.evaluate(()=>screenX+outerWidth)-edge)<=2,'the right edge stays pinned when the studio opens');
  assert.ok(await page.locator('#companion').isVisible(),'the column stays beside the studio');
  if(!await page.locator('#settings').evaluate(d=>d.open))await page.locator('#settings-open').click();await page.locator('#recheck').click();await page.waitForFunction(()=>!document.getElementById('build').disabled);await page.locator('#settings-close').click();checks.push('native expansion opens the studio beside the pinned column');
  await page.locator('#try-demo').click();await page.locator('#version-label').filter({hasText:'VERSION 01'}).waitFor();
  const preview=page.frameLocator('#preview');await preview.getByRole('textbox',{name:'Task title',exact:true}).fill('Verified in desktop');await preview.getByRole('button',{name:'Add task',exact:true}).click();await preview.getByText('Verified in desktop',{exact:true}).waitFor();checks.push('interactive sandbox prototype works in embedded runtime');
  const downloadEvent=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadEvent;assert.ok(download.suggestedFilename().endsWith('.html'));await download.saveAs(join(profile,'downloaded.html'));assert.ok((await readFile(join(profile,'downloaded.html'),'utf8')).includes('<html'));checks.push('native HTML download succeeds');
  await page.locator('#connect').click();await page.waitForFunction(()=>document.getElementById('camera').videoWidth>0);await page.locator('#camera-off').click();assert.equal(await page.locator('#camera').evaluate(v=>v.srcObject),null);checks.push('synthetic camera starts and releases in WebView2');
  await page.locator('#companion-back').click();
  await page.waitForFunction(()=>innerWidth<=500);
  checks.push('workbench returns to a compact native panel');
  const launchFixture=join(profile,'launch-fixture.ps1');
  await writeFile(launchFixture,"param([string]$FixturePath)\n$p=Start-Process -FilePath $FixturePath -WindowStyle Normal -PassThru\n$p.Id\n");
  const fixturePid=Number(execFileSync(powershell,['-NoProfile','-File',launchFixture,fixtureExe],{windowsHide:true,encoding:'utf8'}).trim());
  assert.ok(Number.isInteger(fixturePid)&&fixturePid>0);fixture={pid:fixturePid,kill:()=>{try{process.kill(fixturePid);}catch{}}};await new Promise(resolve=>setTimeout(resolve,800));
  const focusScript=join(profile,'focus.ps1');
  await writeFile(focusScript,`Add-Type @'
using System;using System.Runtime.InteropServices;
public class FocusFixture {
[StructLayout(LayoutKind.Sequential)]struct Rect{public int Left,Top,Right,Bottom;}
[StructLayout(LayoutKind.Sequential)]struct Point{public int X,Y;public Point(int x,int y){X=x;Y=y;}}
[DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")]static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int cx,int cy,uint flags);
[DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out Rect r);
[DllImport("user32.dll")]static extern IntPtr WindowFromPoint(Point p);
[DllImport("user32.dll")]static extern IntPtr GetAncestor(IntPtr h,uint flags);
[DllImport("user32.dll")]static extern bool SetCursorPos(int x,int y);
[DllImport("user32.dll")]static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
public static bool Focus(IntPtr h){if(h==IntPtr.Zero)return false;SetWindowPos(h,new IntPtr(-1),0,0,0,0,0x43);System.Threading.Thread.Sleep(200);Rect r;if(!GetWindowRect(h,out r))return false;Point p=new Point(r.Left+80,r.Top+15);if(GetAncestor(WindowFromPoint(p),2)!=h)return false;SetCursorPos(p.X,p.Y);mouse_event(2,0,0,0,UIntPtr.Zero);mouse_event(4,0,0,0,UIntPtr.Zero);System.Threading.Thread.Sleep(200);return GetForegroundWindow()==h;}
}
'@
$p=Get-Process -Id ${fixture.pid};$deadline=[DateTime]::UtcNow.AddSeconds(5);do{$p.Refresh();if($p.MainWindowHandle -ne [IntPtr]::Zero){break};Start-Sleep -Milliseconds 100}while([DateTime]::UtcNow -lt $deadline);if(-not [FocusFixture]::Focus($p.MainWindowHandle)){throw 'Could not focus the owned capture fixture.'}
`);
  execFileSync(powershell,['-NoProfile','-File',focusScript],{windowsHide:true,stdio:'pipe'});await new Promise(resolve=>setTimeout(resolve,350));
  await page.locator('#companion-capture').click();await page.waitForFunction(()=>!document.getElementById('companion-context').hidden || !document.getElementById('companion-error').hidden);
  if(await page.locator('#companion-context').isHidden())throw new Error('Native capture failed: '+await page.locator('#companion-error').innerText());
  assert.equal((await page.locator('#companion-frame-label').innerText()).includes('Jarvis capture verification'),true,'Capture must target only the owned fixture.');
  assert.match(await page.locator('#companion-frame').getAttribute('src'),/^data:image\/jpeg;base64,/);assert.equal(await page.locator('#companion-send').innerText(),'Send with screenshot ↑');await page.screenshot({path:'.artifacts/native-capture.png'});checks.push('explicit native capture returns only named fixture, no sharing');
  // The picker against the real shell: the fixture is in the list, picking it captures it, and Whole desktop captures every monitor without the panel.
  await page.locator('#companion-remove').click();await page.locator('#companion-front-change').click();await page.locator('#companion-targets .starter').first().waitFor();
  assert.match(await page.locator('#companion-targets .starter').first().innerText(),/^Whole desktop/);
  const fixtureRow=page.locator('#companion-targets .starter').filter({hasText:'Jarvis capture verification'});assert.equal(await fixtureRow.count(),1,'the fixture is listed once');
  assert.equal(await page.locator('#companion-targets .starter').filter({hasText:/^Jarvis\n/}).count(),0,'Jarvis is not in its own list');
  await fixtureRow.click();await page.waitForFunction(()=>document.getElementById('companion-front-title').textContent==='Looking at: Jarvis capture verification');
  await page.locator('#companion-capture').click();await page.waitForFunction(()=>!document.getElementById('companion-context').hidden || !document.getElementById('companion-error').hidden);
  assert.match(await page.locator('#companion-frame-label').innerText(),/Jarvis capture verification/);await page.locator('#companion-remove').click();
  await page.locator('#companion-front-change').click();await page.locator('#companion-targets .starter').first().click();await page.waitForFunction(()=>document.getElementById('companion-front-title').textContent==='Looking at: Whole desktop');
  await page.locator('#companion-capture').click();await page.waitForFunction(()=>!document.getElementById('companion-context').hidden || !document.getElementById('companion-error').hidden);
  if(await page.locator('#companion-context').isHidden())throw new Error('Desktop capture failed: '+await page.locator('#companion-error').innerText());
  assert.equal(await page.locator('#companion-frame-label').innerText(),'Whole desktop');
  const desktopSize=await page.locator('#companion-frame').evaluate(img=>[img.naturalWidth,img.naturalHeight]);assert.ok(desktopSize[0]>=800 && desktopSize[1]>=400,`desktop frame is ${desktopSize.join('x')}`);
  assert.equal(await page.evaluate(()=>document.visibilityState),'visible','the panel is back after a desktop capture');
  await page.screenshot({path:'.artifacts/native-desktop-capture.png'});await page.locator('#companion-remove').click();checks.push('picker lists the fixture and the whole desktop; both capture through the real shell');
  await page.locator('#companion-hide').click();await page.waitForTimeout(200);
  execFileSync(powershell,['-NoProfile','-Command',"$s=[Threading.EventWaitHandle]::OpenExisting('Local\\JarvisDesktopOpen');$s.Set()|Out-Null;$s.Dispose()"],{windowsHide:true,stdio:'pipe'});
  await page.locator('#companion-input').waitFor();assert.ok(await page.locator('#companion').isVisible());checks.push('dock collapse and summon restore conversation');
  assert.deepEqual(errors,[]);await writeFile('.artifacts/native-content-report.json',JSON.stringify({checks,errors},null,2));console.log(`PASS: ${checks.length} native content checks; ${errors.length} page errors; zero model requests.`);
}finally{
  fixture?.kill();
  try{execFileSync(powershell,['-NoProfile','-Command',"$s=[Threading.EventWaitHandle]::OpenExisting('Local\\JarvisDesktopQuit');$s.Set()|Out-Null;$s.Dispose()"],{windowsHide:true,stdio:'pipe'});}catch{}
  await browser?.close().catch(()=>{});
  if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,10000))]);
  if(child.exitCode===null)child.kill();
}
