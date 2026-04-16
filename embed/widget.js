/*!
 * University Evacuation System — Embed Widget
 * Standalone, dependency-free widget for any HTML page.
 *
 * Usage:
 *   <script src="https://your.domain.com/widget.js"
 *           data-university="itu"
 *           data-building="main"
 *           data-host="https://your.domain.com"
 *           data-color="#16a34a"
 *           data-position="bottom-right"
 *           data-label="🚪 Tahliye"></script>
 */
(function () {
  "use strict";

  if (window.__UE_WIDGET_LOADED__) return;
  window.__UE_WIDGET_LOADED__ = true;

  var currentScript =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();

  var ds = (currentScript && currentScript.dataset) || {};
  var scriptSrc = (currentScript && currentScript.src) || "";
  var origin = "";
  try {
    origin = scriptSrc ? new URL(scriptSrc).origin : "";
  } catch (e) {
    origin = "";
  }

  var CFG = {
    university: ds.university || "",
    building: ds.building || "",
    host: ds.host || origin || window.location.origin,
    color: ds.color || "#16a34a",
    textColor: ds.textColor || "#ffffff",
    position: ds.position || "bottom-right",
    label: ds.label || "🚪 Tahliye",
    zIndex: parseInt(ds.zIndex || "2147483000", 10),
    apiBase: ds.apiBase || ""
  };

  if (!CFG.apiBase) {
    CFG.apiBase = CFG.host.replace(/\/+$/, "") + "/api";
  }

  // ── Styles ──
  var STYLE = [
    ".ue-widget-btn{position:fixed;display:flex;align-items:center;gap:8px;",
    "padding:14px 20px;border:0;border-radius:999px;cursor:pointer;",
    "font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;",
    "box-shadow:0 10px 25px rgba(0,0,0,.25),0 2px 6px rgba(0,0,0,.15);",
    "transition:transform .15s ease,box-shadow .15s ease;z-index:" + CFG.zIndex + ";}",
    ".ue-widget-btn:hover{transform:translateY(-2px);",
    "box-shadow:0 14px 30px rgba(0,0,0,.3),0 4px 10px rgba(0,0,0,.2);}",
    ".ue-widget-btn:active{transform:translateY(0);}",
    ".ue-widget-btn .ue-pulse{width:8px;height:8px;border-radius:50%;",
    "background:#fff;animation:ue-pulse 1.4s infinite;}",
    "@keyframes ue-pulse{0%{opacity:1;transform:scale(1)}50%{opacity:.4;",
    "transform:scale(1.6)}100%{opacity:1;transform:scale(1)}}",
    ".ue-widget-br{right:24px;bottom:24px;}",
    ".ue-widget-bl{left:24px;bottom:24px;}",
    ".ue-widget-tr{right:24px;top:24px;}",
    ".ue-widget-tl{left:24px;top:24px;}",
    ".ue-widget-overlay{position:fixed;inset:0;background:rgba(2,6,23,.8);",
    "backdrop-filter:blur(4px);z-index:" + (CFG.zIndex + 1) + ";",
    "opacity:0;transition:opacity .2s ease;}",
    ".ue-widget-overlay.open{opacity:1;}",
    ".ue-widget-modal{position:fixed;inset:0;display:flex;flex-direction:column;",
    "background:#020617;z-index:" + (CFG.zIndex + 2) + ";opacity:0;",
    "transform:scale(.98);transition:opacity .2s ease,transform .2s ease;}",
    ".ue-widget-modal.open{opacity:1;transform:scale(1);}",
    ".ue-widget-bar{display:flex;align-items:center;justify-content:space-between;",
    "padding:12px 20px;background:#0f172a;border-bottom:1px solid #1e293b;",
    "color:#e2e8f0;font:600 13px/1 system-ui,sans-serif;}",
    ".ue-widget-bar .ue-title{display:flex;align-items:center;gap:10px;}",
    ".ue-widget-close{background:transparent;border:0;color:#94a3b8;",
    "font-size:24px;line-height:1;cursor:pointer;padding:6px 10px;",
    "border-radius:6px;transition:background .15s,color .15s;}",
    ".ue-widget-close:hover{background:#1e293b;color:#fff;}",
    ".ue-widget-frame{flex:1;width:100%;border:0;background:#020617;}",
    "@media (max-width:640px){.ue-widget-btn{padding:12px 16px;font-size:13px;}}"
  ].join("");

  function injectStyles() {
    if (document.getElementById("ue-widget-styles")) return;
    var s = document.createElement("style");
    s.id = "ue-widget-styles";
    s.appendChild(document.createTextNode(STYLE));
    document.head.appendChild(s);
  }

  function posClass(p) {
    switch (p) {
      case "bottom-left": return "ue-widget-bl";
      case "top-right": return "ue-widget-tr";
      case "top-left": return "ue-widget-tl";
      default: return "ue-widget-br";
    }
  }

  function buildIframeUrl() {
    var u = CFG.host.replace(/\/+$/, "") + "/?embed=1";
    if (CFG.university) u += "&university=" + encodeURIComponent(CFG.university);
    if (CFG.building) u += "&building=" + encodeURIComponent(CFG.building);
    return u;
  }

  var state = { open: false, btn: null, overlay: null, modal: null, frame: null };

  function openModal() {
    if (state.open) return;
    state.open = true;

    var overlay = document.createElement("div");
    overlay.className = "ue-widget-overlay";

    var modal = document.createElement("div");
    modal.className = "ue-widget-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Tahliye Asistanı");

    var bar = document.createElement("div");
    bar.className = "ue-widget-bar";
    bar.innerHTML =
      '<div class="ue-title"><span style="display:inline-block;width:10px;height:10px;' +
      'border-radius:50%;background:' + CFG.color + ';box-shadow:0 0 8px ' + CFG.color + '"></span>' +
      '<span>Acil Durum Tahliye Asistanı</span></div>';

    var close = document.createElement("button");
    close.className = "ue-widget-close";
    close.setAttribute("aria-label", "Kapat");
    close.innerHTML = "&times;";
    close.onclick = closeModal;
    bar.appendChild(close);

    var frame = document.createElement("iframe");
    frame.className = "ue-widget-frame";
    frame.setAttribute("allow", "geolocation; fullscreen");
    frame.setAttribute("allowfullscreen", "true");
    frame.setAttribute("title", "Evacuation View");
    frame.src = buildIframeUrl();

    modal.appendChild(bar);
    modal.appendChild(frame);

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    requestAnimationFrame(function () {
      overlay.classList.add("open");
      modal.classList.add("open");
    });

    state.overlay = overlay;
    state.modal = modal;
    state.frame = frame;

    document.addEventListener("keydown", onKey);
  }

  function closeModal() {
    if (!state.open) return;
    state.open = false;
    if (state.overlay) state.overlay.classList.remove("open");
    if (state.modal) state.modal.classList.remove("open");
    var overlay = state.overlay;
    var modal = state.modal;
    setTimeout(function () {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
      state.overlay = state.modal = state.frame = null;
    }, 200);
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (e.key === "Escape") closeModal();
  }

  function mountButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ue-widget-btn " + posClass(CFG.position);
    btn.style.background = CFG.color;
    btn.style.color = CFG.textColor;
    btn.setAttribute("aria-label", "Tahliye asistanını aç");
    btn.innerHTML = '<span class="ue-pulse"></span><span>' + escapeHtml(CFG.label) + '</span>';
    btn.onclick = openModal;
    document.body.appendChild(btn);
    state.btn = btn;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  // ── Parent <-> iframe messaging ──
  function onMessage(ev) {
    if (!state.frame || ev.source !== state.frame.contentWindow) return;
    var data = ev.data || {};
    if (!data || typeof data !== "object" || data.source !== "ue-evacuation") return;

    switch (data.type) {
      case "ready":
        postToFrame({ type: "config", config: CFG });
        break;
      case "request-geolocation":
        requestGeolocation();
        break;
      case "close":
        closeModal();
        break;
      case "emergency":
        dispatchEmergency(data.payload || {});
        break;
    }
  }

  function postToFrame(msg) {
    if (!state.frame || !state.frame.contentWindow) return;
    msg.source = "ue-embed-parent";
    state.frame.contentWindow.postMessage(msg, "*");
  }

  function requestGeolocation() {
    if (!("geolocation" in navigator)) {
      postToFrame({ type: "geolocation-error", error: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        postToFrame({
          type: "geolocation",
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          }
        });
      },
      function (err) {
        postToFrame({ type: "geolocation-error", error: err.message, code: err.code });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  function dispatchEmergency(payload) {
    try {
      var evt = new CustomEvent("ue:emergency", { detail: payload });
      window.dispatchEvent(evt);
    } catch (e) {
      // ignore
    }
  }

  // ── Public API ──
  window.UEWidget = {
    open: openModal,
    close: closeModal,
    config: function () {
      return Object.assign({}, CFG);
    }
  };

  function boot() {
    injectStyles();
    mountButton();
    window.addEventListener("message", onMessage);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
