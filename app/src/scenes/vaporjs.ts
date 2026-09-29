// The AI's "I just hallucinated a whole new framework. It's called VaporJS. Don't look it up.":
// a slick, entirely fake framework landing page, in the AI's cobalt: announcement pill, a huge
// VaporJS wordmark, the hero line typed from the lyric, `npm i vapor.js` (-> 404), a star counter
// climbing absurdly, logos of companies that don't exist. On "Don't look it up." everything
// evaporates: the page dissolves upward into steam.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, prog, springStep } from '../engine/util';
import { plain } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { TYPE, col, cursorOn } from './_look';

export default class VaporJS extends Scene {
  layer = new Layer2D();
  page = new Layer2D();
  line!: Line;

  override init() {
    this.line = this.ctx.lyrics.get('VaporJS');
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const ws = this.line.words;
    const called = ws.find((w) => /called/i.test(w.w))!;
    const vapor = ws.find((w) => /vapor/i.test(w.w))!;
    const dont = ws.find((w) => /don/i.test(w.w))!;
    const evap = prog(t, dont.start + 0.5, this.ctx.end - 0.05);
    this.drawPage(this.page.ctx, t, ws, called.start, vapor.start, dont.start);
    // evaporation: the page, sliced into horizontal strips that drift up and fade from the bottom,
    // plus steam puffs
    const c = this.layer.ctx;
    this.layer.clear(col('ink'));
    if (evap <= 0) c.drawImage(this.page.canvas, 0, 0, W, H);
    else {
      const strip = 12;
      for (let y = 0; y < H; y += strip) {
        const k = clamp(evap * 1.6 - (1 - y / H) * 0.6);
        if (k >= 1) continue;
        const dx = Math.sin(y * 0.05 + t * 6) * 30 * k, dy = -k * 160 - hash(y, 1) * 40 * k;
        c.globalAlpha = 1 - k;
        c.drawImage(this.page.canvas, 0, y * (this.page.canvas.height / H), this.page.canvas.width, strip * (this.page.canvas.height / H), dx, y + dy, W, strip);
      }
      c.globalAlpha = 1;
      for (let i = 0; i < 40; i++) {
        const life = clamp(evap * 1.5 - hash(i, 2) * 0.5);
        if (life <= 0 || life >= 1) continue;
        const x = hash(i, 3) * W, y = H - life * H * 1.1;
        const r = 30 + life * 120;
        const g = c.createRadialGradient(x, y, 1, x, y, r);
        g.addColorStop(0, col('steel', 0.18 * (1 - life)));
        g.addColorStop(1, col('steel', 0));
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    return { bloom: 0.6, bloomThreshold: 0.9, vignette: 0.4, grain: 0.055 };
  }

  private drawPage(c: CanvasRenderingContext2D, t: number, ws: Line['words'], tCalled: number, tVapor: number, tDont: number) {
    this.page.clear(col('ink'));
    // cobalt aurora
    const g = c.createRadialGradient(W / 2, 380, 50, W / 2, 380, 900);
    g.addColorStop(0, col('cobaltDeep', 0.9));
    g.addColorStop(1, col('cobaltDeep', 0));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // nav bar
    c.font = TYPE.ai(18, 600);
    c.fillStyle = col('bone');
    c.textAlign = 'left';
    c.fillText('◇ vapor', 132, 90);
    c.textAlign = 'right';
    c.fillStyle = col('ash');
    c.fillText('Docs (coming soon)    Blog    Enterprise    GitHub ★', W - 132, 90);
    // announcement pill: the AI's first words, typed
    const its = ws.findIndex((w) => /^it/i.test(w.w) && w.start < tCalled + 0.01 && w.start > ws[0]!.start);
    const intro = plain(ws.slice(0, its > 0 ? its : ws.length).filter((w) => t >= w.start).map((w) => w.w).join(' '));
    c.textAlign = 'center';
    c.font = TYPE.ai(24, 500);
    const pw = Math.max(200, c.measureText(intro).width + 60);
    c.strokeStyle = col('cobalt'); c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(W / 2 - pw / 2, 150, pw, 50, 25); c.stroke();
    c.fillStyle = col('cobaltText');
    c.fillText(intro || ' ', W / 2, 184);
    if (t < tCalled && cursorOn(t)) c.fillRect(W / 2 + c.measureText(intro).width / 2 + 6, 164, 14, 26);
    // before the wordmark: a skeleton page shimmering while the framework is "generated"
    if (t < tVapor) {
      const k = clamp((t - ws[0]!.start) / 0.3);
      const sh = ((t * 0.9) % 1) * (W + 800) - 400;
      const block = (x: number, y: number, w: number, h: number) => {
        c.fillStyle = col('ink2', 0.9 * k); c.fillRect(x, y, w, h);
        const g2 = c.createLinearGradient(sh - 200, 0, sh + 200, 0);
        g2.addColorStop(0, col('cobalt', 0)); g2.addColorStop(0.5, col('cobalt', 0.18 * k)); g2.addColorStop(1, col('cobalt', 0));
        c.fillStyle = g2; c.fillRect(x, y, w, h);
      };
      block(W / 2 - 460, 330, 920, 190); // wordmark
      block(W / 2 - 380, 570, 760, 36); // tagline
      block(W / 2 - 280, 670, 560, 70); // install
      for (let i = 0; i < 3; i++) block(W / 2 - 520 + i * 360, 820, 320, 150); // feature cards
      const pct = Math.min(99, Math.floor(prog(t, ws[0]!.start, tVapor) * 100));
      c.font = TYPE.ai(22, 500);
      c.fillStyle = col('cobaltText', k);
      c.fillText(`hallucinating framework… ${pct}%`, W / 2, 290);
      c.fillStyle = col('graphite', k); c.fillRect(W / 2 - 200, 300, 400, 3);
      c.fillStyle = col('cobalt', k); c.fillRect(W / 2 - 200, 300, 400 * pct / 100, 3);
    }
    // wordmark: "It's called" (small) then VaporJS slams in
    if (t >= tCalled) {
      c.font = TYPE.ai(28, 500);
      c.fillStyle = col('ash');
      c.fillText('It’s called', W / 2, 270);
    }
    if (t >= tVapor - 0.03) {
      const s = springStep(t - tVapor + 0.03, 2.6, 0.45);
      c.save();
      c.translate(W / 2, 520);
      c.scale(s, s);
      c.font = TYPE.human(260, 100, 900);
      const vw = c.measureText('Vapor').width, jw = c.measureText('JS').width;
      c.textAlign = 'left';
      c.fillStyle = col('bone');
      c.fillText('Vapor', -(vw + jw) / 2, 0);
      c.fillStyle = col('cobalt');
      c.fillText('JS', -(vw + jw) / 2 + vw + 8, 0);
      c.textAlign = 'center';
      c.restore();
      // tagline + CTA
      const k = clamp((t - tVapor - 0.2) / 0.3);
      c.globalAlpha = k;
      c.font = TYPE.human(40, 100, 500);
      c.fillStyle = col('ash');
      c.fillText('The zero-dependency, zero-code, zero-existence framework.', W / 2, 610);
      // npm install box
      const cmd = '$ npm i vapor.js';
      c.font = TYPE.ai(28, 500);
      const bw = 560;
      c.fillStyle = col('ink2'); c.fillRect(W / 2 - bw / 2, 670, bw, 70);
      c.strokeStyle = col('graphite'); c.strokeRect(W / 2 - bw / 2 + 0.5, 670.5, bw - 1, 69);
      c.textAlign = 'left';
      c.fillStyle = col('bone');
      c.fillText(cmd, W / 2 - bw / 2 + 30, 715);
      if (t > tVapor + 1.0) { c.fillStyle = col('error'); c.fillText('404', W / 2 + bw / 2 - 90, 715); }
      c.textAlign = 'center';
      // stars, climbing absurdly
      const stars = Math.floor(48_200 * Math.pow(1.9, Math.max(0, t - tVapor)));
      c.font = TYPE.ai(22, 600);
      c.fillStyle = col('ember');
      c.fillText(`★ ${stars.toLocaleString('en-US')} stars  ·  0 commits  ·  0 contributors`, W / 2, 800);
      // "trusted by" row of companies that don't exist
      c.font = TYPE.human(28, 125, 800);
      c.fillStyle = col('graphite');
      c.fillText('TRUSTED BY    NULLCORP    HYPERSCALE.AI    SYNERGEX    NOTAREAL INC.', W / 2, 900);
      c.globalAlpha = 1;
    }
    // "Don't look it up." as the fine print
    if (t >= tDont) {
      c.font = TYPE.ai(22, 500);
      c.fillStyle = col('cobaltText', clamp((t - tDont) / 0.2));
      c.fillText('* Don’t look it up.', W / 2, 1000);
    }
    c.textAlign = 'left';
    void ease;
  }
}
