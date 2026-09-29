// Chunked export for big output sizes (e.g. 4K): the page normally loads every scene at once, which at
// --scale 2 means every scene's canvases and render targets at 4x the pixels (many GB). This renders the
// song in chunks, each page loading only the scenes that chunk shows (--only), joins the chunks without
// re-encoding, and muxes the audio once.
//   bun scripts/chunked.ts --scale 2 --chunk 40 --out "../out/final/x.mp4" --audio ../audio/happy.wav [video flags...]
// Any other flags (--fps, --samples, --crf, --preset, --x264, --shutter) are passed to each chunk's render.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const APP = path.resolve(import.meta.dir, '..');
const out = path.resolve(opt('out', path.join(APP, '../out/final/chunked.mp4'))!);
const audio = opt('audio');
const fps = +opt('fps', '30')!;
const chunk = +opt('chunk', '40')!;
const pass: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const k = argv[i]!.replace(/^--/, '');
  if (['out', 'audio', 'chunk', 'from', 'to'].includes(k)) { i++; continue; }
  pass.push(argv[i]!);
}

const run = async (args: string[]) => {
  const p = Bun.spawn(['bun', 'scripts/render.ts', ...args], { cwd: APP, stdout: 'pipe', stderr: 'inherit' });
  const text = await new Response(p.stdout).text();
  if ((await p.exited) !== 0) throw new Error(`render.ts ${args[0]} failed`);
  return text;
};

const info = JSON.parse((await run(['timeline'])).trim().split('\n').filter((l) => l.startsWith('{')).pop()!) as { duration: number; timeline: { id: string; start: number; end: number }[] };
const total = Math.round(info.duration * fps);
const per = Math.round(chunk * fps);
const dir = path.join(path.dirname(out), '.chunks');
mkdirSync(dir, { recursive: true });
const files: string[] = [];
for (let f0 = 0, k = 0; f0 < total; f0 += per, k++) {
  const f1 = Math.min(total, f0 + per);
  const from = f0 / fps, to = f1 / fps;
  const ids = info.timeline.filter((e) => e.end > from - 0.1 && e.start < to + 0.1).map((e) => e.id);
  const file = path.join(dir, `chunk_${String(k).padStart(2, '0')}.mp4`);
  console.log(`chunk ${k}: ${from.toFixed(2)}–${to.toFixed(2)} s  (${ids.join(', ')})`);
  await run(['video', ...pass, '--from', String(from), '--to', String(to), '--only', ids.join(','), '--noaudio', '--out', file]);
  files.push(file);
}
const list = path.join(dir, 'list.txt');
writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
const ff = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
if (audio) ff.push('-i', path.resolve(audio), '-map', '0:v', '-map', '1:a', '-af', 'apad', '-c:a', 'aac', '-b:a', '320k', '-shortest');
ff.push('-c:v', 'copy', '-movflags', '+faststart', out);
if ((await Bun.spawn(ff, { stdout: 'inherit', stderr: 'inherit' }).exited) !== 0) throw new Error('concat failed');
console.log(`wrote ${out}`);
