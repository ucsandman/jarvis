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
    const int QuickAskHotkeyId = 0x4A43;
    const int StopHotkeyId = 0x4A45;
    const int WmHotkey = 0x0312;
    const uint ModShift = 0x0004;
    const uint ModControl = 0x0002;
    const uint ModNoRepeat = 0x4000;
    const uint VkSpace = 0x20;
    const uint VkE = 0x45;
    const uint VkF12 = 0x7B;
    readonly string url;
    readonly string launchKey;
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 5 * 1024 * 1024 };
    readonly CaptureService capture = new CaptureService();
    readonly dynamic speech = CreateSpeech();
    readonly FollowService follow = new FollowService();
    readonly Timer foregroundTimer = new Timer { Interval = 250 };
    readonly Timer followTimer = new Timer { Interval = 1000 };
    // The panel is as tall as its content: the page posts its height, the shell eases there over 200 ms with the bottom edge pinned.
    readonly Timer panelTimer = new Timer { Interval = 15 };
    const int PanelWidth = 440;
    const int PanelMinHeight = 240;
    const int PanelMargin = 22;
    const int StudioMaxWidth = 1480;
    const int StudioMaxHeight = 900;
    const int StudioMinWidth = 760;
    const int StudioMinHeight = 520;
    int panelFrom, panelTarget;
    DateTime panelStart;
    bool panelSized;   // the user dragged an edge, so content stops driving the height until the next summon
    // Where Sidelook lives on the desktop: the bottom-right corner shared by the dock, the panel and the studio. Dragging the dock moves it; it is saved beside the profile.
    Point anchor = Point.Empty;
    readonly string anchorFile;
    // The studio opens to fit the monitor Sidelook lives on, unless a drag has taught it a size. Only the studio remembers one.
    Size studioSize = Size.Empty;
    readonly string studioFile;
    Point dockPress;
    bool dockDragging;
    readonly WebView2 web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(23, 29, 45) };
    readonly Button dockButton = new Button {
        Dock = DockStyle.Fill, Text = String.Empty, BackColor = SidelookMark.Navy,
        FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand, TabStop = false, AccessibleName = "Open Sidelook"
    };
    bool dockHover;
    readonly Timer eyeTimer = new Timer { Interval = 40 };
    PointF eyes = new PointF(SidelookMark.EyeTravel, 0);
    Point lastCursor = new Point(int.MinValue, int.MinValue);
    bool animations = true;   // Windows' animation switch, refreshed on preference change; false means the eyes stay at the static right
    readonly Timer fadeTimer = new Timer { Interval = 15 };
    DateTime fadeStart; double fadeFrom, fadeTo, fadeMs; Action fadeDone;
    bool capturingDesktop;   // the panel is deliberately at opacity 0 for a whole-desktop shot; nothing else may touch the opacity
    Action afterCapture;     // a summon or a fade asked for during that shot, run once the shot is done
    string mode = "dock";
    bool ready;
    bool allowClose;
    bool hotkeyRegistered;
    bool quickAskRegistered;
    bool stopHotkeyRegistered;
    bool followSnapshots;
    DateTime followExpires;
    int captureGeneration;
    string pendingCaptureId;

    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr window, int id);
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool SystemParametersInfo(uint action, uint param, ref bool value, uint flags);

    public DesktopShell(string dataRoot, string appUrl, string key) {
        url = appUrl;
        launchKey = key;
        Text = "Sidelook";
        Icon = SidelookMark.AppIcon();
        BackColor = SidelookMark.Navy;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        Controls.Add(web);
        dockButton.FlatAppearance.BorderSize = 0;
        dockButton.FlatAppearance.MouseOverBackColor = SidelookMark.Navy;
        dockButton.FlatAppearance.MouseDownBackColor = SidelookMark.Navy;
        dockButton.Paint += delegate(object sender, PaintEventArgs args) {
            SidelookMark.Draw(args.Graphics, dockButton.ClientRectangle, eyes, false, dockHover);
        };
        dockButton.MouseEnter += delegate { dockHover = true; dockButton.Invalidate(); };
        dockButton.MouseLeave += delegate { dockHover = false; dockButton.Invalidate(); };
        // Press and release summons; press and move drags the dock, and where it lands is where Sidelook lives from then on.
        dockButton.MouseDown += delegate(object sender, MouseEventArgs args) { if (args.Button == MouseButtons.Left) { dockPress = Cursor.Position; dockDragging = false; } };
        dockButton.MouseMove += delegate(object sender, MouseEventArgs args) {
            if (args.Button != MouseButtons.Left || dockDragging) return;
            Point now = Cursor.Position;
            if (Math.Abs(now.X - dockPress.X) < 5 && Math.Abs(now.Y - dockPress.Y) < 5) return;
            dockDragging = true;
            ReleaseCapture();
            SendMessage(Handle, 0x00A1, new IntPtr(2), IntPtr.Zero);
            RememberAnchor();
        };
        dockButton.MouseUp += delegate(object sender, MouseEventArgs args) { if (args.Button == MouseButtons.Left && !dockDragging) SummonPanel(); };
        Controls.Add(dockButton);
        anchorFile = Path.Combine(dataRoot, "dock.json");
        LoadAnchor();
        studioFile = Path.Combine(dataRoot, "studio-size.json");
        LoadStudioSize();
        foregroundTimer.Tick += delegate { capture.RememberForeground(); follow.Track(); };
        foregroundTimer.Start();
        follow.Clicked += OnFollowClick;
        followTimer.Tick += delegate { if (DateTime.UtcNow >= followExpires) EndFollow("expired"); };
        panelTimer.Tick += delegate { StepPanel(); };
        animations = AnimationsEnabled();
        Microsoft.Win32.SystemEvents.UserPreferenceChanged += OnPreferenceChanged;
        Microsoft.Win32.SystemEvents.SessionSwitch += OnSessionSwitch;
        eyeTimer.Tick += delegate { TrackEyes(); };
        eyeTimer.Start();
        fadeTimer.Tick += delegate { StepFade(); };
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
            PostHostReady();
        };
        core.Navigate(url + "/#launch=" + launchKey);
    }

    public void ShowDock() { SetMode("dock"); }

    public void SummonPanel() {
        // A summon mid-capture would fade the panel back in while the desktop shot is being taken, putting Sidelook in its own screenshot.
        if (capturingDesktop) { afterCapture = SummonPanel; return; }
        // A new summon is a new context: a window picked from the list is forgotten and the window in front is the default again.
        capture.ClearPick();
        capture.RememberForeground();
        panelSized = false;
        // Re-summoning a panel that is already open does not blink: only a panel arriving from another mode starts transparent.
        if (animations && mode != "panel") Opacity = 0;
        SetMode("panel");
        Show();
        Activate();
        Fade(Opacity, 1, 150, null);
    }

    public void Shutdown() {
        allowClose = true;
        CancelCapture(null);
        EndFollow("stopped");
        follow.Dispose();
        foregroundTimer.Stop();
        StopSpeaking();
        if (speech != null && Marshal.IsComObject(speech)) Marshal.FinalReleaseComObject(speech);
        eyeTimer.Stop();
        fadeTimer.Stop();
        panelTimer.Stop();
        Microsoft.Win32.SystemEvents.UserPreferenceChanged -= OnPreferenceChanged;
        Microsoft.Win32.SystemEvents.SessionSwitch -= OnSessionSwitch;
        Close();
    }

    protected override void OnHandleCreated(EventArgs e) {
        base.OnHandleCreated(e);
        hotkeyRegistered = RegisterHotKey(Handle, HotkeyId, ModControl | ModShift, VkSpace);
        quickAskRegistered = RegisterHotKey(Handle, QuickAskHotkeyId, ModControl | ModShift, VkE);
        // A mode change recreates the window and Windows drops its shortcuts with it, so a lease in progress takes its Stop back.
        if (follow.On) stopHotkeyRegistered = RegisterHotKey(Handle, StopHotkeyId, ModControl | ModShift | ModNoRepeat, VkF12);
    }

    protected override void OnHandleDestroyed(EventArgs e) {
        if (hotkeyRegistered) UnregisterHotKey(Handle, HotkeyId);
        if (quickAskRegistered) UnregisterHotKey(Handle, QuickAskHotkeyId);
        if (stopHotkeyRegistered) UnregisterHotKey(Handle, StopHotkeyId);
        hotkeyRegistered = false;
        quickAskRegistered = false;
        stopHotkeyRegistered = false;
        base.OnHandleDestroyed(e);
    }

    protected override void WndProc(ref Message message) {
        if (message.Msg == WmHotkey && message.WParam.ToInt32() == HotkeyId) {
            SummonPanel();
            return;
        }
        if (message.Msg == WmHotkey && message.WParam.ToInt32() == StopHotkeyId) {
            EndFollow("hotkey");
            return;
        }
        if (message.Msg == WmHotkey && message.WParam.ToInt32() == QuickAskHotkeyId) {
            // Ctrl+Shift+E: summon, capture the window that was in front, fill the first chip. The page stops at the frame; it never sends.
            SummonPanel();
            Post(new Dictionary<string, object> { {"type", "quick-ask"} });
            return;
        }
        base.WndProc(ref message);
    }

    void PostHostReady() {
        Post(new Dictionary<string, object> {
            {"type", "host-ready"}, {"mode", mode}, {"front", Front()},
            {"hotkeys", new Dictionary<string, object> { {"summon", hotkeyRegistered}, {"quickAsk", quickAskRegistered} }}
        });
    }

    // Title, process, id and the process icon of what Sidelook is looking at. Never a pixel of the window itself.
    Dictionary<string, object> Front() {
        string[] front = capture.DescribeForeground();
        return new Dictionary<string, object> { {"title", front[0]}, {"process", front[1]}, {"id", front[2]}, {"icon", capture.DescribeIcon()} };
    }

    protected override void OnResize(EventArgs e) {
        base.OnResize(e);
        // The dock is a rounded square and the panel a rounded rectangle with nothing behind them; the workbench keeps its normal window shape.
        if (dockButton != null && mode == "dock" && Width > 0 && Height > 0) {
            using (var path = SidelookMark.RoundedSquare(new Rectangle(0, 0, Width, Height), Math.Min(Width, Height) * 14f / 64f)) Region = new Region(path);
        } else if (mode == "panel" && Width > 0 && Height > 0) {
            using (var path = SidelookMark.RoundedSquare(new Rectangle(0, 0, Width, Height), 12f)) Region = new Region(path);
        } else if (Region != null) Region = null;
    }

    // Content height from the page, in the panel only. Clamped to the working area; the bottom edge stays where it is and the top edge moves.
    void FitPanel(int wanted) {
        if (mode != "panel" || panelSized || wanted <= 0) return;
        Rectangle area = Screen.FromControl(this).WorkingArea;
        int height = Math.Max(PanelMinHeight, Math.Min(wanted, area.Height - PanelMargin * 2));
        if (height == panelTarget && (panelTimer.Enabled || height == Height)) return;
        panelTarget = height;
        if (!AnimationsEnabled()) { panelTimer.Stop(); ApplyPanelHeight(height); return; }
        panelFrom = Height;
        panelStart = DateTime.UtcNow;
        panelTimer.Start();
    }

    void StepPanel() {
        double t = Math.Min(1, (DateTime.UtcNow - panelStart).TotalMilliseconds / 200.0);
        double eased = 1 - Math.Pow(1 - t, 4);
        ApplyPanelHeight((int)Math.Round(panelFrom + (panelTarget - panelFrom) * eased));
        if (t >= 1) panelTimer.Stop();
    }

    void ApplyPanelHeight(int height) {
        Rectangle area = Screen.FromControl(this).WorkingArea;
        int bottom = Bottom;
        int top = Math.Max(area.Top + PanelMargin, bottom - height);
        SetBounds(Left, top, Width, bottom - top);
    }

    // Windows' own "animate controls and elements" switch, which is what reduced-motion means on this platform.
    static bool AnimationsEnabled() {
        bool enabled = true;
        try { if (!SystemParametersInfo(0x1042, 0, ref enabled, 0)) return true; } catch { return true; }
        return enabled;
    }

    // Summon fades in over 150 ms, dismiss out over 120 ms, opacity only, ease-out. Under Windows' animation switch both are instant.
    void Fade(double from, double to, double ms, Action done) {
        // The desktop shot owns the opacity while it is being taken; the fade waits and starts from wherever the panel is afterwards.
        if (capturingDesktop) { afterCapture = delegate { Fade(Opacity, to, ms, done); }; return; }
        if (!animations) { Opacity = to; if (done != null) done(); return; }
        fadeFrom = from; fadeTo = to; fadeMs = ms; fadeDone = done; fadeStart = DateTime.UtcNow;
        Opacity = from;
        fadeTimer.Start();
    }

    void StepFade() {
        double t = Math.Min(1, (DateTime.UtcNow - fadeStart).TotalMilliseconds / fadeMs);
        double eased = 1 - Math.Pow(1 - t, 3);
        Opacity = fadeFrom + (fadeTo - fadeFrom) * eased;
        if (t < 1) return;
        fadeTimer.Stop();
        Action done = fadeDone; fadeDone = null;
        if (done != null) done();
    }

    void OnPreferenceChanged(object sender, Microsoft.Win32.UserPreferenceChangedEventArgs args) { animations = AnimationsEnabled(); lastCursor = new Point(int.MinValue, int.MinValue); }

    // A locked session has no cursor to follow; the eyes rest and the timer stops until the desktop is back.
    void OnSessionSwitch(object sender, Microsoft.Win32.SessionSwitchEventArgs args) {
        if (args.Reason == Microsoft.Win32.SessionSwitchReason.SessionLock) { eyeTimer.Stop(); SetEyes(new PointF(SidelookMark.EyeTravel, 0)); }
        else if (args.Reason == Microsoft.Win32.SessionSwitchReason.SessionUnlock) eyeTimer.Start();
    }

    // 25 times a second: read the cursor, and only when it moved either turn the dock's eyes or tell the page where it is.
    void TrackEyes() {
        Point cursor = Cursor.Position;
        if (cursor == lastCursor) return;
        lastCursor = cursor;
        if (mode == "dock") {
            SetEyes(SidelookMark.EyeOffset(dockButton.RectangleToScreen(dockButton.ClientRectangle), cursor, !animations));
        } else if (Visible && ready && animations && !Bounds.Contains(cursor)) {
            // Inside the window the page's own mousemove already drives the eyes; posting the screen position too would fight it.
            Point origin = web.PointToScreen(Point.Empty);
            Post(new Dictionary<string, object> { {"type", "cursor"}, {"x", cursor.X}, {"y", cursor.Y}, {"left", origin.X}, {"top", origin.Y} });
        }
    }

    void SetEyes(PointF next) {
        // Redraw only when an eye moves a quarter unit; the dock is 76px so that is under a pixel.
        if (Math.Round(next.X * 4) == Math.Round(eyes.X * 4) && Math.Round(next.Y * 4) == Math.Round(eyes.Y * 4)) return;
        eyes = next;
        dockButton.Invalidate();
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
            object rawMode, rawHeight;
            string requested = message.TryGetValue("mode", out rawMode) ? rawMode as string : null;
            if (requested == "dock" || requested == "panel" || requested == "workbench") {
                if (requested == "dock" && mode != "dock") Fade(Opacity, 0, 120, delegate { SetMode("dock"); Opacity = 1; });
                else SetMode(requested);
            }
            else if (message.TryGetValue("height", out rawHeight) && (rawHeight is int || rawHeight is long || rawHeight is decimal || rawHeight is double)) FitPanel(Convert.ToInt32(rawHeight));
        } else if (type == "capture") {
            object rawRequestId;
            string requestId = message.TryGetValue("requestId", out rawRequestId) ? rawRequestId as string : null;
            if (ValidRequestId(requestId)) BeginCapture(requestId);
        } else if (type == "cancel-capture") {
            object rawRequestId;
            string requestId = message.TryGetValue("requestId", out rawRequestId) ? rawRequestId as string : null;
            if (ValidRequestId(requestId)) CancelCapture(requestId);
        } else if (type == "windows") {
            // The list of open windows for the picker. Titles and process names only; no pixels.
            Post(new Dictionary<string, object> { {"type", "windows"}, {"windows", capture.ListWindows()} });
        } else if (type == "select-target") {
            object rawTarget;
            string requested = message.TryGetValue("target", out rawTarget) ? rawTarget as string : null;
            bool selected = requested != null && requested.Length <= 32 && capture.Select(requested);
            Post(new Dictionary<string, object> { {"type", "target"}, {"ok", selected}, {"front", Front()} });
        } else if (type == "screen-on") {
            // The Screen on lease: a mouse button-up hook and the border, for ten minutes, until the page, the hotkey or shutdown ends it.
            object rawSnapshots;
            followSnapshots = message.TryGetValue("snapshots", out rawSnapshots) && rawSnapshots is bool && (bool)rawSnapshots;
            if (!follow.Start()) { Post(new Dictionary<string, object> { {"type", "screen"}, {"on", false}, {"reason", "unavailable"} }); return; }
            stopHotkeyRegistered = RegisterHotKey(Handle, StopHotkeyId, ModControl | ModShift | ModNoRepeat, VkF12);
            followExpires = DateTime.UtcNow.AddSeconds(LeaseSeconds());
            followTimer.Start();
            Post(new Dictionary<string, object> { {"type", "screen"}, {"on", true}, {"snapshots", followSnapshots}, {"expires", (long)(followExpires - new DateTime(1970, 1, 1)).TotalMilliseconds}, {"hotkey", stopHotkeyRegistered} });
        } else if (type == "screen-off") {
            EndFollow("stopped");
        } else if (type == "speak") {
            object rawText;
            string text = message.TryGetValue("text", out rawText) ? rawText as string : null;
            if (String.IsNullOrWhiteSpace(text) || text.Length > 8000) PostSpeechError("Spoken replies must contain 1 to 8000 characters.");
            else TrySpeak(text);
        } else if (type == "stop-speaking") {
            StopSpeaking();
        } else if (type == "copy") {
            // Write only. The shell never reads the clipboard, so "screen & mic off" stays true.
            object rawText;
            string text = message.TryGetValue("text", out rawText) ? rawText as string : null;
            if (String.IsNullOrEmpty(text) || text.Length > 8000) { PostCopied(false, "Copy needs 1 to 8000 characters."); return; }
            try { Clipboard.SetText(text); PostCopied(true, null); }
            catch (Exception error) { PostCopied(false, "Windows refused the clipboard: " + error.Message); }
        } else if (type == "drag") {
            // The header moves the window (HTCAPTION). An edge named by the page resizes it, and a panel resized by hand keeps that height until the next summon.
            object rawEdge;
            string edge = message.TryGetValue("edge", out rawEdge) ? rawEdge as string : null;
            int hit = edge == "top" ? 12 : edge == "bottom" ? 15 : edge == "left" ? 10 : edge == "right" ? 11 : edge == "top-left" ? 13 : edge == "top-right" ? 14 : edge == "bottom-left" ? 16 : edge == "bottom-right" ? 17 : 2;
            if (hit != 2) { if (mode != "panel") return; panelSized = true; panelTimer.Stop(); }
            ReleaseCapture();
            SendMessage(Handle, 0x00A1, new IntPtr(hit), IntPtr.Zero);
        }
    }

    void EndFollow(string reason) {
        if (!follow.On) return;
        follow.Stop();
        followTimer.Stop();
        if (stopHotkeyRegistered) UnregisterHotKey(Handle, StopHotkeyId);
        stopHotkeyRegistered = false;
        Post(new Dictionary<string, object> { {"type", "screen"}, {"on", false}, {"reason", reason} });
    }

    // Every click under a lease re-pins the window it landed on and names the control, never its value.
    void OnFollowClick(FollowService.Click click) {
        if (!capture.SelectWindow(click.Window)) return;
        var message = new Dictionary<string, object> { {"type", "target"}, {"ok", true}, {"via", "click"}, {"front", Front()} };
        if (click.ElementName != null) message["element"] = new Dictionary<string, object> { {"name", click.ElementName}, {"type", click.ElementType ?? String.Empty} };
        Post(message);
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

    void PostCopied(bool ok, string error) {
        var message = new Dictionary<string, object> { {"type", "copied"}, {"ok", ok} };
        if (error != null) message["error"] = error;
        Post(message);
    }

    async void BeginCapture(string requestId) {
        int generation = ++captureGeneration;
        pendingCaptureId = requestId;
        try {
            CaptureService.CaptureTarget target = capture.PrepareCapture();
            CaptureResult result;
            if (target.Desktop) {
                // The whole desktop without Sidelook in it: the panel goes transparent for the capture and comes straight back.
                // A fade in flight would step the opacity back up mid-shot, and so would a summon, so both wait for the finally.
                capturingDesktop = true;
                fadeTimer.Stop();
                Opacity = 0;
                try { await Task.Delay(180); result = await Task.Run(() => capture.Capture(target)); }
                finally {
                    capturingDesktop = false;
                    Opacity = 1;
                    Action queued = afterCapture; afterCapture = null;
                    if (queued != null) queued();
                }
            } else result = await Task.Run(() => capture.Capture(target));
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
            // No native title bar: the page's header is the drag handle and its edges post the resize. Height follows the content until an edge is dragged.
            FormBorderStyle = FormBorderStyle.None;
            TopMost = true;
            ShowInTaskbar = true;
            MinimumSize = new Size(380, PanelMinHeight);
            ClientSize = new Size(PanelWidth, panelTarget > 0 ? panelTarget : 360);
            dockButton.Visible = false;
            web.Visible = true;
        } else {
            FormBorderStyle = FormBorderStyle.Sizable;
            TopMost = false;
            ShowInTaskbar = true;
            // The studio: the 440px column keeps its pixels on the right and the canvas opens to its left. It opens to fit the monitor, and the page reflows below 1180 and again below 900.
            MinimumSize = new Size(StudioMinWidth, StudioMinHeight);
            ClientSize = StudioSize();
            dockButton.Visible = false;
            web.Visible = true;
        }
        PositionForMode();
        ResumeLayout();
        if (!Visible) Show();
        if (ready) PostHostReady();
    }

    // What the studio opens at: the size the last drag left it, or 85% of the monitor Sidelook lives on. Capped at 1480x900, floored at 760x520, never larger than the working area.
    Size StudioSize() {
        Rectangle area = (anchor.IsEmpty ? Screen.FromControl(this) : Screen.FromPoint(anchor)).WorkingArea;
        Size wanted = studioSize.IsEmpty
            ? new Size(Math.Min(StudioMaxWidth, area.Width * 85 / 100), Math.Min(StudioMaxHeight, area.Height * 85 / 100))
            : studioSize;
        return new Size(Math.Max(StudioMinWidth, Math.Min(wanted.Width, area.Width - PanelMargin * 2)), Math.Max(StudioMinHeight, Math.Min(wanted.Height, area.Height - PanelMargin * 2)));
    }

    void PositionForMode() {
        // The anchor is the bottom-right corner every mode shares; the default is 22px in from the corner of the monitor under the cursor.
        Rectangle area = (anchor.IsEmpty ? Screen.FromPoint(Cursor.Position) : Screen.FromPoint(anchor)).WorkingArea;
        Point corner = anchor.IsEmpty ? new Point(area.Right - PanelMargin, area.Bottom - PanelMargin) : new Point(Math.Max(area.Left + 76, Math.Min(anchor.X, area.Right)), Math.Max(area.Top + 76, Math.Min(anchor.Y, area.Bottom)));
        panelTimer.Stop();
        if (mode != "dock") {
            Size available = new Size(Math.Max(200, area.Width - PanelMargin * 2), Math.Max(200, area.Height - PanelMargin * 2));
            MinimumSize = new Size(Math.Min(MinimumSize.Width, available.Width), Math.Min(MinimumSize.Height, available.Height));
            Size = new Size(Math.Min(Width, available.Width), Math.Min(Height, available.Height));
        }
        // The dock, the panel and the studio share the pinned corner, so opening the studio widens to the left and the column does not move.
        if (mode == "dock") Location = new Point(corner.X - Width, corner.Y - Height);
        else Location = new Point(Math.Max(area.Left, corner.X - Width), Math.Max(area.Top + PanelMargin, corner.Y - Height));
    }

    // The dock's bottom-right corner after a drag, kept for this session and the next.
    void RememberAnchor() {
        if (mode != "dock") return;
        anchor = new Point(Right, Bottom);
        try { File.WriteAllText(anchorFile, json.Serialize(new Dictionary<string, object> { {"right", anchor.X}, {"bottom", anchor.Y} })); } catch { }
    }

    void LoadAnchor() {
        try {
            if (!File.Exists(anchorFile)) return;
            var saved = json.Deserialize<Dictionary<string, object>>(File.ReadAllText(anchorFile));
            object right, bottom;
            if (saved != null && saved.TryGetValue("right", out right) && saved.TryGetValue("bottom", out bottom)) anchor = new Point(Convert.ToInt32(right), Convert.ToInt32(bottom));
        } catch { anchor = Point.Empty; }
    }

    // The size the user dragged the studio to, kept for this session and the next. The panel's height comes from its content and the dock is fixed, so neither remembers one.
    protected override void OnResizeEnd(EventArgs e) {
        base.OnResizeEnd(e);
        if (mode != "workbench" || ClientSize.Width <= 0 || ClientSize.Height <= 0) return;
        studioSize = ClientSize;
        try { File.WriteAllText(studioFile, json.Serialize(new Dictionary<string, object> { {"width", studioSize.Width}, {"height", studioSize.Height} })); } catch { }
    }

    void LoadStudioSize() {
        try {
            if (!File.Exists(studioFile)) return;
            var saved = json.Deserialize<Dictionary<string, object>>(File.ReadAllText(studioFile));
            object width, height;
            if (saved != null && saved.TryGetValue("width", out width) && saved.TryGetValue("height", out height)) studioSize = new Size(Convert.ToInt32(width), Convert.ToInt32(height));
        } catch { studioSize = Size.Empty; }
    }

    protected override void OnMove(EventArgs e) {
        base.OnMove(e);
        // A dock drag moves the window under the cursor; the corner it lands on is the new anchor, saved as it goes.
        if (dockDragging && mode == "dock") RememberAnchor();
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

    // Ten minutes, unless a check shortens the lease so it can watch the expiry without waiting ten minutes.
    static int LeaseSeconds() {
        int seconds;
        string raw = Environment.GetEnvironmentVariable("SIDELOOK_FOLLOW_LEASE_SECONDS");
        return Int32.TryParse(raw, out seconds) && seconds > 0 && seconds <= 600 ? seconds : 600;
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
