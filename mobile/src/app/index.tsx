import { Link, Stack } from 'expo-router';

import { Button, VStack } from '../components/core';

export default function Page() {
  return (
    <>
      <Stack.Screen
        options={{
          title: t('Home'),
          headerShown: false,
        }}
      />
      <VStack flex={1} justifyContent="center" alignItems="center">
        <Link href="/chat" asChild>
          <Button>{t('Chat')}</Button>
        </Link>
      </VStack>
    </>
  );
}
