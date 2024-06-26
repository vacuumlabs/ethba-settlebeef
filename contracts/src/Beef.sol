// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import "@uniswap/swap-router-contracts/contracts/interfaces/IV3SwapRouter.sol";
import {Slaughterhouse} from "./Slaughterhouse.sol";

/// @title Interface for WETH9
interface IWETH9 is IERC20 {
    /// @notice Deposit ether to get wrapped ether
    function deposit() external payable;

    /// @notice Withdraw wrapped ether to get ether
    function withdraw(uint256) external;
}

contract Beef is OwnableUpgradeable {
    using Address for address;

    struct ConstructorParams {
        address owner;
        uint256 wager;
        address challenger;
        uint256 settleStart;
        string title;
        string description;
        address[] arbiters;
        uint256 joinDeadline;
        bool staking;
    }

    struct BeefInfo {
        ConstructorParams params;
        bool cooking;
        uint128 resultYes;
        uint128 resultNo;
        uint256 attendCount;
        bool beefGone;
        uint256 protocolRewardBasisPoints;
        uint256 arbitersRewardBasisPoints;
    }

    uint256 public constant settlingDuration = 30 days;
    uint256 public constant arbitersRequiredCount = 3;

    // @notice The total basis points representing 100% (i.e., 10,000 basis points = 100%)
    uint256 public constant totalBasisPoints = 10_000;

    // @notice Address of the challenger - the counterparty to the beef.
    address public challenger;
    // @notice Addresses of the arbiters - the judges of the beef.
    address[] public arbiters;
    // @notice Wager amount of each side.
    uint256 public wager;
    // @notice Title of the beef.
    string public title;
    // @notice Description of the beef.
    string public description;
    // @notice Timestamp when the settling can start.
    uint256 public settleStart;
    // @notice Deadline for challenger to join the beef.
    uint256 public joinDeadline;
    // @notice Flag indicating if the beef is cooking - the challenger had joined.
    bool public cooking;
    bool public beefGone;
    Slaughterhouse public slaughterhouse;

    // @notice The portion of rewards allocated to the protocol, measured in basis points (1 point = 1 / totalPoints %)
    uint256 public protocolRewardBasisPoints;

    // @notice The portion of total rewards allocated to the arbiters, measured in basis points (1 point = 1 / totalPoints %)
    uint256 public arbitersRewardBasisPoints;

    // @notice Flag indicating if the beef is staking - the underlying ETH had been staked for wstETH and is earning staking yield.
    bool public staking;
    // @notice Address of the Uniswap V3 Router.
    IV3SwapRouter public swapRouter;
    IWETH9 public WETH9;
    IERC20 public WSTETH;

    uint128 public resultYes;
    uint128 public resultNo;
    uint256 public attendCount;
    // 0 if not settled, 1 if yes, 2 if no.
    mapping(address arbiter => uint256 result) public hasSettled;
    mapping(address arbiter => bool) public hasAttended;

    error BeefAlreadyGone();
    error BeefArbiterAlreadyAttended(address sender);
    error BeefArbiterAlreadySettled(address sender);
    error BeefInvalidArbitersCount(uint256 providedCount, uint256 requiredCount);
    error BeefInvalidWager(uint256 declaredWager, uint256 providedWager);
    error BeefIsCooking();
    error BeefIsNotCooked(uint256 deadline, uint256 timestamp);
    error BeefIsRotten(uint256 deadline, uint256 timestamp);
    error BeefNotArbiter(address sender);
    error BeefNotChallenger(address declaredChallenger, address sender);
    error BeefNotOwner(address declaredOwner, address sender);
    error BeefNotOwnerNorChallenger(address declaredOwner, address declaredChallenger, address sender);
    error BeefNotRaw();
    error BeefNotRotten(uint256 deadline, uint256 timestamp);
    error BeefNotSettled(uint128 resultYes, uint128 resultNo, uint256 requiredSettleCount);
    error EthTransferFailed();
    error OwnershipTransferDisabled();

    event BeefCreated(
        address indexed owner,
        address indexed challenger,
        uint256 wager,
        uint256 settleStart,
        string title,
        string description,
        address[] arbiters,
        uint256 protocolRewardBasisPoints,
        uint256 arbitersRewardBasisPoints
    );
    event ArbiterAttended(address indexed arbiter);
    event BeefCooking();
    event BeefSettled(address indexed arbiter, bool verdict);
    event BeefServed(address indexed winner);
    event BeefWithdrawn(bool hadBeenCooking);

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

    modifier onlyChallenger() {
        if (msg.sender != challenger) {
            revert BeefNotChallenger(challenger, msg.sender);
        }
        _;
    }

    modifier isNotCooking() {
        if (cooking) {
            revert BeefIsCooking();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        ConstructorParams memory params,
        uint256 amountOutMin,
        address _weth,
        address _wsteth,
        address _swapRouter,
        address payable _slaughterhouse,
        uint256 _protocolRewardBasisPoints,
        uint256 _arbitersRewardBasisPoints
    ) public payable initializer {
        if (msg.value != params.wager) {
            revert BeefInvalidWager(params.wager, msg.value);
        }
        if (params.arbiters.length != arbitersRequiredCount) {
            revert BeefInvalidArbitersCount(params.arbiters.length, arbitersRequiredCount);
        }
        wager = params.wager;
        challenger = params.challenger;
        settleStart = params.settleStart;
        title = params.title;
        description = params.description;
        arbiters = params.arbiters;
        joinDeadline = params.joinDeadline;
        staking = params.staking;
        WETH9 = IWETH9(_weth);
        WSTETH = IERC20(_wsteth);
        swapRouter = IV3SwapRouter(_swapRouter);
        slaughterhouse = Slaughterhouse(_slaughterhouse);
        protocolRewardBasisPoints = _protocolRewardBasisPoints;
        arbitersRewardBasisPoints = _arbitersRewardBasisPoints;

        __Ownable_init(params.owner);

        if (staking) {
            _stakeBeef(amountOutMin);
        }

        emit BeefCreated(params.owner, challenger, wager, settleStart, title, description, arbiters, protocolRewardBasisPoints, arbitersRewardBasisPoints);
    }

    // Disabled to prevent the owner from locking funds for the challenger
    function transferOwnership(address newOwner) public override onlyOwner {
        revert OwnershipTransferDisabled();
    }

    // @notice Get the current information about beef.
    function getInfo() public view returns (BeefInfo memory) {
        return BeefInfo({
            params: ConstructorParams({
                owner: owner(),
                wager: wager,
                challenger: challenger,
                settleStart: settleStart,
                title: title,
                description: description,
                arbiters: arbiters,
                joinDeadline: joinDeadline,
                staking: staking
            }),
            cooking: cooking,
            resultYes: resultYes,
            resultNo: resultNo,
            attendCount: attendCount,
            beefGone: beefGone,
            protocolRewardBasisPoints: protocolRewardBasisPoints,
            arbitersRewardBasisPoints: arbitersRewardBasisPoints
        });
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
        emit ArbiterAttended(msg.sender);
    }

    // @notice Challenger can join the beef, paying the wager.
    // @param amountOutMin Minimum amount of wstETH to receive, if staking is enabled.
    function joinBeef(uint256 amountOutMin) public payable onlyChallenger isNotCooking {
        if (msg.value != wager) {
            revert BeefInvalidWager(wager, msg.value);
        }
        if (block.timestamp >= joinDeadline) {
            revert BeefIsRotten(joinDeadline, block.timestamp);
        }
        if (attendCount < arbitersRequiredCount) {
            revert BeefInvalidArbitersCount(attendCount, arbitersRequiredCount);
        }
        cooking = true;
        if (staking) {
            _stakeBeef(amountOutMin);
        }
        emit BeefCooking();
    }

    // @notice Arbiter can settle the beef.
    // @param verdict True if outcome is according to the description, false otherwise.
    function settleBeef(bool verdict) public onlyArbiter {
        if (block.timestamp < settleStart) {
            revert BeefIsNotCooked(settleStart, block.timestamp);
        }
        if (block.timestamp >= settleStart + settlingDuration) {
            revert BeefIsRotten(settleStart + settlingDuration, block.timestamp);
        }
        if (hasSettled[msg.sender] != 0) {
            revert BeefArbiterAlreadySettled(msg.sender);
        }

        if (verdict) {
            ++resultYes;
        } else {
            ++resultNo;
        }
        hasSettled[msg.sender] = verdict ? 1 : 2;
        emit BeefSettled(msg.sender, verdict);
    }

    // @notice Serve the beef to the winner.
    function serveBeef(uint256 amountOutMin) public {
        if (beefGone) {
            revert BeefAlreadyGone();
        }
        if (resultYes <= arbiters.length / 2 && resultNo <= arbiters.length / 2) {
            revert BeefNotSettled(resultYes, resultNo, arbiters.length / 2);
        }

        if (staking) {
            _unstakeBeef(amountOutMin);
        }

        uint256 balance = address(this).balance;

        uint256 protocolReward = balance * protocolRewardBasisPoints / totalBasisPoints;
        uint256 totalArbiterReward = balance * arbitersRewardBasisPoints / totalBasisPoints;
        uint256 beefReward = balance - totalArbiterReward - protocolReward;

        if (resultYes > resultNo) {
            if (msg.sender != owner()) {
                revert BeefNotOwner(owner(), msg.sender);
            }
            _transferEth(owner(), beefReward);
            emit BeefServed(owner());
        } else {
            if (msg.sender != challenger) {
                revert BeefNotChallenger(challenger, msg.sender);
            }
            _transferEth(challenger, beefReward);
            emit BeefServed(challenger);
        }

        uint256 individualArbiterReward = totalArbiterReward / arbitersRequiredCount;
        uint256 correctSettle = resultYes > resultNo ? 1 : 2;

        // TODO: Switch to claim-based reward system
        for (uint256 i; i < arbiters.length;) {
            address arbiterAddress = arbiters[i];

            // Note: Cases where arbiter settled incorrectly / didn't settle / reverted transfer are claimed by protocol
            if (hasSettled[arbiterAddress] == correctSettle) {
                arbiterAddress.call{value: individualArbiterReward}("");
            }

            unchecked {
                ++i;
            }
        }

        _transferEth(address(slaughterhouse), address(this).balance);

        beefGone = true;
    }

    // @notice Withdraw the wagers if beef had rotten (arbiters didn't settle in time).
    function withdrawRotten(uint256 amountOutMin) public {
        if (beefGone) {
            revert BeefAlreadyGone();
        }
        if (!cooking || block.timestamp < settleStart + settlingDuration) {
            revert BeefNotRotten(settleStart + settlingDuration, block.timestamp);
        }
        if (msg.sender != owner() && msg.sender != challenger) {
            revert BeefNotOwnerNorChallenger(owner(), challenger, msg.sender);
        }

        if (staking) {
            _unstakeBeef(amountOutMin);
        }

        uint256 amount = address(this).balance / 2;

        _transferEth(owner(), amount);
        _transferEth(challenger, amount);

        emit BeefWithdrawn(cooking);
        beefGone = true;
    }

    // @notice Withdraw the wager if beef had raw for too long.
    function withdrawRaw(uint256 amountOutMin) public isNotCooking onlyOwner {
        if (beefGone) {
            revert BeefAlreadyGone();
        }
        if (block.timestamp < joinDeadline) {
            revert BeefNotRotten(joinDeadline, block.timestamp);
        }

        if (staking) {
            _unstakeBeef(amountOutMin);
        }

        _transferEth(owner(), address(this).balance);
        emit BeefWithdrawn(cooking);
        beefGone = true;
    }

    function _stakeBeef(uint256 amountOutMin) internal {
        WETH9.deposit{value: address(this).balance}();

        uint256 wethBalance = WETH9.balanceOf(address(this));

        TransferHelper.safeApprove(address(WETH9), address(swapRouter), wethBalance);

        IV3SwapRouter.ExactInputSingleParams memory params =
            IV3SwapRouter.ExactInputSingleParams({
                tokenIn: address(WETH9),
                tokenOut: address(WSTETH),
                fee: 100, // 0.01%
                recipient: address(this),
                amountIn: wethBalance,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            });

       swapRouter.exactInputSingle(params);
    }

    function _unstakeBeef(uint256 amountOutMin) internal {
        uint256 wstethBalance = WSTETH.balanceOf(address(this));

        TransferHelper.safeApprove(address(WSTETH), address(swapRouter), wstethBalance);

        IV3SwapRouter.ExactInputSingleParams memory params = IV3SwapRouter.ExactInputSingleParams({
                tokenIn: address(WSTETH),
                tokenOut: address(WETH9),
                fee: 100, // 0.01%
                recipient: address(this),
                amountIn: wstethBalance,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            });

        swapRouter.exactInputSingle(params);

        uint256 wethBalance = WETH9.balanceOf(address(this));

        WETH9.withdraw(wethBalance);
    }

    function _transferEth(address recipient, uint256 amount) internal {
        (bool isSent,) = recipient.call{value: amount}("");

        if (!isSent) {
            revert EthTransferFailed();
        }
    }

    // @notice Fallback function to receive ETH.
    fallback() external payable {}
}
