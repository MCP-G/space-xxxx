// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title SectorDeed — Ministry of Immutable Affairs, Form 88-B
/// @notice A deed to a procedurally generated sector of space. The token's
///         seed fully determines the sector's contents via the game's
///         deterministic generator. Owning the deed does not imply the
///         sector likes you.
contract SectorDeed is ERC721 {
    uint256 public nextId = 1;
    uint256 public constant CLAIM_FEE = 0.0001 ether;

    /// tokenId => the 32-byte seed that generates the sector
    mapping(uint256 => bytes32) public seedOf;
    /// tokenId => name filed by the owner (optional, regretted often)
    mapping(uint256 => string) public nameOf;

    event SectorClaimed(uint256 indexed tokenId, bytes32 seed, address indexed claimant);
    event SectorNamed(uint256 indexed tokenId, string name);

    constructor() ERC721("Sector Deed", "DEED") {}

    /// @notice Claim a new sector. The seed derives from chain entropy and
    ///         the claimant, so nobody can pre-mine the nice asteroids.
    function claim() external payable returns (uint256 tokenId) {
        require(msg.value >= CLAIM_FEE, "MINISTRY: FEE SCHEDULE 7 APPLIES");
        tokenId = nextId++;
        bytes32 seed = keccak256(
            abi.encodePacked(blockhash(block.number - 1), msg.sender, tokenId)
        );
        seedOf[tokenId] = seed;
        _safeMint(msg.sender, tokenId);
        emit SectorClaimed(tokenId, seed, msg.sender);
    }

    /// @notice Name your sector. Renaming is permitted; the old name is
    ///         remembered by the chain forever anyway, like all mistakes.
    function setName(uint256 tokenId, string calldata name) external {
        require(ownerOf(tokenId) == msg.sender, "MINISTRY: NOT YOUR PARCEL");
        require(bytes(name).length <= 64, "MINISTRY: NAME TOO ENTHUSIASTIC");
        nameOf[tokenId] = name;
        emit SectorNamed(tokenId, name);
    }

    /// @notice Fees fund the Ministry. The Ministry does not exist.
    function withdraw(address payable to) external {
        require(msg.sender == _ministry, "MINISTRY: UNAUTHORIZED");
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok, "MINISTRY: DISBURSEMENT MISLAID");
    }

    address private immutable _ministry = msg.sender;
}
