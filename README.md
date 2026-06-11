# SPACE XXXX

*A first-person space game about flying a mildly inconvenient freighter
through a universe administered by an immutable bureaucracy.*

Walk the station. Board your ship — actually walk into it, sit down, and
fly out through an atmosphere retention field of expired warranty. Trade
commemorative towels, mine ore, salvage derelicts, argue with
loss-prevention drones (ballistically), take contracts from a board that
pretends not to judge you, and — eventually — file Form 88-B to claim a
procedurally generated sector as an on-chain deed from the Ministry of
Immutable Affairs.

Built with Three.js + TypeScript + Vite, a fully procedural Tone.js synth
soundtrack that tracks your speed, and Solidity contracts targeting Base.

## Quick start

```sh
npm install
npm run dev        # → http://localhost:5173  (add ?res=540 on weak GPUs)
```

Click to initialise improbability. Sound on.

**Controls:** WASD move · Shift sprint/boost · E interact · click fire ·
Q swap weapon · mouse steer · R/F lift · Space brake · T cycle nav target.

## Development

```sh
npm test             # procgen determinism suite (vitest)
npm run contracts    # compile Solidity (solc-js) → contracts/out/
```

## Where things stand

See **[docs/HANDOFF.md](docs/HANDOFF.md)** for the full systems map and
current state, and **[docs/AAA-PLAN.md](docs/AAA-PLAN.md)** for the plan to
take every asset and system to AAA-acceptable feel on a reusable,
object-based asset library.

## Credits

3D models: CC0 by [Quaternius](https://quaternius.com)
(`public/models/LICENSE.txt`). Everything else: code, in scandalous
quantities.
