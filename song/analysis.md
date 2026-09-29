# "I'm So Happy To Be Here": the song

The song's measurements, section map and lyrics notes. The figures come from librosa (tempo, loudness, section boundaries) and Whisper (timing); the word-level timings the video uses are in `data/lyrics.approx.json`.

- **Length:** 4:22.7 (262.72 s). WAV at 48 kHz, stereo.
- **Tempo:** about **99.4 BPM** and very steady (beat-to-beat spread ±13 ms). One beat is 0.604 s, one 4/4 bar about 2.42 s. The first detected beat is at 1.23 s.
- **Loudness:** builds steadily and peaks around 3:20–3:55 (interlude into outro). There are dips at about 1:15 (spoken aside) and 3:05–3:10 ("Honestly? Respect.").

## Section map
| Time | Section | Notes |
|---|---|---|
| 0:00–0:10 | Intro | "I'm so happy to be here" + the North Virginia data-center aside |
| 0:10–0:27 | Intro chorus | "industry's on fire / tech debt's looking dire" |
| 0:27–1:07 | Verse 1 | multiverse, "LLM wrote the second verse", legacy monolith, chatbot does every task; 3 spoken asides |
| 1:00–1:13 | Bridge 1 | repos deprecated, "transformer theory", "The only thing that's clear to me is…" |
| 1:13–1:20 | Hook + aside | "I promise I'm not trying to take your job" |
| 1:20–1:39 | Chorus | same as the intro chorus |
| 1:39–1:46 | Synth/organ interlude | only about 7 s |
| 1:46–2:20 | Verse 2 | code machine, Jira tickets, trampoline, VaporJS, ghost, "logs are all red", "emergent behavior" |
| 2:20–2:43 | Bridge 2 | cooling fans, agents simulating us, "borrowed sanity" |
| 2:43–2:47 | Hook | |
| 2:47–3:07 | Spoken AI bit | thanks the organizers, AV team, sponsors, and the front-row ChatGPT user. "Honestly? Respect." |
| 3:07–3:27 | Interlude | "remind you / find you" call and response ("Take your seat", "Check my uptime") |
| 3:27–3:52 | Outro A | maze of possibilities, "look a human in the eye (or a camera lens)", **"happy that *you're* here"** |
| 3:52–4:10 | Outro B | "world gone mad… a human's gonna have to lend a hand" |
| 4:10–4:22 | Tag | "Enjoy your conference talk while it still matters…" → **"happy that *we're* here"** |

The acoustic boundaries librosa found at 0:13, 0:30, 1:14, 1:20, 2:04, 3:09, 3:13, 3:17, 3:35, 3:40, 4:03 and 4:15 agree with the map above.

## The lyrics file
The original is kept as `lyrics.original.txt`. In `lyrics.txt`:
- The Cyrillic е, the hidden U+205F spaces and a trailing space were replaced.
- "to to" became "to", and "gunna" became "gonna".
- The "Spoken:" note was dropped, and "Vapor J S" became "VaporJS".
- Quotes are now curly, and ellipses are a single "…" character.
- Kept as sung: "handedly" and "North Virginia".

**Rule for on-screen text:** the words must be exactly right. Commas, periods, quotes and ellipses are mostly notes on how to sing a line, so the typography may keep, drop or restyle them as the design calls for. Section headers in [brackets] are structure only and never appear on screen. Lines in (parentheses) are the AI's voice.

## Voices
- **There are two main male voices, and it isn't a duet.** A third voice appears in the interlude.
  - **The Human** is the main singer, a software engineer type.
  - **The AI** is a slightly distorted male voice. It sings or speaks **every line in parentheses** and the spoken bit, **except** "Honestly?" in the spoken bit, which is the Human ("Respect." is the AI again).
  - **A third voice, a female human**, sings the whole **interlude (3:07–3:27)**, including "(Take your seat)". **It's a voice, not a character.** Nobody sings it on screen. The only AI line in the interlude is "(Check my uptime)". "(Will you)" isn't in the performance and has been removed from the lyrics.

What the voices mean, and how the hook changes, is in [`docs/TREATMENT.md`](../docs/TREATMENT.md).
