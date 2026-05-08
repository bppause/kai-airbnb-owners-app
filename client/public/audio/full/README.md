# Full tutorial narration audio

Drop one MP3 per slide per language. Filename = slide index (zero-padded
to 2 digits) + language suffix:

```
01-es.mp3   01-en.mp3
02-es.mp3   02-en.mp3
...
22-es.mp3   22-en.mp3
```

Slide order matches the `SLIDES` array in `tutorial-full.html`.

If a file is missing, the player falls back to browser TTS reading the
slide's `text` field. You can roll out audio slide-by-slide with no
code change — the player just looks for the file and plays it if found.

Recommended encoding: mono, 64–96 kbps MP3. Each slide narration is
typically 8–15 s, so files end up ~80–150 KB.
