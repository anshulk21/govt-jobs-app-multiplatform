// Website icons: plain inline <svg> from Lucide, already in the pre-rendered HTML
// (no icon font to download, no layout shift). Colour comes from the text-* class.
// One import per icon file: importing from the package root would bundle all ~1,500 icons.
import type { LucideIcon } from 'lucide-react';
import Archive from 'lucide-react/dist/esm/icons/archive.mjs';
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down.mjs';
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up.mjs';
import Bell from 'lucide-react/dist/esm/icons/bell.mjs';
import Bookmark from 'lucide-react/dist/esm/icons/bookmark.mjs';
import Briefcase from 'lucide-react/dist/esm/icons/briefcase.mjs';
import Calculator from 'lucide-react/dist/esm/icons/calculator.mjs';
import Calendar from 'lucide-react/dist/esm/icons/calendar.mjs';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import CheckCheck from 'lucide-react/dist/esm/icons/check-check.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import CircleAlert from 'lucide-react/dist/esm/icons/circle-alert.mjs';
import CircleHelp from 'lucide-react/dist/esm/icons/circle-question-mark.mjs';
import CirclePlus from 'lucide-react/dist/esm/icons/circle-plus.mjs';
import CircleX from 'lucide-react/dist/esm/icons/circle-x.mjs';
import CloudOff from 'lucide-react/dist/esm/icons/cloud-off.mjs';
import Download from 'lucide-react/dist/esm/icons/download.mjs';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.mjs';
import File from 'lucide-react/dist/esm/icons/file.mjs';
import FileText from 'lucide-react/dist/esm/icons/file-text.mjs';
import Files from 'lucide-react/dist/esm/icons/files.mjs';
import Globe from 'lucide-react/dist/esm/icons/globe.mjs';
import GraduationCap from 'lucide-react/dist/esm/icons/graduation-cap.mjs';
import House from 'lucide-react/dist/esm/icons/house.mjs';
import IdCard from 'lucide-react/dist/esm/icons/id-card.mjs';
import ImageIcon from 'lucide-react/dist/esm/icons/image.mjs';
import Info from 'lucide-react/dist/esm/icons/info.mjs';
import KeyRound from 'lucide-react/dist/esm/icons/key-round.mjs';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid.mjs';
import Mail from 'lucide-react/dist/esm/icons/mail.mjs';
import MapIcon from 'lucide-react/dist/esm/icons/map.mjs';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.mjs';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.mjs';
import Menu from 'lucide-react/dist/esm/icons/menu.mjs';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.mjs';
import SlidersHorizontal from 'lucide-react/dist/esm/icons/sliders-horizontal.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash.mjs';
import Trophy from 'lucide-react/dist/esm/icons/trophy.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';
import Wrench from 'lucide-react/dist/esm/icons/wrench.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import { FILLED, type IconName, type IconProps } from './icon-names';

const MAP: Record<IconName, LucideIcon> = {
  'add-circle-outline': CirclePlus,
  'alert-circle-outline': CircleAlert,
  'archive-outline': Archive,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  bookmark: Bookmark,
  'bookmark-outline': Bookmark,
  'briefcase-outline': Briefcase,
  'calculator-outline': Calculator,
  'calendar-number-outline': CalendarDays,
  'calendar-outline': Calendar,
  'checkmark-done-outline': CheckCheck,
  'chevron-forward': ChevronRight,
  close: X,
  'close-circle-outline': CircleX,
  'cloud-offline-outline': CloudOff,
  construct: Wrench,
  'construct-outline': Wrench,
  'document-attach-outline': Files,
  'document-outline': File,
  'document-text-outline': FileText,
  'download-outline': Download,
  'globe-outline': Globe,
  'grid-outline': LayoutGrid,
  'help-circle-outline': CircleHelp,
  home: House,
  'home-outline': House,
  'id-card-outline': IdCard,
  'image-outline': ImageIcon,
  'information-circle-outline': Info,
  'key-outline': KeyRound,
  'location-outline': MapPin,
  'logo-whatsapp': MessageCircle,
  'mail-outline': Mail,
  'map-outline': MapIcon,
  menu: Menu,
  'menu-outline': Menu,
  notifications: Bell,
  'notifications-outline': Bell,
  'open-outline': ExternalLink,
  'options-outline': SlidersHorizontal,
  'people-outline': Users,
  'resize-outline': Maximize2,
  'school-outline': GraduationCap,
  search: Search,
  'search-outline': Search,
  'shield-checkmark-outline': ShieldCheck,
  'trash-outline': Trash2,
  'trophy-outline': Trophy,
};

export function Icon({ name, size = 18, className = 'text-slate-500 dark:text-slate-400', color }: IconProps) {
  const Component = MAP[name];
  return (
    <Component
      size={size}
      className={`shrink-0 ${className}`}
      color={color ?? 'currentColor'}
      fill={FILLED.has(name) ? (color ?? 'currentColor') : 'none'}
      strokeWidth={2}
      aria-hidden="true"
    />
  );
}
