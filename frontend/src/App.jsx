import { useState, useEffect } from "react";
import "./index.css";
import { TabProvider } from "./context/TabContext";
import TabBar from "./components/TabBar";
import ApiKeyModal from "./components/ApiKeyModal";
import AboutModal from "./components/AboutModal";
import ErrorBoundary from "./components/ErrorBoundary";
import GenerateTab    from "./tabs/GenerateTab";
import DebugTab       from "./tabs/DebugTab";
import AnalyzeTab     from "./tabs/AnalyzeTab";
import ConvertTab     from "./tabs/ConvertTab";
import ImproveTab     from "./tabs/ImproveTab";
import SimulateTab    from "./tabs/SimulateTab";
import CheatSheetsTab from "./tabs/CheatSheetsTab";
import TutorTab       from "./tabs/TutorTab";
import SandboxTab          from "./tabs/SandboxTab";
import SecurityScannerTab  from "./tabs/SecurityScannerTab";
import WorkflowBuilderTab  from "./tabs/WorkflowBuilderTab";

const TABS = [
  { id: "generate",   Component: GenerateTab },
  { id: "debug",      Component: DebugTab },
  { id: "analyze",    Component: AnalyzeTab },
  { id: "convert",    Component: ConvertTab },
  { id: "improve",    Component: ImproveTab },
  { id: "simulate",   Component: SimulateTab },
  { id: "cheatsheet", Component: CheatSheetsTab },
  { id: "tutor",      Component: TutorTab },
  { id: "sandbox",    Component: SandboxTab },
  { id: "security",   Component: SecurityScannerTab },
  { id: "workflow",   Component: WorkflowBuilderTab },
];

export default function App() {
  const [tab, setTab] = useState("generate");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [hasKey, setHasKey] = useState(() => !!localStorage.getItem("scriptforge_api_key"));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasKey) setShowKeyModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModalClose = () => {
    setShowKeyModal(false);
    setHasKey(!!localStorage.getItem("scriptforge_api_key"));
  };

  return (
    <TabProvider onNavigate={setTab}>
      <div className="app">
        <header className="app-header">
          <h1>ScriptForge AI</h1>
          <span className="tagline">// AI-powered script generation &amp; analysis</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {!hasKey && (
              <span
                className="no-key-badge"
                onClick={() => setShowKeyModal(true)}
                title="No API key set — click to add"
              >
                ⚠ No API key
              </span>
            )}
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setShowAbout(true)}
              title="About — Feature Overview"
              style={{ fontSize: 16, padding: "4px 10px" }}
            >
              ℹ
            </button>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setShowKeyModal(true)}
              title="Settings — Anthropic API Key"
              style={{ fontSize: 16, padding: "4px 10px" }}
            >
              ⚙
            </button>
          </div>
        </header>
        <div className="app-body">
          <TabBar active={tab} onChange={setTab} />
          <div className="tab-content">
            {TABS.map(({ id, Component }) => (
              <div key={id} style={{ display: id === tab ? "block" : "none" }}>
                <ErrorBoundary>
                  <Component isActive={id === tab} />
                </ErrorBoundary>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showKeyModal && (
        <ApiKeyModal
          onClose={handleModalClose}
          isRequired={!hasKey}
        />
      )}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </TabProvider>
  );
}
