// Every icon the app uses. Names ending in "-outline" draw the outline; the plain
// name of bookmark/notifications/home/… draws the filled version.
export const ICON_NAMES = [
  'add-circle-outline', 'alert-circle-outline', 'archive-outline', 'arrow-down', 'arrow-up',
  'bookmark', 'bookmark-outline', 'briefcase-outline', 'calculator-outline', 'calendar-number-outline',
  'calendar-outline', 'checkmark-done-outline', 'chevron-forward', 'close', 'close-circle-outline',
  'cloud-offline-outline', 'construct', 'construct-outline', 'document-attach-outline', 'document-outline',
  'document-text-outline', 'download-outline', 'globe-outline', 'grid-outline', 'help-circle-outline',
  'home', 'home-outline', 'id-card-outline', 'image-outline', 'information-circle-outline', 'key-outline',
  'location-outline', 'logo-whatsapp', 'mail-outline', 'map-outline', 'menu', 'menu-outline',
  'notifications', 'notifications-outline', 'open-outline', 'options-outline', 'people-outline',
  'resize-outline', 'school-outline', 'search', 'search-outline', 'shield-checkmark-outline',
  'trash-outline', 'trophy-outline',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** Plain (non-outline) names that are drawn filled. */
export const FILLED: ReadonlySet<IconName> = new Set<IconName>(['bookmark', 'notifications', 'home']);

export interface IconProps {
  name: IconName;
  size?: number;
  /** Colour as a text-* class (e.g. "text-brand-700 dark:text-brand-200"). */
  className?: string;
  /** Explicit colour (overrides className), e.g. from a tab bar. */
  color?: string;
}
