# SPACE XXXX — State of the Universe (handoff)

*Last updated: June 2026 (post-R1). Everything below is implemented,
committed, and verified in-browser unless marked otherwise.*

## AAA plan progress

**R1 (library spine): DONE.** The reusable asset library exists at `src/lib/`:

- `lib/materials/MaterialLibrary.ts` — every named surface defined once
  (`material('hull-worn')`, `material('glow-pink', {color})` for variants);
  shared instances cached, overrides derive copies. Tune a def, the whole
  universe updates.
- `lib/models/ModelCache.ts` — GLTF load-once/clone-many (SkeletonUtils),
  normalization (feet at y=0, height/length scaling), shadows, preload.
- `lib/registry/` — `AssetRegistry` + `Prefab` types + `prefabs.ts`
  catalogue + `manifest.json` (source/license/budget per asset).
  Procedural prefabs spawn sync (`registry.spawn(id, overrides)` →
  `{root, parts}`); model prefabs via `spawnModel`/`preload()` (warmed at
  boot). Guide text and prefabId ride in userData automatically.
- **Proof-of-pattern**: the combat drone is spawned from
  `'drone-loss-prevention'` (verified killing one in-browser);
  `salvage-crate` and `ore-node` prefabs show the overrides pattern;
  all 7 GLB models registered + preloaded.
- `src/render/models.ts` is now a thin wrapper over ModelCache (adds
  Quaternius arm-posing + idle-mixer support).
- Tests: `lib/registry/registry.test.ts` locks the contract (12 total pass).

**R2 next — animated characters.** Blocker found during R1: no reachable
CC0 GLBs ship with animation clips (checked all Quaternius mirrors; clips
live in site-only zips). R2 starts by downloading the Quaternius Universal
Animation Library zip (or Mixamo export) and converting to GLB clips that
retarget onto the existing `npc-*` rigs — ModelCache already returns
`animations` and models.ts already plays idle clips when present, so it's
an asset task, not a code task.

**Still to migrate onto the library** (do opportunistically during R2/R3):
station/sector builders still use local `box`/`padBox` helpers and the old
PALETTE — fold into MaterialLibrary names + `lib/world/Interior.ts` per plan.

## Run it

```sh
cd <repo> && npm install && npm run dev   # → http://localhost:5173
npm test                                  # vitest: procgen determinism suite
npm run contracts                         # solc compile → contracts/out/
```

Optional: `?res=540` URL param lowers internal render resolution for weak
GPUs (default 1080p, capped to device pixels).

## What the game is

First-person 3D space game (Three.js/TS/Vite): walk a hand-built station
(**Port Improbable**), board your ship (**The Heart of Mild Inconvenience**),
fly a procedurally generated sector, dock at POIs, trade, mine, salvage,
fight drones, take contracts, upgrade. Douglas Adams tone throughout;
procedural synth soundtrack (Tone.js) that reacts to movement speed and
danger. Ethereum layer (Base) designed in but not yet deployed.

## Systems map

| System | File(s) | Notes |
|---|---|---|
| Render pipeline | `src/render/PixelPipeline.ts` | Internal-res target → filmic tonemap, 24-level quantize + Bayer dither, scanlines, glitch FX, vertex snap; shadow mapping on |
| Model loading | `src/render/models.ts` | GLTF load + normalize + shadows + T-pose arm fix + mixer support |
| Walking | `src/player/WalkController.ts` | Capsule-vs-AABB, settable floor height (station decks + space pads) |
| Flight | `src/player/FlightController.ts` | Arcade-newtonian; camera-eyeline cockpit; `power` = engine upgrades |
| Ship | `src/ship/Ship.ts` | Walkable interior + colliders from transform; exterior = Imperial GLB (hidden in pilot view) |
| Station | `src/world/station.ts` | Geometry, palette, NPC spawn defs, terminal lines |
| Sector procgen | `src/world/sector.ts` | Deterministic (sfc32 seed): asteroids+mine, derelict w/ interior, beacon, wreck field, nebula, monolith; salvage; floaters; dock pillars |
| Combat | `src/game/combat.ts` | Weapons (hitscan blaster / projectile pulse cannon), tracers/sparks/explosions, drone AI (standoff ring, juke-on-hit), cover system |
| Economy | `src/game/economy.ts` | Commodities, seeded per-market prices, PlayerState (localStorage) |
| Missions | `src/game/missions.ts` | Contracts board: deliver/clear/salvage, persistence |
| Audio | `src/audio/AudioDirector.ts` | Adaptive synth: station/flight/danger modes + continuous intensity; SFX synthesized (zap, whomp, navchime, boom). ⚠️ never use `bpm.rampTo` — it hard-freezes the tab (set `bpm.value` instead) |
| Chain client | `src/chain/ministry.ts` | viem + Base Sepolia; guest mode default; `SECTOR_DEED_ADDRESS` is zero until deployed |
| Contracts | `contracts/*.sol` | SectorDeed + ShipRegistry (ERC-721, OZ); compile via solc-js; **not deployed** — needs funded Base Sepolia key |
| UI | `src/ui/hud.ts` | Prompts, Guide popups, market/board panel, nav chevron, flight readout, death flash, toasts |
| Orchestration | `src/main.ts` | Mode machine (walk/fly), interactions, docking, nav, guide raycast, frame loop. `window.__game` debug hook drives scripted browser tests |

## Assets

`public/models/` — CC0 Quaternius (see LICENSE.txt there): Imperial +
Challenger ships, 5 modular humanoids (no animation clips; arms posed in
loader; animated replacements are R2 of the AAA plan).

## Known issues / honest caveats

- NPCs are well-posed statues (no walk/idle animation clips in these GLBs).
- Wreck-field pad is cramped — you disembark against your own hull.
- Pulse cannon is dodgeable at range by design; may need splash.
- Headless/software-GL environments can't run 1080p internal (use `?res=480`).
- `docs/AAA-PLAN.md` is the forward plan; R1 (asset library spine) not started.

## Blocked on owner

1. **Contract deployment**: funded Base Sepolia key → `forge create` or viem
   script → paste address into `src/chain/ministry.ts`.
2. **Async-multiplayer indexer hosting** decision (Cloudflare Worker + KV
   suggested).

## Git history = design history

Every milestone is one descriptive commit (M0 vibe gate → M1 traversal →
M2 chain → M3/M4 economy+combat → polish/detail/hi-res/photoreal passes).
`git log --oneline` reads as the project diary.
