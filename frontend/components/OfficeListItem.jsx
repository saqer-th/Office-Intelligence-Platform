"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import StatusBadge from "./StatusBadge";

export default function OfficeListItem({
    office,
    isSelected,
    onToggleSelect,
    onFocus,
    isVisited,
}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const backUrl = `${pathname}?${searchParams.toString()}`;

    return (
        <div
            className={`group relative flex items-start gap-4 rounded-xl border p-4 transition-all hover:shadow-sm ${isSelected
                ? "border-primary bg-slate-50/50"
                : "border-slate-100 bg-white hover:border-slate-200"
                }`}
        >
            {/* Selection Checkbox */}
            <div className="pt-1">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(office.id)}
                    className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-ink truncate">
                                {office.name || "Unnamed Office"}
                            </h3>
                            {/* Primary Status: Interest Status if set, otherwise Contact Status */}
                            <StatusBadge
                                status={
                                    (office.interest_status && office.interest_status !== 'New')
                                        ? office.interest_status
                                        : (office.contact_status || 'New')
                                }
                            />
                            {/* Secondary Status: Show secondary tag if it adds value (e.g. Interested but not yet Visited) */}
                            {office.interest_status === 'Interested' && office.contact_status === 'Visited' && (
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                                    Visited
                                </span>
                            )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                            <span>{office.city}</span>
                            <span className="text-slate-300">•</span>
                            <span>{office.district || "No District"}</span>
                            {office.group_name && (
                                <>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-500">
                                        Group: {office.group_name}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-xs font-medium text-slate-900">
                            {office.rating ? `⭐ ${office.rating}` : "No Rating"}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">
                            {office.nearest_office_distance_m
                                ? `${Math.round(office.nearest_office_distance_m)}m away`
                                : "Isolated"}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link
                        href={`/offices/${office.id}?back=${encodeURIComponent(backUrl)}`}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                        View Profile
                    </Link>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onFocus(office);
                        }}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                        Show on Map
                    </button>
                </div>
            </div>
        </div>
    );
}
