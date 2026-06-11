import './style.css';
import { PixelPipeline } from './render/PixelPipeline';
import { buildGreybox } from './world/greybox';
import { WalkController } from './player/WalkController';
import { AudioDirector } from './audio/AudioDirector';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const boot = document.querySelector<HTMLDivElement>('#boot')!;
const hud = document.querySelector<HTMLDivElement>('#hud')!;

const pipeline = new PixelPipeline(canvas);
const world = buildGreybox();
const player = new WalkController(pipeline.aspect, canvas);
const audio = new AudioDirector();

player.onFootstep = () => audio.footstep();

window.addEventListener('resize', () => {
  player.camera.aspect = pipeline.aspect;
  player.camera.updateProjectionMatrix();
});

// occasional ambient glitch, because the station's maintenance budget
// was reallocated to a subcommittee that no longer exists
setInterval(() => {
  if (Math.random() < 0.25) {
    pipeline.triggerGlitch(0.4 + Math.random() * 0.6);
    audio.glitchBurst();
  }
}, 4000);

boot.addEventListener('click', async () => {
  boot.style.display = 'none';
  await audio.start();
  canvas.requestPointerLock();
});

hud.textContent = 'WASD move · SHIFT sprint · mouse look\nPORT IMPROBABLE — Deck 7 (allegedly)';

let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  player.update(dt, world.colliders);
  pipeline.render(world.scene, player.camera, dt, now / 1000);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
