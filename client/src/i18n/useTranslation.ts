import { useCallback, useEffect, useState } from "react";
import tr from "./tr.json";
import en from "./en.json";

export type Locale = "tr" | "en";

type Dict = Record<string, unknown>;

const dicts: Record<Locale, Dict> = { tr, en };

const STORAGE_KEY = "evac.locale";
const DEFAULT_LOCALE: Locale = "tr";

/**
 * Resolve a dotted key like "exit.distance" against a nested JSON dict.
 * Falls back to the key itself if the path is missing — never throws, so
 * a typo shows up in the UI instead of crashing the page.
 */
function resolve(dict: Dict, key: string): string {
  const parts = key.split(".");
  let current: unknown = dict;
  for (const p of parts) {
    if (typeof current !== "object" || current === null) return key;
    current = (current as Record<string, unknown>)[p];
  }
  return typeof current === "string" ? current : key;
}

/** Replace {{placeholders}} in a template with values from the params object. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{{${name}}}`
  );
}

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "tr" || stored === "en") return stored;
  const nav = window.navigator.language?.slice(0, 2).toLowerCase();
  if (nav === "en") return "en";
  return DEFAULT_LOCALE;
}

// In-module state so all hook instances re-render together on locale change.
let currentLocale: Locale = detectInitialLocale();
const listeners = new Set<(l: Locale) => void>();

export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, locale);
  }
  listeners.forEach((fn) => fn(locale));
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Minimal i18n hook. Returns { t, locale, setLocale }.
 *
 * `t("exit.distance")` resolves a dotted key; missing keys fall back to the
 * key itself. Supports {{placeholder}} interpolation via the second arg.
 */
export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(currentLocale);

  useEffect(() => {
    const fn = (l: Locale) => setLocaleState(l);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const raw = resolve(dicts[locale], key);
      return interpolate(raw, params);
    },
    [locale]
  );

  return { t, locale, setLocale };
}
