import { useEffect, useMemo, useState } from "react";

type Position = "bottom-right" | "bottom-left" | "top-right" | "top-left";

interface WidgetConfig {
  host: string;
  university: string;
  building: string;
  label: string;
  color: string;
  textColor: string;
  position: Position;
}

const DEFAULT_CONFIG: WidgetConfig = {
  host: typeof window !== "undefined" ? window.location.origin : "",
  university: "",
  building: "",
  label: "🚪 Tahliye",
  color: "#16a34a",
  textColor: "#ffffff",
  position: "bottom-right",
};

export default function WidgetBuilder() {
  const [cfg, setCfg] = useState<WidgetConfig>(DEFAULT_CONFIG);
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(() => {
    const host = cfg.host.trim().replace(/\/+$/, "");
    const attrs: string[] = [`src="${host}/widget.js"`, `data-host="${host}"`];
    if (cfg.university.trim()) attrs.push(`data-university="${cfg.university.trim()}"`);
    if (cfg.building.trim()) attrs.push(`data-building="${cfg.building.trim()}"`);
    if (cfg.label.trim()) attrs.push(`data-label="${cfg.label.trim()}"`);
    if (cfg.color) attrs.push(`data-color="${cfg.color}"`);
    if (cfg.textColor) attrs.push(`data-text-color="${cfg.textColor}"`);
    if (cfg.position) attrs.push(`data-position="${cfg.position}"`);
    return `<script ${attrs.join(" ")}></script>`;
  }, [cfg]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const set = <K extends keyof WidgetConfig>(k: K, v: WidgetConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const previewStyle: React.CSSProperties = {
    position: "absolute",
    padding: "12px 18px",
    border: 0,
    borderRadius: 999,
    background: cfg.color,
    color: cfg.textColor,
    fontWeight: 600,
    fontSize: 13,
    boxShadow: "0 10px 25px rgba(0,0,0,.15)",
    cursor: "pointer",
    ...(cfg.position === "bottom-right" && { right: 16, bottom: 16 }),
    ...(cfg.position === "bottom-left" && { left: 16, bottom: 16 }),
    ...(cfg.position === "top-right" && { right: 16, top: 16 }),
    ...(cfg.position === "top-left" && { left: 16, top: 16 }),
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Widget Oluşturucu</h1>
        <p className="mt-1 text-sm text-gray-400">
          Üniversite web sitenize tek satırda entegre edilebilen tahliye asistanı widget'ı.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Konfigürasyon
          </h2>

          <Field label="Sunucu (Host URL)">
            <input
              type="text"
              value={cfg.host}
              onChange={(e) => set("host", e.target.value)}
              className={inputCls}
              placeholder="https://evac.yourdomain.com"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Üniversite Slug">
              <input
                type="text"
                value={cfg.university}
                onChange={(e) => set("university", e.target.value)}
                className={inputCls}
                placeholder="itu"
              />
            </Field>
            <Field label="Bina (ops.)">
              <input
                type="text"
                value={cfg.building}
                onChange={(e) => set("building", e.target.value)}
                className={inputCls}
                placeholder="main"
              />
            </Field>
          </div>

          <Field label="Buton Metni">
            <input
              type="text"
              value={cfg.label}
              onChange={(e) => set("label", e.target.value)}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Buton Rengi">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={cfg.color}
                  onChange={(e) => set("color", e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-gray-800 bg-gray-950 p-1"
                />
                <input
                  type="text"
                  value={cfg.color}
                  onChange={(e) => set("color", e.target.value)}
                  className={inputCls}
                />
              </div>
            </Field>
            <Field label="Yazı Rengi">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={cfg.textColor}
                  onChange={(e) => set("textColor", e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-gray-800 bg-gray-950 p-1"
                />
                <input
                  type="text"
                  value={cfg.textColor}
                  onChange={(e) => set("textColor", e.target.value)}
                  className={inputCls}
                />
              </div>
            </Field>
          </div>

          <Field label="Konum">
            <select
              value={cfg.position}
              onChange={(e) => set("position", e.target.value as Position)}
              className={inputCls}
            >
              <option value="bottom-right">Sağ alt köşe</option>
              <option value="bottom-left">Sol alt köşe</option>
              <option value="top-right">Sağ üst köşe</option>
              <option value="top-left">Sol üst köşe</option>
            </select>
          </Field>

          <h2 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Entegrasyon Kodu
          </h2>
          <div className="whitespace-pre-wrap break-all rounded-lg border border-gray-800 bg-gray-950 p-4 font-mono text-xs text-gray-200">
            {snippet}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={copy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {copied ? "✓ Kopyalandı" : "📋 Kodu Kopyala"}
            </button>
            <a
              href="/embed-demo.html"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-gray-700"
            >
              Demo Sayfası
            </a>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Canlı Önizleme
          </h2>
          <div className="relative h-80 overflow-hidden rounded-lg border border-gray-800 bg-slate-50">
            <span className="absolute left-3 top-3 rounded bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
              Örnek Sayfa
            </span>
            <button type="button" style={previewStyle}>
              {cfg.label || "🚪 Tahliye"}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Butona tıklayan ziyaretçiye tahliye asistanı tam ekran modal olarak açılır.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-100 " +
  "placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-gray-400">{label}</label>
      {children}
    </div>
  );
}
