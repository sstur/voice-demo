import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import { RefreshCw } from '@tamagui/lucide-icons';
import type { CameraCapturedPicture, CameraType } from 'expo-camera';
import { CameraView } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack } from 'tamagui';

import { sleep } from '../support/sleep';
import { resize } from './resize';
import type { ImageResult } from './types';

type CameraState =
  | { name: 'IDLE' }
  | { name: 'RECORDING'; abortController: AbortController };

type RootState =
  | { name: 'INITIALIZING' }
  | { name: 'READY'; camera: CameraView; cameraState: CameraState }
  | { name: 'ERROR'; message: string };

export function VisionView(props: {
  onPhoto: (photo: ImageResult) => void;
  style?: StyleProp<ViewStyle> | undefined;
}) {
  const { onPhoto, style } = props;
  const [facing, setFacing] = useState<CameraType>('front');
  const safeAreaInsets = useSafeAreaInsets();
  const [state, setState] = useState<RootState>({ name: 'INITIALIZING' });

  const [abortController] = useState(() => new AbortController());
  useEffect(() => {
    return () => abortController.abort();
  }, [abortController]);

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <Camera
      style={style}
      facing={facing}
      onReady={(camera) => {
        if (abortController.signal.aborted) {
          return;
        }
        setState({
          name: 'READY',
          camera,
          cameraState: { name: 'RECORDING', abortController },
        });
        takePictures(camera, (photo) => onPhoto(photo), abortController).catch(
          (error: unknown) => {
            setState({ name: 'ERROR', message: String(error) });
          },
        );
      }}
    >
      {state.name === 'READY' ? (
        <>
          <View flex={1} />
          <XStack pb={safeAreaInsets.bottom} px={20} ai="center">
            <XStack flex={1} />
            <XStack flex={1} jc="flex-end">
              <IconButton onPress={toggleCameraFacing}>
                <RefreshCw />
              </IconButton>
            </XStack>
          </XStack>
        </>
      ) : null}
    </Camera>
  );
}

function Camera(props: {
  facing: CameraType;
  onReady: (camera: CameraView) => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle> | undefined;
}) {
  const { facing, onReady, ...otherProps } = props;
  const cameraRef = useRef<CameraView>(null);
  return (
    <CameraView
      ref={cameraRef}
      facing={facing}
      mode="picture"
      animateShutter={false}
      mute={true}
      onCameraReady={() => {
        const camera = cameraRef.current;
        if (camera) {
          onReady(camera);
        }
      }}
      onMountError={(event) => {
        // eslint-disable-next-line no-console
        console.warn(`Error mounting camera: ${event.message}`);
      }}
      {...otherProps}
    />
  );
}

function IconButton(props: { onPress: () => void; children: ReactNode }) {
  const { onPress, children } = props;
  return (
    <Pressable onPress={onPress}>
      <View p={10} bc="rgba(0, 0, 0, .5)" br={500}>
        {children}
      </View>
    </Pressable>
  );
}

async function takePictures(
  camera: CameraView,
  onPhoto: (photo: ImageResult) => void,
  abortController: AbortController,
) {
  const minWaitTime = 1200;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
  while (true) {
    const startTime = Date.now();
    const result = await takePicture(camera);
    if (abortController.signal.aborted) {
      return;
    }
    onPhoto(result);
    const timeElapsed = Date.now() - startTime;
    if (timeElapsed < minWaitTime) {
      await sleep(minWaitTime - timeElapsed);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (abortController.signal.aborted) {
        return;
      }
    }
  }
}

async function takePicture(camera: CameraView) {
  const result = await new Promise<CameraCapturedPicture>((resolve, reject) => {
    camera
      .takePictureAsync({
        imageType: 'jpg',
        quality: 0.8,
        fastMode: true,
        onPictureSaved: (picture) => resolve(picture),
      })
      .catch((e: unknown) => {
        reject(e instanceof Error ? e : new Error(String(e)));
      });
  });
  return await resize(result, { maxSize: 512, quality: 0.7 });
}
