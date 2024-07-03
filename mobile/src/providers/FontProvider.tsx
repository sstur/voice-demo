import { useEffect, type ReactNode } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { useFonts } from 'expo-font';

import { fonts } from '../config/fonts';

type Props = {
  onInitialized: () => void;
  children: ReactNode;
};

export function FontProvider(props: Props) {
  const { onInitialized, children } = props;
  const [isLoaded, error] = useFonts(fonts);

  useEffect(() => {
    if (isLoaded || error) {
      onInitialized();
    }
  }, [isLoaded, error, onInitialized]);

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
