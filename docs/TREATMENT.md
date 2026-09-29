# "I'm So Happy To Be Here": treatment

**One line:** a cheerful software engineer sings about being happy to be here while his office slowly catches fire and an AI keeps interrupting him. The video keeps cutting out to graphic, beat-driven scenes that act out the lyrics, and keeps coming back to the burning office. It ends with every engineer in the city, each in a lit window, while the world burns around them: the band on the *Titanic*, playing on together.

**Played:** before a conference talk, on a big screen. 16:9, and readable from the back row.

**The song:** "I'm So Happy To Be Here", 4:22, an upbeat electro-pop-rock track at 99.4 BPM (one beat is 0.604 s, one bar about 2.42 s). The happy sound against the gloomy lyrics is the song's joke, and the video tells the same joke in pictures. Lyrics, voices and the section map are in [`song/`](../song).

## The idea

It's about how confusing it is to be a software professional right now. **The Human** is happy to be here sincerely, but also *despite* everything, and maybe a little obliviously. **The AI** keeps interjecting, and he never responds. The comedy is in that one-sided conflict.

There are three voices:

- **The Human**, the main singer.
- **The AI**, a slightly distorted male voice. It has every line in parentheses and the spoken bit, except "Honestly?", which is the Human being caught out, not a reply.
- **A third voice**, a woman, who sings only the interlude. It's a voice, not a character: nobody on screen sings it, and it exists only as type.

The hook changes along the way, and so does its meaning:

1. "happy to be **here**": personal, sincere, a bit in denial.
2. "happy that **you're** here": to the audience in the room.
3. "happy that **we're** here": we're still here, not just me and the bots, and I hope it stays that way.

The tone: the world may be on fire, but he chooses optimism, and trusts that people together will make it OK.

## Look

The bar is professional motion design: restrained, graphic, and deadpan. No mascots, no emoji, no cartoon faces.

- **Two lights.** FIRE is the Human's world: warm, from below, and it grows over the song. COBALT is the AI's: cold, from above, and its screens, text, cursor and selections. They meet on edges, not in a muddy mix. How much orange is on screen is how bad things are.
- **The Human is a flat ink silhouette**, rim-lit by both lights, in the spirit of Saul Bass and the *Mad Men* titles.
- **Fire is posterized and graphic**: flat bands from a shader, with embers. Never realistic, never clip-art.
- **3D scenes are cel-shaded**: a hard three-step light ramp and constant-width ink outlines (the marionette, the data-centre aisle), or toon bands without outlines (the Jenga tower).
- **The humour is straight-faced and technical**: `@deprecated`, ARCHIVED stamps, SANITY · BORROWED · DUE: YESTERDAY, `npm i vapor.js` → 404.

### Colour

