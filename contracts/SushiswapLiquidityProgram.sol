// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IMasterChef.sol";
import "./interfaces/IMasterChefV2.sol";
import "hardhat/console.sol";
import "./interfaces/IWETH.sol";

contract SushiAddLiquidity {
    address public owner;
    IUniswapV2Router02 private router;
    address public factory;
    address public weth;
    address public masterChef;

    address public constant MASTER_CHEF_V1 = 0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd;
    address public constant MASTER_CHEF_V2 = 0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d;
    address private constant SUSHI = 0x6B3595068778DD592e39A122f4f5a5cF09C90fE2;

    constructor(address _router) {
        owner = msg.sender;
        router = IUniswapV2Router02(_router);
        weth = IUniswapV2Router02(_router).WETH();
        factory = IUniswapV2Router02(_router).factory();
    }

    /**
    * @notice Joins a SushiSwap pool to earn SLP and stake them into a yield farm
    *         managed by masterChef smart contracts
    * @param tokenA Token for the pool
    * @param tokenB Token for the pool
    * @param liquidityTokenA Desired liquidity for tokenA
    * @param liquidityTokenB Desired liquidity for tokenB
    * @param _masterChefV1 True if masterChefV1, false if masterChefV2
    * @param pid The pool ID for staking SLP
    */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint liquidityTokenA,
        uint liquidityTokenB,
        bool _masterChefV1,
        uint pid
    ) external payable {
        require(msg.sender == owner);
        masterChef = (_masterChefV1 ? MASTER_CHEF_V1 : MASTER_CHEF_V2);

        // First we add the desired liquidity to this contract
        IERC20(tokenA).transferFrom(owner, address(this), liquidityTokenA);
        IERC20(tokenB).transferFrom(owner, address(this), liquidityTokenB);

        // Approve the router to use this amount of liquidity from each token
        IERC20(tokenA).approve(address(router), liquidityTokenA);
        IERC20(tokenB).approve(address(router), liquidityTokenB);

        // Add liquidity using the router interface
        uint liquidity;
        (liquidityTokenA, liquidityTokenB, liquidity) = router.addLiquidity(
            tokenA, 
            tokenB, 
            liquidityTokenA, 
            liquidityTokenB, 
            liquidityTokenA*99/100,         // Minimum liquidity is 1% less than desired
            liquidityTokenB*99/100,         // Minimum liquidity is 1% less than desired
            address(this), 
            block.timestamp
        );
        console.log("===============JOIN=============");
        console.log("liquidity:", liquidity);
        console.log("users sushi before:", IERC20(SUSHI).balanceOf(owner));
        
        // Approve MasterChef to use the SLP tokens
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        IERC20(pair).approve(masterChef, liquidity);

        // Deposit SLP into MasterChef contract
        if(masterChef == MASTER_CHEF_V1) {
            IMasterChef(masterChef).deposit(pid, liquidity);
        } else {
            IMasterChefV2(masterChef).deposit(pid, liquidity, address(this));
        }
    }

    /**
    * @notice Exits masterChef yield farm, earn SUSHI and withdraw tokens 
    *          from liquidity pools
    * @param tokenA Token to withdraw
    * @param tokenB Token to withsraw
    * @param _masterChefV1 True if masterChefV1, false if masterChefV2
    * @param pid The pool ID where user's SLP are staked
    */
    function exitLiquidity(
        address tokenA,
        address tokenB, 
        bool _masterChefV1,
        uint pid 
    ) external {
        require(msg.sender == owner);
        masterChef = (_masterChefV1 ? MASTER_CHEF_V1 : MASTER_CHEF_V2);

        // See how much liquidity user has in this pool
        IMasterChef.UserInfo memory userInfo = IMasterChef(masterChef).userInfo(pid, address(this));
        uint liquidity = userInfo.amount;

        // Withdraw SLP tokens
        if(masterChef == MASTER_CHEF_V1) {
            console.log("===============WITHDRAW=============");
            console.log("sushi before withdraw:", IERC20(SUSHI).balanceOf(address(this)));
            console.log("pending sushi before withdraw:", IMasterChef(masterChef).pendingSushi(pid, address(this)));
            IMasterChef(masterChef).withdraw(pid, liquidity);
            console.log("sushi after withdraw:", IERC20(SUSHI).balanceOf(address(this)));
            console.log("pending sushi after withdraw:", IMasterChef(masterChef).pendingSushi(pid, address(this)));
        } else {
            IMasterChefV2(masterChef).withdraw(pid, liquidity, address(this));
        }

        // Get pair address for desired tokens
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);

        //Get exact liquidity owner has 
        liquidity = IERC20(pair).balanceOf(address(this));
        IERC20(pair).approve(address(router), liquidity);

        // Removes tokens from LP and sends it directly to owner
        router.removeLiquidity(
            tokenA,
            tokenB, 
            liquidity, 
            1, 
            1, 
            owner, 
            block.timestamp
        );
    }

    /**
    * @notice Claims user's SUSHI rewards
    * @param _masterChefV1 True if masterChefV1, false if masterChefV2
    * @param pid The pool ID where user's SLP are staked
    */
    function claimSushiRewards(
        bool _masterChefV1,
        uint pid 
    ) external {
        require(msg.sender == owner);
        masterChef = (_masterChefV1 ? MASTER_CHEF_V1 : MASTER_CHEF_V2);
        if(masterChef == MASTER_CHEF_V1) {
            // Operation to collect rewards in masterChefV1
            IMasterChef(masterChef).withdraw(pid, 0);

            // Transfer SUSHI from contract to user
            IERC20(SUSHI).transfer(
                owner, 
                IERC20(SUSHI).balanceOf(address(this))
            );
        } else {
            // Collect SUSHI rewards in masterChefV2
            IMasterChefV2(masterChef).harvest(pid, owner);
        }
        console.log("===================CLAIM=====================");
        console.log("owner's SUSHI after claim:", IERC20(SUSHI).balanceOf(owner));
    }
}
