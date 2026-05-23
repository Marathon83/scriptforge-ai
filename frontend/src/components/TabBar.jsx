const TABS = [
  { id: "generate",   label: "Generate" },
  { id: "debug",      label: "Debugger" },
  { id: "analyze",    label: "Analyzer" },
  { id: "convert",    label: "Convert" },
  { id: "improve",    label: "Improve" },
  { id: "cheatsheet", label: "Cheat Sheets" },
  { id: "tutor",      label: "AI Tutor" },
  { id: "sandbox",    label: "Sandbox" },
];

export default function TabBar({ active, onChange }) {
  return (
    <div className="tab-bar">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={active === t.id ? "active" : ""}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
