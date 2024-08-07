import { StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';

export function ConversationalChat() {
  return (
    <WebView
      style={styles.container}
      source={{ uri: 'https://aura-tts-demo.deepgram.com/' }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: Constants.statusBarHeight,
  },
});
