# SPACE XXXX — Start Here (handoff for a fresh model)

You are inheriting a working, polished browser game. This file is the
single thing you need to read to be productive. It assumes **zero prior
context**. Companion docs: [REPORT.md](REPORT.md) (full history),
[AAA-PLAN.md](AAA-PLAN.md) (forward roadmap), [HANDOFF.md](HANDOFF.md)
(session-by-session log). This file supersedes them as your entry point.

---

## 1. What this is

A first-person 3D space game, Douglas-Adams-funny, cyber-decay aesthetic.
You walk a decaying space station, board a freighter you can physically
walk inside, sit down, fly out into a procedurally generated sector, dock
at outposts, trade / mine / salvage / fight drones, take contracts
(including deliberate wild-goose chases), and — once a wallet is wired —
claim sectors as on-chain deeds. Three.js + TypeScript + Vite + Tone.js
(procedural synth score) + Solidity (Base L2, not yet deployed).

Repo: https://github.com/MCP-G/space-xxxx — push there when done.

## 2. Run it

```sh
cd ~/Documents/Claude/Projects/Space
npm install        # first time only
npm run dev        # → http://localhost:5173
npm test           # vitest: 12 tests (procgen determinism + asset registry)
npm run contracts  # solc-js compile of the Solidity → contracts/out/
```

Click "INITIALISE IMPROBABILITY" to start (a click is required to begin
audio). **Controls**: WASD move · Shift sprint/boost · E interact ·
click fire · Q swap weapon · mouse steer · R/F lift · Space brake ·
T cycle nav target.

URL params: `?res=720` pins internal resolution (disables auto-scaler);
`?shadows=0` disables shadow mapping (for weak/software GL).

## 3. The mental model (how it fits together)

`src/main.ts` (~930 lines) is the orchestrator: it owns the **mode
machine** (`walk` / `fly` / cinematic), all interactions, docking, the
nav HUD, the guide raycaster, and the frame loop. Everything else is a
module it wires together:

| Concern | File | Notes |
|---|---|---|
| Render / pixel look | `src/render/PixelPipeline.ts` | Renders to a low-res target, then a post shader does ACES tonemap + palette + Bayer dither + scanlines + glitch. **Adaptive resolution** lives here (samples frame times, scales 540p↔1080p). |
| On-foot movement | `src/player/WalkController.ts` | Capsule-vs-AABB; floor height is settable (station decks vs space pads). |
| Flight | `src/player/FlightController.ts` | Arcade-newtonian; `power` = engine upgrades. |
| The ship | `src/ship/Ship.ts` | Walkable interior + colliders derived from transform. Exterior is a downloaded GLB hull (hidden in pilot view). Glass canopy + thruster flares. |
| Station geometry | `src/world/station.ts` | Hangar/corridor/bar, palette, NPC spawn defs, terminal lines. |
| Sector procgen | `src/world/sector.ts` (~680 lines) | Deterministic from a seed (`sfc32`). Asteroids+mine, derelict+interior, beacon, wreck field, nebula, monolith, **planets**. Plus salvage, floaters, dock pillars, decay, windows. |
| Combat | `src/game/combat.ts` | Weapons (hitscan blaster / projectile pulse), tracers/sparks/explosions, drone AI (standoff ring, juke-on-hit), cover detection. |
| Economy | `src/game/economy.ts` | Commodities, seeded per-market prices, `PlayerState` (localStorage). |
| Missions | `src/game/missions.ts` | Contracts board: deliver / clear / salvage / **goose** (multi-hop). |
| Audio | `src/audio/AudioDirector.ts` | Adaptive synth: station/flight/danger modes + continuous intensity; synthesized SFX + dock/undock stingers in A. |
| Cinematics | `src/game/cinematic.ts` | Letterboxed orbit camera for dock/undock. |
| Chain | `src/chain/ministry.ts` + `contracts/*.sol` | viem + Base Sepolia; **not deployed** (needs a funded key). Guest mode works without it. |
| UI overlay | `src/ui/hud.ts` | DOM overlay: prompts, Guide popups, market/board panel, nav chevron, letterbox, death flash. |

### The reusable asset library (`src/lib/`) — important

This is the architectural spine from the AAA plan. **Build new world
content through it, not with ad-hoc geometry.**

- `lib/materials/MaterialLibrary.ts` — every surface is a named PBR preset:
  `material('hull-worn')`, `material('glow-pink', {color})` for a variant.
  Tune one definition, the whole universe updates.
- `lib/models/ModelCache.ts` — GLTF load-once / clone-many (handles
  skinned meshes), normalization, preload.
- `lib/registry/` — `AssetRegistry` + prefab catalogue (`prefabs.ts`) +
  `manifest.json` (asset source/license/budget ledger). `registry.spawn(id,
  overrides)` for procedural prefabs, `spawnModel(id)` for GLB ones.
