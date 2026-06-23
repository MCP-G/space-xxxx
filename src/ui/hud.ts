// DOM-overlay HUD: interaction prompts, Guide encyclopedia panel, flight
// readout, terminal chatter. Styled scrappy on purpose.

function el(id: string, css: string): HTMLDivElement {
  const d = document.createElement('div');
  d.id = id;
  d.style.cssText = css;
  document.querySelector('#app')!.appendChild(d);
  return d;
}

const MONO = 'font-family:monospace;color:#7fffd4;text-shadow:0 0 6px #7fffd466;';

export class Hud {
  private prompt = el('prompt', `${MONO}position:absolute;bottom:30%;width:100%;text-align:center;font-size:16px;pointer-events:none;`);
  private guide = el('guide', `${MONO}position:absolute;top:18px;right:18px;width:300px;font-size:12px;line-height:1.5;pointer-events:none;border:1px solid #7fffd455;padding:10px;background:#0a0a12cc;display:none;`);
  private toast = el('toast', `position:absolute;bottom:18%;width:100%;text-align:center;font-size:14px;pointer-events:none;font-family:monospace;color:#ffd23e;text-shadow:0 0 6px #ffd23e66;opacity:0;transition:opacity .3s;`);
  private toastTimer = 0;

  // --- flight HUD: styled gauge block + minimap
  private flightPanel = el('flight-panel', `${MONO}position:absolute;top:14px;left:14px;font-size:11px;pointer-events:none;white-space:pre;display:none;background:#0a0a14cc;border:1px solid #7fffd433;padding:8px 10px;line-height:1.6;min-width:160px;`);
  private minimap = el('minimap', `position:absolute;top:14px;right:14px;width:80px;height:80px;pointer-events:none;display:none;border:1px solid #7fffd433;background:#020810;overflow:hidden;`);
  private minimapCanvas: HTMLCanvasElement = (() => {
    const c = document.createElement('canvas');
    c.width = 80; c.height = 80;
    c.style.cssText = 'position:absolute;top:0;left:0;';
    this.minimap.appendChild(c);
    return c;
  })();

  setPrompt(text: string | null) {
    this.prompt.textContent = text ?? '';
  }

  showGuide(title: string, text: string) {
    this.guide.style.display = 'block';
    this.guide.innerHTML = `<b>${title}</b><br><span style="color:#b8b8d8">${text}</span><br><span style="color:#555;font-size:10px">— THE GUIDE (abridged, unreliable)</span>`;
  }

  hideGuide() {
    this.guide.style.display = 'none';
  }

  setFlight(speed: number | null, nearest?: string) {
    if (speed === null) {
      this.flightPanel.style.display = 'none';
      this.minimap.style.display = 'none';
      return;
    }
    this.flightPanel.style.display = 'block';
    this.minimap.style.display = 'block';
    const spd = Math.round(speed);
    const bars = Math.round((Math.min(spd, 200) / 200) * 10);
    const gauge = '█'.repeat(bars) + '░'.repeat(10 - bars);
    this.flightPanel.textContent =
      `SPD ${gauge} ${spd}m/s\nFUEL ██████████ MAX\n${nearest ?? ''}`;
  }

  updateMinimap(playerPos: {x:number;z:number}, pois: {x:number;z:number;color?:string}[]) {
    const ctx = this.minimapCanvas.getContext('2d');
    if (!ctx) return;
    const W = 80;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#020810';
    ctx.fillRect(0, 0, W, W);
    // grid
    ctx.strokeStyle = 'rgba(0,100,200,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const v = (i / 4) * W;
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(W, v); ctx.stroke();
    }
    // POI dots (project world x/z into 80px, sector radius ~600)
    const scale = W / 1400;
    for (const p of pois) {
      const sx = W / 2 + (p.x - playerPos.x) * scale;
      const sy = W / 2 + (p.z - playerPos.z) * scale;
      if (sx < 2 || sx > W - 2 || sy < 2 || sy > W - 2) continue;
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = p.color ?? '#00ffcc';
      ctx.fill();
    }
    // player dot
    ctx.beginPath(); ctx.arc(W / 2, W / 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(W / 2, W / 2, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  }

  private market = el('market', `${MONO}position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:480px;font-size:13px;line-height:1.7;border:1px solid #7fffd455;padding:14px;background:#0a0a12ee;display:none;`);
  private status = el('status', `${MONO}position:absolute;bottom:12px;right:18px;font-size:12px;text-align:right;pointer-events:none;white-space:pre;`);

  // --- walk-mode portrait bar
  private portraits = el('portraits', `position:absolute;bottom:0;left:50%;transform:translateX(-50%);display:none;flex-direction:row;gap:6px;padding:6px 10px;background:#08081488;border-top:1px solid #7fffd422;pointer-events:none;`);
  private portraitTiles: HTMLCanvasElement[] = [];

  showPortraits(npcs: {name: string; color: number; role: string}[]) {
    this.portraits.innerHTML = '';
    this.portraitTiles = [];
    for (const npc of npcs.slice(0, 6)) {
      const c = document.createElement('canvas');
      c.width = 48; c.height = 60;
      c.style.cssText = 'display:block;border:1px solid #7fffd433;';
      const ctx = c.getContext('2d')!;
      const hex = '#' + npc.color.toString(16).padStart(6, '0');
      ctx.fillStyle = '#0a0a18';
      ctx.fillRect(0, 0, 48, 60);
      // face circle
      ctx.beginPath(); ctx.arc(24, 20, 12, 0, Math.PI * 2);
      ctx.fillStyle = hex; ctx.fill();
      // eyes
      ctx.fillStyle = '#222'; ctx.fillRect(18, 16, 4, 4); ctx.fillRect(26, 16, 4, 4);
      // mouth
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(24, 22, 5, 0.2, Math.PI - 0.2); ctx.stroke();
      // name
      ctx.font = '6px monospace';
      ctx.fillStyle = '#7fffd4';
      ctx.textAlign = 'center';
      ctx.fillText(npc.role.slice(0, 8), 24, 40);
      ctx.fillStyle = '#666';
      ctx.fillText(npc.name.slice(0, 8), 24, 50);
      // border tint
      ctx.strokeStyle = hex + '66';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.5, 0.5, 47, 59);
      this.portraits.appendChild(c);
      this.portraitTiles.push(c);
    }
    this.portraits.style.display = npcs.length ? 'flex' : 'none';
  }

