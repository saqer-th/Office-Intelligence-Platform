export default function StatusBadge({ status, className = "" }) {
    const getStyle = (s) => {
        switch (s) {
            case "Interested":
                return "bg-blue-50 text-blue-700 border-blue-200";
            case "Visited":
                return "bg-purple-50 text-purple-700 border-purple-200";
            case "Onboarded":
                return "bg-emerald-50 text-emerald-700 border-emerald-200";
            case "Rejected":
                return "bg-red-50 text-red-700 border-red-200";
            case "Contacted":
                return "bg-amber-50 text-amber-700 border-amber-200";
            default:
                // New or unknown
                return "bg-slate-50 text-slate-600 border-slate-200";
        }
    };

    const label = status || "New";

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStyle(
                status
            )} ${className}`}
        >
            {label}
        </span>
    );
}
