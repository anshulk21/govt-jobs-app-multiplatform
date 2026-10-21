import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

/** Opens an official website: a new tab on the web, an in-app browser in the apps. */
export async function openExternal(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  if (/^https?:/i.test(url)) await WebBrowser.openBrowserAsync(url);
  else await Linking.openURL(url);
}

/** Opens WhatsApp's share screen with the given text. */
export async function shareOnWhatsApp(text: string): Promise<void> {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
  else await Linking.openURL(url);
}
