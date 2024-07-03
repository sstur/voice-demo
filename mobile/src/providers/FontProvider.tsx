import type { ReactNode } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { useFonts } from 'expo-font';

import { fonts } from '../config/fonts';

type Props = {
  children: ReactNode;
};

export function FontProvider(props: Props) {
  const { children } = props;
  const [isLoaded, error] = useFonts(fonts);

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'red' }}>
        <View style={{ padding: 20 }}>
          <Text style={{ color: 'white' }}>{String(error)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isLoaded) {
    return null;
  }

  return <>{children}</>;
}
