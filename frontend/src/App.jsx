import { useState } from "react";
import "./index.css";
import { TabProvider } from "./context/TabContext";
import TabBar from "./components/TabBar";
import GenerateTab    from "./tabs/GenerateTab";
import DebugTab       from "./tabs/DebugTab";
import AnalyzeTab     from "./tabs/AnalyzeTab";
import ConvertTab     from "./tabs/ConvertTab";
import ImproveTab     from "./tabs/ImproveTab";
import SimulateTab    from "./tabs/SimulateTab";
import CheatSheetsTab from "./tabs/CheatSheetsTab";
import TutorTab       from "./tabs/TutorTab";
import SandboxTab     from "./tabs/SandboxTab";

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
];

export default function App() {
  const [tab, setTab] = useState("generate");

  return (
    <TabProvider onNavigate={setTab}>
      <div className="app">
        <header className="app-header">
          <h1>ScriptForge AI</h1>
          <span className="tagline">// AI-powered script generation &amp; analysis</span>
        </header>
        <div className="app-body">
          <TabBar active={tab} onChange={setTab} />
          <div className="tab-content">
            {TABS.map(({ id, Component }) => (
              <div key={id} style={{ display: id === tab ? "block" : "none" }}>
                <Component isActive={id === tab} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </TabProvider>
  );
}
