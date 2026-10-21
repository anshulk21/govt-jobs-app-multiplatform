// Shared building blocks. Colours and dark-mode variants live here so screens stay consistent.
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type TextProps } from 'react-native';
import { useT } from '@/lib/settings';
import { Icon } from './icon';
import type { IconName } from './icon-names';

export { Icon };
export type { IconName };


/** Scrollable page with comfortable padding; centred and width-limited on large web screens. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const inner = <View className="mx-auto w-full max-w-3xl gap-5 px-4 pb-10 pt-4">{children}</View>;
  // On the website the page itself scrolls (better for mobile browsers and SEO).
  if (!scroll || Platform.OS === 'web') return <View className="flex-1 bg-slate-50 dark:bg-slate-950">{inner}</View>;
  return (
    <ScrollView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {inner}
    </ScrollView>
  );
}

type Variant = 'h1' | 'h2' | 'h3' | 'label' | 'body' | 'muted' | 'small';
const TEXT: Record<Variant, string> = {
  h1: 'text-3xl font-black tracking-tight text-ink dark:text-slate-50',
  h2: 'text-xl font-extrabold tracking-tight text-ink dark:text-slate-50',
  h3: 'text-base font-semibold text-slate-900 dark:text-slate-100',
  /** Looks like h3 but is not a heading (form labels, card titles). */
  label: 'text-base font-semibold text-slate-900 dark:text-slate-100',
  body: 'text-base leading-6 text-slate-800 dark:text-slate-200',
  muted: 'text-sm leading-5 text-slate-500 dark:text-slate-400',
  small: 'text-xs text-slate-500 dark:text-slate-400',
};

export function Txt({ variant = 'body', className = '', ...props }: TextProps & { variant?: Variant; className?: string }) {
  const role = variant === 'h1' || variant === 'h2' || variant === 'h3' ? { role: 'heading' as const, 'aria-level': variant === 'h1' ? 1 : variant === 'h2' ? 2 : 3 } : {};
  return <Text {...role} {...props} className={`${TEXT[variant]} ${className}`} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</View>;
}

