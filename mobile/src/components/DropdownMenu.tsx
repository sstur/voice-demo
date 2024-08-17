import type { ReactNode } from 'react';
import { Paragraph, Popover, YStack } from 'tamagui';

type Item = {
  label: string;
  onClick: () => void;
};

export function DropdownMenu(props: {
  items: Array<Item | null>;
  trigger: ReactNode;
}) {
  const { trigger } = props;
  const items = props.items.filter((item): item is Item => item !== null);

  if (items.length === 0) {
    return null;
  }

  return (
    <Popover size="$5" allowFlip>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Content
        py={14}
        px={20}
        borderWidth={1}
        borderColor="$borderColor"
        enterStyle={{ y: -10, opacity: 0 }}
        exitStyle={{ y: -10, opacity: 0 }}
        elevate
        animation={[
          'quick',
          {
            opacity: {
              overshootClamping: true,
            },
          },
        ]}
      >
        <Popover.Arrow borderWidth={1} borderColor="$borderColor" />
        <YStack gap={16} minWidth={140}>
          {items.map((item, i) => {
            return (
              <Popover.Close key={i} asChild>
                <Paragraph size="$5" onPress={item.onClick}>
                  {item.label}
                </Paragraph>
              </Popover.Close>
            );
          })}
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
