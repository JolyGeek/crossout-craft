import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultSettings, type Settings } from './craft';

const KEY = 'crossout-craft:settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    // Плата за верстак зависит от предмета, поэтому её не сохраняем.
    return raw ? { ...defaultSettings, ...JSON.parse(raw), benchCost: 0 } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

const Ctx = createContext<[Settings, (s: Settings) => void]>([defaultSettings, () => {}]);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);
  return <Ctx.Provider value={[settings, setSettings]}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
