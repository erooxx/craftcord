export const SUPPORTED_LOCALES = [
    { code: "de", label: "Deutsch" },
    { code: "en", label: "English" },
] as const;

export type Locale = typeof SUPPORTED_LOCALES[number]["code"];
