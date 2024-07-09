import { Stack } from 'expo-router';

import { Text, VStack } from '../components/core';

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
        <Text>{t('Hello World')}</Text>
      </VStack>
    </>
  );
}
