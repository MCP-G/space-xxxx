// The Ministry of Immutable Affairs: viem wrapper around SectorDeed on
// Base Sepolia. Fully optional — the game runs in guest mode without a
// wallet, with a locally improvised (and legally meaningless) seed.
import {
  createWalletClient, createPublicClient, custom, http,
  parseEther, type Address, type Hash,
} from 'viem';
import { baseSepolia } from 'viem/chains';

// Set after deployment (see contracts/README). Zero = filing window closed.
export const SECTOR_DEED_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

export const SECTOR_DEED_ABI = [
  {
    name: 'claim', type: 'function', stateMutability: 'payable',
    inputs: [], outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'seedOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'nextId', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'SectorClaimed', type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'seed', type: 'bytes32', indexed: false },
      { name: 'claimant', type: 'address', indexed: true },
    ],
  },
] as const;

export type FilingUpdate =
  | { stage: 'queue'; text: string }
  | { stage: 'pending'; text: string; hash: Hash }
  | { stage: 'granted'; text: string; seed: number; tokenId: bigint }
  | { stage: 'rejected'; text: string };

function seedFromBytes32(seed: `0x${string}`): number {
  // fold the 32-byte seed into the 32-bit seed our PRNG takes
  let acc = 0;
  for (let i = 2; i < seed.length; i += 8) {
    acc = (acc ^ parseInt(seed.slice(i, i + 8), 16)) >>> 0;
  }
  return acc;
}

export class Ministry {
  get hasWallet() {
    return typeof (window as any).ethereum !== 'undefined';
  }

  get windowOpen() {
    return SECTOR_DEED_ADDRESS !== '0x0000000000000000000000000000000000000000';
  }

  /** Guest-mode claim: a locally generated seed, persisted, worth nothing. */
  improviseSeed(): number {
    const stored = localStorage.getItem('improvised-sector-seed');
    if (stored) return parseInt(stored, 10);
    const seed = (Math.random() * 0xffffffff) >>> 0;
    localStorage.setItem('improvised-sector-seed', String(seed));
    return seed;
  }

  /** File Form 88-B: claim a sector on-chain. Reports progress via onUpdate. */
  async claimSector(onUpdate: (u: FilingUpdate) => void): Promise<void> {
    if (!this.hasWallet) {
      onUpdate({ stage: 'rejected', text: 'NO WALLET DETECTED. THE MINISTRY ACCEPTS ONLY CRYPTOGRAPHIC GRIEF.' });
      return;
    }
    if (!this.windowOpen) {
      onUpdate({ stage: 'rejected', text: 'FILING WINDOW CLOSED. (CONTRACT NOT YET DEPLOYED. TRY EXISTING LATER.)' });
      return;
    }
    try {
      const eth = (window as any).ethereum;
      const wallet = createWalletClient({ chain: baseSepolia, transport: custom(eth) });
      const pub = createPublicClient({ chain: baseSepolia, transport: http() });
      const [account] = await wallet.requestAddresses();

      onUpdate({ stage: 'queue', text: 'FORM 88-B SUBMITTED. PLEASE TAKE A NUMBER. YOUR NUMBER IS A HASH.' });
      const hash = await wallet.writeContract({
        address: SECTOR_DEED_ADDRESS,
        abi: SECTOR_DEED_ABI,
        functionName: 'claim',
        value: parseEther('0.0001'),
        account,
        chain: baseSepolia,
      });
      onUpdate({ stage: 'pending', text: 'FILING NOTARIZED INTO THE MEMPOOL. THE MEMPOOL DOES NOT CARE.', hash });

      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        onUpdate({ stage: 'rejected', text: 'FILING REJECTED. REASON: YES.' });
        return;
      }
      // read the claimed seed back (tokenId = nextId - 1 for our tx's mint)
      const nextId = await pub.readContract({
        address: SECTOR_DEED_ADDRESS, abi: SECTOR_DEED_ABI, functionName: 'nextId',
      });
      const tokenId = nextId - 1n;
      const seedBytes = await pub.readContract({
        address: SECTOR_DEED_ADDRESS, abi: SECTOR_DEED_ABI, functionName: 'seedOf', args: [tokenId],
      });
      onUpdate({
        stage: 'granted',
        text: `DEED #${tokenId} GRANTED IN PERPETUITY (PERPETUITY SOLD SEPARATELY).`,
        seed: seedFromBytes32(seedBytes as `0x${string}`),
        tokenId,
      });
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? 'UNKNOWN';
      onUpdate({ stage: 'rejected', text: `FILING MISLAID: ${String(msg).slice(0, 80).toUpperCase()}` });
    }
  }
}
