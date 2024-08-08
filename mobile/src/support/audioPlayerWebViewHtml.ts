export const audioPlayerWebViewHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    <script>
      const CHANNELS = 1;
      const SAMPLE_RATE = 16000;

      window.addEventListener('error', (event) => {
        log({ error: String(event.error) });
      });
      window.addEventListener('unhandledrejection', (event) => {
        log({ error: String(event.reason) });
      });

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();

      const audioQueue = [];
      let inputStreamFinished = false;
      let bufferedFrames = 0;
      let isPlaying = false;

      document.addEventListener('DOMContentLoaded', () => {
        send({ type: 'READY' });
      });

      window.addEventListener('message', (event) => {
        const data = JSON.parse(String(event.data));
        switch (data.type) {
          case 'LOG': {
            logToPage(data.value);
            break;
          }
          case 'AUDIO_CHUNK': {
            const chunk = fromBase64(data.value);
            enqueueAudioChunk(new Float32Array(chunk));
            break;
          }
          case 'AUDIO_DONE': {
            inputStreamFinished = true;
            break;
          }
        }
      });

      function enqueueAudioChunk(float32Array) {
        const audioBuffer = audioContext.createBuffer(
          CHANNELS,
          float32Array.length,
          SAMPLE_RATE,
        );
        audioBuffer.getChannelData(0).set(float32Array);
        audioQueue.push(audioBuffer);
        bufferedFrames += audioBuffer.length;
        if (!isPlaying) {
          playNextChunk();
        }
      }

      function playNextChunk() {
        if (audioQueue.length === 0) {
          isPlaying = false;
          if (inputStreamFinished) {
            send({ type: 'PLAYBACK_COMPLETE' });
          }
          return;
        }
        const audioBuffer = audioQueue.shift();
        bufferedFrames -= audioBuffer.length;
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.addEventListener('ended', () => {
          playNextChunk();
        });
        source.start();
        isPlaying = true;
      }

      function fromBase64(str) {
        const binaryString = atob(str);
        const bytes = Uint8Array.from(binaryString, (ch) => ch.charCodeAt(0));
        return bytes.buffer;
      }

      function send(value) {
        window.ReactNativeWebView.postMessage(JSON.stringify(value));
      }

      function log(...args) {
        send({ type: 'LOG', args });
      }

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