type BadgeTone = 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'sun';
const BADGE: Record<BadgeTone, { box: string; text: string }> = {
  neutral: { box: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' },
  brand: { box: 'bg-brand-50 dark:bg-brand-900', text: 'text-brand-800 dark:text-brand-100' },
  green: { box: 'bg-green-50 dark:bg-green-950', text: 'text-green-700 dark:text-green-300' },
  amber: { box: 'bg-sun-light/60 dark:bg-amber-950', text: 'text-amber-900 dark:text-amber-300' },
  red: { box: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-300' },
  sun: { box: 'bg-sun', text: 'font-black text-ink' },
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${BADGE[tone].box}`}>
      <Text className={`text-xs font-semibold ${BADGE[tone].text}`}>{children}</Text>
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost';
const BUTTON: Record<ButtonKind, { box: string; text: string; icon: string }> = {
  primary: { box: 'bg-brand-700 active:bg-brand-800 dark:bg-brand-600', text: 'text-white', icon: 'text-white' },
  secondary: {
    box: 'border border-slate-300 bg-white active:bg-cream-light dark:border-slate-700 dark:bg-slate-900 dark:active:bg-slate-800',
    text: 'text-slate-900 dark:text-slate-100',
    icon: 'text-slate-700 dark:text-slate-300',
  },
  ghost: { box: 'active:bg-slate-100 dark:active:bg-slate-800', text: 'text-brand-700 dark:text-brand-200', icon: 'text-brand-700 dark:text-brand-200' },
};

export function Button({
  label,
  onPress,
  href,
  icon,
  kind = 'primary',
  disabled,
  className = '',
}: {
  label: string;
  onPress?: () => void;
  href?: Href;
  icon?: IconName;
  kind?: ButtonKind;
  disabled?: boolean;
  className?: string;
}) {
  const s = BUTTON[kind];
  const content = (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      role={href ? undefined : 'button'}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-full px-5 py-2.5 active:scale-95 ${kind === 'ghost' ? '' : 'gj-btn'} ${s.box} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {icon ? <Icon name={icon} className={s.icon} /> : null}
      <Text className={`text-base font-semibold ${s.text}`}>{label}</Text>
    </Pressable>
  );
  return href ? (
    <Link href={href} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}

/** A round icon-only button; `label` is read out by screen readers. */
export function IconButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      role="button"
      aria-label={label}
      className={`h-11 w-11 items-center justify-center rounded-full active:bg-slate-100 dark:active:bg-slate-800 ${disabled ? 'opacity-30' : ''}`}
    >
      <Icon name={icon} size={20} className="text-slate-700 dark:text-slate-300" />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      role="checkbox"
      aria-checked={!!selected}
      className={`rounded-full border px-3.5 py-2 active:scale-95 ${
        selected ? 'border-brand-700 bg-brand-700' : 'gj-chip border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{label}</Text>
    </Pressable>
  );
}

/** A chip that navigates (renders a real <a> link on the website, so search engines can follow it). */
export function ChipLink({ label, href }: { label: string; href: Href }) {
  return (
    <Link
      href={href}
      className="gj-chip rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      {label}
    </Link>
  );
}

export function ChipRow({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-4">
        {children}
      </ScrollView>
    );
  }
  return <View className="flex-row flex-wrap gap-2">{children}</View>;
}

export function Section({ title, href, count, children }: { title: string; href?: Href; count?: number; children: ReactNode }) {
  const t = useT();
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2.5">
          <View className="h-2.5 w-2.5 rounded-full bg-brand-500" />
          <Txt variant="h2" className="shrink">
            {title}
          </Txt>
          {count ? (
            <View className="rounded-full bg-ink px-2.5 py-0.5 dark:bg-cream">
              <Text className="text-xs font-black text-cream dark:text-ink">{count}</Text>
            </View>
          ) : null}
        </View>
        {href ? (
          <Link href={href} className="rounded-full px-2 py-1 text-sm font-bold text-brand-700 dark:text-brand-200">
            {t('common.seeAll')} →
          </Link>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A tappable row with an icon, used in menus and lists of links. */
export function LinkRow({ href, icon, label, description }: { href: Href; icon: IconName; label: string; description?: string }) {
  return (
    <Link href={href} asChild>
      <Pressable className="flex-row items-center gap-3 rounded-2xl px-3 py-3 active:bg-slate-100 dark:active:bg-slate-800">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900">
          <Icon name={icon} size={20} className="text-brand-700 dark:text-brand-100" />
        </View>
        <View className="flex-1">
          <Txt variant="label">{label}</Txt>
          {description ? <Txt variant="muted">{description}</Txt> : null}
        </View>
        <Icon name="chevron-forward" />
      </Pressable>
    </Link>
  );
}

export function Loading() {
  const t = useT();
  return (
    <View className="items-center gap-2 py-10">
      <ActivityIndicator color="#e43d12" />
      <Txt variant="muted">{t('common.loading')}</Txt>
    </View>
  );
}

export function Message({ icon = 'information-circle-outline', text, action }: { icon?: IconName; text: string; action?: ReactNode }) {
  return (
    <View className="items-center gap-3 rounded-3xl border border-dashed border-slate-300 px-6 py-8 dark:border-slate-700">
      <Icon name={icon} size={28} />
      <Txt variant="muted" className="text-center">
        {text}
      </Txt>
      {action}
    </View>
  );
}

export function OfflineNotice() {
  const t = useT();
  return (
    <View className="flex-row items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950">
      <Icon name="cloud-offline-outline" className="text-amber-800 dark:text-amber-300" />
      <Text className="text-sm text-amber-800 dark:text-amber-300">{t('common.offline')}</Text>
    </View>
  );
}

/** Two-column label/value line used on the job page. */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View className="flex-row gap-3 border-b border-slate-100 py-2.5 last:border-b-0 dark:border-slate-800">
      <Txt variant="muted" className="w-32 shrink-0">
        {label}
      </Txt>
      <View className="flex-1">{typeof value === 'string' ? <Txt>{value}</Txt> : value}</View>
    </View>
  );
}

export const isWeb = Platform.OS === 'web';

/** Labelled text input used by the tools. */
export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View className="gap-1.5">
      <Txt variant="label">{label}</Txt>
      <TextInput
        placeholderTextColor="#948c7c"
        aria-label={label}
        {...input}
        className="h-12 rounded-2xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      {hint ? <Txt variant="small">{hint}</Txt> : null}
    </View>
  );
}
