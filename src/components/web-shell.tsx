// Website frame: sticky header with navigation, optional "Get the app" banner, footer.
import { Link, usePathname, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { APP } from '@/config/app';
import { readJson, writeJson } from '@/lib/storage';
import { useSettings } from '@/lib/settings';
import { BannerSlot } from './ads';
import { ThemeToggle } from './theme-toggle';
import { Icon } from './ui';

const NAV: { href: Href; label: string }[] = [
  { href: '/', label: 'Latest Jobs' },
  { href: '/states', label: 'States' },
  { href: '/categories', label: 'Categories' },
  { href: '/admit-card', label: 'Admit Card' },
  { href: '/answer-key', label: 'Answer Key' },
  { href: '/result', label: 'Result' },
  { href: '/tools', label: 'Tools' },
  { href: '/quiz', label: 'Mock Tests' },
  { href: '/saved', label: 'Saved' },
];

/** Pages that render <Screen wide>: no sidebar, so their grids get the whole width. */
const WIDE_PAGES = ['/states'];

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
      <Link
        href={APP.playStoreUrl as never}
        target="_blank"
        rel="noopener"
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-brand-700"
      >
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
      <View
        role="banner"
        className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90"
      >
        <View className="mx-auto w-full max-w-5xl gap-1 px-4 pt-3">
          <View className="flex-row items-center justify-between gap-3">
            <Link href="/" asChild>
              <Pressable className="gj-logo flex-row items-center gap-2 self-start">
                {/* Plain <img> (this file is web-only) so the logo is in the static HTML before JS loads. */}
                <img src="/logo.svg" alt="" width={32} height={32} />
                <Text className="text-xl font-black tracking-tight text-brand-700 dark:text-brand-200">{APP.name}</Text>
              </Pressable>
            </Link>
            <ThemeToggle />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} role="navigation" className="gj-nav" contentContainerClassName="gap-1 pb-2">
            {NAV.map((n) => (
              <Link
                key={String(n.href)}
                href={n.href}
                className={`rounded-full px-3 py-2 text-xs font-extrabold uppercase tracking-wider ${
                  isActive(n.href) ? 'bg-brand-700 text-white dark:bg-brand-600' : 'text-brand-800 dark:text-brand-200'
                }`}
              >
                {n.label}
              </Link>
            ))}
          </ScrollView>
        </View>
      </View>
      <View className="mx-auto w-full max-w-6xl flex-1 flex-row">
        <View role="main" className="min-w-0 flex-1">
          {children}
        </View>
        {/* Desktop only (≥1024px): sidebar ad. Hidden by CSS on phones, so nothing shifts. */}
        {WIDE_PAGES.includes(pathname) ? null : (
          <View role="complementary" className="hidden w-80 shrink-0 px-4 pt-4 lg:flex">
            <View className="sticky top-28">
              <BannerSlot placement="sidebar" />
            </View>
          </View>
        )}
      </View>
      <View role="contentinfo" className="mt-8 rounded-t-[32px] bg-ink dark:border-t dark:border-slate-800">
        <View className="mx-auto w-full max-w-5xl gap-5 px-4 pb-8 pt-10">
          <View>
            <Text className="text-4xl font-black uppercase leading-none tracking-tighter text-brand-400 sm:text-6xl">Every sarkari job.</Text>
            <Text className="text-4xl font-black uppercase leading-none tracking-tighter text-pink sm:text-6xl">One place.</Text>
          </View>
          <View className="flex-row flex-wrap gap-x-5 gap-y-2">
            {FOOTER.map((f) => (
              <Link key={String(f.href)} href={f.href} className="text-sm font-semibold text-cream hover:text-sun">
                {f.label}
              </Link>
            ))}
          </View>
          <Text className="text-xs leading-5 text-slate-300">
            {APP.name} is not a government website and is not affiliated with any government body. Job details are summarised from official
            notifications; always verify on the official website before applying.
          </Text>
        </View>
      </View>
      <AppBanner />
    </View>
  );
}
