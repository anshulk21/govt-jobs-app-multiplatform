import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

export const isWebUrl = (url: string | null | undefined): url is string => !!url && /^https?:\/\//i.test(url.trim());

/** Opens an official website: a new tab on the web, an in-app browser in the apps. */
export async function openExternal(url: string): Promise<void> {
  if (!isWebUrl(url)) return; // never javascript:, data:, file: … even if typed into the admin panel
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  await WebBrowser.openBrowserAsync(url);
}

/** Opens WhatsApp's share screen with the given text. */
export async function shareOnWhatsApp(text: string): Promise<void> {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
  else await Linking.openURL(url);
}
