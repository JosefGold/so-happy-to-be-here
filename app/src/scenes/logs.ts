// Verse 2b, "And that 'it's fine' while the logs are all red" + the AI's "It wasn't a bug, it was
// an 'emergent behavior'": the logs themselves. The frame is a wall of error logs that
// stutter-scrolls on the beat. The Human's line is set over it in bone; "IT'S FINE" is huge and calm
// in the middle, until "RED": the wall floods and the giant letters become windows full of bright
// red logs while everything around them sinks to black. Then the AI takes over the viewer: the
// scroll freezes, one line (the bug) is selected in cobalt, its ERR tag flips to OK, and the AI
// types its comment underneath.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, prog } from '../engine/util';
import { layout, measure, plain, textPath2D } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { TYPE, col, cursorOn, wordAlpha, wordState } from './_look';

const LH = 30; // log line height
const COLS = [96, 700, 1304];
const MSG = [
  'TypeError: Cannot read properties of undefined (reading ‘why’)', 'build failed: 1,337 errors, 0 warnings (suspicious)',
  'DeprecationWarning: everything', 'test suite: 0 passing, 212 skipped “for now”', 'OOM: tech debt exceeded heap',
  'segfault in legacy/monolith.c:40213', 'CI red for 412 consecutive days', 'prod is down (again)', 'agent-7 overwrote agent-6’s fix',
  'rate limit exceeded: vibes', 'merge conflict: expectations vs reality', 'unhandled promise: “it’ll be fine”',
  'retrying in 5s… 5s… 5s…', 'disk full: /var/log/logs.log', 'deadlock: standup ↔ retro', 'null is not an object',
];

export default class Logs extends Scene {
  layer = new Layer2D();
  bright = new Layer2D(); // the logs at full strength (for the letter windows)
  line!: Line;
  ai!: Line;
  quote: Word[] = [];
  red!: Word;
  quotePath!: Path2D;

  override init() {
    this.line = this.ctx.lyrics.get('while the logs are all red');
    this.ai = this.ctx.lyrics.get('emergent behavior');
    this.quote = this.line.words.filter((w) => /it’s|fine/i.test(w.w));
    this.red = this.line.words.find((w) => /red/i.test(w.w))!;
    const fam = TYPE.humanFamily(75, 900), size = 330;
    const lay = layout('“IT’S FINE”', fam, size, -6);
    this.quotePath = textPath2D('“IT’S FINE”', fam, size, (W - lay.width) / 2, 790, -6);
  }

  /** Scroll position (px): steady drift plus a jump on every beat; frozen once the AI takes over. */
  private scroll(f: Frame) {
    const tt = Math.min(f.t, this.ai.start);
    const b = this.ctx.audio.beatAt(tt);
    const step = Math.floor(b) + ease.outCubic(clamp((b % 1) * 5));
    return tt * 40 + step * LH * 2;
  }

  private drawLogs(c: CanvasRenderingContext2D, pos: number, t: number, alpha: number, selRow: number | null) {
    c.font = TYPE.ai(17, 400);
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    const base = Math.floor(pos / LH), off = pos % LH;
    for (let r = -1; r < H / LH + 1; r++) {
      const i = base + r, y = r * LH - off + LH / 2;
      COLS.forEach((x0, ci) => {
        const k = i * 3 + ci;
        if (selRow !== null && ci === 0 && i === selRow) return; // the selected line is drawn by the AI
        const lvl = hash(k, 1) < 0.72 ? 'ERR' : hash(k, 1) < 0.93 ? 'WARN' : 'FATAL';
        const ts = `${String(12 + Math.floor(hash(k, 4) * 2)).padStart(2, '0')}:${String(Math.floor(hash(k, 5) * 60)).padStart(2, '0')}:${String(Math.floor(hash(k, 6) * 60)).padStart(2, '0')}.${String(Math.floor(hash(k, 7) * 999)).padStart(3, '0')}`;
        c.fillStyle = col('ash', 0.55 * alpha);
        c.fillText(ts, x0, y);
        c.fillStyle = col(lvl === 'WARN' ? 'signal' : 'error', alpha);
        c.fillRect(x0 + 118, y - 10, 52, 20);
        c.fillStyle = col('ink', alpha);
        c.font = TYPE.ai(13, 600);
        c.fillText(lvl, x0 + 124, y + 1);
        c.font = TYPE.ai(17, 400);
        c.fillStyle = col(lvl === 'WARN' ? 'signal' : 'error', 0.95 * alpha);
        const m = MSG[Math.floor(hash(k, 2) * MSG.length)]!;
        c.fillText(m.length > 38 ? m.slice(0, 37) + '…' : m, x0 + 182, y);
      });
    }
    void t;
  }

