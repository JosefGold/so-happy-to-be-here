// Verse 1a (cont.), "The technical skill, I took decades to rehearse / Eventually landed me, handedly
// into a world of hurt" + the AI's "Did I just deprecate your whole career? Maybe."
// A skill tree grows from the floor node by node (amber: the Human's decades), with a year counter.
// On "handedly" the floor gives way and the whole tree drops into the pit: A WORLD OF HURT, in
// error red. Then the AI (cobalt) greys everything out and strikes CAREER with @deprecated.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, mulberry32, prog, springStep } from '../engine/util';
import { measure, plain } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { TYPE, col, cursorOn, wordAlpha, wordRow, wordState } from './_look';

const SKILLS = ['C', 'POINTERS', 'UNIX', 'VIM', 'REGEX', 'SQL', 'TCP/IP', 'BIG-O', 'OOP', 'GIT', 'GIT REBASE -i', 'JAVA', 'JS', 'CSS', 'CENTERING A DIV',
  'LINUX', 'DOCKER', 'K8S', 'DISTRIBUTED SYSTEMS', 'CAP THEOREM', 'FP', 'TYPESCRIPT', 'REACT', 'CI/CD', 'OBSERVABILITY', 'ON-CALL', 'CODE REVIEW',
  'MENTORING', 'ESTIMATES', 'LEGACY', 'MIGRATIONS', 'PERF', 'SECURITY', 'ARCHITECTURE', 'SAYING NO', 'COFFEE', 'DEBUGGING', 'READING THE DOCS'];

interface Node { x: number; y: number; depth: number; parent: number; label: string; order: number }

export default class SkillTree extends Scene {
  layer = new Layer2D();
  l1!: Line; l2!: Line; ai!: Line;
  nodes: Node[] = [];

  override init() {
    const ly = this.ctx.lyrics;
    this.l1 = ly.get('The technical skill');
    this.l2 = ly.get('world of hurt');
    this.ai = ly.get('deprecate your whole career');
    // a tidy tree: fixed counts per depth, each node's parent chosen by position
    const counts = [1, 3, 5, 7, 6, 5];
    let si = 0, prev: number[] = [];
    counts.forEach((n, d) => {
      const span = d === 0 ? 0 : Math.min(860, 150 * n);
      const cur: number[] = [];
      for (let i = 0; i < n; i++) {
        const parent = d === 0 ? -1 : prev[Math.min(prev.length - 1, Math.floor((i + 0.5) * prev.length / n))]!;
        this.nodes.push({ x: 1400 - span / 2 + (span * (i + 0.5)) / Math.max(1, n), y: 910 - d * 150, depth: d, parent, label: d === 0 ? 'HELLO WORLD' : SKILLS[si++ % SKILLS.length]!, order: this.nodes.length });
        cur.push(this.nodes.length - 1);
      }
      prev = cur;
    });
    this.nodes[0]!.x = 1400;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, c = this.layer.ctx;
    this.layer.clear(col('ink'));
    const w1 = this.l1.words, w2 = this.l2.words, wa = this.ai.words;
    const handedly = w2.find((w) => /handedly/i.test(w.w))!;
    const into = w2.find((w) => /into/i.test(w.w))!;
    const aiOn = t >= this.ai.start - 0.05;
    const grey = prog(t, this.ai.start, this.ai.start + 0.4);
    // growth: nodes light in order across line 1 (decades), the counter runs 1998 -> 2026
    const grow = prog(t, this.l1.start - 0.2, this.l1.end + 0.6, ease.inOutQuad);
    const nLit = grow * this.nodes.length;
    // the fall: from "handedly", gravity, nodes separating a little
    const fall = Math.max(0, t - handedly.start + 0.1);
    const dropY = 0.5 * 1500 * fall * fall;
    const floorGone = clamp(fall * 6);

    // the floor line, breaking in the middle on "handedly"
    c.fillStyle = col('graphite');
    const gap = floorGone * 700;
    c.fillRect(0, 930, 1400 - gap / 2, 2);
    c.fillRect(1400 + gap / 2, 930, W, 2);
    // the pit glow (the world of hurt) rising once the tree is down
    const hurt = prog(t, into.start - 0.1, this.l2.end);
    if (hurt > 0) {
      const g = c.createRadialGradient(1250, 1200, 50, 1250, 1200, 900);
      g.addColorStop(0, col('error', 0.45 * hurt * (1 - grey * 0.5)));
      g.addColorStop(1, col('error', 0));
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }

    // ---- the tree
    c.lineCap = 'round';
    for (const n of this.nodes) {
      if (n.parent < 0) continue;
      const p = this.nodes[n.parent]!;
      const k = clamp(nLit - n.order + 1);
      if (k <= 0) continue;
      const dy1 = dropY * (1 + n.depth * 0.05), dy0 = dropY * (1 + p.depth * 0.05);
      c.strokeStyle = col(grey > 0 ? 'graphite' : 'signal', 0.8 * (1 - grey * 0.5));
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(p.x, p.y + dy0);
      c.lineTo(p.x + (n.x - p.x) * k, p.y + dy0 + (n.y + dy1 - p.y - dy0) * k);
      c.stroke();
    }
    for (const n of this.nodes) {
      const k = clamp(nLit - n.order + 1);
      if (k <= 0) continue;
      const pop = springStep(Math.max(0, (nLit - n.order) * 0.12), 3, 0.5);
      const y = n.y + dropY * (1 + n.depth * 0.05);
      if (y > H + 60) continue;
      const r = (n.depth === 0 ? 12 : 8) * pop;
      c.fillStyle = col(grey > 0 ? 'graphite' : 'ember');
      c.beginPath(); c.arc(n.x, y, r, 0, Math.PI * 2); c.fill();
      c.font = TYPE.ai(n.depth === 0 ? 17 : 14, 500);
      c.textAlign = 'center';
      c.fillStyle = col(grey > 0 ? 'graphite' : 'bone', 0.85 * clamp(pop));
      const alt = n.depth > 0 && (n.order % 2 === 0);
      c.fillText(n.label, n.x, alt ? y + 30 : y - 18);
    }
    // the year counter
    const year = Math.floor(1998 + 28 * grow);
    c.textAlign = 'left';
    c.font = TYPE.human(120, 62, 800);
    c.fillStyle = col('signal', 0.9 * (1 - floorGone));
    c.fillText(String(year), 132, 250);
    c.font = TYPE.ai(15, 500);
    c.fillStyle = col('steel', 0.8 * (1 - floorGone));
    c.fillText(`SKILL POINTS ${Math.floor(nLit * 1250).toLocaleString('en-US')} · XP: DECADES`, 136, 282);

    // ---- the lyric
    if (t < this.l2.start - 0.1) {
      wordRow(c, w1.slice(0, 3), t, 124, 720, 120, { width: 62, weight: 900, gap: 0.2 });
      wordRow(c, w1.slice(3), t, 132, 830, 60);
    } else if (t < (wa.find((w) => /career/i.test(w.w))?.start ?? Infinity)) {
      if (aiOn) c.globalAlpha = 1 - 0.5 * grey; // stays under the AI's question until CAREER lands
      if (!aiOn) wordRow(c, w2.slice(0, 3), t, 132, 220, 72);
      const iInto = w2.indexOf(into);
      if (!aiOn) wordRow(c, w2.slice(3, iInto), t, 132, 330, 72);
      // A WORLD OF HURT, in the pit
      wordRow(c, w2.slice(iInto, iInto + 1), t, 132, 760, 64);
      const hurtW = w2.slice(iInto + 1);
      const o = { width: 112, weight: 900, color: (x: Word) => (/hurt/i.test(x.w) ? 'error' : 'bone') };
      const fit = Math.min(190, (190 * (W - 250)) / wordRow(c, hurtW, t, 0, 0, 190, { ...o, measureOnly: true }));
      wordRow(c, hurtW, t, 124, 960, fit, o);
      c.globalAlpha = 1;
    }
    // ---- the AI: CAREER struck @deprecated, then "Maybe."
    if (aiOn) this.deprecate(c, t, wa);

    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    return { bloom: 0.5, bloomThreshold: 0.95, vignette: 0.42, grain: 0.055, zoom: 1 + f.a.kick * 0.008, shake: (fall > 0 && fall < 0.5 ? [Math.sin(t * 90) * 6 * (0.5 - fall), 0] : [0, 0]) as [number, number] };
  }

