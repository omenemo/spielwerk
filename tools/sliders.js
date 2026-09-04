// Shared slider niceties for Spielwerk tools. Classic script, event delegation —
// works on any panel built as  label > input[type=range] + output.
//
//  • double-click a slider  → reset to its default (data-def, set by the tool)
//  • click the value readout → type an exact value, Enter/blur commits, Esc cancels
//
// Both paths re-dispatch "input" on the range, so the tool's own listener does
// the p[key] update, readout refresh, persistence and re-render as usual.
(() => {
  const fire = r => r.dispatchEvent(new Event("input", {bubbles: true}));

  document.addEventListener("dblclick", e => {
    const r = e.target;
    if (r.type === "range" && r.dataset.def !== undefined) { r.value = r.dataset.def; fire(r); }
  });

  document.addEventListener("click", e => {
    const out = e.target;
    if (out.tagName !== "OUTPUT" || out.isContentEditable) return;
    const range = out.closest("label")?.querySelector('input[type=range]');
    if (!range) return;
    e.preventDefault();                     // stop the <label> forwarding focus to the slider
    try { out.contentEditable = "plaintext-only"; } catch { out.contentEditable = "true"; }
    out.focus();
    getSelection().selectAllChildren(out);
    out.addEventListener("blur", () => {
      out.contentEditable = "false";
      const v = parseFloat(out.textContent.replace(",", "."));
      if (isFinite(v)) { range.value = v; fire(range); }   // range clamps to min/max/step
      else out.textContent = range.value;
    }, {once: true});
    out.onkeydown = ev => {
      if (ev.key === "Enter") { ev.preventDefault(); out.blur(); }
      else if (ev.key === "Escape") { out.textContent = range.value; out.blur(); }
    };
  });
})();
