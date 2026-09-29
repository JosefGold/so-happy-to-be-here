// Verse 1b, one continuous tracking shot along a git graph (its main line continues the skill
// tree's floor): five stations, one per line, the camera dollying to the next on each line.
//   1 "It could be worse, I could be cursed to be"          CURSED glitches
//   2 "Debugging a legacy monolith, stuck on a different timeline"  a dead branch, the monolith
//   3 "Where I never find time to optimize my stack"         a wobbling stack of the stack
//   4 "And never asked, the questions that I needed to ask"  question marks float up, unasked
//   5 "Before I let a chatbot handle every single task"      the AI ticks off every task (cobalt)
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, noise1, prog, springStep } from '../engine/util';
import { measure, plain } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { TYPE, col, wordAlpha, wordRow, wordState } from './_look';

const LINE_Y = 930; // the git main line (= the skill tree's floor)
const SPACING = 2100; // world px between stations
const STACK = ['react', 'redux', 'graphql', 'kafka', 'k8s', 'terraform', 'webpack', 'babel', 'lodash', 'jquery (still)', 'microservices', 'a monorepo', 'yarn', 'npm', 'pnpm', 'bun'];
const TASKS = ['write the code', 'review the code', 'write the tests', 'fix the tests', 'name the variables', 'talk to users', 'estimate it', 'design the system', 'write the docs', 'deploy on friday', 'fix prod', 'decide', 'think'];

export default class Timeline extends Scene {
  layer = new Layer2D();
  lines: Line[] = [];

  override init() {
    const ly = this.ctx.lyrics;
    this.lines = ['It could be worse', 'Debugging a legacy monolith', 'optimize my stack', 'never asked', 'Before I let a chatbot'].map((q) => ly.get(q));
  }

  /** Camera x (world px): holds on a station until its line's last word has landed, then a quick
   *  whip-pan to the next on that line's first word (the lines here are back to back, so a slow dolly
   *  would cut off CURSED TO BE / TIMELINE / MY STACK). */
  private camX(t: number) {
    let x = 0;
    this.lines.forEach((l, i) => { if (i > 0) x += SPACING * ease.inOutCubic(prog(t, l.start - 0.06, l.start + 0.3)); });
    return x;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, c = this.layer.ctx;
    this.layer.clear(col('ink'));
    const cam = this.camX(t);
    c.save();
    c.translate(-cam, 0);
    this.graph(c, t, cam);
    this.lines.forEach((l, i) => {
      const sx = i * SPACING;
      if (Math.abs(sx - cam) > W * 1.3) return;
      [this.s1, this.s2, this.s3, this.s4, this.s5][i]!.call(this, c, t, l, sx, f);
    });
    c.restore();
    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    return { bloom: 0.5, bloomThreshold: 0.95, vignette: 0.42, grain: 0.055, zoom: 1 + f.a.kick * 0.008 };
  }

