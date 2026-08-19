const EXACT_EXCLUDED_NAMES = new Set(["Tracking", "Skinning Details"]);
const EXCLUDED_PREFIXES = ["Appendix", "Recraft", "Section "];

export function isExcludedCategory(categoryNameEn: string): boolean {
    if (EXACT_EXCLUDED_NAMES.has(categoryNameEn)) {
        return true;
    }
    return EXCLUDED_PREFIXES.some(prefix => categoryNameEn.startsWith(prefix));
}
