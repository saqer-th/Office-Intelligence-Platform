import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Hook to manage filter state in URL search params.
 * 
 * @returns {object} { filters, setFilter, setFilters, resetFilters }
 */
export function useUrlFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Parse current filters from URL
    const filters = useMemo(() => {
        const params = {};
        searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    }, [searchParams]);

    // Update a single filter
    const setFilter = useCallback((key, value) => {
        const params = new URLSearchParams(searchParams);
        if (value === null || value === undefined || value === "") {
            params.delete(key);
        } else {
            params.set(key, value);
        }

        // Use replace to avoid cluttering history stack for every keystroke/click, 
        // unless we decide we want push. For filters, replace is usually better 
        // to keep "Back" functional for "Back to Dashboard" rather than "Back to previous filter letter".
        // However, for significant changes like "City Changed", Push might be better. 
        // Let's default to replace for smoothness, or maybe we want push?
        // The "Context Amnesia" requirement implies "Back" should go to previous state.
        // So `push` is actually safer for "Back button works".
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, pathname, router]);

    // Update multiple filters
    const setFilters = useCallback((updates) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined || value === "") {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        });
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, pathname, router]);

    const resetFilters = useCallback(() => {
        router.push(pathname, { scroll: false });
    }, [pathname, router]);

    return { filters, setFilter, setFilters, resetFilters };
}
