// The edit: which scene plays when. Boundaries are anchored to lyric lines and snapped
// to the beat grid, so they follow the aligned data (data/lyrics.json, data/audio.json).
// Look development: only the three test scenes are placed so far (docs/TREATMENT.md).
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Cut on the last beat at/before the first word of the matching line (never after the word). */
  const cut = (q: string, nth = 0, tol = 0.02) => {
    const s = ly.get(q, nth).words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };

  /** Nearest downbeat to the end of a line. */
  const after = (q: string, nth = 0) => {
    const e = ly.get(q, nth).end;
    return au.downbeats.reduce((b, d) => (Math.abs(d - e) < Math.abs(b - e) ? d : b), au.downbeats[0] ?? e);
  };

  /** Cut exactly on a line's first word (when the beat before it would clip the previous line's last word). */
  const onWord = (q: string, nth = 0, late = 0) => ly.get(q, nth).words[0]!.start - 0.02 + late;

  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });

  // the office: the hook scene, revisited with the fire one level higher each time; the AI's colour
  // follows its arc (steel early, cobalt later)
  const office = (id: string, start: number, end: number, fire: number, ai: number, extra: Record<string, any> = {}) =>
    E(id, 'office', start, end, { params: { fire, ai, ...extra } });

  return [
    office('hook0', 0, cut('Still I know'), 0, 0, { zoom: [1.0, 1.08], pullOut: true }),
    office('hook0b', cut('I’m just happy to be here', 1), cut('I’m sure there’s'), 1, 0.2, { exterior: true }),
    office('hook1', onWord('I’m so happy', 1, 0.25), cut('Still I know', 1), 2, 0.8, { zoom: [1.0, 1.08], pullOut: true }),
    office('hook1b', cut('I’m just happy to be here', 3), after('I’m just happy to be here', 3), 3, 0.8, { exterior: true }),
    office('hook2', onWord('I’m so happy', 2, 0.25), cut('At this point'), 4, 1, { zoom: [1.0, 1.1], freeze: true, room: 140 }),
    // intro chorus, line 1: the city becomes a chart and catches fire
    E('industry', 'industry', cut('Still I know') - 0.35, cut('The tech debt')),
    // intro chorus, line 2: the Jenga tower of tech-debt words
    E('techdebt', 'techdebt', cut('The tech debt'), cut('A lot of prompts')),
    // intro chorus, line 3: the prompt waterfall; the cards become the tower's windows
    E('prompts', 'prompts', cut('A lot of prompts') - 0.3, cut('I’m just happy to be here', 1) + 0.35),
    // verse 1a: the multiverse of him (styles), the AI's review
    E('multiverse', 'multiverse', cut('I’m sure there’s') - 0.3, cut('The technical skill')),
    // verse 1a (cont.): the skill tree falls into a world of hurt; the AI deprecates the career
    E('skilltree', 'skilltree', cut('The technical skill') - 0.3, cut('It could be worse')),
    // verse 1b: one tracking shot along the git graph (continues the skill tree's floor line)
    E('timeline', 'timeline', cut('It could be worse') - 0.25, cut('And the multiple repos')),
    // bridge 1: repos archived, the mixing desk of weights, the white-out
    E('bridge1', 'bridge1', cut('And the multiple repos'), onWord('I’m so happy', 1, 0.25)), // (IS… needs every frame up to the word)
    // chorus 1: the chart, the tower and the feed again, one level hotter
    E('industry2', 'industry', cut('Still I know', 1) - 0.35, cut('The tech debt', 1), { params: { nth: 1, heat: 1 } }),
    E('techdebt2', 'techdebt', cut('The tech debt', 1), cut('A lot of prompts', 1), { params: { nth: 1, heat: 1 } }),
    E('prompts2', 'prompts', cut('A lot of prompts', 1) - 0.3, cut('I’m just happy to be here', 3) + 0.35, { params: { nth: 1, heat: 1 } }),
    // the synth/organ interlude: the rack organ; the racks part onto verse 2's corridor
    E('synth', 'synth', after('I’m just happy to be here', 3) - 0.3, cut('My laptop is a code machine') + 0.4),
    // the AI's spotlight: the thank-yous, the front row, Honestly? / Respect.
    E('spotlight', 'spotlight', cut('At this point'), cut('Now I take the time') + 1.8), // RESPECT. holds into the interlude
    // the interlude: the third voice's dreamscape
    E('interlude', 'interlude', cut('Now I take the time') + 1.2, cut('In this maze')),
    // outro A: the maze, the lens, and that's why
    E('maze', 'maze', cut('In this maze'), cut('I’m just happy that you’re here')),
    // the finale: the pull-back to a whole city of us; we're here
    E('finale', 'finale', cut('I’m just happy that you’re here'), au.duration + 2.4), // the cursor holds after the song
    // verse 2: ghost-text karaoke (the AI wrote this verse) over the ticket tunnel
    E('verse2', 'verse2', cut('My laptop is a code machine'), cut('But my model')),
    // verse 2a: the model on a trampoline; the AI's fake framework launch, evaporating
    E('trampoline', 'trampoline', cut('But my model'), cut('I just hallucinated a whole new')),
    E('vaporjs', 'vaporjs', cut('I just hallucinated a whole new'), cut('It’s getting weird') + 0.2),
    // verse 2b: the marionette, steered by a ghost
    E('ghost', 'ghost', cut('It’s getting weird'), cut('while the logs are all red')),
    // the logs themselves: "it's fine" while they're all red, then the AI edits the bug into a feature
    E('logs', 'logs', cut('while the logs are all red'), cut('And I could go')),
    // bridge 2a: the data-center aisle
    // (it runs to the word, not the beat: LAST BREATH and the headstone need every frame they can get)
    E('aisle', 'aisle', cut('And I could go') - 0.3, ly.get('And the multiple agents').words[0]!.start + 0.9), // the headstone holds, dissolving into the agents
    // bridge 2b: the recursion of simulations, the conveyor of borrowed sanity; then the white-out again
    E('agents', 'agents', ly.get('And the multiple agents').words[0]!.start - 0.02, cut('The only thing that’s clear to me', 1)),
    E('clear2', 'bridge1', cut('The only thing that’s clear to me', 1), onWord('I’m so happy', 2, 0.25), { params: { only: 'clear', nth: 1 } }), // (all three dots land first)
  ];
}
