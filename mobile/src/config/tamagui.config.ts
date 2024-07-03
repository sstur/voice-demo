// The v2 config imports the css driver on web and react-native on native
// for reanimated: @tamagui/config/v2-reanimated
// for react-native only: @tamagui/config/v2-native
import { config } from '@tamagui/config/v2';
import { createTamagui } from 'tamagui';

const tamaguiConfig = createTamagui(config);

// This makes typescript properly type everything based on the config
type Conf = typeof tamaguiConfig;
declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/consistent-type-definitions
  interface TamaguiCustomConfig extends Conf {}
}

export default tamaguiConfig;
