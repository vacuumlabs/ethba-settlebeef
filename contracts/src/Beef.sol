// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Address} from "openzeppelin-contracts/contracts/utils/Address.sol";

contract Beef is Ownable {
    using Address for address;

    struct ConstructorParams {
        address owner;
        uint256 wager;
        address foe;
        uint256 duration;
        string title;
        string description;
        address[] arbiters;
    }

    uint256 constant arbiteringDuration = 30 days;
    uint256 constant joinDuration = 7 days;
    uint256 constant arbitersRequiredCount = 3;

    address public foe;
    address[] public arbiters;
    uint256 public wager;
    uint256 public duration;
    uint256 public deadline;
    uint256 public joinDeadline;
    int256 public result;
    uint256 public settleCount;
    string public title;
    string public description;
    uint256 attendCount;
    mapping(address => bool) public hasSettled;
    mapping(address => bool) public hasAttended;

    error BeefArbiterAlreadyAttended(address sender);
    error BeefArbiterAlreadySettled(address sender);
    error BeefInvalidArbitersCount(uint256 providedCount, uint256 requiredCount);
    error BeefInvalidWager(uint256 declaredWager, uint256 providedWager);
    error BeefisNotCooking(uint256 deadline, uint256 timestamp);
    error BeefIsRotten(uint256 deadline, uint256 timestamp);
    error BeefNotArbiter(address sender);
    error BeefNotFoe(address declaredFoe, address sender);
    error BeefNotRaw();
    error BeefNotRotten(uint256 deadline, uint256 timestamp);
    error BeefNotSettled(uint256 settleCount, uint256 requiredSettleCount);

    modifier onlyArbiter() {
        bool isArbiter;
        for (uint256 i = 0; i < arbiters.length; i++) {
            if (msg.sender == arbiters[i]) {
                isArbiter = true;
                break;
            }
        }
        if (!isArbiter) {
            revert BeefNotArbiter(msg.sender);
        }
        _;
    }

    modifier onlyFoe() {
        if (msg.sender != foe) {
            revert BeefNotFoe(foe, msg.sender);
        }
        _;
    }

    modifier isNotCooking() {
        if (deadline != 0) {
            revert BeefNotRaw();
        }
        _;
    }

    constructor(ConstructorParams memory params) payable Ownable(params.owner) {
        if (msg.value != params.wager) {
            revert BeefInvalidWager(params.wager, msg.value);
        }
        if (params.arbiters.length != arbitersRequiredCount) {
            revert BeefInvalidArbitersCount(params.arbiters.length, arbitersRequiredCount);
        }
        (wager, foe, duration, title, description, arbiters) =
            (params.wager, params.foe, params.duration, params.title, params.description, params.arbiters);
        joinDeadline = block.timestamp + joinDuration;
    }

    // @notice Owner can set the arbiters, if beef is still raw.
    // function setArbiters(address[] memory _arbiters) public onlyOwner isNotCooking {
    //     arbiters = _arbiters;
    // }

    function arbiterAttend() public onlyArbiter {
        if (hasAttended[msg.sender]) {
            revert BeefArbiterAlreadyAttended(msg.sender);
        }
        hasAttended[msg.sender] = true;
        ++attendCount;
    }

    // @notice Foe can join the beef, paying the wager.
    function joinBeef() public payable onlyFoe isNotCooking {
        if (msg.value != wager) {
            revert BeefInvalidWager(wager, msg.value);
        }
        if (block.timestamp >= joinDuration) {
            revert BeefIsRotten(joinDuration, block.timestamp);
        }
        if (attendCount < arbitersRequiredCount) {
            revert BeefInvalidArbitersCount(attendCount, arbitersRequiredCount);
        }
        deadline = block.timestamp + duration;
    }

    // @notice Arbiter can settle the beef.
    // @param verdict True if outcome is according to the description, false otherwise.
    function settleBeef(bool verdict) public onlyArbiter {
        if (block.timestamp < deadline) {
            revert BeefisNotCooking(deadline, block.timestamp);
        }
        if (block.timestamp >= deadline + arbiteringDuration) {
            revert BeefIsRotten(deadline + arbiteringDuration, block.timestamp);
        }
        if (hasSettled[msg.sender]) {
            revert BeefArbiterAlreadySettled(msg.sender);
        }
        result += verdict ? int256(1) : int256(-1);
        ++settleCount;
        hasSettled[msg.sender] = true;
    }

    // @notice Serve the beef to the winner.
    function serveBeef() public {
        if (settleCount <= arbiters.length / 2) {
            revert BeefNotSettled(settleCount, arbiters.length / 2);
        }
        // If majority has settled, result should never be 0.
        assert(result != 0);
        if (result > 0) {
            payable(owner()).transfer(address(this).balance);
        } else {
            payable(foe).transfer(address(this).balance);
        }
    }

    // @notice Withdraw the wagers if beef had rotten (arbiters didn't settle in time).
    function withdrawRotten() public {
        if (deadline != 0 && block.timestamp < deadline + arbiteringDuration) {
            revert BeefNotRotten(deadline + arbiteringDuration, block.timestamp);
        }
        payable(owner()).transfer(address(this).balance / 2);
        payable(foe).transfer(address(this).balance / 2);
    }

    // @notice Withdraw the wager if beef had raw for too long.
    function withdrawRaw() public isNotCooking {
        if (block.timestamp < joinDuration) {
            revert BeefNotRotten(joinDuration, block.timestamp);
        }
        payable(owner()).transfer(address(this).balance);
    }
}