  private deprecate(c: CanvasRenderingContext2D, t: number, wa: Line['words']) {
    const career = wa.find((w) => /career/i.test(w.w))!;
    const maybe = wa.find((w) => /maybe/i.test(w.w))!;
    // the question, typed in cobalt mono
    const q = plain(wa.filter((w) => w !== maybe && t >= w.start).map((w) => w.w).join(' '));
    c.font = TYPE.ai(40, 500);
    c.textAlign = 'left';
    c.fillStyle = col('cobaltText');
    c.fillText(q, 132, 250);
    if (t < maybe.start && cursorOn(t)) c.fillRect(132 + c.measureText(q).width + 8, 214, 22, 42);
    // CAREER, huge, then struck
    const s = wordState(career, t);
    if (s.sung) {
      const size = 260, fam = TYPE.humanFamily(112, 900);
      const cw = measure('CAREER', fam, size);
      c.font = TYPE.human(size, 112, 900);
      c.fillStyle = col('bone', wordAlpha(career, t));
      c.fillText('CAREER', 124, 620);
      const k = ease.outCubic(prog(t, career.end - 0.05, career.end + 0.3));
      c.fillStyle = col('cobalt');
      c.fillRect(110, 620 - size * 0.34, (cw + 30) * k, 16);
      if (k > 0.6) {
        c.font = TYPE.ai(30, 600);
        c.fillStyle = col('cobaltText', clamp((k - 0.6) * 3));
        c.fillText('@deprecated  since: now · replacement: pending', 132, 700);
      }
    }
    if (t >= maybe.start) {
      const pop = springStep(t - maybe.start, 3, 0.45);
      c.save();
      c.translate(132, 860);
      c.scale(pop, pop);
      c.font = TYPE.ai(96, 700);
      c.fillStyle = col('cobaltText');
      c.fillText('Maybe.', 0, 0);
      c.restore();
    }
  }
}