- `lib/actors/Character.ts` — animated NPC: clip state machine, waypoint
  patrols, greet-the-player turns. The whole cast is tinted clones of one
  CC0 animated mannequin.
- `lib/world/Decay.ts` — the cyber-decay dressing system. Feed it a
  collider list; it classifies walls/floors and litters them with pooled
  canvas-texture posters, graffiti, grime, and garbage prefabs.
- `lib/world/Windows.ts` — same pattern, framed star-view windows.

### Assets
`public/models/` — all CC0 Quaternius: 2 ships, 5 modular humanoids, and
the Universal Animation Library mannequin + 46 clips (`AnimLib.gltf`).
License recorded in `public/models/LICENSE.txt` and the registry manifest.

## 4. CRITICAL gotchas (these cost real debugging time — heed them)

1. **`window.__game.step(ms)` for ALL scripted browser tests.** Hidden /
   occluded preview tabs park `requestAnimationFrame` *and* clamp
   `setInterval`, so `setTimeout`-based waits hang. Drive the sim
   synchronously: `g.step(300)`. The `__game` debug hook exposes
   `walk, flight, ship, dockAt, enterFlight, setSector, combat, player,
   fire, missions, sector(), dockSpots(), mode(), step(), pipeline`.
2. **Never call Tone.js `bpm.rampTo`** — it hard-freezes the browser tab.
   Set `bpm.value` discretely (this is why music tempo steps, not ramps).
3. **`fog: false` on anything beyond the fog far-plane** (stars, planets)
   or it renders as background void.
4. **Don't downscale a dithered frame** (moiré). Internal target ≤ canvas
   device pixels — the pipeline already enforces this.
5. **The preview sometimes opens a second tab** stuck at the boot screen;
   `preview_screenshot` may hit it. Click `#boot` again and re-screenshot.
   The eval-driven tab and the screenshot tab can differ.
6. **Disposing a regenerated sector must dispose `material.map`**, not just
   the material — canvas textures leak otherwise. `setSector()` in main.ts
   does this correctly now; copy that pattern for any new disposable.
7. **No vertex-snap shader anymore** — `applyVertexSnap` is a deliberate
   no-op (it shimmered small props at hi-res). The pixel feel is 100% in
   the post chain. Don't resurrect it without a large-objects-only guard.

## 5. Verified-working state (as of this handoff)

Just completed a two-auditor pass + live playtest. Confirmed working:
trade round-trips with cargo cap / credit floor, all 5 docks, salvage,
mining, kiosk market, ship's log, all 4 contract types (deliver/clear/
salvage/goose) + abandon, death+respawn, Ministry filing (guest mode),
arms crate, engineer upgrade, dock/undock cinematics, planets, canopy.
Fixed this session: GPU texture leak on sector regen, weaponIndex
persistence, goose empty-options guard, cinematic-interrupt soft-lock.
**12/12 tests pass, no console errors, no flicker.**

## 6. What to do next (prioritized)

1. **Deploy the contracts** (only thing the codebase can't do itself):
   needs a funded Base Sepolia key → `forge create` or a viem deploy
   script → paste the address into `src/chain/ministry.ts`
   (`SECTOR_DEED_ADDRESS`). Then the Ministry filing window mints for real.
   See `contracts/README.md`.
2. **AAA-PLAN R3 — hero spaces**: rebuild the station interior through a
   `lib/world/Interior.ts` builder + dressing, add bloom/SSAO
   postprocessing, audio buses + reverb zones. This is the next planned
   milestone. See AAA-PLAN.md §2.3 / R3.
3. **De-mannequin the cast**: NPCs are tint-coded copies of one mannequin.
   Distinct meshes rigged to the same UAL skeleton would be a big visual
   win (registry manifest "wanted" list).
4. **Async multiplayer indexer**: needs a hosting decision (Cloudflare
   Worker + KV suggested). Other players appear as traces, never avatars.

## 7. Known minor warts (not bugs, judgment calls)

- Bar patron reads as standing *on* his stool (sit-clip foot placement).
- Wreck-field landing pad is cramped (you disembark against your hull).
- Pulse-cannon slugs are dodgeable at long range (intended: blaster for
  reach, pulse for burst).
- On a planet's NIGHT side the surface reads as a dim looming mass (lit
  by a distant sun); a faint self-glow keeps it visible. Could add a
  planet-facing light for a brighter, more dramatic landing if wanted.

## 8. Working agreement (owner preferences)

- Give terminal commands as one paste-ready line including the `cd`.
- Update **REPORT.md and HANDOFF.md every session**, then push to GitHub.
- Verify changes in the browser (use `step()`); don't claim done unverified.
- Keep the Douglas Adams tone. Cyber decay is a load-bearing aesthetic.
