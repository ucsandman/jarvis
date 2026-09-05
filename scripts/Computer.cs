using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;

// A local, reviewed-action controller. No shell commands or coordinate fallback.
public static class JarvisComputer {
    delegate bool EnumProc(IntPtr h, IntPtr p);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr p);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h, int id);
    static volatile bool armed, hotkeyReady;
    static DateTime expires;
    static readonly object gate = new object();
    static readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength=1000000 };
    static readonly Regex denied = new Regex(@"password|credential|sign.?in|log.?in|1password|bitwarden|keepass|lastpass|vault|authentication|windows security|consent|\.env\b|\.secrets\.env|powershell|terminal|command prompt|cmd\.exe", RegexOptions.IgnoreCase);
    static readonly Regex launcherControl = new Regex(@"address|location|omnibox|urlbar|searchorenter|run command|commandline|terminal|console",RegexOptions.IgnoreCase);
    static readonly Regex commandText = new Regex(@"powershell|pwsh|cmd(?:\.exe)?\s|mshta|wscript|cscript|rundll32|regsvr32|javascript:|vbscript:|file:|shell:|^\s*[&|]|[\r\n]",RegexOptions.IgnoreCase);
    static readonly Dictionary<string,string> apps = new Dictionary<string,string> {
        {"notepad", "notepad.exe"}, {"calculator", "calc.exe"}, {"paint", "mspaint.exe"}
    };
    static string Str(Dictionary<string,object> d, string k) { return d.ContainsKey(k) ? Convert.ToString(d[k]) : ""; }
    static string Title(IntPtr h) { var s=new StringBuilder(1024); GetWindowText(h,s,s.Capacity); return s.ToString(); }
    static string Identity(IntPtr h) {
        uint pid; GetWindowThreadProcessId(h,out pid);
        using(var p=Process.GetProcessById((int)pid)) return h.ToInt64()+":"+pid+":"+p.StartTime.ToUniversalTime().Ticks;
    }
    static bool Safe(IntPtr h) {
        try {
            uint pid; GetWindowThreadProcessId(h,out pid);
            using(var p=Process.GetProcessById((int)pid)) {
                return IsWindowVisible(h) && Title(h).Length>0 && p.ProcessName!="explorer" && !denied.IsMatch(Title(h)+" "+p.ProcessName) && !Title(h).StartsWith("Jarvis",StringComparison.OrdinalIgnoreCase);
            }
        } catch { return false; }
    }
    static IntPtr Window(string id) {
        long n; var parts=id.Split(':');
        if(parts.Length!=3 || !long.TryParse(parts[0],out n)) throw new Exception("Choose a current window.");
        var h=new IntPtr(n);
        if(!Safe(h) || Identity(h)!=id) throw new Exception("The selected window changed or is protected. Refresh the window list.");
        return h;
    }
    static object Windows() {
        var rows=new List<object>();
        EnumWindows((h,p)=>{ if(Safe(h) && rows.Count<100) try { rows.Add(new { id=Identity(h), title=Title(h) }); } catch {} return true; },IntPtr.Zero);
        return new { windows=rows, hotkey=hotkeyReady };
    }
    static string Rid(AutomationElement e) { return string.Join(".",e.GetRuntimeId()); }
    static string Context(AutomationElement e) {
        var parent=TreeWalker.ControlViewWalker.GetParent(e);string name=parent==null?"":parent.Current.Name;
        return name.Length>300?name.Substring(0,300):name;
    }
    static string State(AutomationElement e) {
        object p;var s=new StringBuilder();
        if(e.TryGetCurrentPattern(ValuePattern.Pattern,out p))s.Append("value:").Append(((ValuePattern)p).Current.Value);
        if(e.TryGetCurrentPattern(TogglePattern.Pattern,out p))s.Append("toggle:").Append(((TogglePattern)p).Current.ToggleState);
        if(e.TryGetCurrentPattern(SelectionItemPattern.Pattern,out p))s.Append("selected:").Append(((SelectionItemPattern)p).Current.IsSelected);
        if(e.TryGetCurrentPattern(ExpandCollapsePattern.Pattern,out p))s.Append("expanded:").Append(((ExpandCollapsePattern)p).Current.ExpandCollapseState);
        using(var hash=System.Security.Cryptography.SHA256.Create())return BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(s.ToString())));
    }
    static List<AutomationElement> Elements(IntPtr h) {
        var list=new List<AutomationElement>();
        var queue=new Queue<Tuple<AutomationElement,int>>();
        queue.Enqueue(Tuple.Create(AutomationElement.FromHandle(h),0));
        var timer=Stopwatch.StartNew();
        while(queue.Count>0 && list.Count<350 && timer.ElapsedMilliseconds<3500) {
            var pair=queue.Dequeue(); var e=pair.Item1;
            try {
                if(e.Current.IsPassword || denied.IsMatch(e.Current.Name ?? "") || launcherControl.IsMatch((e.Current.Name ?? "")+" "+e.Current.AutomationId)) continue;
                if(!e.Current.IsOffscreen) list.Add(e);
                if(pair.Item2>=7) continue;
                var children=e.FindAll(TreeScope.Children,Condition.TrueCondition);
                for(int i=0;i<children.Count && queue.Count<600;i++) queue.Enqueue(Tuple.Create(children[i],pair.Item2+1));
            } catch(ElementNotAvailableException) {}
        }
        return list;
    }
    static object Snapshot(string id) {
        var h=Window(id); var rows=new List<object>();
        foreach(var e in Elements(h)) try {
            var c=e.Current;
            var name=c.Name ?? ""; if(name.Length>300) name=name.Substring(0,300);
            string value="";object pattern;
            if(e.TryGetCurrentPattern(ValuePattern.Pattern,out pattern)) { value=((ValuePattern)pattern).Current.Value ?? ""; if(value.Length>500)value=value.Substring(0,500); }
            rows.Add(new { id=Rid(e), name=name, automationId=c.AutomationId, context=Context(e), state=State(e), value=value, type=c.ControlType.ProgrammaticName.Replace("ControlType.",""), enabled=c.IsEnabled });
        } catch(ElementNotAvailableException) {}
        return new { window=id, title=Title(h), elements=rows, limited=rows.Count>=350 };
    }
    static void Check() {
        lock(gate) { if(!armed || DateTime.UtcNow>=expires || !hotkeyReady) throw new Exception("Computer control is stopped or expired. Enable it again in Jarvis."); }
    }
    static void Focus(IntPtr h) {
        Check(); SetForegroundWindow(h);
        if(GetForegroundWindow()!=h) { try { AutomationElement.FromHandle(h).SetFocus(); } catch {} }
        Thread.Sleep(150); Check();
        if(GetForegroundWindow()!=h) throw new Exception("The target did not take focus. No input was sent.");
    }
    static AutomationElement Recheck(AutomationElement el, IntPtr h, Dictionary<string,object> d) {
        Check(); Window(Str(d,"window"));
        el=Elements(h).Find(e=>Rid(e)==Str(d,"element"));
        if(el==null) throw new Exception("The approved control no longer exists.");
        var c=el.Current;
        if(Context(el)!=Str(d,"context") || State(el)!=Str(d,"state")) throw new Exception("The approved control context or value changed. Inspect it again.");
        if(Title(h)!=Str(d,"title") || Rid(el)!=Str(d,"element") || c.Name!=Str(d,"name") || c.AutomationId!=Str(d,"automationId") || c.ControlType.ProgrammaticName.Replace("ControlType.","")!=Str(d,"type") || !c.IsEnabled || c.IsOffscreen || c.IsPassword || denied.IsMatch(c.Name ?? "") || launcherControl.IsMatch((c.Name ?? "")+" "+c.AutomationId)) throw new Exception("The approved target changed. Inspect it again.");
        Check();
        return el;
    }
    static object FreshPattern(AutomationElement el, IntPtr h, Dictionary<string,object> d, AutomationPattern pattern) {
        el=Recheck(el,h,d);object value;
        if(!el.TryGetCurrentPattern(pattern,out value)) throw new Exception("The approved action is no longer available.");
        Check();return value;
    }
    static object Act(Dictionary<string,object> d) {
        Check(); var kind=Str(d,"kind");
        if(kind=="launch") {
            var app=Str(d,"app");
            if(!apps.ContainsKey(app)) throw new Exception("Choose one of the supported applications.");
            Check();
            var instance=Str(d,"launcherInstance");
            if(instance.Length>0) {
                if(!Regex.IsMatch(instance,"^[a-f0-9]{32}$")) throw new Exception("Invalid launcher session.");
                using(var signal=EventWaitHandle.OpenExisting("Local\\JarvisOpenApp-"+instance+"-"+app)) { Check();signal.Set(); }
                return new { performed=true, message="Application launch requested. Choose its window to continue." };
            }
            var exe=System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),apps[app]);
            if(System.IO.File.Exists(exe)) Process.Start(new ProcessStartInfo(exe) { UseShellExecute=false });
            else {
                var registered=app=="notepad"?"Microsoft.WindowsNotepad_8wekyb3d8bbwe!App":app=="calculator"?"Microsoft.WindowsCalculator_8wekyb3d8bbwe!App":"Microsoft.Paint_8wekyb3d8bbwe!App";
                Process.Start(new ProcessStartInfo(System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"explorer.exe"),"shell:AppsFolder\\"+registered) {UseShellExecute=false});
            }
            return new { performed=true, message="Application launch requested. Choose its window to continue." };
        }
        var h=Window(Str(d,"window"));
        if(Title(h)!=Str(d,"title")) throw new Exception("The window title changed. Inspect it and request a new action.");
        if(kind=="focus") { Focus(h); return new { performed=true }; }
        var target=Str(d,"element"); AutomationElement el=null;
        foreach(var e in Elements(h)) if(Rid(e)==target) { el=e; break; }
        if(el==null || !el.Current.IsEnabled || el.Current.IsPassword || el.Current.Name!=Str(d,"name")) throw new Exception("The control changed. Inspect the window and request a new action.");
        Window(Str(d,"window")); Check();
        object pat;
        if(kind=="click") {
            if(el.TryGetCurrentPattern(InvokePattern.Pattern,out pat)) { ((InvokePattern)FreshPattern(el,h,d,InvokePattern.Pattern)).Invoke(); }
            else if(el.TryGetCurrentPattern(TogglePattern.Pattern,out pat)) { ((TogglePattern)FreshPattern(el,h,d,TogglePattern.Pattern)).Toggle(); }
            else if(el.TryGetCurrentPattern(SelectionItemPattern.Pattern,out pat)) { ((SelectionItemPattern)FreshPattern(el,h,d,SelectionItemPattern.Pattern)).Select(); }
            else if(el.TryGetCurrentPattern(ExpandCollapsePattern.Pattern,out pat)) { ((ExpandCollapsePattern)FreshPattern(el,h,d,ExpandCollapsePattern.Pattern)).Expand(); }
            else throw new Exception("This control has no accessible click action. Coordinate clicking is not supported.");
        } else if(kind=="type") {
            string text=Str(d,"text"); if(text.Length>2000 || commandText.IsMatch(text)) throw new Exception("This text is too long or resembles a command. No text was sent.");
            if(el.TryGetCurrentPattern(ValuePattern.Pattern,out pat) && !((ValuePattern)pat).Current.IsReadOnly) { ((ValuePattern)FreshPattern(el,h,d,ValuePattern.Pattern)).SetValue(text); }
            else throw new Exception("This control has no editable accessibility value. No text was sent.");
        } else if(kind=="scroll") {
            if(!el.TryGetCurrentPattern(ScrollPattern.Pattern,out pat)) throw new Exception("This control does not expose scrolling.");
            ((ScrollPattern)FreshPattern(el,h,d,ScrollPattern.Pattern)).Scroll(ScrollAmount.NoAmount,Str(d,"key")=="up"?ScrollAmount.LargeDecrement:ScrollAmount.LargeIncrement);
        } else if(kind=="key") {
            Focus(h);
            var keys=new Dictionary<string,string> { {"enter","{ENTER}"},{"tab","{TAB}"},{"escape","{ESC}"},{"up","{UP}"},{"down","{DOWN}"},{"left","{LEFT}"},{"right","{RIGHT}"},{"save","^s"},{"select-all","^a"},{"backspace","{BACKSPACE}"},{"delete","{DELETE}"} };
            var key=Str(d,"key"); if(!keys.ContainsKey(key)) throw new Exception("Unsupported keyboard shortcut.");
            el=Recheck(el,h,d);el.SetFocus(); Thread.Sleep(80);el=Recheck(el,h,d);
            if(!el.Current.HasKeyboardFocus || GetForegroundWindow()!=h) throw new Exception("Focus changed. No key was sent.");
            Check();SendKeys.SendWait(keys[key]);
        } else throw new Exception("Unsupported desktop action.");
        return new { performed=true };
    }
    class StopWindow : NativeWindow {
        public StopWindow() {
            CreateHandle(new CreateParams());
            hotkeyReady=RegisterHotKey(Handle,718,0x0002|0x0004|0x4000,0x7B); // Ctrl+Shift+F12
        }
        protected override void WndProc(ref Message m) {
            if(m.Msg==0x0312) { lock(gate) armed=false; Console.WriteLine("{\"event\":\"stopped\"}"); }
            base.WndProc(ref m);
        }
        public void Close() { UnregisterHotKey(Handle,718); DestroyHandle(); }
    }
    public static void Run() {
        Console.InputEncoding=Encoding.UTF8; Console.OutputEncoding=new UTF8Encoding(false);
        var ready=new ManualResetEvent(false);
        var thread=new Thread(()=>{ var win=new StopWindow(); ready.Set(); Application.Run(); win.Close(); });
        thread.IsBackground=true; thread.SetApartmentState(ApartmentState.STA); thread.Start(); ready.WaitOne();
        string line;
        while((line=Console.ReadLine())!=null) {
            try {
                if(line.Length>20000) throw new Exception("Request too large.");
                var d=json.Deserialize<Dictionary<string,object>>(line); object result;
                switch(Str(d,"op")) {
                    case "windows": result=Windows(); break;
                    case "snapshot": result=Snapshot(Str(d,"window")); break;
                    case "arm": lock(gate) { if(!hotkeyReady) throw new Exception("The stop shortcut is unavailable. Close the other Computer session first."); armed=true; expires=DateTime.UtcNow.AddMinutes(10); } result=new { armed=true }; break;
                    case "stop": lock(gate) armed=false; result=new { armed=false }; break;
                    case "status": result=new { armed=armed && DateTime.UtcNow<expires, hotkey=hotkeyReady }; break;
                    case "act": result=Act(d); break;
                    default: throw new Exception("Unsupported operation.");
                }
                Console.WriteLine(json.Serialize(new { ok=true, result=result }));
            } catch(Exception e) { Console.WriteLine(json.Serialize(new { ok=false, error=e is System.ComponentModel.Win32Exception ? "Windows refused the operation." : e.Message })); }
        }
        lock(gate) armed=false;
    }
}
