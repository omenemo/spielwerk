// Shared export helper for Spielwerk tools. Classic script → window.saveAs / pickExportDir.
// Chromium: writes into a folder you pick once per session. Others: normal download.
(() => {
  let dir = null;
  const can = !!window.showDirectoryPicker;

  // Returns the dir handle, or throws with a human-readable reason.
  // Cancelling the picker is not an error → resolves to current dir (maybe null).
  async function pickExportDir() {
    if (!can) throw new Error("this browser has no folder picker (Chrome/Edge only)");
    try {
      dir = await showDirectoryPicker({ id: "spielwerk-export", mode: "readwrite" });
    } catch (err) {
      if (err.name === "AbortError") return dir;          // user cancelled
      if (err.name === "SecurityError")
        throw new Error("blocked in this frame — open the tool directly, and over http:// not file://");
      throw err;
    }
    return dir;
  }

  async function saveAs(name, blob) {
    if (can) {
      if (!dir) try { await pickExportDir(); } catch { /* fall back to download */ }
      if (dir) {
        const h = await dir.getFileHandle(name, { create: true });
        const w = await h.createWritable();
        await w.write(blob);
        await w.close();
        return dir.name;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return null;
  }

  Object.assign(window, { saveAs, pickExportDir, exportDirName: () => dir?.name || null });
})();
