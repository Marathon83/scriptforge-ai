const ICONS = { low: "✓", medium: "⚠", high: "✕", unknown: "?" };

export default function SecurityBadge({ level }) {
  const l = (level || "unknown").toLowerCase();
  return (
    <span className={`sec-badge ${l}`}>
      {ICONS[l] ?? "?"} Risk: {l}
    </span>
  );
}
