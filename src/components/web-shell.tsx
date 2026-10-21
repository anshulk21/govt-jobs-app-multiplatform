// Website frame: sticky header with navigation, optional "Get the app" banner, footer.
import { Link, usePathname, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { APP } from '@/config/app';
import { readJson, writeJson } from '@/lib/storage';
import { useSettings } from '@/lib/settings';
import { Icon } from './ui';

const NAV: { href: Href; label: string }[] = [
  { href: '/', label: 'Latest Jobs' },
  { href: '/states', label: 'States' },
  { href: '/categories', label: 'Categories' },
  { href: '/admit-card', label: 'Admit Card' },
  { href: '/answer-key', label: 'Answer Key' },
  { href: '/result', label: 'Result' },
  { href: '/tools', label: 'Tools' },
  { href: '/saved', label: 'Saved' },
];

const FOOTER: { href: Href; label: string }[] = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms' },
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/more', label: 'Settings' },
];

function AppBanner() {
  const { t } = useSettings();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (APP.playStoreUrl) void readJson<boolean>('banner-dismissed').then((d) => setShow(!d));
  }, []);
  if (!show) return null;
  return (
    // Fixed to the bottom so it never pushes the page content down (no layout shift).
    <View className="fixed bottom-0 left-0 right-0 z-20 flex-row items-center gap-3 bg-brand-700 px-4 py-3 shadow-lg">
      <Icon name="notifications" className="text-white" />
      <Text className="flex-1 text-sm font-medium text-white">{t('common.getApp')}</Text>
      <Link href={APP.playStoreUrl as never} target="_blank" rel="noopener" className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-brand-700">
        {t('common.install')}
      </Link>
      <Pressable aria-label="Close" onPress={() => (setShow(false), void writeJson('banner-dismissed', true))}>
        <Icon name="close" className="text-white" />
      </Pressable>
    </View>
  );
}

export function WebShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: Href) => (href === '/' ? pathname === '/' : pathname.startsWith(String(href)));
  return (
    <View className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <View role="banner" className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95">
        <View className="mx-auto w-full max-w-5xl gap-1 px-4 pt-3">
          <Link href="/" className="text-xl font-extrabold text-brand-700 dark:text-brand-200">
            {APP.name}
          </Link>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} role="navigation" contentContainerClassName="gap-1 pb-2">
            {NAV.map((n) => (
              <Link
                key={String(n.href)}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive(n.href) ? 'bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-100' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {n.label}
              </Link>
            ))}
          </ScrollView>
        </View>
      </View>
      <View role="main" className="flex-1">
        {children}
      </View>
      <View role="contentinfo" className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <View className="mx-auto w-full max-w-5xl gap-3 px-4 py-6">
          <View className="flex-row flex-wrap gap-x-4 gap-y-2">
            {FOOTER.map((f) => (
              <Link key={String(f.href)} href={f.href} className="text-sm text-slate-600 dark:text-slate-400">
                {f.label}
              </Link>
            ))}
          </View>
          <Text className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {APP.name} is not a government website and is not affiliated with any government body. Job details are summarised from official
            notifications; always verify on the official website before applying.
          </Text>
        </View>
      </View>
      <AppBanner />
    </View>
  );
}
