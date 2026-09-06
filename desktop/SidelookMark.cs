using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

// The Sidelook mark: one node of the Practical Systems mark, a white hexagon with two navy eyes, on a navy rounded square
// where a background is needed. Same geometry as public/mark.svg and scripts/build-icon.ps1, same eye function as public/eyes.js.
// scripts/verify-mark.ps1 checks all of them agree. 64 grid: square radius 14; hexagon 32,10 51,21 51,43 32,54 13,43 13,21;
// eyes r 3.6 at home (26,32) (38,32), travel 5, reach 120; static renders look right, (31,32) (43,32).
internal static class SidelookMark {
    public static readonly Color Navy = Color.FromArgb(23, 29, 45);
    public static readonly Color Hub = Color.White;
    public const float EyeTravel = 5f, EyeReach = 120f, EyeRadius = 3.6f, EyeWide = 0.4f;
    static readonly PointF[] Home = { new PointF(26, 32), new PointF(38, 32) };
    static readonly PointF[] Hexagon = { new PointF(32, 10), new PointF(51, 21), new PointF(51, 43), new PointF(32, 54), new PointF(13, 43), new PointF(13, 21) };

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

    // Where the eyes look, in grid units, for a mark drawn in bounds (screen coordinates) and a cursor in the same space.
    // Null cursor or reduced motion: the static sidelong look. Inside the mark: centred. Otherwise toward the cursor, fully turned at EyeReach units.
    public static PointF EyeOffset(Rectangle bounds, Point? cursor, bool reducedMotion) {
        if (reducedMotion || cursor == null) return new PointF(EyeTravel, 0);
        Point c = cursor.Value;
        if (bounds.Contains(c)) return PointF.Empty;
        float unit = Math.Min(bounds.Width, bounds.Height) / 64f;
        double vx = c.X - (bounds.X + 32 * unit), vy = c.Y - (bounds.Y + 32 * unit);
        double d = Math.Sqrt(vx * vx + vy * vy);
        if (d == 0) return PointF.Empty;
        double o = Math.Min(d / (EyeReach * unit), 1) * EyeTravel;
        return new PointF((float)(o * vx / d), (float)(o * vy / d));
    }

    public static void Draw(Graphics graphics, Rectangle bounds, PointF eyes, bool background, bool wide) {
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        float unit = Math.Min(bounds.Width, bounds.Height) / 64f;
        if (background) {
            using (GraphicsPath square = RoundedSquare(bounds, 14 * unit))
            using (var fill = new SolidBrush(Navy)) graphics.FillPath(fill, square);
        }
        var hex = new PointF[Hexagon.Length];
        for (int i = 0; i < hex.Length; i++) hex[i] = new PointF(bounds.X + Hexagon[i].X * unit, bounds.Y + Hexagon[i].Y * unit);
        using (var hub = new SolidBrush(Hub)) graphics.FillPolygon(hub, hex);
        float r = (EyeRadius + (wide ? EyeWide : 0)) * unit;
        using (var ink = new SolidBrush(Navy))
            foreach (PointF home in Home)
                graphics.FillEllipse(ink, bounds.X + (home.X + eyes.X) * unit - r, bounds.Y + (home.Y + eyes.Y) * unit - r, r * 2, r * 2);
    }

    // The exe carries sidelook.ico; a drawn 32px fallback keeps the tray from showing the stock Windows icon.
    public static Icon AppIcon() {
        try { return Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        using (var bitmap = new Bitmap(32, 32))
        using (Graphics graphics = Graphics.FromImage(bitmap)) {
            graphics.Clear(Color.Transparent);
            Draw(graphics, new Rectangle(0, 0, 32, 32), new PointF(EyeTravel, 0), true, false);
            return Icon.FromHandle(bitmap.GetHicon());
        }
    }
}
