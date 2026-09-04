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

  // ---------- svg → pixels ----------
  const svgBlob = svg => new Blob([svg], { type: "image/svg+xml" });

  // Draw an SVG string at w×h and hand back its RGBA bytes (ImageData.data).
  // Note: <animate>/SMIL does not run here — you get the static first frame.
  async function rasterise(svg, w, h) {
    const img = new Image();
    const url = URL.createObjectURL(svgBlob(svg));
    img.src = url;
    try {
      await img.decode();
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h).data;
    } finally {
      URL.revokeObjectURL(url);            // also on a failed decode
    }
  }

  async function svgToPNG(svg, w, h) {
    const px = await rasterise(svg, w, h);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").putImageData(new ImageData(px, w, h), 0, 0);
    return new Promise(r => c.toBlob(r, "image/png"));
  }

  // ---------- export bar ----------
  // Wires <select id=fmt> + <a id=dl> + <a id=dldir> (all optional).
  // handlers: { SVG: async setLabel => {…}, … } — keys become the dropdown options,
  // setLabel lets a slow export report progress on the button.
  function wireExport(handlers) {
    const sel = document.getElementById("fmt"), btn = document.getElementById("dl");
    const dirBtn = document.getElementById("dldir");
    if (sel && btn) {
      sel.innerHTML = Object.keys(handlers).map(k => `<option>${k}</option>`).join("");
      const label = btn.textContent;
      const setLabel = s => { btn.textContent = s; };
      btn.addEventListener("click", async () => {
        btn.style.pointerEvents = "none";
        try {
          await handlers[sel.value](setLabel);
        } catch (err) {
          console.warn("export:", err);
          btn.textContent = "\u2717 export failed";
          await new Promise(r => setTimeout(r, 2000));
        }
        btn.textContent = label;
        btn.style.pointerEvents = "";
      });
    }
    dirBtn?.addEventListener("click", async () => {
      try {
        await pickExportDir();
        dirBtn.textContent = "\uD83D\uDCC1 " + (dir?.name || "\u2026");
        dirBtn.title = dir ? `exporting to ${dir.name}` : "choose export folder";
      } catch (err) {
        dirBtn.textContent = "\uD83D\uDCC1 \u2717";
        dirBtn.title = err.message;      // hover the button to see why
        console.warn("export folder:", err);
      }
    });
  }

  // ---------- animated GIF ----------
  // Frames are RGBA Uint8ClampedArrays (ImageData.data), all the same size.
  // One global palette: exact top-256 colours, everything else to nearest.
  function quantize(frames) {
    const hist = new Map();
    for (const px of frames)
      for (let i = 0; i < px.length; i += 4) {
        const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
        hist.set(k, (hist.get(k) || 0) + 1);
      }
    const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256).map(e => e[0]);
    const near = new Map(top.map((c, i) => [c, i]));
    const lookup = k => {                       // nearest palette entry, memoised
      let hit = near.get(k);
      if (hit !== undefined) return hit;
      const r = k >> 16, g = (k >> 8) & 255, b = k & 255;
      let best = 0, bd = Infinity;
      for (let i = 0; i < top.length; i++) {
        const c = top[i], dr = (c >> 16) - r, dg = ((c >> 8) & 255) - g, db = (c & 255) - b;
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = i; }
      }
      near.set(k, best);
      return best;
    };
    const indexed = frames.map(px => {
      const out = new Uint8Array(px.length / 4);
      for (let i = 0, j = 0; i < px.length; i += 4, j++)
        out[j] = lookup((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
      return out;
    });
    return { palette: top, indexed };
  }

  // GIF LZW: variable code size, LSB-first packing, clear on a full 12-bit dict
  function lzw(minCodeSize, px) {
    const clear = 1 << minCodeSize, eoi = clear + 1;
    const out = [];
    let codeSize = minCodeSize + 1, next = eoi + 1, dict = new Map();
    let cur = 0, bits = 0;
    const emit = code => {
      cur |= code << bits; bits += codeSize;
      while (bits >= 8) { out.push(cur & 255); cur >>= 8; bits -= 8; }
    };
    emit(clear);
    let prefix = px[0];
    for (let i = 1; i < px.length; i++) {
      const k = px[i], key = (prefix << 8) | k;
      const hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix);
      dict.set(key, next++);
      if (next > (1 << codeSize)) {
        if (codeSize < 12) codeSize++;
        else { emit(clear); dict = new Map(); next = eoi + 1; codeSize = minCodeSize + 1; }
      }
      prefix = k;
    }
    emit(prefix);
    emit(eoi);
    if (bits > 0) out.push(cur & 255);
    return out;
  }

  // delay is in centiseconds (GIF's unit). loop 0 = forever.
  function encodeGIF(frames, { width, height, delay = 5, loop = 0 }) {
    const { palette, indexed } = quantize(frames);
    let depth = 1;                               // table size is a power of two, >= 2
    while ((1 << depth) < palette.length) depth++;
    const b = [];
    const u16 = n => b.push(n & 255, (n >> 8) & 255);
    const str = s => { for (const c of s) b.push(c.charCodeAt(0)); };

    str("GIF89a");
    u16(width); u16(height);
    b.push(0x80 | 0x70 | (depth - 1), 0, 0);     // global table, 8-bit colour res
    for (let i = 0; i < (1 << depth); i++) {
      const c = palette[i] || 0;
      b.push(c >> 16, (c >> 8) & 255, c & 255);
    }
    b.push(0x21, 0xFF, 0x0B);                    // NETSCAPE2.0 loop extension
    str("NETSCAPE2.0");
    b.push(0x03, 0x01); u16(loop); b.push(0);

    const minCodeSize = Math.max(2, depth);      // LZW min code size is at least 2
    for (const px of indexed) {
      b.push(0x21, 0xF9, 0x04, 0x00); u16(delay); b.push(0, 0);   // graphic control
      b.push(0x2C); u16(0); u16(0); u16(width); u16(height); b.push(0);
      b.push(minCodeSize);
      const data = lzw(minCodeSize, px);
      for (let i = 0; i < data.length; i += 255) {
        const chunk = data.slice(i, i + 255);
        b.push(chunk.length, ...chunk);
      }
      b.push(0);
    }
    b.push(0x3B);
    return new Blob([new Uint8Array(b)], { type: "image/gif" });
  }

  Object.assign(window, {
    saveAs, pickExportDir, encodeGIF, wireExport, rasterise, svgToPNG, svgBlob,
    exportDirName: () => dir?.name || null
  });
})();
