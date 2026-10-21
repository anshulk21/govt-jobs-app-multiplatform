// Hindi UI text. Missing keys fall back to English automatically.
// TODO: translate the remaining keys from en.ts (ask a native speaker to review).
import type { MessageKey } from './en';

export const hi: Partial<Record<MessageKey, string>> = {
  'tab.home': 'होम',
  'tab.search': 'खोजें',
  'tab.saved': 'सेव',
  'tab.tools': 'टूल्स',
  'tab.more': 'और',
  'home.forYou': 'आपके लिए',
  'home.newToday': 'आज की नई',
  'home.closingSoon': 'जल्द बंद होने वाली',
  'home.latest': 'नवीनतम नौकरियाँ',
  'job.vacancies': 'पद',
  'job.qualification': 'योग्यता',
  'job.ageLimit': 'आयु सीमा',
  'job.fee': 'आवेदन शुल्क',
  'job.lastDate': 'अंतिम तिथि',
  'job.save': 'सेव करें',
  'job.expired': 'समाप्त',
  'onboarding.language': 'अपनी भाषा चुनें',
  'onboarding.next': 'आगे',
  'onboarding.back': 'पीछे',
  'more.language': 'भाषा',
};
