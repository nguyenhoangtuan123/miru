import { ClipboardList, FileText, Stethoscope } from 'lucide-react';
import type { TherapyTabId } from './types';

type TherapyTabsProps = {
  activeTab: TherapyTabId;
  onChange: (tab: TherapyTabId) => void;
};

const tabs = [
  { id: 'exercises' as const, label: 'Bài tập', icon: ClipboardList },
  { id: 'reports' as const, label: 'Báo cáo AI', icon: FileText },
  { id: 'therapist' as const, label: 'Nhà trị liệu', icon: Stethoscope },
];

export function TherapyTabs({ activeTab, onChange }: TherapyTabsProps) {
  return (
    <div className="mb-8 flex w-fit flex-wrap gap-2 rounded-2xl bg-white/5 p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-miru-primary text-white shadow-lg'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon size={18} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
