import * as THREE from 'three';

// Canvas texture generators for in-world monitor screens.
// Each function returns a CanvasTexture you can slap on a PlaneGeometry.
// Caller owns disposal.

const W = 128, H = 96;

/** Scrolling Ministry data feed — green on black. */
export function makeDataScreen(seed: number): THREE.CanvasTexture {
  const lines = [
    'PROCESSING FORM 88-B...',
    'SECTOR DEED PENDING',
    'ERROR 404: REASON NOT FOUND',
    'QUEUE POSITION: 14,003',
    'MINISTRY UPTIME: 0.003%',
    'FILING STATUS: ASPIRATIONAL',
    'TX HASH: 0x???...',
    'BUREAUCRATIC LOAD: HIGH',
    'APPROVAL: PENDING SINCE',
    'THE THIRD EPOCH',
  ];
  const offset = seed % lines.length;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#020d06';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '7px monospace';
  ctx.fillStyle = '#00ff66';
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 10; i++) {
    const alpha = 0.4 + (i % 3) * 0.2;
    ctx.globalAlpha = alpha;
    ctx.fillText(lines[(offset + i) % lines.length], 4, 10 + i * 9);
  }
  ctx.globalAlpha = 1;
  // scanline overlay
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dot map of the current sector — POIs as blinking blobs. */
export function makeStarMapScreen(poiCount: number, seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#010a14';
  ctx.fillRect(0, 0, W, H);
  // grid lines
  ctx.strokeStyle = 'rgba(0,100,200,0.2)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // star field
  const rndSeq = lcg(seed);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(150,180,255,${0.2 + rndSeq() * 0.4})`;
    ctx.fillRect(rndSeq() * W, rndSeq() * H, 1, 1);
  }
  // POI dots
  const colors = ['#00ffcc', '#ff8800', '#ff2288', '#88aaff', '#ffdd00'];
  for (let i = 0; i < Math.max(3, poiCount); i++) {
    const x = 12 + rndSeq() * (W - 24);
    const y = 12 + rndSeq() * (H - 24);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
  }
  // player dot: always center
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 7, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Pixel-art face — the crew-feed look. */
export function makeFaceScreen(seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const skinColors = ['#c8a878', '#44cc66', '#b0b8c8', '#ff9ad0', '#9fd8ff', '#ffd044'];
  const bgColors = ['#0a0a1a', '#0a1a0a', '#1a0a0a', '#0a0e1a'];
  ctx.fillStyle = bgColors[seed % bgColors.length];
  ctx.fillRect(0, 0, W, H);
  // name ticker at bottom
  const names = ['CREW-1', 'ZXBT-9', 'MAR-V', 'GLERN', 'Q!X', 'OBR-3'];
  ctx.fillStyle = 'rgba(0,255,180,0.15)';
  ctx.fillRect(0, H - 14, W, 14);
  ctx.font = '7px monospace';
  ctx.fillStyle = '#00ffaa';
  ctx.fillText(names[seed % names.length] + '  STATUS: FINE', 4, H - 4);
  // face: head oval
  const skin = skinColors[seed % skinColors.length];
  const cx = W / 2, cy = H / 2 - 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 26, 32, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  // eyes
  const eyeStyle = seed % 3;
  if (eyeStyle === 0) {
    // standard two eyes
    ctx.fillStyle = '#222244';
    ctx.fillRect(cx - 14, cy - 10, 10, 8);
    ctx.fillRect(cx + 4, cy - 10, 10, 8);
    ctx.fillStyle = '#88aaff';
    ctx.fillRect(cx - 11, cy - 8, 5, 5);
    ctx.fillRect(cx + 7, cy - 8, 5, 5);
  } else if (eyeStyle === 1) {
    // three eyes (alien)
    ctx.fillStyle = '#220000';
    ctx.beginPath(); ctx.arc(cx - 12, cy - 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 12, cy - 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 14, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(cx - 12, cy - 8, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 12, cy - 8, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 14, 2, 0, Math.PI * 2); ctx.fill();
  } else {
    // single visor (robot)
    ctx.fillStyle = '#002244';
    ctx.fillRect(cx - 18, cy - 12, 36, 10);
    ctx.fillStyle = '#00ccff';
    ctx.fillRect(cx - 16, cy - 10, 32, 6);
  }
  // mouth
  ctx.strokeStyle = '#33223a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy + 10, 10, 0.3, Math.PI - 0.3);
  ctx.stroke();
  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Amber/red warning stripes + status codes — for derelict screens. */
export function makeAlertScreen(seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0a0000';
  ctx.fillRect(0, 0, W, H);
  // diagonal hazard stripes
  ctx.save();
  ctx.globalAlpha = 0.25;
  const isRed = seed % 2 === 0;
  ctx.fillStyle = isRed ? '#ff2200' : '#ff8800';
  for (let x = -H; x < W + H; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 14, 0); ctx.lineTo(x + 14 + H, H); ctx.lineTo(x + H, H);
    ctx.fill();
  }
  ctx.restore();
  // status codes
  ctx.font = '7px monospace';
  const codes = [
    'ALERT CODE 7-GAMMA',
    'HULL BREACH: PROBABLE',
    'LIFE SUPPORT: LOL',
    'REACTOR: SULKING',
    'CREW: UNAVAILABLE',
    'STATUS: SEE LOGS',
    '>> EVACUATE NOW <<',
  ];
  const offset = seed % codes.length;
  ctx.fillStyle = isRed ? '#ff4400' : '#ffaa00';
  for (let i = 0; i < 7; i++) {
    ctx.globalAlpha = i === 3 ? 1 : 0.6;
    ctx.fillText(codes[(offset + i) % codes.length], 4, 10 + i * 12);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}
