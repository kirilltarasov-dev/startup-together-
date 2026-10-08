# Saved English dialogue

Sergio: `es-CO-GonzaloNeural`; Kirill: `ru-RU-DmitryNeural`.
The user approved the voices and generated recordings by listening on October 8.
The manifest contains 86 Sergio and 91 Kirill English lines. All source audio
hashes, non-silent PCM and byte-identical dist copies were verified. This is user
acceptance, not a blinded accent evaluation. Deployment remains pending.

In the existing ignored `apps/game/.env.local`, add your **Speech resource**
settings from Azure Portal → resource → Keys and Endpoint:

```dotenv
AZURE_SPEECH_KEY=your-speech-resource-key
AZURE_SPEECH_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
```

Do not replace the existing GPT-Live settings. Its OpenAI key is not implicitly
a Speech key. Neither new setting is VITE-prefixed or sent to the game browser.
Alternatively, AZURE_SPEECH_REGION selects the documented regional TTS endpoint.
The custom resource root uses `/tts/cognitiveservices/v1` for synthesis.

From `apps/game`, inspect the plan (no API call):

```sh
node .devin/scripted-voices/generate.mjs --character sergio
```

Save one real English game line first:

```sh
HTTPS_PROXY=http://proxy.muc:8080 HTTP_PROXY=http://proxy.muc:8080 \
node --use-env-proxy .devin/scripted-voices/generate.mjs --character sergio --limit 1 --execute
```

The printed `public/assets/voices/sergio-<hash>.wav` file is the actual audio to
open and listen to. To save the remaining Sergio lines, repeat without `--limit 1`.
Use `--character kirill` for Dmitry. Existing verified files are skipped.
Use the proxy variables only on the corporate network where that proxy is configured.

The generator reads the original skit and full campaign, including variants,
choices and optional conversations. It sends exact English text with the selected
voice's native locale and default rate/pitch/style. No translation or respelling.
Output is 24 kHz, 16-bit mono WAV (~48 KB per second), chosen for lossless auditable
PCM and direct browser playback without extra encoders. The manifest records text,
voice, format, content hash, timestamp, duration, peak and RMS. One request at a
time; first error stops; no automatic retries. Do not run concurrent generators.

After generation, `npm run build` includes the manifest and copies the audio into
the Vercel static build. There are no per-player synthesis requests. Exact-text
matching prevents a changed line from playing an old recording. Uncovered or
unavailable recordings retain the original browser voice fallback. Cancellation,
mute and restart stop playback through the existing stage queue; GPT-Live stays
unchanged. Generated audio and the manifest must be committed together when release
is authorized. A fresh production build and browser listening are required.

Focused verification:

```sh
node --test recordedSpeech.test.ts tts.test.ts .devin/scripted-voices/generate.test.mjs
```

REST contract checked against Microsoft's official documentation:
https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech
