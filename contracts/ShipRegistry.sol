// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title ShipRegistry — Vessels of Questionable Provenance
/// @notice Each ship is a token with an immutable serial seed; the game
///         derives hull shape, paint, and personality defects from it.
contract ShipRegistry is ERC721 {
    uint256 public nextId = 1;
    uint256 public constant REGISTRATION_FEE = 0.0002 ether;

    struct Vessel {
        bytes32 serial;     // seed for procedural hull + quirks
        uint64 commissioned; // block timestamp of registration
    }

    mapping(uint256 => Vessel) public vesselOf;
    mapping(uint256 => string) public nameOf;

    event ShipRegistered(uint256 indexed tokenId, bytes32 serial, address indexed owner);
    event ShipNamed(uint256 indexed tokenId, string name);

    constructor() ERC721("Ship Registry", "SHIP") {}

    function register(string calldata name) external payable returns (uint256 tokenId) {
        require(msg.value >= REGISTRATION_FEE, "REGISTRY: SEE FEE APPENDIX C");
        require(bytes(name).length > 0 && bytes(name).length <= 64, "REGISTRY: NAME UNFILEABLE");
        tokenId = nextId++;
        bytes32 serial = keccak256(
            abi.encodePacked(blockhash(block.number - 1), msg.sender, tokenId, name)
        );
        vesselOf[tokenId] = Vessel(serial, uint64(block.timestamp));
        nameOf[tokenId] = name;
        _safeMint(msg.sender, tokenId);
        emit ShipRegistered(tokenId, serial, msg.sender);
        emit ShipNamed(tokenId, name);
    }

    function withdraw(address payable to) external {
        require(msg.sender == _registrar, "REGISTRY: UNAUTHORIZED");
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok, "REGISTRY: DISBURSEMENT MISLAID");
    }

    address private immutable _registrar = msg.sender;
}
