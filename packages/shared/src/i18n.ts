/**
 * Mini moteur de localisation : tables clé → chaîne avec interpolation
 * « {var} ». Les tables sont fournies par @ttc/content.
 */
export type LocaleTable = Record<string, string>;
export type Locale = 'fr' | 'en';

export function interpolate(template: string, vars?: Record<string, string | number | undefined | null>): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (match, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? match : String(v);
  });
}

export function createTranslator(primary: LocaleTable, fallback?: LocaleTable) {
  return function t(key: string, vars?: Record<string, string | number | undefined | null>): string {
    const tpl = primary[key] ?? fallback?.[key];
    if (tpl === undefined) return key;
    return interpolate(tpl, vars);
  };
}

export type Translator = ReturnType<typeof createTranslator>;

/** Formatage de nombre français (espace fine insécable). */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatSigned(n: number, decimals = 1): string {
  const s = formatNumber(Math.abs(n), decimals);
  if (n > 0) return `+${s}`;
  if (n < 0) return `−${s}`;
  return s;
}
