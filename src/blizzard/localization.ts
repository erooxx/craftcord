export interface LocalizedText {
    de: string;
    en: string;
}

export function toLocalizedText(raw: Record<string, string>): LocalizedText {
    return {
        en:raw.en_US,
        de: raw.de_DE
    }
}