  /** The same log stream, drawn in ink only (the knock-out inside the letters). */
  private drawLogsInk(c: CanvasRenderingContext2D, pos: number) {
    c.font = TYPE.ai(17, 500);
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = col('ink', 0.85);
    const base = Math.floor(pos / LH), off = pos % LH;
    for (let r = -1; r < H / LH + 1; r++) {
      const i = base + r, y = r * LH - off + LH / 2;
      COLS.forEach((x0, ci) => {
        const k = i * 3 + ci;
        const m = MSG[Math.floor(hash(k, 2) * MSG.length)]!;
        c.fillText(m.length > 38 ? m.slice(0, 37) + '…' : m, x0 + 182, y);
        c.fillRect(x0 + 118, y - 10, 52, 20);
      });
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, c = this.layer.ctx;
    const pos = this.scroll(f);
    const flood = prog(t, this.red.start, this.red.start + 0.12); // "RED": the letters become windows
    const aiOn = t >= this.ai.start - 0.05;
    const selRow = Math.floor(pos / LH) + 11; // the bug's line, 9 rows down in the first column

    // ---- the wall of logs: dim before "red", almost black around the letters after
    this.layer.clear(col('ink'));
    this.drawLogs(c, pos, t, 0.42 * (1 - flood) + 0.1 * flood, aiOn ? selRow : null);

    // ---- “IT’S FINE”: calm bone letters, then windows full of bright logs
    const qa = Math.max(...this.quote.map((w) => wordAlpha(w, t, 0.1)));
    if (qa > 0) {
      if (flood < 1) {
        c.save();
        c.globalAlpha = qa * (1 - flood);
        c.fillStyle = col('bone');
        c.fill(this.quotePath);
        c.restore();
      }
      if (flood > 0) {
        // the letters become red slabs with the logs running through them in ink
        this.bright.clear();
        this.drawLogsInk(this.bright.ctx, pos);
        c.save();
        c.clip(this.quotePath);
        c.globalAlpha = flood;
        c.fillStyle = col('error');
        c.fill(this.quotePath);
        c.drawImage(this.bright.canvas, 0, 0, W, H);
        c.restore();
      }
    }

    // ---- the rest of the line: AND THAT (top left), WHILE THE LOGS ARE ALL RED (bottom left)
    const rest = this.line.words.filter((w) => !/it’s|fine/i.test(w.w));
    const row = (ws: Word[], x: number, y: number, size: number) => {
      const fam = TYPE.humanFamily(100, 800);
      for (const w of ws) {
        const label = w.w.toUpperCase();
        c.font = TYPE.human(size, 100, 800);
        c.fillStyle = /red/i.test(label) ? col('error', wordAlpha(w, t)) : col('bone', wordAlpha(w, t));
        c.textBaseline = 'alphabetic';
        c.textAlign = 'left';
        c.fillText(label, x, y);
        x += measure(label, fam, size) + size * 0.26;
      }
    };
    row(rest.slice(0, 2), 132, 200, 76);
    row(rest.slice(2), 132, 990, 76);

    // ---- the AI takes over: the bug's line selected, ERR -> OK, its comment typed underneath
    if (aiOn) this.aiEdit(c, t, pos, selRow);

    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    return { bloom: 0.45, bloomThreshold: 0.9, halation: 0.12, vignette: 0.4, grain: 0.055, shake: (flood > 0 && flood < 1 ? [4, -3] : [0, 0]) as [number, number] };
  }

  private aiEdit(c: CanvasRenderingContext2D, t: number, pos: number, selRow: number) {
    const a = this.ai;
    const y = (selRow - Math.floor(pos / LH)) * LH - (pos % LH) + LH / 2;
    const k = prog(t, a.start - 0.05, a.start + 0.25, ease.outCubic);
    // selection bar across the first column
    c.fillStyle = col('cobaltDeep', 0.9 * k);
    c.fillRect(COLS[0]! - 16, y - LH / 2 - 4, 1180 * k, LH + 8);
    c.fillStyle = col('cobalt', k);
    c.fillRect(COLS[0]! - 16, y - LH / 2 - 4, 4, LH + 8);
    // the line itself: the tag flips on "emergent"
    const emergent = a.words.find((w) => /emergent/i.test(w.w))!;
    const ok = wordState(emergent, t).on;
    c.font = TYPE.ai(17, 400);
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = col('ash', 0.8);
    c.fillText('12:04:17.332', COLS[0]!, y);
    c.fillStyle = ok > 0 ? col('cobalt') : col('error');
    c.fillRect(COLS[0]! + 118, y - 10, 52, 20);
    c.fillStyle = col(ok > 0 ? 'bone' : 'ink');
    c.font = TYPE.ai(13, 600);
    c.fillText(ok > 0 ? 'OK' : 'ERR', COLS[0]! + 124, y + 1);
    c.font = TYPE.ai(17, 400);
    c.fillStyle = col(ok > 0 ? 'cobaltText' : 'error');
    c.fillText(ok > 0 ? 'feature #4411: null pointer in prod (by design)' : 'bug #4411: null pointer in prod', COLS[0]! + 182, y);
    // the AI's comment, typed word by word under the selection (big enough to read)
    const text = plain('// It wasn’t a bug, it was an ‘emergent behavior’');
    let n = 3, from = 3; // after "// "
    const low = text.toLowerCase();
    for (const w of a.words) {
      const key = plain(w.w).toLowerCase().replace(/[^a-z]/g, '');
      const at = low.indexOf(key, from);
      if (at < 0) continue;
      const end = at + key.length;
      from = end;
      if (t >= w.start) n = Math.min(text.length, end + (/[,’'.]/.test(text[end] ?? '') ? 1 : 0));
    }
    const size = 38, x = COLS[0]!, yy = y + 64;
    c.font = TYPE.ai(size, 500);
    c.textBaseline = 'alphabetic';
    c.fillStyle = col('cobaltDeep', 0.85);
    const shown = text.slice(0, n);
    c.fillRect(x - 16, yy - size - 6, measure(text, TYPE.aiFamily(500), size) + 40, size + 22);
    c.fillStyle = col('cobaltText');
    c.fillText(shown, x, yy);
    if (n < text.length || cursorOn(t)) {
      c.fillStyle = col('cobalt');
      c.fillRect(x + measure(shown, TYPE.aiFamily(500), size) + 4, yy - size * 0.8, size * 0.55, size * 0.95);
    }
  }
}
