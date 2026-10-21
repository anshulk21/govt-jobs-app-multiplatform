// App icons (iOS/Android): Lucide SVG icons via react-native-svg. The website uses icon.web.tsx.
// One import per icon file: importing from the package root would bundle all ~1,500 icons.
import type { LucideIcon } from 'lucide-react-native';
import Archive from 'lucide-react-native/icons/archive';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import Bell from 'lucide-react-native/icons/bell';
import Bookmark from 'lucide-react-native/icons/bookmark';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Calculator from 'lucide-react-native/icons/calculator';
import Calendar from 'lucide-react-native/icons/calendar';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import CheckCheck from 'lucide-react-native/icons/check-check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleHelp from 'lucide-react-native/icons/circle-question-mark';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import CircleX from 'lucide-react-native/icons/circle-x';
import CloudOff from 'lucide-react-native/icons/cloud-off';
import Download from 'lucide-react-native/icons/download';
import ExternalLink from 'lucide-react-native/icons/external-link';
import File from 'lucide-react-native/icons/file';
import FileText from 'lucide-react-native/icons/file-text';
import Files from 'lucide-react-native/icons/files';
import Globe from 'lucide-react-native/icons/globe';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import House from 'lucide-react-native/icons/house';
import IdCard from 'lucide-react-native/icons/id-card';
import ImageIcon from 'lucide-react-native/icons/image';
import Info from 'lucide-react-native/icons/info';
import KeyRound from 'lucide-react-native/icons/key-round';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import Mail from 'lucide-react-native/icons/mail';
import MapIcon from 'lucide-react-native/icons/map';
import MapPin from 'lucide-react-native/icons/map-pin';
import Maximize2 from 'lucide-react-native/icons/maximize-2';
import Menu from 'lucide-react-native/icons/menu';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Search from 'lucide-react-native/icons/search';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Trash2 from 'lucide-react-native/icons/trash';
import Trophy from 'lucide-react-native/icons/trophy';
import Users from 'lucide-react-native/icons/users';
import Wrench from 'lucide-react-native/icons/wrench';
import X from 'lucide-react-native/icons/x';
import { cssInterop } from 'nativewind';
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

function Glyph({ name, size, color }: { name: IconName; size: number; color?: string }) {
  const Component = MAP[name];
  return <Component size={size} color={color} fill={FILLED.has(name) ? color : 'none'} strokeWidth={2} />;
}

// Turn the text-* colour class into the `color` prop.
cssInterop(Glyph, { className: { target: false, nativeStyleToProp: { color: true } } });

export function Icon({ name, size = 18, className = 'text-slate-500 dark:text-slate-400', color }: IconProps) {
  return color ? <Glyph name={name} size={size} color={color} /> : <Glyph name={name} size={size} {...({ className } as object)} />;
}
