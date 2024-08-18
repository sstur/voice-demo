# React Native Voice Assistant

This is a real-time voice / conversational AI assistant built with React Native and Expo. This isn't production-ready software, but it's a fully-functional demo and has been tested on iOS. Android might need some work.

## Demo

https://github.com/user-attachments/assets/b6428261-22c1-4592-98d8-8e28b43ce688

## Getting Started

Install dependencies:

```sh
pnpm install
```

Add `backend/.env` and populate it with the following API keys:

```
DEEPGRAM_KEY=""
OPENAI_KEY=""
CARTESIA_KEY=""
```

Run backend:

```sh
pnpm dev:backend
```

Run Expo dev server:

```sh
pnpm dev:mobile
```

Have fun!
