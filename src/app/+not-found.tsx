import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { Button, Message, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title: 'Not found' }} /> : null}
      <Message icon="help-circle-outline" text="This page does not exist. The job may have been removed or the link is wrong." action={<Button label="Go to latest jobs" href="/" />} />
    </Screen>
  );
}
