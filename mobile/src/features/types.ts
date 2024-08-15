export type ImageResult = {
  width: number;
  height: number;
  uri: string;
  base64: string;
};

export type ConversationMessage = {
  role: 'USER' | 'ASSISTANT';
  content: string;
};

export type Caption = {
  text: string;
  startTime: number;
  endTime: number;
};
