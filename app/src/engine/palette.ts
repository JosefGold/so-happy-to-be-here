import { hexToLinear } from './util';

// "Happy to be here": TWO LIGHTS. A warm near-black ground and bone type, lit by two
// opposing accents: FIRE (blood, signal, ember) is the Human's world and grows with the fire level;
// COBALT is the AI's cold light (screens, its text, its interruptions). Where they meet they mix.
// See docs/TREATMENT.md.
const BASE = {
  ink: '#0B0A0A', // warm near-black ground
  ink2: '#171514', // raised black
  graphite: '#57524E', // hairlines, dim type
  ash: '#958E86', // mid grey
  bone: '#EDE6DA', // paper / the Human's type
  signal: '#FF5A1F', // fire
  ember: '#FFA237', // fire core (the only thing that blooms)
  blood: '#B01F0E', // fire shadow, error red
  acid: '#D8FF3C', // unused (inherited)
  steel: '#C2CAD6', // neutral cold white (hairlines, readouts)
  cobalt: '#2F5BFF', // THE AI: its light, fields and cursor (blooms when bright)
  cobaltText: '#9CB0FF', // the AI's mono text (cobalt, lifted for legibility on ink)
  cobaltDeep: '#0B1A66', // cobalt shadow
  error: '#E5241B', // true error red: logs, ERR tags, the word RED (separate from the fire)
};
// NB: the `cobalt*` keys are "the AI's accent" whatever its hue; the `blood/signal/ember` keys are
// "the Human's fire". Candidate pairings for look development, picked with `?pal=<name>`
// (render.ts: `--pal <name>`). `amberCobalt` is the film's palette; the rest are
// kept for reference.
export const PALETTES: Record<string, Partial<typeof BASE>> = {
  cobalt: {},
  acid: { cobalt: '#C6FF1A', cobaltText: '#DDFF7A', cobaltDeep: '#223000' },
  ice: { cobalt: '#27D8FF', cobaltText: '#A6F0FF', cobaltDeep: '#03364A' },
  ultraviolet: { cobalt: '#7B4DFF', cobaltText: '#C3AEFF', cobaltDeep: '#1E0B57' },
  phosphor: { cobalt: '#1FFF8A', cobaltText: '#A8FFD0', cobaltDeep: '#033D22' },
  magenta: { cobalt: '#FF2E93', cobaltText: '#FFA3CF', cobaltDeep: '#4A0827' },
  // the Human's fire shifted to sodium amber, against ice
  sodium: { blood: '#C2410C', signal: '#FF9500', ember: '#FFD166', cobalt: '#27D8FF', cobaltText: '#A6F0FF', cobaltDeep: '#03364A' },
  // round 2: amber fire against other AI colours
  amberCobalt: { blood: '#C2410C', signal: '#FF9500', ember: '#FFD166' },
  amberViolet: { blood: '#C2410C', signal: '#FF9500', ember: '#FFD166', cobalt: '#6A5BFF', cobaltText: '#B9B2FF', cobaltDeep: '#1A1466' },
  amberTeal: { blood: '#C2410C', signal: '#FF9500', ember: '#FFD166', cobalt: '#12B5A5', cobaltText: '#8FE6DC', cobaltDeep: '#03332F' },
  amberRose: { blood: '#C2410C', signal: '#FF9500', ember: '#FFD166', cobalt: '#FF4D8D', cobaltText: '#FFB0CC', cobaltDeep: '#4D0B24' },
  amberSteel: { blood: '#C2410C', signal: '#FF9500', ember: '#FFD166', cobalt: '#C9D6E8', cobaltText: '#DDE6F2', cobaltDeep: '#1C232E' },
  honeyIce: { blood: '#9A4A00', signal: '#FFB000', ember: '#FFE08A', cobalt: '#27D8FF', cobaltText: '#A6F0FF', cobaltDeep: '#03364A' },
};
const PAL = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('pal') ?? 'amberCobalt' : 'amberCobalt';
export const HEX = { ...BASE, ...(PALETTES[PAL] ?? {}) } as const;

export type PaletteKey = keyof typeof BASE;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