  /** The git graph: the main line with commit dots (amber), the dead branch of station 2. */
  private graph(c: CanvasRenderingContext2D, t: number, cam: number) {
    c.fillStyle = col('graphite');
    c.fillRect(cam - 100, LINE_Y - 1, W + 200, 2);
    const x0 = Math.floor((cam - 100) / 160) * 160;
    for (let x = x0; x < cam + W + 100; x += 160) {
      const lit = x < cam + W * 0.35;
      c.fillStyle = col(lit ? 'ember' : 'graphite');
      c.beginPath(); c.arc(x, LINE_Y, 6, 0, Math.PI * 2); c.fill();
      if (hash(x, 2) > 0.7) {
        c.font = TYPE.ai(12, 500);
        c.fillStyle = col('ash', 0.6);
        c.textAlign = 'center';
        c.fillText(Math.floor(hash(x, 3) * 0xfffffff).toString(16).slice(0, 7), x, LINE_Y + 28);
      }
    }
    // the dead branch: leaves the main line before station 2, drops to a lower lane, ends under the monolith
    const bx = SPACING - 500, ex = SPACING + 1495, by = LINE_Y + 90;
    c.strokeStyle = col('graphite');
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(bx, LINE_Y);
    c.bezierCurveTo(bx + 150, LINE_Y, bx + 150, by, bx + 300, by);
    c.lineTo(ex, by);
    c.stroke();
    for (let x = bx + 360; x < ex; x += 160) { c.fillStyle = col('ash', 0.8); c.beginPath(); c.arc(x, by, 5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = col('error');
    c.beginPath(); c.arc(ex, by, 8, 0, Math.PI * 2); c.fill();
    void t;
  }

  // 1: IT COULD BE WORSE, / I COULD BE CURSED TO BE
  private s1(c: CanvasRenderingContext2D, t: number, l: Line, sx: number) {
    const ws = l.words;
    wordRow(c, ws.slice(0, 4), t, sx + 132, 420, 150, { width: 75, weight: 900, gap: 0.2 });
    const cursed = ws.find((w) => /cursed/i.test(w.w))!;
    const ci = ws.indexOf(cursed);
    let x = sx + 132 + wordRow(c, ws.slice(4, ci), t, sx + 132, 640, 110, { width: 75, weight: 900, gap: 0.2 }) + 22;
    // CURSED: sliced and offset, cobalt / error ghosts, jittering on frame steps
    const s = wordState(cursed, t);
    const size = 110, fam = TYPE.humanFamily(75, 900), label = 'CURSED';
    const cw = measure(label, fam, size);
    c.font = TYPE.human(size, 75, 900);
    if (s.sung) {
      const fi = Math.floor(t * 24);
      for (let k = 0; k < 6; k++) {
        const y0 = 640 - size * 0.8 + (k * size * 0.8) / 6, hh = size * 0.8 / 6 + 1;
        const dx = (hash(fi, k) - 0.5) * 36 * (hash(fi, k + 9) > 0.55 ? 1 : 0.1);
        c.save();
        c.beginPath(); c.rect(x - 40, y0, cw + 80, hh); c.clip();
        c.fillStyle = col('cobalt', 0.8); c.fillText(label, x + dx - 6, 640);
        c.fillStyle = col('error', 0.8); c.fillText(label, x + dx + 6, 640);
        c.fillStyle = col('bone'); c.fillText(label, x + dx, 640);
        c.restore();
      }
    } else {
      c.fillStyle = col('bone', wordAlpha(cursed, t));
      c.fillText(label, x, 640);
    }
    x += cw + 22;
    wordRow(c, ws.slice(ci + 1), t, x, 640, 110, { width: 75, weight: 900, gap: 0.2 });
  }

  // 2: the monolith on the dead branch
  private s2(c: CanvasRenderingContext2D, t: number, l: Line, sx: number) {
    const ws = l.words;
    const stuck = ws.findIndex((w) => /stuck/i.test(w.w));
    wordRow(c, ws.slice(0, 1), t, sx + 132, 300, 80, { width: 100, weight: 800 });
    wordRow(c, ws.slice(1, stuck), t, sx + 132, 430, 130, { width: 75, weight: 900, gap: 0.2 });
    wordRow(c, ws.slice(stuck), t, sx + 132, 560, 64);
    // the monolith: a black slab with a cobalt rim (the screen-glow of its logs), rising on "monolith"
    const mono = ws.find((w) => /monolith/i.test(w.w))!;
    const rise = ease.outCubic(prog(t, mono.start - 0.1, mono.start + 0.6));
    const mx = sx + 1380, mw = 230, /* its base sits on the dead branch's last commit */ mh = 560 * rise, base = LINE_Y + 90;
    c.fillStyle = col('cobalt', 0.9);
    c.fillRect(mx - 3, base - mh - 3, mw + 6, mh + 3);
    c.fillStyle = col('ink2');
    c.fillRect(mx, base - mh, mw, mh);
    if (rise > 0.8) {
      c.save();
      c.translate(mx + mw / 2, base - mh / 2);
      c.rotate(-Math.PI / 2);
      c.font = TYPE.ai(22, 600);
      c.textAlign = 'center';
      c.fillStyle = col('steel', 0.8);
      c.fillText('legacy/monolith.c  ·  412,337 LOC  ·  © 2009', 0, 8);
      c.restore();
    }
    // the branch chip
    const tl = ws.find((w) => /timeline/i.test(w.w))!;
    if (t >= tl.start - 0.1) {
      const k = clamp((t - tl.start + 0.1) / 0.3);
      c.globalAlpha = k;
      const bx = sx + 1340, by = LINE_Y + 90;
      const txt = 'branch: different-timeline  ·  stale 16y  ·  1,204 behind main';
      c.font = TYPE.ai(17, 500);
      const tw = c.measureText(txt).width + 30;
      c.fillStyle = col('ink2'); c.fillRect(bx - tw, by + 22, tw, 34);
      c.strokeStyle = col('error'); c.lineWidth = 1.5; c.strokeRect(bx - tw + 0.5, by + 22.5, tw - 1, 33);
      c.fillStyle = col('error'); c.textAlign = 'left'; c.fillText(txt, bx - tw + 15, by + 45);
      c.globalAlpha = 1;
    }
  }

  // 3: the stack, wobbling
  private s3(c: CanvasRenderingContext2D, t: number, l: Line, sx: number, f: Frame) {
    const ws = l.words;
    const opt = ws.findIndex((w) => /optimize/i.test(w.w));
    const grow = prog(t, l.start, l.end + 0.6);
    const n = Math.floor(3 + grow * (STACK.length - 3));
    const cx = sx + 1650; // (clear of MY STACK)
    let y = LINE_Y;
    for (let i = 0; i < n; i++) {
      const wob = (noise1(t * 1.3 + i * 0.4, 2) * 10 + Math.sin(f.beat * Math.PI) * 4) * (i / 6);
      const bw = 300 - (i % 3) * 40 + hash(i, 1) * 40, bh = 46;
      const drop = (1 - springStep(Math.max(0, (grow * (STACK.length - 3) + 3 - i) * 0.25), 3, 0.5)) * -60;
      y -= bh;
      c.save();
      c.translate(cx + wob * i * 0.6, y + drop);
      c.rotate(wob * 0.004);
      c.fillStyle = col(i % 4 === 3 ? 'signal' : 'bone');
      c.fillRect(-bw / 2, 0, bw, bh - 4);
      c.fillStyle = col('ink');
      c.font = TYPE.ai(20, 600);
      c.textAlign = 'center';
      c.fillText(STACK[i]!, 0, bh / 2 + 4);
      c.restore();
    }
    // the line, over the stack
    wordRow(c, ws.slice(0, opt), t, sx + 132, 360, 88, { width: 100, weight: 800 });
    wordRow(c, ws.slice(opt), t, sx + 124, 520, 150, { width: 75, weight: 900, gap: 0.2, color: (w) => (/stack/i.test(w.w) ? 'signal' : 'bone') });
  }

  // 4: questions, never asked, floating away
  private s4(c: CanvasRenderingContext2D, t: number, l: Line, sx: number) {
    const ws = l.words;
    const the = ws.findIndex((w) => /^the$/i.test(w.w));
    wordRow(c, ws.slice(0, the), t, sx + 132, 360, 120, { width: 75, weight: 900, gap: 0.2 });
    wordRow(c, ws.slice(the), t, sx + 132, 480, 72);
    const k = prog(t, l.start - 0.2, l.end + 1);
    for (let i = 0; i < 26; i++) {
      const born = hash(i, 1) * 0.8;
      const life = clamp((k - born) / 0.6);
      if (life <= 0) continue;
      const x = sx + 1150 + hash(i, 2) * 650 + Math.sin(t * 1.5 + i) * 20;
      const y = LINE_Y - 40 - life * (500 + hash(i, 3) * 400);
      const size = 40 + hash(i, 4) * 120;
      c.font = TYPE.third(size, 600);
      c.fillStyle = col(hash(i, 5) > 0.8 ? 'ember' : 'bone', (1 - life) * 0.9);
      c.textAlign = 'center';
      c.fillText('?', x, y);
    }
    c.font = TYPE.ai(16, 500);
    c.textAlign = 'left';
    c.fillStyle = col('steel', 0.7);
    c.fillText('QUESTIONS ASKED: 0  ·  QUESTIONS NEEDED: ∞', sx + 136, 540);
  }

  // 5: the AI ticks off every task
  private s5(c: CanvasRenderingContext2D, t: number, l: Line, sx: number) {
    const ws = l.words;
    const every = ws.findIndex((w) => /every/i.test(w.w));
    const chat = ws.findIndex((w) => /chatbot/i.test(w.w));
    wordRow(c, ws.slice(0, chat), t, sx + 132, 300, 72, { width: 100, weight: 800 });
    wordRow(c, ws.slice(chat, every), t, sx + 132, 400, 72, { width: 100, weight: 800, color: (w) => (/chatbot/i.test(w.w) ? 'cobaltText' : 'bone') });
    wordRow(c, ws.slice(every, every + 2), t, sx + 124, 580, 150, { width: 75, weight: 900, gap: 0.2 });
    wordRow(c, ws.slice(every + 2), t, sx + 124, 740, 150, { width: 75, weight: 900, gap: 0.2 });
    // the checklist: ticks accelerate (each next tick sooner), in the AI's cobalt
    const x = sx + 1260, y0 = 150;
    const start = l.start + 0.3;
    let tt = start, dt = 0.6;
    TASKS.forEach((task, i) => {
      const y = y0 + i * 56;
      const ticked = t >= tt;
      const k = clamp((t - tt) / 0.12);
      c.strokeStyle = col(ticked ? 'cobalt' : 'graphite');
      c.lineWidth = 2;
      c.strokeRect(x, y - 22, 28, 28);
      if (ticked) {
        c.strokeStyle = col('cobaltText');
        c.lineWidth = 4;
        c.beginPath(); c.moveTo(x + 5, y - 8); c.lineTo(x + 12, y - 1 - 0 * k); c.lineTo(x + 12 + 12 * k, y - 18 * k); c.stroke();
      }
      c.font = TYPE.ai(26, 400);
      c.fillStyle = col(ticked ? 'cobaltText' : 'bone', ticked ? 0.55 : 0.9);
      c.textAlign = 'left';
      c.fillText(task, x + 48, y);
      if (ticked) { c.fillStyle = col('cobaltText', 0.55); c.fillRect(x + 48, y - 9, measure(task, TYPE.aiFamily(400), 26) * k, 2); }
      tt += dt; dt *= 0.8;
    });
    const all = t >= tt;
    c.font = TYPE.ai(22, 600);
    c.fillStyle = col(all ? 'cobalt' : 'graphite');
    c.fillText(all ? 'ALL TASKS COMPLETE  ✓  (0 by you)' : `${TASKS.filter((_, i) => t >= start + 0.6 * (1 - Math.pow(0.8, i)) / 0.2).length} / ${TASKS.length}`, x, y0 + TASKS.length * 56 + 20);
    void plain; void wordState;
  }
}
