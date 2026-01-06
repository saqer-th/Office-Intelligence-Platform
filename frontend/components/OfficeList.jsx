import OfficeListItem from "./OfficeListItem";

export default function OfficeList({
    offices,
    selectedIds,
    onToggleSelect,
    onFocus,
    loading,
}) {
    if (loading) {
        return (
            <div className="py-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-4 text-sm text-muted">Loading offices...</p>
            </div>
        );
    }

    if (offices.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
                <div className="text-4xl">🏢</div>
                <h3 className="mt-4 text-sm font-semibold text-ink">No offices found</h3>
                <p className="mt-1 text-sm text-muted">
                    Try adjusting your filters or search query.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {offices.map((office) => (
                <OfficeListItem
                    key={office.id}
                    office={office}
                    isSelected={selectedIds instanceof Set ? selectedIds.has(office.id) : selectedIds.includes(office.id)}
                    onToggleSelect={onToggleSelect}
                    onFocus={onFocus}
                />
            ))}
        </div>
    );
}
