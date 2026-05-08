# Short tutorial narration audio

Drop one MP3 per slide per language. Filename = slide index (zero-padded
to 2 digits) + language suffix:

```
01-es.mp3   01-en.mp3
02-es.mp3   02-en.mp3
...
07-es.mp3   07-en.mp3
```

Slide order matches the `SLIDES` array in `tutorial-short.html`.

If a file is missing, the player falls back to browser TTS reading the
slide's `text` field. You can roll out audio slide-by-slide with no
code change — the player just looks for the file and plays it if found.
