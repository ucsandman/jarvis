using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal sealed class CaptureResult {
    public string Image;
    public string Label;
    public string CapturedAt;
}

// What Jarvis looks at: the window that was in front at summon, or one the user picked from the list, or the whole desktop.
// A pick lasts until the next summon. Nothing is captured until the page asks.
internal sealed class CaptureService {
    const int DwmwaCloaked = 14;
    const int MaxWidth = 1600;
    const int MaxHeight = 1200;
    const int GwlExStyle = -20;
    const long WsExToolWindow = 0x80;
    public const string DesktopId = "desktop";
    public const string DesktopTitle = "Whole desktop";
    static readonly TimeSpan MaxTargetAge = TimeSpan.FromMinutes(5);
    readonly int ownProcessId = Process.GetCurrentProcess().Id;
    readonly object sync = new object();
    IntPtr target;
    int targetProcessId;
    string targetTitle;
    string targetProcessName;
    DateTime targetSeenAt;
    bool picked;
    bool desktop;

    internal sealed class CaptureTarget {
        internal IntPtr Window;
        internal int ProcessId;
        internal string Title;
        internal NativeRect Bounds;
        internal bool Desktop;
    }

    [StructLayout(LayoutKind.Sequential)] internal struct NativeRect { public int Left, Top, Right, Bottom; }
    delegate bool EnumWindowsProc(IntPtr window, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out int processId);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window, System.Text.StringBuilder text, int capacity);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out NativeRect rect);
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr window, IntPtr target, uint flags);
    [DllImport("user32.dll")] static extern bool GetWindowDisplayAffinity(IntPtr window, out uint affinity);
    [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);

    public void RememberForeground() {
        IntPtr window = GetForegroundWindow();
        int processId;
        if (window == IntPtr.Zero || GetWindowThreadProcessId(window, out processId) == 0 || processId == ownProcessId) return;
        string title = WindowTitle(window);
        if (String.IsNullOrWhiteSpace(title) || !IsWindowVisible(window) || IsIconic(window)) return;
        lock (sync) {
            // A window the user picked from the list stays until the next summon; the tracker only fills the default.
            if (picked || desktop) return;
            Remember(window, processId, title);
        }
    }

    void Remember(IntPtr window, int processId, string title) {
        // The timer fires every 250 ms; resolve the process name only when the process changes.
        if (processId != targetProcessId) targetProcessName = ProcessName(processId);
        target = window;
        targetProcessId = processId;
        targetTitle = title;
        targetSeenAt = DateTime.UtcNow;
    }

    // A new summon is a new context: the default is the window that was in front again.
    public void ClearPick() { lock (sync) { picked = false; desktop = false; } }

    // "desktop", or a window id from ListWindows(). Returns false when the id no longer names a capturable window.
    public bool Select(string id) {
        if (id == DesktopId) { lock (sync) { desktop = true; picked = false; } return true; }
        long raw;
        if (!Int64.TryParse(id, out raw)) return false;
        IntPtr window = new IntPtr(raw);
        int processId;
        if (!IsWindow(window) || GetWindowThreadProcessId(window, out processId) == 0 || processId == ownProcessId) return false;
        string title = WindowTitle(window);
        if (String.IsNullOrWhiteSpace(title) || !IsWindowVisible(window) || IsIconic(window)) return false;
        lock (sync) { desktop = false; picked = true; Remember(window, processId, title); }
        return true;
    }

    // Title, process name and id of what Jarvis is looking at, for the label and the starters. Never a pixel, never sent anywhere by the shell.
    public string[] DescribeForeground() {
        lock (sync) {
            if (desktop) return new[] { DesktopTitle, String.Empty, DesktopId };
            if (target == IntPtr.Zero || DateTime.UtcNow - targetSeenAt > MaxTargetAge) return new[] { String.Empty, String.Empty, String.Empty };
            return new[] { targetTitle ?? String.Empty, targetProcessName ?? String.Empty, target.ToInt64().ToString() };
        }
    }

    // Every visible, titled top-level window except Jarvis, tool windows, cloaked and minimized ones. Titles only; no pixels.
    public List<Dictionary<string, object>> ListWindows() {
        var windows = new List<Dictionary<string, object>>();
        var names = new Dictionary<int, string>();
        EnumWindows(delegate(IntPtr window, IntPtr lParam) {
            int processId;
            if (!IsWindowVisible(window) || IsIconic(window) || GetWindowThreadProcessId(window, out processId) == 0 || processId == ownProcessId) return true;
            if (((long)GetWindowLongPtr(window, GwlExStyle) & WsExToolWindow) != 0) return true;
            int cloaked;
            if (DwmGetWindowAttribute(window, DwmwaCloaked, out cloaked, sizeof(int)) == 0 && cloaked != 0) return true;
            string title = WindowTitle(window);
            if (String.IsNullOrWhiteSpace(title) || windows.Count >= 60) return true;
            string name;
            if (!names.TryGetValue(processId, out name)) { name = ProcessName(processId); names[processId] = name; }
            windows.Add(new Dictionary<string, object> { {"id", window.ToInt64().ToString()}, {"title", title.Length > 200 ? title.Substring(0, 200) : title}, {"process", name} });
            return true;
        }, IntPtr.Zero);
        return windows;
    }

    public bool DesktopSelected { get { lock (sync) { return desktop; } } }

    static string ProcessName(int processId) {
        try { using (Process process = Process.GetProcessById(processId)) return process.ProcessName; }
        catch { return String.Empty; }
    }

    public CaptureTarget PrepareCapture() {
        lock (sync) { if (desktop) return new CaptureTarget { Desktop = true, Title = DesktopTitle }; }
        return ValidateTarget();
    }

    public CaptureResult Capture(CaptureTarget snapshot) {
        if (snapshot.Desktop) return CaptureDesktop();
        // The window's own surface at its full size, so a window half off the screen or on another monitor still captures whole.
        int width = snapshot.Bounds.Right - snapshot.Bounds.Left, height = snapshot.Bounds.Bottom - snapshot.Bounds.Top;
        if (width < 2 || height < 2) throw new InvalidOperationException("The selected window has no size to capture.");
        using (Bitmap source = new Bitmap(width, height, PixelFormat.Format24bppRgb)) {
            bool rendered;
            using (Graphics graphics = Graphics.FromImage(source)) {
                IntPtr device = graphics.GetHdc();
                try { rendered = PrintWindow(snapshot.Window, device, 2); }
                finally { graphics.ReleaseHdc(device); }
            }
            if (!rendered || LooksProtected(source)) throw new InvalidOperationException("Windows protected this window or it does not support safe capture.");
            ValidateTarget(snapshot);
            return Result(source, snapshot.Title);
        }
    }

    // Every monitor at once. The shell hides its own panel before calling this, so Jarvis is not in the picture.
    CaptureResult CaptureDesktop() {
        Rectangle bounds = SystemInformation.VirtualScreen;
        if (bounds.Width < 2 || bounds.Height < 2) throw new InvalidOperationException("The desktop has no size to capture.");
        using (Bitmap source = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format24bppRgb)) {
            using (Graphics graphics = Graphics.FromImage(source)) graphics.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bounds.Size, CopyPixelOperation.SourceCopy);
            return Result(source, DesktopTitle);
        }
    }

    static CaptureResult Result(Bitmap source, string label) {
        using (Bitmap bounded = Bound(source)) {
            byte[] encoded = Encode(bounded);
            return new CaptureResult {
                Image = "data:image/jpeg;base64," + Convert.ToBase64String(encoded),
                Label = label,
                CapturedAt = DateTime.UtcNow.ToString("o")
            };
        }
    }

    CaptureTarget ValidateTarget() {
        IntPtr selected;
        int selectedProcessId;
        string selectedTitle;
        DateTime selectedAt;
        lock (sync) { selected = target; selectedProcessId = targetProcessId; selectedTitle = targetTitle; selectedAt = targetSeenAt; }
        if (selected == IntPtr.Zero || DateTime.UtcNow - selectedAt > MaxTargetAge) throw new InvalidOperationException("Choose a window with \"change\", or summon Jarvis from the window you want.");
        int processId;
        if (!IsWindow(selected) || GetWindowThreadProcessId(selected, out processId) == 0 || processId != selectedProcessId || processId == ownProcessId) throw new InvalidOperationException("That window is no longer open. Choose another with \"change\".");
        if (!IsWindowVisible(selected) || IsIconic(selected)) throw new InvalidOperationException("That window is minimized. Restore it, then take the screenshot again.");
        if (!String.Equals(WindowTitle(selected), selectedTitle, StringComparison.Ordinal)) throw new InvalidOperationException("That window changed. Choose it again with \"change\".");
        uint affinity;
        if (GetWindowDisplayAffinity(selected, out affinity) && affinity != 0) throw new InvalidOperationException("Windows protected this window from capture.");
        int cloaked;
        if (DwmGetWindowAttribute(selected, DwmwaCloaked, out cloaked, sizeof(int)) == 0 && cloaked != 0) throw new InvalidOperationException("The selected window is not currently visible.");
        NativeRect bounds;
        if (!GetWindowRect(selected, out bounds)) throw new InvalidOperationException("Jarvis could not read the selected window bounds.");
        return new CaptureTarget { Window = selected, ProcessId = selectedProcessId, Title = selectedTitle, Bounds = bounds };
    }

    void ValidateTarget(CaptureTarget snapshot) {
        int processId;
        NativeRect bounds;
        if (!IsWindow(snapshot.Window) || GetWindowThreadProcessId(snapshot.Window, out processId) == 0 || processId != snapshot.ProcessId
            || !String.Equals(WindowTitle(snapshot.Window), snapshot.Title, StringComparison.Ordinal) || !GetWindowRect(snapshot.Window, out bounds)
            || bounds.Left != snapshot.Bounds.Left || bounds.Top != snapshot.Bounds.Top || bounds.Right != snapshot.Bounds.Right || bounds.Bottom != snapshot.Bounds.Bottom)
            throw new InvalidOperationException("That window changed during capture. Take the screenshot again.");
    }

    static string WindowTitle(IntPtr window) {
        var value = new System.Text.StringBuilder(512);
        GetWindowText(window, value, value.Capacity);
        return value.ToString().Trim();
    }

    static Bitmap Bound(Bitmap source) {
        double scale = Math.Min(1, Math.Min((double)MaxWidth / source.Width, (double)MaxHeight / source.Height));
        int width = Math.Max(1, (int)Math.Round(source.Width * scale));
        int height = Math.Max(1, (int)Math.Round(source.Height * scale));
        var result = new Bitmap(width, height, PixelFormat.Format24bppRgb);
        using (Graphics graphics = Graphics.FromImage(result)) {
            graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            graphics.DrawImage(source, 0, 0, width, height);
        }
        return result;
    }

    static byte[] Encode(Bitmap image) {
        ImageCodecInfo codec = Array.Find(ImageCodecInfo.GetImageEncoders(), item => item.FormatID == ImageFormat.Jpeg.Guid);
        foreach (long quality in new long[] { 82, 68, 52, 40 }) {
            using (MemoryStream stream = new MemoryStream())
            using (EncoderParameters parameters = new EncoderParameters(1)) {
                parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
                image.Save(stream, codec, parameters);
                if (stream.Length <= 3300000) return stream.ToArray();
            }
        }
        throw new InvalidOperationException("The selected frame is too detailed to share safely.");
    }

    static bool LooksProtected(Bitmap image) {
        int dark = 0, samples = 0;
        for (int y = 0; y < image.Height; y += Math.Max(1, image.Height / 24)) {
            for (int x = 0; x < image.Width; x += Math.Max(1, image.Width / 24)) {
                Color color = image.GetPixel(x, y);
                if (color.R < 3 && color.G < 3 && color.B < 3) dark++;
                samples++;
            }
        }
        return samples > 0 && dark >= samples * 99 / 100;
    }
}
