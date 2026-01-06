import Link from "next/link";
import { useMemo } from "react";

export default function GroupCard({ group }) {
    const isReady = group.status === "ReadyForVisit";

    const statusColor = isReady
        ? "bg-green-100 text-green-700 border-green-200"
        : "bg-slate-100 text-slate-600 border-slate-200";

    const priorityScore = group.priority_score ? Math.round(group.priority_score) : 0;

    // Dynamic border color based on readiness
    const borderColor = isReady ? "border-green-500/50" : "border-border";
    const shadow = isReady ? "shadow-md shadow-green-900/5" : "shadow-sm";

    return (
        <Link
            href={`/groups/${group.id}`}
            className={`group relative flex flex-col justify-between rounded-xl border ${borderColor} bg-white p-5 transition-all hover:-translate-y-1 hover:shadow-md ${shadow}`}
        >
            <div>
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-semibold text-ink group-hover:text-primary">
                            {group.group_name || "Unnamed Group"}
                        </h3>
                        <p className="text-xs text-muted mt-1">
                            {group.district || "Mixed District"} • {group.city}
                        </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${statusColor}`}>
                        {isReady ? "Ready" : "Monitoring"}
                    </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-50 p-2 text-center">
                        <div className="text-lg font-bold text-slate-700">{group.interested_count}</div>
                        <div className="text-[10px] uppercase text-muted">Interested</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 text-center">
                        <div className="text-lg font-bold text-slate-700">{group.total_offices}</div>
                        <div className="text-[10px] uppercase text-muted">Total Offices</div>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted">Priority Score</span>
                        <span className="font-medium">{priorityScore}/100</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${isReady ? "bg-green-500" : "bg-slate-400"}`}
                            style={{ width: `${priorityScore}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-xs text-muted">
                    Last activity: {group.last_action_date ? new Date(group.last_action_date).toLocaleDateString() : "Never"}
                </span>
                <span className="text-xs font-medium text-primary group-hover:underline">
                    {isReady ? "Plan Visit →" : "View Details"}
                </span>
            </div>
        </Link>
    );
}
