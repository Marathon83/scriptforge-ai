import { createContext, useContext, useState, useCallback } from "react";

const Ctx = createContext(null);

export function TabProvider({ onNavigate, children }) {
  const [inbox, setInbox] = useState({});

  const sendToTab = useCallback((tab, payload) => {
    setInbox(prev => ({ ...prev, [tab]: payload }));
    onNavigate(tab);
  }, [onNavigate]);

  const consume = useCallback((tab) => {
    setInbox(prev => {
      if (!prev[tab]) return prev;
      const next = { ...prev };
      delete next[tab];
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ inbox, sendToTab, consume }}>{children}</Ctx.Provider>;
}

export const useTabCtx = () => useContext(Ctx);
