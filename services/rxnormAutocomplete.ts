type RxNormAutocompleteConfig = {
    inputSelector?: string;
    datalistSelector?: string;
    debounceMs?: number;
    minChars?: number;
    onResults?: (names: string[]) => void;
};

const RXNORM_ENDPOINT = 'https://rxnav.nlm.nih.gov/REST/drugs.json?name=';

const getMedicationNames = (payload: unknown): string[] => {
    if (!payload || typeof payload !== 'object') {
        return [];
    }

    const conceptGroups = (payload as {
        drugGroup?: { conceptGroup?: { conceptProperties?: { name?: string }[] }[] };
    }).drugGroup?.conceptGroup;

    if (!Array.isArray(conceptGroups)) {
        return [];
    }

    const names = conceptGroups.flatMap((group) =>
        Array.isArray(group.conceptProperties)
            ? group.conceptProperties
                .map((item) => item?.name)
                .filter((value): value is string => Boolean(value))
            : []
    );

    return Array.from(new Set(names));
};

export const initializeRxNormAutocomplete = ({
    inputSelector = 'input[list="meds"]',
    datalistSelector = '#meds',
    debounceMs = 300,
    minChars = 2,
    onResults,
}: RxNormAutocompleteConfig = {}) => {
    const input = document.querySelector<HTMLInputElement>(inputSelector);
    const datalist = document.querySelector<HTMLDataListElement>(datalistSelector);

    if (!input || !datalist) {
        return () => undefined;
    }

    let debounceTimer: number | undefined;

    const renderOptions = (names: string[]) => {
        datalist.innerHTML = '';

        names.forEach((name) => {
            const option = document.createElement('option');
            option.value = name;
            datalist.appendChild(option);
        });

        onResults?.(names);
    };

    const handleInput = () => {
        const query = input.value.trim();

        if (debounceTimer) {
            window.clearTimeout(debounceTimer);
        }

        debounceTimer = window.setTimeout(async () => {
            if (query.length < minChars) {
                renderOptions([]);
                return;
            }

            try {
                const response = await fetch(`${RXNORM_ENDPOINT}${encodeURIComponent(query)}`);
                if (!response.ok) {
                    throw new Error(`RxNorm request failed with status ${response.status}`);
                }

                const payload = await response.json();
                const names = getMedicationNames(payload);
                renderOptions(names);
            } catch (error) {
                console.error('RxNorm autocomplete failed:', error);
                renderOptions([]);
            }
        }, debounceMs);
    };

    input.addEventListener('input', handleInput);

    return () => {
        if (debounceTimer) {
            window.clearTimeout(debounceTimer);
        }

        input.removeEventListener('input', handleInput);
    };
};

