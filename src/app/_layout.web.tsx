// Root layout for the website: header navigation, page, footer.
import '../global.css';
import { Slot } from 'expo-router';
import { Providers } from '@/components/providers';
import { WebShell } from '@/components/web-shell';
import { usePushNotifications } from '@/lib/push';

function WebPush() {
  usePushNotifications(); // does nothing unless FEATURES.webPush is on
  return null;
}

export default function RootLayout() {
  return (
    <Providers>
      <WebPush />
      <WebShell>
        <Slot />
      </WebShell>
    </Providers>
  );
}
