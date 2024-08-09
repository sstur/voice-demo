export const audioPlayerWebViewHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    <script>
      // @ts-check

      /** @type {Record<string, unknown>} */
      const inputParams = {};

      const CHANNELS = Number(inputParams.channels ?? 1);
      const SAMPLE_RATE = Number(inputParams.sampleRate ?? 16000);

      window.addEventListener('error', (event) => {
        log({ error: String(event.error), type: 'uncaughtException' });
      });
      window.addEventListener('unhandledrejection', (event) => {
        log({ error: String(event.reason), type: 'unhandledRejection' });
      });

      const audioContext = new AudioContext();

      /** @type {Window} */
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const parentContext = Object(window).ReactNativeWebView;

      /** @type {Array<AudioBuffer>} */
      const audioQueue = [];
      /** @type {ArrayBuffer | null} */
      let partialFrame = null;
      let inputStreamFinished = false;
      let isPlaying = false;

      document.addEventListener('DOMContentLoaded', () => {
        send({ type: 'READY' });
      });

      window.addEventListener('message', (event) => {
        const data = parseMessage(String(event.data));
        switch (data.type) {
          case 'LOG': {
            logToPage(data.value);
            break;
          }
          case 'AUDIO_CHUNK': {
            const chunk = fromBase64(String(data.value));
            enqueueAudioChunk(chunk);
            break;
          }
          case 'AUDIO_DONE': {
            inputStreamFinished = true;
            break;
          }
        }
      });

      /**
       * @param {ArrayBuffer} inputChunk
       */
      function enqueueAudioChunk(inputChunk) {
        const chunk = maybeCombine(partialFrame, inputChunk);
        const numFrames = Math.floor(chunk.byteLength / 4);
        const float32Array = new Float32Array(chunk, 0, numFrames);
        const leftoverCount = chunk.byteLength % 4;
        log({ chunkSize: chunk.byteLength, leftoverCount });
        if (leftoverCount > 0) {
          partialFrame = chunk.slice(numFrames * 4);
        } else {
          partialFrame = null;
        }
        const audioBuffer = audioContext.createBuffer(
          CHANNELS,
          float32Array.length,
          SAMPLE_RATE,
        );
        audioBuffer.getChannelData(0).set(float32Array);
        audioQueue.push(audioBuffer);
        if (!isPlaying) {
          playNextChunk();
        }
      }

      function playNextChunk() {
        const audioBuffer = audioQueue.shift();
        if (!audioBuffer) {
          isPlaying = false;
          if (inputStreamFinished) {
            send({ type: 'PLAYBACK_COMPLETE' });
          }
          return;
        }
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.addEventListener('ended', () => {
          playNextChunk();
        });
        source.start();
        isPlaying = true;
      }

      /**
       * @param {ArrayBuffer | null} leftoverPart
       * @param {ArrayBuffer} nextPart
       */
      function maybeCombine(leftoverPart, nextPart) {
        return leftoverPart === null
          ? nextPart
          : combine(leftoverPart, nextPart);
      }

      /**
       * @param {ArrayBuffer} buffer1
       * @param {ArrayBuffer} buffer2
       */
      function combine(buffer1, buffer2) {
        const combinedLength = buffer1.byteLength + buffer2.byteLength;
        const combinedBuffer = new ArrayBuffer(combinedLength);
        const view1 = new Uint8Array(buffer1);
        const view2 = new Uint8Array(buffer2);
        const combinedView = new Uint8Array(combinedBuffer);
        combinedView.set(view1, 0);
        combinedView.set(view2, view1.byteLength);
        return combinedBuffer;
      }

      /**
       * @param {string} str
       * @returns {ArrayBuffer}
       */
      function fromBase64(str) {
        const binaryString = atob(str);
        const bytes = Uint8Array.from(binaryString, (ch) => ch.charCodeAt(0));
        return bytes.buffer;
      }

      /**
       * @param {Record<string, unknown>} value
       */
      function send(value) {
        parentContext.postMessage(JSON.stringify(value));
      }

      /**
       * @param {string} input
       * @returns {unknown}
       */
      function safeParse(input) {
        try {
          return JSON.parse(input);
        } catch {
          return null;
        }
      }

      /**
       * @param {unknown} input
       * @returns {input is Record<string, unknown>}
       */
      function isObject(input) {
        return (
          input !== null && typeof input === 'object' && !Array.isArray(input)
        );
      }

      /**
       * @param {string} input
       * @returns {Record<string, unknown>}
       */
      function parseMessage(input) {
        const value = safeParse(input);
        return isObject(value) ? value : { value };
      }

      /**
       * @param {...unknown} args
       */
      function log(...args) {
        send({ type: 'LOG', args });
      }

      /**
       * @param {unknown} value
       */
      function logToPage(value) {
        const code = document.createElement('code');
        code.appendChild(document.createTextNode(String(value)));
        const pre = document.createElement('pre');
        pre.appendChild(code);
        document.body.appendChild(pre);
      }
    </script>
  </body>
</html>
`.trim();
