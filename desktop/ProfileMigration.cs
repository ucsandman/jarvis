using System;
using System.IO;

// 0.16.0 renamed the product, and with it the profile folder under %LOCALAPPDATA%. Saved prototypes live in the WebView2 profile
// inside it, and the dock's position beside it, so the first start moves the whole folder once. Decide is pure and tested by
// scripts/verify-mark.ps1; Apply falls back to copying the two things worth keeping when a file in the old folder is locked.
internal static class ProfileMigration {
    public enum Plan { None, Move }

    public static Plan Decide(bool newExists, bool legacyExists) {
        return !newExists && legacyExists ? Plan.Move : Plan.None;
    }

    public static void Apply(string legacyRoot, string newRoot) {
        if (Decide(Directory.Exists(newRoot), Directory.Exists(legacyRoot)) != Plan.Move) return;
        try { Directory.Move(legacyRoot, newRoot); return; }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        try {
            Directory.CreateDirectory(newRoot);
            string profile = Path.Combine(legacyRoot, "WebView2");
            if (Directory.Exists(profile)) CopyTree(profile, Path.Combine(newRoot, "WebView2"));
            string dock = Path.Combine(legacyRoot, "dock.json");
            if (File.Exists(dock)) File.Copy(dock, Path.Combine(newRoot, "dock.json"), true);
        } catch (IOException) { /* The app still starts with a fresh profile; nothing in the old folder is deleted. */ }
        catch (UnauthorizedAccessException) { }
    }

    static void CopyTree(string from, string to) {
        Directory.CreateDirectory(to);
        foreach (string file in Directory.GetFiles(from)) File.Copy(file, Path.Combine(to, Path.GetFileName(file)), true);
        foreach (string dir in Directory.GetDirectories(from)) CopyTree(dir, Path.Combine(to, Path.GetFileName(dir)));
    }
}
