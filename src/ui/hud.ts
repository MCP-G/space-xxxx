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
  private flight = el('flight', `${MONO}position:absolute;top:18px;left:18px;font-size:13px;pointer-events:none;white-space:pre;display:none;`);
  private toast = el('toast', `position:absolute;bottom:18%;width:100%;text-align:center;font-size:14px;pointer-events:none;font-family:monospace;color:#ffd23e;text-shadow:0 0 6px #ffd23e66;opacity:0;transition:opacity .3s;`);
  private toastTimer = 0;

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
      this.flight.style.display = 'none';
      return;
    }
    this.flight.style.display = 'block';
    this.flight.textContent = `VEL ${speed.toFixed(0)} m/s\n${nearest ?? ''}`;
  }

  private market = el('market', `${MONO}position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:460px;font-size:13px;line-height:1.7;border:1px solid #7fffd455;padding:14px;background:#0a0a12ee;display:none;`);
  private status = el('status', `${MONO}position:absolute;bottom:12px;right:18px;font-size:12px;text-align:right;pointer-events:none;white-space:pre;`);

  /** Market panel. rows pre-formatted; null hides. */
  setMarket(html: string | null) {
    this.market.style.display = html ? 'block' : 'none';
    if (html) this.market.innerHTML = html;
  }

  get marketOpen() { return this.market.style.display !== 'none'; }

  setStatus(text: string) {
    this.status.textContent = text;
  }

  /** Transient yellow line — terminal chatter, dock confirmations. */
  say(text: string, seconds = 4) {
    this.toast.textContent = text;
    this.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.toast.style.opacity = '0'; }, seconds * 1000);
  }
}
