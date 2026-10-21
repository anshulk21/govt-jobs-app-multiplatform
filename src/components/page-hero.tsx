// Big headline block for browse pages (States, Categories), in the same style as the home hero.
import type { ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Icon } from './ui';

export function PageHero({ title, accent, subtitle, children }: { title: string; accent: string; subtitle: string; children?: ReactNode }) {
  const line = 'text-4xl font-black uppercase leading-[0.95] tracking-tighter sm:text-5xl';
  return (
    <View className="relative overflow-hidden rounded-[32px] bg-cream-light px-5 pb-6 pt-8 dark:bg-slate-900">
      <View aria-hidden className="gj-float absolute -right-10 -top-14 h-36 w-36 rounded-full bg-sun/90" />
      <View aria-hidden className="gj-float-slow absolute -bottom-12 right-24 h-20 w-20 rounded-full bg-pink/80" />
      <View role="heading" aria-level={1}>
        <View className="gj-line">
          <Text className={`${line} text-ink dark:text-cream`}>{title} </Text>
        </View>
        <View className="gj-line">
          <Text className={`${line} text-brand-600 dark:text-brand-400`}>{accent}</Text>
        </View>
      </View>
      <Text className="mt-3 max-w-md text-base font-medium leading-6 text-slate-600 dark:text-slate-300">{subtitle}</Text>
      {children ? <View className="mt-4">{children}</View> : null}
    </View>
  );
}

/** Rounded "type to filter" box used on browse pages. */
export function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-full border-2 border-ink/10 bg-white px-4 dark:border-slate-700 dark:bg-slate-950">
      <Icon name="search" className="text-brand-700 dark:text-brand-200" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#948c7c"
        aria-label={placeholder}
        className="h-12 min-w-0 flex-1 text-base text-slate-900 dark:text-slate-100"
      />
    </View>
  );
}
