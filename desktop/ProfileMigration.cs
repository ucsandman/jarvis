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
        // The WebView2 folder decides, not the root: lib/claude.mjs makes <root>\tools before the shell ever starts, so the root
        // alone is there on a first run and gating on it would disable the move forever. A new root without a profile in it makes
        // Directory.Move throw, which is intended: the copy below runs instead.
        string profile = Path.Combine(newRoot, "WebView2");
        string legacyProfile = Path.Combine(legacyRoot, "WebView2");
        if (Decide(Directory.Exists(profile), Directory.Exists(legacyProfile)) != Plan.Move) return;
        try { Directory.Move(legacyRoot, newRoot); return; }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        // A half-copied profile is worse than none and would never be retried, so the tree lands beside the real name and is
        // renamed into place only once all of it arrived; anything else leaves nothing behind and the next start tries again.
        string incoming = profile + ".incoming";
        try {
            Directory.CreateDirectory(newRoot);
            Discard(incoming);
            CopyTree(legacyProfile, incoming);
            Directory.Move(incoming, profile);
            string dock = Path.Combine(legacyRoot, "dock.json");
            if (File.Exists(dock)) File.Copy(dock, Path.Combine(newRoot, "dock.json"), true);
        } catch (IOException) { Discard(incoming); /* The app still starts with a fresh profile; nothing in the old folder is deleted. */ }
        catch (UnauthorizedAccessException) { Discard(incoming); }
    }

    static void Discard(string folder) {
        try { if (Directory.Exists(folder)) Directory.Delete(folder, true); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    static void CopyTree(string from, string to) {
        Directory.CreateDirectory(to);
        foreach (string file in Directory.GetFiles(from)) File.Copy(file, Path.Combine(to, Path.GetFileName(file)), true);
        foreach (string dir in Directory.GetDirectories(from)) CopyTree(dir, Path.Combine(to, Path.GetFileName(dir)));
    }
}