| Role | Colours |
|---|---|
| Neutrals | ink `#0B0A0A` (the warm near-black ground), bone `#EDE6DA` (paper and the Human's type), graphite `#57524E`, steel `#C2CAD6` |
| The Human's fire | blood `#C2410C`, signal `#FF9500`, ember `#FFD166` (the white-hot core is the only thing that blooms) |
| The AI | cobalt `#2F5BFF`, cobalt text `#9CB0FF` |
| Errors | error red `#E5241B`, only for logs, ERR tags and the word RED, kept separate from the fire so "the logs are all red" reads literally |

It's a grammar, not a rulebook. The default is fire against cobalt when both voices are on screen. A scene can also use a single accent against steel, move between the two, or depart on purpose where a moment needs it. The palette lives in `app/src/engine/palette.ts`.

## Typography

**Every lyric appears on screen**, and the text is part of each scene rather than subtitles on top of it. Typography is the video's main visual language: the scenes are built around the words.

| | The Human | The AI | The third voice |
|---|---|---|---|
| **Typeface** | Archivo, with width and weight as expressive axes | IBM Plex Mono, always with a block cursor | Cormorant Garamond italic |
| **Colour** | Bone, singed by the fire | Cobalt; ghost text before it's "accepted" | Soft, through the haze |
| **How words arrive** | Unsung words sit dim; each word snaps on exactly when it's sung | Typed, character by character, at the speed of the syllables | Drifts in and hangs in the air |

The text works in a few recurring ways:

- **Words as objects:** Jenga blocks, faders on a mixing desk, a skill tree, a stack, a checklist, maze walls.
- **Words on surfaces:** screens, logs, repo cards, tickets, a landing page, rack LED displays.
- **The AI editing the Human:** autocomplete ghost text, strikethrough, `@deprecated`, selections, typed comments. This is the AI's main typographic joke.
- **The hook lockup:** "I'M SO / HAPPY / TO BE HERE", set like a band logo across the office window. It comes back on every office visit, a little more singed each time. In the finale it rolls, like an odometer, from TO BE to THAT YOU'RE, and at the very end from YOU'RE to WE'RE.

Rules for a big screen:

- At most about 6–8 words on screen at once.
- Any line meant to be read has a cap height of at least about 5% of the frame. Tiny text is only for jokes you catch on a second viewing.
- A line stays for at least 0.5 s after its last word, or until the next line arrives.
- Always high contrast. No outlined or haloed type.

## Structure

- **The office is the anchor.** We come back to it on the "happy to be here" hooks, and each visit the fire is one level higher, so the office works as the song's progress bar. Most visits start inside and pull back through the window to the tower outside.
- **Everything between those visits breaks out** into its own graphic world, one per lyric idea, cut on the beat. Scene boundaries are defined by lyric lines and snapped to the beat grid (`app/src/timeline.ts`).
- **Everything moves on the beat:** kicks give bumps, snares give hits and flashes, cuts land on bars or half-bars, and hi-hats drive the small motion (flame flicker, cursor blinks, embers). The cutting gets faster where the drums get denser.
- **The AI escalates:** ghost text in the first minute; then possessed objects (the cursor riding the faders, the pointer working the puppet, the selection in the logs); then a full ASCII body under its own spotlight; and finally a single cursor, which blinks twice after the song ends and is gone.
- **The ending pulls back and doesn't cut away.** The last 45 seconds are one continuous move from his window out to the whole city.

## Scene by scene

Times are from the final edit. Each scene is one module in `app/src/scenes/`, shown in backticks.

| Time | Lyrics | Scene | What happens |
|---|---|---|---|
| 0:00–0:13 | "I'm so happy to be here…" | `office` (fire 0) | The silhouette at his desk, mug in hand, in front of a floor-to-ceiling window onto a night city. The hook lockup sets across the frame. The AI's aside ("I mean, I'm technically in a data center in North Virginia, but let's not get semantic") is typed in a hairline callout from the monitor. On the second line we pull back through the window to the tower outside. |
| 0:12–0:18 | "Still I know the industry's on fire" | `industry` | The skyline turns into data: the buildings become the bars of a chart, a line joins the rooftops, and on "fire" every rooftop catches. |
| 0:18–0:21 | "The tech debt's looking dire" | `techdebt` | A Jenga tower on a dark stage, fire from below and cobalt from above. Each sung word is a block that slides out; the tower sways more with every pull. |
| 0:21–0:27 | "A lot of prompts and 'vibes' are gonna be required but" | `prompts` | A waterfall of cobalt prompt cards slides up on the beat; VIBES wobbles like a mood. The cards fall into a grid and become the lit windows of the office tower. |
| 0:27–0:31 | "I'm just happy to be here" | `office` (fire 1) | The tower from outside. |
| 0:31–0:38 | "I'm sure there's many versions, inside this multiverse…" | `multiverse` | A wall of portals: the same man in a dozen art styles (halftone, engraving, pixel, blueprint, neon, woodcut…), each word in its own typeface. The AI autocompletes "second verse" before he sings it, and on "derivative" every tile snaps to the same style. |
| 0:38–0:47 | "The technical skill, I took decades to rehearse…" | `skilltree` | A skill tree grows node by node with a year counter, then the floor gives way into A WORLD OF HURT. The AI greys it all out and strikes CAREER with `@deprecated`. "Maybe." |
| 0:47–1:02 | "It could be worse, I could be cursed to be…" | `timeline` | One tracking shot along a git graph, whip-panning to a new station on each line: CURSED glitches; a legacy monolith on a dead branch; MY STACK wobbling; unasked questions floating up; the AI ticking off every task. |
| 1:02–1:13 | "And the multiple repos…" / "…transformer theory" / "The only thing that's clear to me is…" | `bridge1` | Repo cards branch off the git line and get stamped ARCHIVED, and INSANITY's letters come loose. A mixing desk of model weights (attn.q, lr, temperature, vibes…) follows the music, with the AI's cursor riding the faders. Then a white-out: ink on bone, perfectly still, the three dots of "Is…" landing on the beat. |
| 1:13–1:22 | "I'm so happy to be here…" | `office` (fire 2) | The AI turns cobalt: "I promise I'm not trying to take your job, I just really like refactoring." Pull back to the tower. |
| 1:22–1:37 | The chorus again | `industry`, `techdebt`, `prompts` | The same three images, one level hotter: the chart at +9,001%, the tower going over, the feed at double speed. |
| 1:37–1:40 | "I'm just happy to be here" | `office` (fire 3) | The tower from outside. |
| 1:40–1:50 | (synth and organ break) | `synth` | The servers are the band. Rack LEDs become level meters and the AI's cursor hops rack to rack on the beat. Pods autoscale onto the racks, PROD IS FINE ✓ scrolls across them as one marquee, and the cloud bill counts up with the music. In the drum build the racks overheat, then part down the middle onto the AI's cobalt light. |
| 1:50–1:57 | "My laptop is a code machine…" | `verse2` | A corridor of Jira tickets rushes past toward the laptop's silhouette. The AI wrote this verse, so every line is already there as ghost text and fills in with the Human's type as he sings it. A throughput readout counts to 60M tokens per hour. |
| 1:57–2:04 | "But my model's like a trampoline…" | `trampoline` | The model (the AI's cursor) bounces on a trampoline, one bounce per beat, between HALLUCINATING (soft, melting, misspelling itself) and SUPER-HUMAN POWERS (hard, confident, cobalt). |
| 2:04–2:09 | "I just hallucinated a whole new framework…" | `vaporjs` | A slick, entirely fake landing page: the VaporJS wordmark, `npm i vapor.js` → 404, a star counter climbing absurdly, logos of companies that don't exist. On "Don't look it up." it evaporates into steam. |
| 2:09–2:14 | "It's getting weird / I'm being steered by a ghost…" | `ghost` | The Human as a jointed wooden marionette, cel-shaded amber, hung from a real cross control that the AI's giant pointer drags. A new pose on every beat, from slack to ta-da to a shrug and a thumbs-up: it's not that bad. |
| 2:14–2:20 | "And that 'it's fine' while the logs are all red" | `logs` | A wall of error logs stutter-scrolls on the beat behind a huge, calm "IT'S FINE". On RED the letters become windows full of red logs. Then the AI takes over: the scroll freezes, it selects the bug, flips ERR to OK and types "It wasn't a bug, it was an 'emergent behavior'". |
| 2:20–2:30 | "And I could go, to the data center near my death…" | `aisle` | A dolly down a cel-shaded data-centre aisle of real rack units. LEDs fail red, the fans speed up on "laugh", and on "last breath" the lights go out bar by bar as the camera stops. At the end of the aisle, in a single spotlight: a headstone. HERE LIES A HUMAN — *he was happy to be here*. A rose, and someone left him a coffee. |
| 2:29–2:37 | "And the multiple agents… simulating us in this infinity…" | `agents` | An infinite zoom into a monitor showing the room showing the monitor, each level a simulation labelled by the agent running it. Then a conveyor of SHIPPED ✓ boxes, each with a draining SANITY gauge, and a loan slip: SANITY · BORROWED · DUE: YESTERDAY. |
| 2:37–2:39 | "The only thing that's clear to me is…" | `bridge1` | The white-out again. |
| 2:39–2:47 | "I'm so happy to be here…" | `office` (fire 4) | The room is burning. On the second line he freezes mid-sip under a loading spinner, and we cut to a close-up. |
| 2:47–3:08 | "At this point in the song, the artificial intelligence would like to thank…" | `spotlight` | A black stage. The AI stands at a podium in a body made of ASCII characters, with no face. Each thank-you (THE CONFERENCE ORGANIZERS, THE AV TEAM, THE SPONSORS) lands as a giant pixel banner under a sweeping spotlight. The camera tilts down to the front row, where one person holds a glowing phone and still wears the Human's spinner. "HONESTLY?": a hard spotlight on him. "RESPECT.": a full-frame pixel banner slams in and holds. |
| 3:07–3:27 | "Now I take the time to remind you, to find you…" | `interlude` | The third voice. RESPECT's pixels fall and land as seats: the conference hall as a seat map. A spotlight searches the rows and finds YOU ARE HERE. "Take your seat" fills the hall front to back. The camera tilts up to the stage, where the AI checks its uptime on the screen, then back down, top-down, until only your amber dot is left. |
| 3:27–3:40 | "In this maze of possibilities…" / "It's nice to look a human in the eye" | `maze` | The dot wanders a hairline maze. WHY gets lost in a dead end, and HYPE, FEAR and TOOLS chase the dot as ghosts. On "look a human in the eye" the maze irises into a camera aperture around a real eye, and the AI's viewfinder locks on (`human? 0.97`): "Or a camera lens. Whatever you've got." On "and that's why…" the lost WHY flies back. |
| 3:40–4:25 | "I'm just happy that you're here…" to the end | `finale` | We start inside his window and pull back and back, until it's a whole city of lit windows with an engineer in every one. The lockup reads THAT YOU'RE. The AI, tiny, in a file label: "I mean, I'm just an MP3 file, but you guys look great." On "lend a hand", rings of his window's light spread through the city, one per beat. The fire spreads tower by tower, the far ones first and his tower last, with his own window never burning. "Enjoy your conference talk while it still matters…" On "happy that WE'RE here" the whole city bounces on the beat. A slow fade to black; one cursor blinks twice, and is gone. |

## Assets

Everything is drawn in code except three images: a CC0 standing silhouette (the ASCII AI's body), a public-domain macro photo of an eye (the maze's aperture), and a front-facing bust (every window in the finale). Their sources and licences are in [`app/public/assets/ASSETS.md`](../app/public/assets/ASSETS.md).
