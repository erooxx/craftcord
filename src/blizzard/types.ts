export interface ProfessionIndexResponse {
    professions: {
        id: number;
        name: Record<string, string>;
    }[];
}

export interface ProfessionDetailResponse {
    skill_tiers: {
        id: number;
        name: Record<string, string>;
    }[];
}

export interface ProfessionSkillTierResponse {
    id: number;
    name: Record<string, string>;
    categories: {
        name: Record<string, string>;
        recipes: {
            id: number;
            name: Record<string, string>;
        }[];
    }[];
}

export interface MediaResponse {
    assets: {
        key: string;
        value: string;
    }[];
}

export interface RecipeResponse {
    id: number;
    name: Record<string, string>;
    reagents?: {
        reagent: {
            id: number;
            name: Record<string, string>;
        };
        quantity: number;
    }[];
    modified_crafting_slots?: {
        slot_type: {
            id: number;
            name: Record<string, string>;
        };
    }[];
}