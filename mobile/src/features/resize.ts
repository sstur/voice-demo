import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { ImageResult } from './types';

export async function resize(
  image: { uri: string; width: number; height: number },
  options: { maxSize: number; quality: number },
): Promise<ImageResult> {
  const { maxSize, quality } = options;
  const aspectRatio = image.width / image.height;
  const newSize = { width: image.width, height: image.height };
  if (image.width > image.height) {
    newSize.width = Math.min(image.width, maxSize);
    newSize.height = newSize.width / aspectRatio;
  } else {
    newSize.height = Math.min(image.height, maxSize);
    newSize.width = newSize.height * aspectRatio;
  }
  const result = await manipulateAsync(
    image.uri,
    [{ resize: { width: newSize.width, height: newSize.height } }],
    { compress: quality, base64: true, format: SaveFormat.JPEG },
  );
  return {
    ...result,
    base64: result.base64 ?? '',
  };
}