  hidePortraits() {
    this.portraits.style.display = 'none';
    this.portraitTiles = [];
  }

  private nav = el('nav', `${MONO}position:absolute;top:50%;left:50%;width:0;height:0;pointer-events:none;display:none;`);
  private navArrow = (() => {
    const a = document.createElement('div');
    a.style.cssText = `${MONO}position:absolute;left:-12px;top:-90px;font-size:24px;transform-origin:12px 90px;`;
    a.textContent = '▲';
    this.nav.appendChild(a);
    const label = document.createElement('div');
    label.id = 'nav-label';
    label.style.cssText = `${MONO}position:absolute;left:-120px;top:-130px;width:240px;text-align:center;font-size:12px;`;
    this.nav.appendChild(label);
    return a;
  })();

  /**
   * Heading indicator: arrow rotates around screen center to point at the
   * target (angle in radians, 0 = dead ahead/up). null hides.
   */
  setNav(angle: number | null, label = '') {
    this.nav.style.display = angle === null ? 'none' : 'block';
    if (angle === null) return;
    this.navArrow.style.transform = `rotate(${angle}rad)`;
    const l = this.nav.querySelector('#nav-label') as HTMLDivElement;
    l.textContent = label;
    // arrow turns mint when roughly on course, pink otherwise
    const on = Math.abs(((angle + Math.PI) % (2 * Math.PI)) - Math.PI) < 0.35;
    this.navArrow.style.color = on ? '#7fffd4' : '#ff2e88';
  }

  /** Market panel. rows pre-formatted; null hides. */
  setMarket(html: string | null) {
    this.market.style.display = html ? 'block' : 'none';
    if (html) this.market.innerHTML = html;
  }

  get marketOpen() { return this.market.style.display !== 'none'; }

  setStatus(text: string) {
    this.status.textContent = text;
  }

  private death = el('death', `position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:#3a002288;font-family:monospace;color:#ff2e88;text-shadow:0 0 18px #ff2e88;text-align:center;pointer-events:none;z-index:5;`);
  private barTop = el('bar-top', `position:absolute;top:0;left:0;right:0;height:0;background:#000;transition:height .5s ease;z-index:4;pointer-events:none;`);
  private barBottom = el('bar-bottom', `position:absolute;bottom:0;left:0;right:0;height:0;background:#000;transition:height .5s ease;z-index:4;pointer-events:none;`);

  /** Letterbox on/off: the universal sign that something cinematic is occurring. */
  setCinematic(on: boolean) {
    this.barTop.style.height = on ? '11%' : '0';
    this.barBottom.style.height = on ? '11%' : '0';
    if (on) { this.setPrompt(null); this.setNav(null); }
  }

  /** Full-screen death notice with Ministry invoice. Unmissable by design. */
  flashDeath(text: string) {
    this.death.innerHTML = `
      <div style="font-size:28px;margin-bottom:12px;">${text}</div>
      <div style="font-size:11px;color:#ff8888;border:1px solid #ff2e8855;padding:10px 16px;background:#1a000888;max-width:360px;line-height:1.8;">
        MINISTRY OF IMMUTABLE AFFAIRS<br>
        <span style="color:#ff4444">INVOICE FOR MORTALITY SERVICES</span><br>
        ─────────────────────────────<br>
        Emergency Respawn Fee ........ ∞¢<br>
        Dignity Recovery (partial) .... N/A<br>
        Processing Time ............. 14,000 yrs<br>
        ─────────────────────────────<br>
        <span style="color:#ffaa00">AMOUNT: YOUR REMAINING DIGNITY</span>
      </div>`;
    this.death.style.display = 'flex';
    setTimeout(() => { this.death.style.display = 'none'; }, 4000);
  }

  /** Transient yellow line — terminal chatter, dock confirmations. */
  say(text: string, seconds = 4) {
    this.toast.textContent = text;
    this.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.toast.style.opacity = '0'; }, seconds * 1000);
  }
}
