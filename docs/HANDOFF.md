# SPACE XXXX — State of the Universe (handoff)

*Last updated: June 2026 (post-R2 + decay pass). Everything below is
implemented, committed, and verified in-browser unless marked otherwise.*

## Latest session: planets, goose chases, embellishments

- **Planets** (sector.ts): 2-3 per sector, seeded — banded canvas
  textures (4 palettes), storm ellipses, optional tilted rings, rim
  point-light, slow rotation via floaters, `fog: false` (same trap as
  stars). POI kind `'planet'`, nav-targetable, Adams names + guide jokes
  (BRUNCH, TAXHAVEN IX, THE LONG QUEUE…). Not dockable (by design:
  "not accepting visitors. or apologies.").
- **Wild goose chases** (missions.ts kind `'goose'`): 4th board offer.
  Multi-hop pursuit — target dock keeps relocating via
  `gooseArrived(dockName, allDocks)` (deterministic hop choice), flavor
  toast per hop (GOOSE_HOPS), paid punchline at the end (GOOSE_ENDINGS).
  Board accepts [1-4] now. Verified end-to-end: 4 hops, 378¢.
- **Embellishments**: ship thruster flares (`Ship.setThrustVisual`,
  eased cones behind the pods), neon bar sign with a loose connection
  (canvas texture, random flicker), breathing atmosphere field
  (named 'atmo-field', opacity sine), +7 terminal lines, +3 derelict
  logs, +6 slogans, +8 graffiti tags.
- **docs/REPORT.md** — "the report of everything, ever": full project
  chronicle, stats, engineering lessons. Keep it updated each session
  alongside this handoff.

## Previous session: canopy, windows, docking cinematics

- **Cockpit canopy** (`Ship.buildCockpitGlass`): raked glass pane + frame
  rails/pillars/center strut, visible only in pilot view (toggled by
  `setPilotView`). Glass tuned subtle (opacity 0.07) — earlier values
  mirror-balled the whole view.
- **`lib/world/Windows.ts`**: collider-driven window system (same pattern
  as Decay). Framed star-view viewports (pooled canvas textures: stars +
  nebula wash + glass sheen) on station + all POI walls. Guide text admits
  views are simulated for morale.
- **Docking cinematics** (`src/game/cinematic.ts` + hud.setCinematic
  letterbox + `AudioDirector.stinger`): dock = camera cranes down around
  the ship as it glides/rotates onto the pad; undock = ship lifts while
  the camera sweeps up. Music ducks via a musicGain bus; stinger in A
  (score's home key): rising arp/major swell/noise riser for undock,
  descending resolve + add9 for dock, ~3.5s, groove fades back.
  Player is invulnerable during shots. **Tests/respawn use
  `dockAt(spot, false)` / `enterFlight(false)`** to skip cinematics.

## Previous session: full playtest + cyber decay

**Playtest** (scripted via `window.__game`, fresh save): every flow passes —
economy caps/floors, all five docks, salvage, mining, kiosk market, ship's
log, all three contract types (+ abandon + docking a delivery without the
goods), Ministry filing, arms crate (broke/buy/double-buy), engineer
upgrade. Fixes that came out of it:
- **Hidden-tab freeze**: browsers park rAF *and* clamp setInterval in
  hidden tabs. Heartbeat fallback added (helps briefly-hidden tabs) plus
  `__game.step(ms)` — synchronous simulation stepping that makes scripted
  testing deterministic regardless of throttling. Use it in all future
  browser tests; do not trust setTimeout waits.
- `?shadows=0` URL param (software-GL/CI), shadow-type deprecation fixed.

**Cyber decay** — `lib/world/Decay.ts` (start of AAA-PLAN's Dressing
system): feed `DecaySystem.apply()` any collider list; it classifies walls
and floors (floor/ceiling pair detection so litter never decorates the
void above rooms) and dresses them from seeded, pooled canvas textures:
~20 Ministry slogan posters, ~20 robot graffiti tags (spray halo + drips),
grime stains, and six floor-garbage builders (cans, bottles, crumpled
reports, dead datapads, cable tangles, lost towels). Wired to the station
(seed 777) and every sector POI pad/interior (derelict densest). Decals
carry Guide entries. Tune density per call; add slogans/tags by appending
to the arrays.

## AAA plan progress

**R2 (living characters): DONE.** No static humanoid anywhere — the R2 exit
criterion holds:

- **Animation source found**: the Quaternius Universal Animation Library as
  glTF (CC0, J-Ponzo port) — `public/models/AnimLib.gltf` + `.bin` —
  46 clips (Idle/Walk/Run, Idle_Talking, Fixing_Kneeling, Sitting,
  Dance, combat, etc.) on a Rigify-style rig **with its own skinned
  Mannequin mesh**. That made retargeting unnecessary: NPCs are tinted
  mannequin clones (one cached model → whole cast, via R1's ModelCache).
- **`lib/actors/Character.ts`** — the Character actor: clip state machine
  with crossfades (`play(name)`), waypoint patrols (Walk_Loop between
  points, configured waits, smooth turning), and greet behavior (turns to
  face the player within 2.8m, drifts back after).
- **The cast** (defined in `station.ts` NPC_SPAWNS, spawned in main):
  engineer kneels fixing a crate, bartender idles behind the bar, the
  passenger talks to the departures board, suit guy patrols the hangar on
  a 4-waypoint loop (movement verified: 1.08m sampled over 4s), a patron
  sits on a bar stool, and THE RAVER dances. Six animated characters.
- The five static modular GLBs remain in `public/models` (registered,
  unused as NPCs) — future props/variants.
- Known cosmetic gap → manifest "wanted": the cast is colour-coded
  mannequins; distinct heads/outfits rigged to the UAL skeleton is the
  R3+ upgrade. Patrolling NPCs don't collide with level geometry (routes
  are authored clear of obstacles).

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

**R3 next — hero spaces**: station interior rebuild on the library
(`lib/world/Interior.ts` + Dressing per AAA-PLAN §2.3), postprocessing
chain (bloom/SSAO), audio buses + reverb zones. Exit: hangar + bar pass
the art-bible checklist at 60fps.

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

- NPCs are animated mannequins (uniform body, tint-coded); unique meshes are an R3+ asset task.
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
