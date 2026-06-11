# Ministry of Immutable Affairs — contracts

Two ERC-721s (OpenZeppelin base):

- **SectorDeed** (`DEED`) — `claim()` (0.0001 ETH) mints a deed whose 32-byte
  seed deterministically generates a sector in-game. `setName()` for naming
  rights. Seed derives from blockhash + claimant + tokenId.
- **ShipRegistry** (`SHIP`) — `register(name)` (0.0002 ETH) mints a vessel
  with a serial seed for procedural hull generation (used from M4).

## Compile

```sh
npm run contracts   # solc-js → contracts/out/*.json (abi + bytecode)
```

## Deploy to Base Sepolia

You need a funded Base Sepolia account (faucet: https://faucet.circle.com or
Coinbase developer faucet). Easiest path with Foundry installed:

```sh
forge create contracts/SectorDeed.sol:SectorDeed --rpc-url https://sepolia.base.org --private-key $PK
```

Or use `viem`'s `deployContract` with `contracts/out/SectorDeed.json` from a
small Node script. Either way, paste the deployed address into
`src/chain/ministry.ts` → `SECTOR_DEED_ADDRESS`. Until then the in-game
filing window reports itself (accurately) as closed.
