import type { MutableRefObject } from 'react';
import { useEffect, useState } from 'react';
import { Paragraph, YStack } from 'tamagui';

import type { Caption } from './types';

type DisplaySet = {
  prev: Caption | null;
  current: Caption | null;
};

export function PlaybackCaptionView(props: {
  captionsRef: MutableRefObject<Array<Caption>>;
  playbackStartTimeRef: MutableRefObject<number | null>;
}) {
  const { captionsRef, playbackStartTimeRef } = props;
  const [toDisplay, setToDisplay] = useState<DisplaySet>({
    prev: null,
    current: null,
  });

  useEffect(() => {
    const mountedAt = Date.now();
    const intervalId = setInterval(() => {
      const playbackStartTime = playbackStartTimeRef.current ?? mountedAt;
      const offset = (time: number) => time + playbackStartTime;

      const now = Date.now();
      const captions = captionsRef.current;
      setToDisplay((currentDisplaySet) => {
        const currentCaption = currentDisplaySet.current;
        if (currentCaption && now < offset(currentCaption.endTime)) {
          // Current display set is still valid
          return currentDisplaySet;
        }

        const i = findCurrentCaptionIndex(captions, playbackStartTime);
        return {
          prev: captions[i - 1] ?? null,
          current: captions[i] ?? null,
        };
      });
    }, 30);
    return () => {
      clearInterval(intervalId);
    };
  }, [captionsRef, playbackStartTimeRef]);

  return (
    <YStack gap={8}>
      <Paragraph
        fontSize="$8"
        textAlign="center"
        numberOfLines={1}
        opacity={0.5}
      >
        {toDisplay.prev?.text ?? ''}
      </Paragraph>
      <Paragraph fontSize="$8" textAlign="center" numberOfLines={1}>
        {toDisplay.current?.text ?? ''}
      </Paragraph>
    </YStack>
  );
}

function findCurrentCaptionIndex(
  captions: Array<Caption>,
  playbackStartTime: number,
) {
  const now = Date.now();
  const offset = (time: number) => time + playbackStartTime;
  let mostRecentCaptionIndex: number | null = null;
  for (const [i, caption] of captions.entries()) {
    if (offset(caption.endTime) < now) {
      mostRecentCaptionIndex = i;
    }
    if (now >= offset(caption.startTime) && now <= offset(caption.endTime)) {
      return i;
    }
  }
  return mostRecentCaptionIndex ?? -1;
}
