using System;
using System.IO;
using System.Reflection;

internal static class EmbeddedDependencyLoader {
    public static void Install() {
        AppDomain.CurrentDomain.AssemblyResolve += Resolve;
    }

    static Assembly Resolve(object sender, ResolveEventArgs args) {
        string name = new AssemblyName(args.Name).Name;
        if (name != "Microsoft.Web.WebView2.Core" && name != "Microsoft.Web.WebView2.WinForms") return null;
        using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name + ".dll")) {
            if (stream == null) return null;
            byte[] bytes = new byte[stream.Length];
            int offset = 0;
            while (offset < bytes.Length) {
                int read = stream.Read(bytes, offset, bytes.Length - offset);
                if (read == 0) throw new EndOfStreamException("Embedded WebView2 dependency is incomplete.");
                offset += read;
            }
            return Assembly.Load(bytes);
        }
    }
}
