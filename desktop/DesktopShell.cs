using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal sealed class DesktopRuntimeMissingException : Exception {
    public DesktopRuntimeMissingException(Exception inner) : base("Microsoft Edge WebView2 Runtime is required.", inner) { }
}

internal sealed class DesktopShell : Form {
    const int HotkeyId = 0x4A41;
    const int WmHotkey = 0x0312;
    const uint ModShift = 0x0004;
    const uint ModControl = 0x0002;
    const uint VkSpace = 0x20;
    readonly string url;
    readonly string launchKey;
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 5 * 1024 * 1024 };
    readonly CaptureService capture = new CaptureService();
    readonly dynamic speech = CreateSpeech();
    readonly Timer foregroundTimer = new Timer { Interval = 250 };
    readonly WebView2 web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(17, 16, 14) };
    readonly Button dockButton = new Button {
        Dock = DockStyle.Fill, Text = String.Empty, BackColor = JarvisMark.Charcoal,
        FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand, TabStop = false, AccessibleName = "Open Jarvis"
    };
    bool dockHover;
    string mode = "dock";
    bool ready;
    bool allowClose;
    bool hotkeyRegistered;
    int captureGeneration;
    string pendingCaptureId;

    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr window, int id);
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);

    public DesktopShell(string dataRoot, string appUrl, string key) {
        url = appUrl;
        launchKey = key;
        Text = "Jarvis";
        Icon = JarvisMark.AppIcon();
        BackColor = JarvisMark.Charcoal;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        Controls.Add(web);
        dockButton.FlatAppearance.BorderSize = 0;
        dockButton.FlatAppearance.MouseOverBackColor = JarvisMark.Charcoal;
        dockButton.FlatAppearance.MouseDownBackColor = JarvisMark.Charcoal;
        dockButton.Paint += delegate(object sender, PaintEventArgs args) {
            JarvisMark.Draw(args.Graphics, dockButton.ClientRectangle, dockHover ? JarvisMark.AmberHover : JarvisMark.Amber, false);
        };
        dockButton.MouseEnter += delegate { dockHover = true; dockButton.Invalidate(); };
        dockButton.MouseLeave += delegate { dockHover = false; dockButton.Invalidate(); };
        dockButton.Click += delegate { SummonPanel(); };
        Controls.Add(dockButton);
        foregroundTimer.Tick += delegate { capture.RememberForeground(); };
        foregroundTimer.Start();
        FormClosing += OnShellClosing;
        Shown += delegate { PositionForMode(); };
        ProfileDirectory = Path.Combine(dataRoot, "WebView2");
    }

    public string ProfileDirectory { get; private set; }
    public bool HotkeyAvailable { get { return hotkeyRegistered; } }

    public async Task InitializeAsync() {
        try {
            CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, ProfileDirectory);
            await web.EnsureCoreWebView2Async(environment);
        } catch (WebView2RuntimeNotFoundException error) { throw new DesktopRuntimeMissingException(error); }
        CoreWebView2 core = web.CoreWebView2;
        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.AreDevToolsEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.IsZoomControlEnabled = false;
        core.NavigationStarting += OnNavigationStarting;
        core.NewWindowRequested += OnNewWindowRequested;
        core.WebMessageReceived += OnWebMessageReceived;
        core.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs args) {
            if (!IsRoot(args.Uri) || args.PermissionKind == CoreWebView2PermissionKind.Microphone) args.State = CoreWebView2PermissionState.Deny;
            else if (args.PermissionKind == CoreWebView2PermissionKind.Camera) args.State = CoreWebView2PermissionState.Allow;
        };
        core.ScreenCaptureStarting += delegate(object sender, CoreWebView2ScreenCaptureStartingEventArgs args) {
            if (args.OriginalSourceFrameInfo == null || !IsRoot(args.OriginalSourceFrameInfo.Source)) args.Cancel = true;
        };
        core.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs args) {
            if (!args.IsSuccess) return;
            ready = true;
            Post(new Dictionary<string, object> { {"type", "host-ready"}, {"mode", mode} });
        };
        core.Navigate(url + "/#launch=" + launchKey);
    }

    public void ShowDock() { SetMode("dock"); }

    public void SummonPanel() {
        capture.RememberForeground();
        SetMode("panel");
        Show();
        Activate();
    }

    public void Shutdown() {
        allowClose = true;
        CancelCapture(null);
        foregroundTimer.Stop();
        StopSpeaking();
        if (speech != null && Marshal.IsComObject(speech)) Marshal.FinalReleaseComObject(speech);
        Close();
    }

    protected override void OnHandleCreated(EventArgs e) {
        base.OnHandleCreated(e);
        hotkeyRegistered = RegisterHotKey(Handle, HotkeyId, ModControl | ModShift, VkSpace);
    }

    protected override void OnHandleDestroyed(EventArgs e) {
        if (hotkeyRegistered) UnregisterHotKey(Handle, HotkeyId);
        hotkeyRegistered = false;
        base.OnHandleDestroyed(e);
    }

    protected override void WndProc(ref Message message) {
        if (message.Msg == WmHotkey && message.WParam.ToInt32() == HotkeyId) {
            SummonPanel();
            return;
        }
        base.WndProc(ref message);
    }

    protected override void OnResize(EventArgs e) {
        base.OnResize(e);
        // The dock is a rounded square with nothing behind it; the panel and workbench keep their normal window shape.
        if (dockButton != null && mode == "dock" && Width > 0 && Height > 0) {
            using (var path = JarvisMark.RoundedSquare(new Rectangle(0, 0, Width, Height), Math.Min(Width, Height) * 14f / 64f)) Region = new Region(path);
        } else if (Region != null) Region = null;
    }

    void OnShellClosing(object sender, FormClosingEventArgs args) {
        if (allowClose || args.CloseReason == CloseReason.ApplicationExitCall) return;
        args.Cancel = true;
        Post(new Dictionary<string, object> { {"type", "stop"} });
        SetMode("dock");
    }

    void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs args) {
        if (!IsRoot(args.Uri)) args.Cancel = true;
    }

    void OnNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs args) {
        args.Handled = true;
        if (IsApprovedExternal(args.Uri)) Process.Start(new ProcessStartInfo(args.Uri) { UseShellExecute = true });
    }

    void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args) {
        if (!IsRoot(args.Source)) return;
        Dictionary<string, object> message;
        try { message = json.Deserialize<Dictionary<string, object>>(args.WebMessageAsJson); }
        catch { return; }
        object rawType;
        string type = message.TryGetValue("type", out rawType) ? rawType as string : null;
        if (type == "resize") {
            object rawMode;
            string requested = message.TryGetValue("mode", out rawMode) ? rawMode as string : null;
            if (requested == "dock" || requested == "panel" || requested == "workbench") SetMode(requested);
        } else if (type == "capture") {
            object rawRequestId;
            string requestId = message.TryGetValue("requestId", out rawRequestId) ? rawRequestId as string : null;
            if (ValidRequestId(requestId)) BeginCapture(requestId);
        } else if (type == "cancel-capture") {
            object rawRequestId;
            string requestId = message.TryGetValue("requestId", out rawRequestId) ? rawRequestId as string : null;
            if (ValidRequestId(requestId)) CancelCapture(requestId);
        } else if (type == "speak") {
            object rawText;
            string text = message.TryGetValue("text", out rawText) ? rawText as string : null;
            if (String.IsNullOrWhiteSpace(text) || text.Length > 8000) PostSpeechError("Spoken replies must contain 1 to 8000 characters.");
            else TrySpeak(text);
        } else if (type == "stop-speaking") {
            StopSpeaking();
        } else if (type == "drag") {
            ReleaseCapture();
            SendMessage(Handle, 0x00A1, new IntPtr(2), IntPtr.Zero);
        }
    }

    void StopSpeaking() {
        if (speech != null) try { speech.Speak(String.Empty, 2); } catch { }
    }

    void TrySpeak(string text) {
        if (speech == null) { PostSpeechError("Windows speech is not available on this computer."); return; }
        try { StopSpeaking(); speech.Speak(text, 17); }
        catch { PostSpeechError("Windows could not speak this reply."); }
    }

    void PostSpeechError(string error) { Post(new Dictionary<string, object> { {"type", "speech-error"}, {"error", error} }); }

    async void BeginCapture(string requestId) {
        int generation = ++captureGeneration;
        pendingCaptureId = requestId;
        try {
            CaptureService.CaptureTarget target = capture.PrepareCapture();
            CaptureResult result = await Task.Run(() => capture.Capture(target));
            if (generation != captureGeneration || pendingCaptureId != requestId || mode == "dock") return;
            pendingCaptureId = null;
            Post(new Dictionary<string, object> { {"type", "capture"}, {"requestId", requestId}, {"image", result.Image}, {"label", result.Label}, {"capturedAt", result.CapturedAt} });
        } catch (Exception error) {
            if (generation != captureGeneration || pendingCaptureId != requestId || mode == "dock") return;
            pendingCaptureId = null;
            Post(new Dictionary<string, object> { {"type", "capture-error"}, {"requestId", requestId}, {"error", error.Message} });
        }
    }

    void CancelCapture(string requestId) {
        if (requestId != null && pendingCaptureId != requestId) return;
        captureGeneration++;
        pendingCaptureId = null;
    }

    void SetMode(string requested) {
        if (requested == "dock") CancelCapture(null);
        mode = requested;
        SuspendLayout();
        if (mode == "dock") {
            FormBorderStyle = FormBorderStyle.None;
            TopMost = true;
            ShowInTaskbar = false;
            MinimumSize = Size.Empty;
            ClientSize = new Size(76, 76);
            web.Visible = false;
            dockButton.Visible = true;
            dockButton.BringToFront();
        } else if (mode == "panel") {
            FormBorderStyle = FormBorderStyle.SizableToolWindow;
            TopMost = true;
            ShowInTaskbar = true;
            MinimumSize = new Size(380, 520);
            ClientSize = new Size(440, 700);
            dockButton.Visible = false;
            web.Visible = true;
        } else {
            FormBorderStyle = FormBorderStyle.Sizable;
            TopMost = false;
            ShowInTaskbar = true;
            ClientSize = new Size(1200, 850);
            MinimumSize = new Size(900, 650);
            dockButton.Visible = false;
            web.Visible = true;
        }
        PositionForMode();
        ResumeLayout();
        if (!Visible) Show();
        if (ready) Post(new Dictionary<string, object> { {"type", "host-ready"}, {"mode", mode} });
    }

    void PositionForMode() {
        Rectangle area = Screen.FromPoint(Cursor.Position).WorkingArea;
        if (mode != "dock") {
            Size available = new Size(Math.Max(200, area.Width - 44), Math.Max(200, area.Height - 44));
            MinimumSize = new Size(Math.Min(MinimumSize.Width, available.Width), Math.Min(MinimumSize.Height, available.Height));
            Size = new Size(Math.Min(Width, available.Width), Math.Min(Height, available.Height));
        }
        if (mode == "dock") Location = new Point(area.Right - Width - 22, area.Bottom - Height - 22);
        else if (mode == "panel") Location = new Point(area.Right - Width - 22, Math.Max(area.Top + 22, area.Bottom - Height - 22));
        else Location = new Point(area.Left + Math.Max(0, (area.Width - Width) / 2), area.Top + Math.Max(0, (area.Height - Height) / 2));
    }

    void Post(Dictionary<string, object> message) {
        if (ready && web.CoreWebView2 != null) web.CoreWebView2.PostWebMessageAsJson(json.Serialize(message));
    }

    bool IsRoot(string value) {
        Uri parsed;
        Uri origin = new Uri(url);
        return Uri.TryCreate(value, UriKind.Absolute, out parsed)
            && parsed.Scheme == origin.Scheme && parsed.Host == origin.Host && parsed.Port == origin.Port
            && parsed.AbsolutePath == "/";
    }

    static bool IsApprovedExternal(string value) {
        Uri parsed;
        if (!Uri.TryCreate(value, UriKind.Absolute, out parsed) || parsed.Scheme != Uri.UriSchemeHttps) return false;
        string host = parsed.Host.ToLowerInvariant();
        if (host == "auth.openai.com" || host == "chatgpt.com" || host == "claude.ai" || host == "console.anthropic.com") return true;
        if (host == "developers.openai.com") return parsed.AbsolutePath.TrimEnd('/') == "/codex/auth";
        if (host == "code.claude.com") return parsed.AbsolutePath.TrimEnd('/') == "/docs/en/authentication" || parsed.AbsolutePath.TrimEnd('/') == "/docs/en/legal-and-compliance";
        return false;
    }

    static bool ValidRequestId(string value) {
        if (String.IsNullOrEmpty(value) || value.Length > 64) return false;
        foreach (char item in value) if (!Char.IsLetterOrDigit(item) && item != '.' && item != '_' && item != '-') return false;
        return true;
    }

    static object CreateSpeech() {
        try {
            Type type = Type.GetTypeFromProgID("SAPI.SpVoice");
            return type == null ? null : Activator.CreateInstance(type);
        } catch { return null; }
    }
}
