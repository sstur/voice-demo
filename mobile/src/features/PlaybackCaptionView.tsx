import type { MutableRefObject } from 'react';
import { useEffect, useState } from 'react';
import { Paragraph } from 'tamagui';

import type { Caption } from './types';

export function PlaybackCaptionView(props: {
  captionsRef: MutableRefObject<Array<Caption>>;
  playbackStartTimeRef: MutableRefObject<number | null>;
}) {
  const { captionsRef, playbackStartTimeRef } = props;
  const [currentCaption, setCurrentCaption] = useState<Caption | null>(null);

  useEffect(() => {
    const mountedAt = Date.now();
    const intervalId = setInterval(() => {
      const playbackStartTime = playbackStartTimeRef.current ?? mountedAt;
      const offset = (time: number) => time + playbackStartTime;

      const now = Date.now();
      const captions = captionsRef.current;
      setCurrentCaption((currentCaption) => {
        if (currentCaption && now < offset(currentCaption.endTime)) {
          // Current caption is still valid
          return currentCaption;
        }
        let mostRecentCaption: Caption | null = null;
        for (const caption of captions) {
          if (
            offset(caption.startTime) <= now &&
            offset(caption.endTime) >= now
          ) {
            return caption;
          }
          if (offset(caption.endTime) < now) {
            mostRecentCaption = caption;
          }
        }
        return mostRecentCaption;
      });
    }, 30);
    return () => {
      clearInterval(intervalId);
    };
  }, [captionsRef, playbackStartTimeRef]);

  return (
    <Paragraph fontSize="$8" textAlign="center">
      {currentCaption?.text ?? ''}
    </Paragraph>
  );
}
