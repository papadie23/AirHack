"use client";

import type { BottomTab } from "@/app/page";

interface Props {
  activeTab: BottomTab;
  onSelectTab: (tab: BottomTab) => void;
}

export default function BottomBar({ activeTab, onSelectTab }: Props) {
  const tabs: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "operator",
      label: "Airport Operator",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      id: "passengers",
      label: "Passengers (anon)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: "settings",
      label: "API Settings",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      ),
    },
    {
      id: "architecture",
      label: "Architecture",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2"/>
          <circle cx="5" cy="19" r="2"/>
          <circle cx="19" cy="19" r="2"/>
          <line x1="12" y1="7" x2="12" y2="14"/>
          <line x1="12" y1="14" x2="5" y2="17"/>
          <line x1="12" y1="14" x2="19" y2="17"/>
        </svg>
      ),
    },
  ];

  return (
    <div
      className="rounded-2xl border p-3 flex gap-3"
      style={{ gridColumn: "1 / 4", background: "var(--bg-card)", borderColor: "var(--border-color)" }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelectTab(tab.id)}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[10px] border text-sm font-medium transition-all duration-200 cursor-pointer"
          style={
            tab.id === activeTab
              ? { background: "var(--bg-hover)", color: "var(--text-main)", borderColor: "#555" }
              : { background: "transparent", color: "var(--text-muted)", borderColor: "var(--border-color)" }
          }
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
