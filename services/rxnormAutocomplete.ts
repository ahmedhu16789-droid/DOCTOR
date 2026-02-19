type RxNormAutocompleteConfig = {
    inputSelector?: string;
    debounceMs?: number;
    minChars?: number;
    onResults?: (names: string[]) => void;
};

// ClinicalTables rxterms API — designed for autocomplete, works from 2 chars
// Returns drug names + strength/form data in one call
const CLINICAL_TABLES_ENDPOINT = 'https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?ef=STRENGTHS_AND_FORMS&terms=';

type ClinicalTablesResponse = [
    number,           // total count
    null,             // codes (unused)
    { STRENGTHS_AND_FORMS: string[][] },  // extra fields
    string[]          // display names
];

const parseClinicalTables = (data: ClinicalTablesResponse): { names: string[]; dosageMap: Record<string, string[]> } => {
    const names: string[] = data[3] ?? [];
    const strengthsArr: string[][] = data[2]?.STRENGTHS_AND_FORMS ?? [];
    const dosageMap: Record<string, string[]> = {};
    names.forEach((name, i) => {
        const forms = strengthsArr[i] ?? [];
        // deduplicate forms
        dosageMap[name] = [...new Set(forms)];
    });
    return { names, dosageMap };
};

const getDosageForms = (payload: unknown): string[] => {
    if (!payload || typeof payload !== 'object') return [];
    const conceptGroups = (payload as {
        drugGroup?: { conceptGroup?: { conceptProperties?: { name?: string }[] }[] };
    }).drugGroup?.conceptGroup ?? [];

    const seen = new Set<string>();
    const results: string[] = [];

    conceptGroups.forEach(group => {
        (group.conceptProperties ?? []).forEach(item => {
            if (item?.name) {
                // Extract just the strength part, e.g. "ibuprofen 200 MG Oral Tablet" → "200 MG Oral Tablet"
                const withoutDrug = item.name.replace(/\[.*?\]/g, '').trim(); // drop brand
                if (!seen.has(withoutDrug)) {
                    seen.add(withoutDrug);
                    results.push(withoutDrug);
                }
            }
        });
    });

    return results;
};

/** Fetch dosage/form options for a chosen drug name */
export const fetchDosagesForDrug = async (drugName: string): Promise<string[]> => {
    if (!drugName.trim()) return [];
    try {
        const res = await fetch(`${CLINICAL_TABLES_ENDPOINT}${encodeURIComponent(drugName)}&maxList=1`);
        if (!res.ok) return [];
        const data: ClinicalTablesResponse = await res.json();
        const { dosageMap } = parseClinicalTables(data);
        // Find the best matching key
        const key = Object.keys(dosageMap).find(k => k.toLowerCase() === drugName.toLowerCase())
            ?? Object.keys(dosageMap)[0];
        return dosageMap[key] ?? [];
    } catch {
        return [];
    }
};

export const initializeRxNormAutocomplete = ({
    inputSelector = 'input[list="meds"]',
    debounceMs = 250,
    minChars = 2,
    onResults,
}: RxNormAutocompleteConfig = {}) => {
    const input = document.querySelector<HTMLInputElement>(inputSelector);

    if (!input) {
        return () => undefined;
    }

    let debounceTimer: number | undefined;

    const handleInput = () => {
        const query = input.value.trim();

        if (debounceTimer) window.clearTimeout(debounceTimer);

        debounceTimer = window.setTimeout(async () => {
            if (query.length < minChars) {
                onResults?.([]);
                return;
            }
            try {
                const response = await fetch(`${CLINICAL_TABLES_ENDPOINT}${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error(`ClinicalTables status ${response.status}`);
                const data: ClinicalTablesResponse = await response.json();
                const { names } = parseClinicalTables(data);
                // Only notify React — React owns the <option> DOM nodes, never touch datalist directly
                onResults?.(names);
            } catch (error) {
                console.error('Drug autocomplete failed:', error);
                onResults?.([]);
            }
        }, debounceMs);
    };

    input.addEventListener('input', handleInput);

    return () => {
        if (debounceTimer) window.clearTimeout(debounceTimer);
        input.removeEventListener('input', handleInput);
    };
};


