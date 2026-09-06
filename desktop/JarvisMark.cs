using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

// The Jarvis mark: a thick mint ring with an offset pupil on a rounded charcoal square.
// Same geometry as public/mark.svg and scripts/build-icon.ps1 (64 grid: ring r18 w6 at 32,32; pupil r6.5 at 36,28).
internal static class JarvisMark {
    public static readonly Color Charcoal = Color.FromArgb(20, 23, 25);
    public static readonly Color Amber = Color.FromArgb(111, 227, 193);
    public static readonly Color AmberHover = Color.FromArgb(142, 236, 207);

    public static GraphicsPath RoundedSquare(Rectangle bounds, float radius) {
        var path = new GraphicsPath();
        float d = radius * 2;
        path.AddArc(bounds.X, bounds.Y, d, d, 180, 90);
        path.AddArc(bounds.Right - d, bounds.Y, d, d, 270, 90);
        path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90);
        path.AddArc(bounds.X, bounds.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    public static void Draw(Graphics graphics, Rectangle bounds, Color accent, bool background) {
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        float unit = Math.Min(bounds.Width, bounds.Height) / 64f;
        if (background) {
            using (GraphicsPath square = RoundedSquare(bounds, 14 * unit))
            using (var fill = new SolidBrush(Charcoal)) graphics.FillPath(fill, square);
        }
        float cx = bounds.X + 32 * unit, cy = bounds.Y + 32 * unit;
        float ring = 18 * unit, stroke = Math.Max(2f, 6 * unit), pupil = 6.5f * unit;
        using (var pen = new Pen(accent, stroke)) graphics.DrawEllipse(pen, cx - ring, cy - ring, ring * 2, ring * 2);
        using (var brush = new SolidBrush(accent)) graphics.FillEllipse(brush, cx + 4 * unit - pupil, cy - 4 * unit - pupil, pupil * 2, pupil * 2);
    }

    // The exe carries jarvis.ico; a drawn 32px fallback keeps the tray from showing the stock Windows icon.
    public static Icon AppIcon() {
        try { return Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        using (var bitmap = new Bitmap(32, 32))
        using (Graphics graphics = Graphics.FromImage(bitmap)) {
            graphics.Clear(Color.Transparent);
            Draw(graphics, new Rectangle(0, 0, 32, 32), Amber, true);
            return Icon.FromHandle(bitmap.GetHicon());
        }
    }
}
