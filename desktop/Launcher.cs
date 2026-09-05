using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

// A small Windows host for the existing Node application, not a second app runtime.
internal static class Launcher {
    const string Url = "http://127.0.0.1:4317";
    static string Root = Path.GetFullPath(Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA") ?? Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Jarvis"));
    static string VersionDir = Path.Combine(Root, "versions", BuildInfo.Version + "-" + BuildInfo.PayloadHash.Substring(0,12));
    static Process Server;
    static NotifyIcon Tray;
    static DesktopShell Window;
    static Mutex Instance;
    static EventWaitHandle OpenSignal,QuitSignal;
    static readonly System.Collections.Generic.List<EventWaitHandle> AppSignals=new System.Collections.Generic.List<EventWaitHandle>();
    static readonly string SessionId=Guid.NewGuid().ToString("N");
    static readonly string LaunchKey=NewKey();
    static bool AppReady;
    static IntPtr Job;
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits { public long PerProcess,PerJob; public uint Flags; public UIntPtr MinWorking,MaxWorking; public uint ActiveProcesses; public UIntPtr Affinity; public uint Priority,Scheduling; }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits { public BasicLimits Basic; public IoCounters Io; public UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory; }
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
    [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job,int info,ref ExtendedLimits limits,uint size);
    [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool SetDllDirectory(string path);

    [STAThread]
    static int Main(string[] args) {
        EmbeddedDependencyLoader.Install();
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        if (args.Length == 1 && args[0] == "--verify") {
            try {
                Extract();
                string node = Run("--version");
                string codex = Run("\"" + Path.Combine(VersionDir,"runtime","node_modules","@openai","codex","bin","codex.js") + "\" --version");
                File.WriteAllText(Path.Combine(VersionDir,"verification.txt"), node.Trim() + "\n" + codex.Trim());
                return 0;
            } catch { return 1; }
        }
        bool created;
        Instance = new Mutex(true, "Local\\JarvisDesktopLauncher", out created);
        if (!created) {
            if (!File.Exists(Path.Combine(VersionDir,"installed.txt"))) MessageBox.Show("Jarvis is already running. Choose Quit Jarvis from its tray menu, then reopen this download to install the new version.","Update Jarvis");
            else {
                try { using(var signal=EventWaitHandle.OpenExisting("Local\\JarvisDesktopOpen")) signal.Set(); }
                catch { MessageBox.Show("Jarvis is still starting. Try opening it again shortly.","Jarvis"); }
            }
            Instance.Dispose(); return 0;
        }
        try {
            var loading = new Form { Text="Starting Jarvis", Width=440, Height=180, StartPosition=FormStartPosition.CenterScreen, FormBorderStyle=FormBorderStyle.FixedDialog, MaximizeBox=false, MinimizeBox=false, ControlBox=false };
            var label = new Label { Text="Getting Jarvis ready on your computer...", Dock=DockStyle.Top, Height=70, Padding=new Padding(22), Font=new Font("Segoe UI",11) };
            loading.Controls.Add(new ProgressBar { Dock=DockStyle.Bottom, Height=18, Style=ProgressBarStyle.Marquee });
            loading.Controls.Add(label);
            OpenSignal=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\JarvisDesktopOpen");
            QuitSignal=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\JarvisDesktopQuit");
            loading.Handle.ToString();
            // User applications start from the launcher, outside the server's kill-on-close job.
            foreach(string appName in new [] {"notepad","calculator","paint"}) {
                string selectedApp=appName;
                var signal=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\JarvisOpenApp-"+SessionId+"-"+selectedApp);
                AppSignals.Add(signal);
                ThreadPool.RegisterWaitForSingleObject(signal,delegate { loading.BeginInvoke((Action)(()=>OpenDesktopApp(selectedApp))); },null,-1,false);
            }
            ThreadPool.RegisterWaitForSingleObject(OpenSignal,delegate { if(AppReady) loading.BeginInvoke((Action)Open); },null,-1,false);
            ThreadPool.RegisterWaitForSingleObject(QuitSignal,delegate { loading.BeginInvoke((Action)Application.Exit); },null,-1,true);
            loading.Shown += async delegate {
                try {
                    await Task.Run((Action)Extract);
                    if(!SetDllDirectory(VersionDir)) throw new Exception("Windows couldn't load Jarvis's desktop components.");
                    if (PortInUse()) throw new Exception("Another application is using port 4317. Quit that session, then reopen Jarvis.");
                    if (!Ready()) {
                        Job=CreateJobObject(IntPtr.Zero,null);
                        var limits=new ExtendedLimits(); limits.Basic.Flags=0x2000;
                        if(Job==IntPtr.Zero || !SetInformationJobObject(Job,9,ref limits,(uint)Marshal.SizeOf(limits))) throw new Exception("Windows couldn't create Jarvis's process group.");
                        var start = new ProcessStartInfo(Path.Combine(VersionDir,"runtime","node.exe"), "server.mjs --desktop-instance=" + SessionId) { WorkingDirectory=VersionDir, UseShellExecute=false, CreateNoWindow=true };
                        // The CLI's native helpers can find the bundled Node runtime without a global install.
                        start.EnvironmentVariables["PATH"] = Path.Combine(VersionDir,"runtime") + ";" + Environment.GetEnvironmentVariable("PATH");
                        start.EnvironmentVariables["JARVIS_DESKTOP_KEY"] = LaunchKey;
                        Server = Process.Start(start);
                        if(!AssignProcessToJobObject(Job,Server.Handle)) throw new Exception("Windows couldn't attach Jarvis to its process group.");
                        var deadline=DateTime.UtcNow.AddSeconds(20);
                        while (!Ready()) {
                            if (Server.HasExited) throw new Exception("Jarvis couldn't start. Another program may be using port 4317. Close that program and open Jarvis again.");
                            if (DateTime.UtcNow>deadline) throw new Exception("Jarvis took too long to start. Quit and reopen Jarvis to try again.");
                            await Task.Delay(250);
                        }
                    }
                    Shortcuts();
                    var menu=new ContextMenuStrip();
                    menu.Items.Add("Open Jarvis",null,delegate { Open(); });
                    menu.Items.Add("Quit Jarvis",null,delegate { Application.Exit(); });
                    Tray=new NotifyIcon { Icon=SystemIcons.Application, Text="Jarvis", ContextMenuStrip=menu, Visible=true };
                    Tray.DoubleClick += delegate { Open(); };
                    Window=new DesktopShell(Root,Url,LaunchKey);
                    Window.ShowDock();
                    await Window.InitializeAsync();
                    if(!Window.HotkeyAvailable) MessageBox.Show("Ctrl+Shift+Space is already in use. Use the Jarvis dock or tray menu to open the companion.","Jarvis shortcut unavailable",MessageBoxButtons.OK,MessageBoxIcon.Information);
                    AppReady=true; loading.Hide(); Window.SummonPanel();
                } catch (Exception error) {
                    if (error is DesktopRuntimeMissingException) {
                        if (MessageBox.Show("Jarvis needs Microsoft Edge WebView2 Runtime. Open Microsoft's official download page?","Jarvis needs WebView2",MessageBoxButtons.YesNo,MessageBoxIcon.Information)==DialogResult.Yes)
                            Process.Start(new ProcessStartInfo("https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section") {UseShellExecute=true});
                    } else MessageBox.Show(error.Message,"Jarvis couldn't start",MessageBoxButtons.OK,MessageBoxIcon.Error);
                    Application.Exit();
                }
            };
            Application.Run(loading);
            return 0;
        } finally {
            if (Window!=null) { Window.Shutdown(); Window.Dispose(); }
            if (Tray!=null) Tray.Dispose();
            if (Server!=null && !Server.HasExited) {
                // Stop only the process tree this launcher owns, including a canceled inference.
                using (var kill=Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"taskkill.exe"),"/PID " + Server.Id + " /T /F") { UseShellExecute=false,CreateNoWindow=true })) kill.WaitForExit(10000);
            }
            Instance.ReleaseMutex(); Instance.Dispose();
            if(Job!=IntPtr.Zero) CloseHandle(Job);
            if(OpenSignal!=null) OpenSignal.Dispose();
            if(QuitSignal!=null) QuitSignal.Dispose();
            foreach(var signal in AppSignals)signal.Dispose();
        }
    }

    static void OpenDesktopApp(string app) {
        string executable=app=="notepad"?"notepad.exe":app=="calculator"?"calc.exe":"mspaint.exe";
        try {
            string path=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),executable);
            if(File.Exists(path)) Process.Start(new ProcessStartInfo(path) {UseShellExecute=false});
            else {
                string registered=app=="notepad"?"Microsoft.WindowsNotepad_8wekyb3d8bbwe!App":app=="calculator"?"Microsoft.WindowsCalculator_8wekyb3d8bbwe!App":"Microsoft.Paint_8wekyb3d8bbwe!App";
                Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"explorer.exe"),"shell:AppsFolder\\"+registered) {UseShellExecute=false});
            }
        }
        catch { MessageBox.Show("Windows could not open that application. Open it yourself and refresh the window list.","Jarvis"); }
    }

    static bool Ready() {
        try {
            var request=(HttpWebRequest)WebRequest.Create(Url+"/api/health");
            request.Timeout=500; request.Proxy=null;
            using(var response=request.GetResponse()) using(var reader=new StreamReader(response.GetResponseStream())) {
                string body=reader.ReadToEnd(); return body.Contains("\"app\":\"jarvis-workbench\"") && body.Contains("\"ready\":true") && body.Contains("\"instanceId\":\""+SessionId+"\"");
            }
        } catch { return false; }
    }
    static bool PortInUse() { try { using(var socket=new TcpClient()) socket.Connect("127.0.0.1",4317); return true; } catch { return false; } }
    static string NewKey() { var bytes=new byte[32]; using(var random=RandomNumberGenerator.Create()) random.GetBytes(bytes); return BitConverter.ToString(bytes).Replace("-","").ToLowerInvariant(); }
    static void Open() { if(Window!=null) Window.SummonPanel(); }
    static string Run(string args) {
        using(var process=Process.Start(new ProcessStartInfo(Path.Combine(VersionDir,"runtime","node.exe"),args) { WorkingDirectory=VersionDir,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true })) {
            string output=process.StandardOutput.ReadToEnd();
            if(!process.WaitForExit(30000) || process.ExitCode!=0) throw new Exception("Bundled runtime check failed.");
            return output;
        }
    }
    static void Extract() {
        // Each build has an immutable directory; a failed extraction is never treated as ready.
        string marker=Path.Combine(VersionDir,"installed.txt");
        if(File.Exists(marker) && File.ReadAllText(marker)==BuildInfo.PayloadHash) return;
        Directory.CreateDirectory(VersionDir);
        using(var payload=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip")) {
            using(var sha=SHA256.Create()) {
                string actual=BitConverter.ToString(sha.ComputeHash(payload)).Replace("-","").ToLowerInvariant();
                if(actual!=BuildInfo.PayloadHash) throw new Exception("This download is damaged. Download Jarvis again from the official site.");
            }
            payload.Position=0;
            using(var archive=new ZipArchive(payload,ZipArchiveMode.Read)) {
                foreach(var entry in archive.Entries) {
                    string path=Path.GetFullPath(Path.Combine(VersionDir,entry.FullName));
                    if(!path.StartsWith(VersionDir+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)) throw new Exception("Invalid package path.");
                    if(String.IsNullOrEmpty(entry.Name)) { Directory.CreateDirectory(path); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(path));
                    entry.ExtractToFile(path,true);
                }
            }
        }
        string installed=Path.Combine(VersionDir,"Jarvis.exe");
        if(!String.Equals(Application.ExecutablePath,installed,StringComparison.OrdinalIgnoreCase)) File.Copy(Application.ExecutablePath,installed,true);
        File.WriteAllText(marker,BuildInfo.PayloadHash);
    }
    static void Shortcuts() {
        try {
            string programs=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"Jarvis");
            Directory.CreateDirectory(programs);
            foreach(string link in new [] { Path.Combine(programs,"Jarvis.lnk"),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"Jarvis.lnk") }) {
                dynamic shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
                dynamic shortcut=shell.CreateShortcut(link);
                if(File.Exists(link) && !((string)shortcut.TargetPath).StartsWith(Root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)) continue;
                shortcut.TargetPath=Path.Combine(VersionDir,"Jarvis.exe"); shortcut.WorkingDirectory=VersionDir; shortcut.Description="Open Jarvis"; shortcut.Save();
            }
        } catch { /* Shortcuts are optional; the downloaded executable remains usable. */ }
    }
}
