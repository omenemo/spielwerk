// Phone bottom sheet: tap the tool title to open/close the control panel.
// Desktop ignores .open entirely — the toggle only has meaning inside
// mobile.css's media query, so no matchMedia check is needed here.
document.querySelector("#panel h1")?.addEventListener("click", e =>
  e.currentTarget.parentElement.classList.toggle("open"));
