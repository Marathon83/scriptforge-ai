import { useState } from "react";
import "./index.css";
import { TabProvider } from "./context/TabContext";
import TabBar from "./components/TabBar";
import GenerateTab    from "./tabs/GenerateTab";
import DebugTab       from "./tabs/DebugTab";
import AnalyzeTab     from "./tabs/AnalyzeTab";
import ConvertTab     from "./tabs/ConvertTab";
import ImproveTab     from "./tabs/ImproveTab";
import CheatSheetsTab from "./tabs/CheatSheetsTab";
import TutorTab       from "./tabs/TutorTab";
import SandboxTab     from "./tabs/SandboxTab";

const TABS = {
  generate:   GenerateTab,
  debug:      DebugTab,
  analyze:    AnalyzeTab,
  convert:    ConvertTab,
  improve:    ImproveTab,
  cheatsheet: CheatSheetsTab,
  tutor:      TutorTab,
  sandbox:    SandboxTab,
};

export default function App() {
  const [tab, setTab] = useState("generate");
  const ActiveTab = TABS[tab];

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
            <ActiveTab />
          </div>
        </div>
      </div>
    </TabProvider>
  );
}
