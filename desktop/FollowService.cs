using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Automation;
using System.Windows.Forms;

// The Screen on lease, shell side: which window the user clicked, and a border that says so.
// Mouse button-up events only, only while a lease is on. No keyboard hook, no values, no pixels of its own.
internal sealed class FollowService : IDisposable {
    const int WhMouseLl = 14;
    const int WmLButtonUp = 0x0202;
    const int WmRButtonUp = 0x0205;
    const uint GaRoot = 2;
    const int GwlExStyle = -20;
    const long WsExToolWindow = 0x80;
    const int DwmwaCloaked = 14;
    public sealed class Click { public IntPtr Window; public string ElementName; public string ElementType; }

    delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)] struct MsLlHookStruct { public Point Point; public uint MouseData, Flags, Time; public IntPtr Extra; }
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, HookProc callback, IntPtr module, uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out int processId);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out CaptureService.NativeRect rect);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] static extern bool GetWindowDisplayAffinity(IntPtr window, out uint affinity);
    [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);

    readonly int ownProcessId = Process.GetCurrentProcess().Id;
    readonly Border border = new Border();
    HookProc callback;   // kept in a field so the GC never collects the delegate behind the hook
    IntPtr hook;
    IntPtr followed;
    public event Action<Click> Clicked;
    public bool On { get { return hook != IntPtr.Zero; } }

    public bool Start() {
        if (On) return true;
        callback = OnMouse;
        hook = SetWindowsHookEx(WhMouseLl, callback, GetModuleHandle(null), 0);
        return On;
    }
    public void Stop() {
        if (hook != IntPtr.Zero) UnhookWindowsHookEx(hook);
        hook = IntPtr.Zero; callback = null; followed = IntPtr.Zero;
        border.Hide();
    }
    public void Dispose() { Stop(); border.Dispose(); }

    IntPtr OnMouse(int code, IntPtr wParam, IntPtr lParam) {
        int message = wParam.ToInt32();
        if (code == 0 && (message == WmLButtonUp || message == WmRButtonUp)) {
            Point point = ((MsLlHookStruct)Marshal.PtrToStructure(lParam, typeof(MsLlHookStruct))).Point;
            // Resolve off the hook thread: a hook callback that takes long gets the hook removed by Windows.
            border.BeginInvoke(new Action(delegate { Resolve(point); }));
        }
        return CallNextHookEx(hook, code, wParam, lParam);
    }

    void Resolve(Point point) {
        IntPtr root = GetAncestor(WindowFromPoint(point), GaRoot);
        int processId;
        if (root == IntPtr.Zero || GetWindowThreadProcessId(root, out processId) == 0 || processId == ownProcessId) return;
        if (((long)GetWindowLongPtr(root, GwlExStyle) & WsExToolWindow) != 0) return;
        int cloaked; uint affinity;
        if (DwmGetWindowAttribute(root, DwmwaCloaked, out cloaked, sizeof(int)) == 0 && cloaked != 0) return;
        if (GetWindowDisplayAffinity(root, out affinity) && affinity != 0) return;
        var click = new Click { Window = root };
        try {
            AutomationElement element = AutomationElement.FromPoint(new System.Windows.Point(point.X, point.Y));
            if (element != null && !element.Current.IsPassword) {
                string name = element.Current.Name ?? String.Empty;
                click.ElementName = name.Length > 100 ? name.Substring(0, 100) : name;
                click.ElementType = element.Current.ControlType.ProgrammaticName.Replace("ControlType.", "").ToLowerInvariant();
            }
        } catch { }
        followed = root;
        Action<Click> handler = Clicked;
        if (handler != null) handler(click);
        Track();
    }

    // Called on the shell's 250 ms tick too, so the border follows a window the user moves or resizes.
    public void Track() {
        if (!On || followed == IntPtr.Zero || !IsWindow(followed) || IsIconic(followed)) { border.Hide(); return; }
        CaptureService.NativeRect rect;
        if (!GetWindowRect(followed, out rect)) { border.Hide(); return; }
        border.Outline(Rectangle.FromLTRB(rect.Left, rect.Top, rect.Right, rect.Bottom));
    }

    // A 2px amber frame: layered, topmost, click-through, never activated, never in the taskbar or Alt+Tab.
    sealed class Border : Form {
        const int WsExLayered = 0x80000, WsExTransparent = 0x20, WsExToolWindowStyle = 0x80, WsExNoActivate = 0x8000000;
        public Border() {
            FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; TopMost = true; StartPosition = FormStartPosition.Manual;
            BackColor = Color.Magenta; TransparencyKey = Color.Magenta; Size = new Size(1, 1); Location = new Point(-10, -10);
            CreateHandle();   // so BeginInvoke works before the first Show
        }
        protected override CreateParams CreateParams { get { CreateParams p = base.CreateParams; p.ExStyle |= WsExLayered | WsExTransparent | WsExToolWindowStyle | WsExNoActivate; return p; } }
        protected override bool ShowWithoutActivation { get { return true; } }
        public void Outline(Rectangle rect) {
            if (rect.Width < 4 || rect.Height < 4) { Hide(); return; }
            Bounds = rect;
            Region outer = new Region(new Rectangle(0, 0, rect.Width, rect.Height));
            outer.Exclude(new Rectangle(2, 2, rect.Width - 4, rect.Height - 4));
            Region = outer;
            BackColor = JarvisMark.Amber;
            if (!Visible) Show();
        }
    }
}
