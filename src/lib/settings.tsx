// User settings kept on the device (no login): language, theme, and job preferences.
import { colorScheme } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Preferences } from '@/core/jobs';
import { translate, type Language, type MessageKey } from './i18n';
import { readJson, writeJson } from './storage';

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Settings {
  language: Language;
  theme: ThemeSetting;
  prefs: Preferences;
  /** Finished (or skipped) the first-launch questions. */
  onboarded: boolean;
  /** User turned on job alerts (and allowed notifications). */
  notifications: boolean;
}

/** Storage key; +html.tsx reads the theme from it before the page paints (no dark-mode flash). */
export const SETTINGS_KEY = 'settings:v1';

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'system',
  prefs: { states: [], central: true, categories: [], qualifications: [] },
  onboarded: false,
  notifications: false,
};

interface SettingsContextValue extends Settings {
  /** False until saved settings are loaded from the device. */
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void readJson<Partial<Settings>>(SETTINGS_KEY).then((saved) => {
      if (saved) setSettings((s) => ({ ...s, ...saved, prefs: { ...s.prefs, ...saved.prefs } }));
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) colorScheme.set(settings.theme);
  }, [settings.theme, ready]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      void writeJson(SETTINGS_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ ...settings, ready, update, t: (key, vars) => translate(settings.language, key, vars) }),
    [settings, ready, update],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}

/** Shortcut for UI text. */
export function useT() {
  return useSettings().t;
}
