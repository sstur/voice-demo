import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Linking, Pressable } from 'react-native';
import { RefreshCw } from '@tamagui/lucide-icons';
import type { CameraCapturedPicture, CameraType } from 'expo-camera';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { sleep } from '../support/sleep';

type CameraState =
  | { name: 'IDLE' }
  | { name: 'RECORDING'; abortController: AbortController };

type RootState =
  | { name: 'INITIALIZING' }
  | { name: 'READY'; camera: CameraView; cameraState: CameraState }
  | { name: 'ERROR'; message: string };

export function VisionView(props: {
  onPhoto: (photo: CameraCapturedPicture) => void;
  style?: StyleProp<ViewStyle> | undefined;
}) {
  const { onPhoto, style } = props;
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const safeAreaInsets = useSafeAreaInsets();
  const [state, setState] = useState<RootState>({ name: 'INITIALIZING' });

  const [abortController] = useState(() => new AbortController());
  useEffect(() => {
    return () => abortController.abort();
  }, [abortController]);

  if (!permission) {
    return (
      <YStack flex={1} jc="center" ai="center">
        <Spinner />
      </YStack>
    );
  }

  if (!permission.granted) {
    return (
      <YStack flex={1} jc="center" ai="center">
        <Text textAlign="center">{t('Camera requires permission.')}</Text>
        {permission.canAskAgain ? (
          <Button onPress={requestPermission}>{t('Show Camera')}</Button>
        ) : (
          <Button onPress={() => Linking.openSettings()}>
            {t('Settings')}
          </Button>
        )}
      </YStack>
    );
  }

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
  const [pictureSize, setPictureSize] = useState<string | undefined>();
  const cameraRef = useRef<CameraView>(null);
  return (
    <CameraView
      ref={cameraRef}
      facing={facing}
      mode="picture"
      pictureSize={pictureSize}
      animateShutter={false}
      mute={true}
      onCameraReady={() => {
        const camera = cameraRef.current;
        if (camera) {
          camera
            .getAvailablePictureSizesAsync()
            .then((pictureSizes) => {
              const size = getSize(new Set(pictureSizes), [
                // '1280x720',
                '640x480',
                'Medium',
              ]);
              if (size === null) {
                // eslint-disable-next-line no-console
                console.warn(
                  'Error: No suitable size found in list of available sizes:',
                  pictureSizes,
                );
                return;
              }
              setPictureSize(size);
            })
            .catch((error: unknown) => {
              // eslint-disable-next-line no-console
              console.warn(
                'Error: Unable to get available picture sizes;',
                error,
              );
            })
            .finally(() => {
              onReady(camera);
            });
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
  onPhoto: (photo: CameraCapturedPicture) => void,
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

function takePicture(camera: CameraView): Promise<CameraCapturedPicture> {
  return new Promise((resolve, reject) => {
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
}

function getSize(availableSizes: Set<string>, desiredSizes: Array<string>) {
  for (const size of desiredSizes) {
    if (availableSizes.has(size)) {
      return size;
    }
  }
  return null;
}
