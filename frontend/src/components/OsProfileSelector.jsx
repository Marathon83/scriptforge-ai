const PROFILES = ["linux", "macos", "windows", "kali", "docker"];

export default function OsProfileSelector({ value, onChange }) {
  return (
    <div className="form-row">
      <label>OS Profile</label>
      <div className="os-selector">
        {PROFILES.map((p) => (
          <button
            key={p}
            className={`os-chip${value === p ? " active" : ""}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
