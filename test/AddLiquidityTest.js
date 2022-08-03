const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const IUniswapV2Router02 = require("../artifacts/contracts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json");
const IWETH = require("../artifacts/contracts/interfaces/IWETH.sol/IWETH.json");
const IERC20 = require("../artifacts/contracts/interfaces/IERC20.sol/IERC20.json");
const MASTER_CHEF_V1 = require("../artifacts/contracts/interfaces/IMasterChef.sol/IMasterChef.json");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
const SUSHI = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; 
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; 
const MASTERCHEFV1 = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd";
const PID = 1;

describe("Add Sushi liquidity Unit Test", function ()  {
    let contractFactory;
    let contract;
    let router;
    let deployer;
    let tokenA;
    let tokenB;
    let iweth;
    before(async function () {
        [deployer] = await ethers.getSigners();
        tokenA = await new ethers.Contract(WETH, IERC20, deployer);
        tokenB = await new ethers.Contract(USDC, IERC20, deployer);
        iweth = await new ethers.Contract(WETH, IWETH, deployer);
        
        // Instantiate router´s smart contract
        router = await new ethers.Contract(ROUTER, IUniswapV2Router02, deployer);

        // Start smart contract
        contractFactory = await ethers.getContractFactory("SushiAddLiquidity");
        contract = await contractFactory.deploy(router.address);
        await contract.deployed();

        // Add 100 ETH to my account
        setBalance(deployer.address, ethers.utils.parseEther("100"));

        // Swap WETH to USDC
        await router.swapExactETHForTokens(
            0,
            [WETH, USDC],
            deployer.address,
            Date.now() + 1000 * 60,
            {value: ethers.utils.parseEther("1")}
        );
        
        // Swap ETH for WETH
        iweth.deposit({value: ethers.utils.parseEther("10")})
        
        // Approve both transactions
        await tokenA.approve(
            contract.address,
            ethers.utils.parseEther("10"),
            { from: deployer.address }
        );
        await tokenB.approve(
            contract.address, 
            ethers.utils.parseUnits("2000", "6"), 
            { from: deployer.address }
        );
    });

    describe("Core", () => {
        it("should add liquidity", async () => {
            // Check the exact amount of USDC for 1 ether and add liquidity
            const amountsOut = await router.getAmountsOut(
                ethers.utils.parseEther("1"), 
                [WETH, USDC]
            );
            await contract.addLiquidity(
                tokenA.address,
                tokenB.address,
                amountsOut[0],
                amountsOut[1],
                true,
                PID,
                { value: ethers.utils.parseEther("1"), from: deployer.address }
            );

            // Check if it added liquidity to the pool
            masterChef = await new ethers.Contract(MASTERCHEFV1, MASTER_CHEF_V1, deployer);
            userInfo = await masterChef.userInfo(PID, contract.address);
            expect(userInfo.amount > 0);
        });
        it("Claim rewards", async () => {
            sushi = await new ethers.Contract(SUSHI, IERC20, deployer);

            await contract.claimSushiRewards(true, PID);

            expect(sushi.balanceOf(deployer.address) > 0);
        });
        it("Exit liquidity and withdraw my tokens", async () => {
            amountWETHBefore = tokenA.balanceOf(deployer.address);
            amountUSDCBefore = tokenB.balanceOf(deployer.address);
            await contract.exitLiquidity(
                tokenA.address, 
                tokenB.address, 
                true, 
                PID
            );
            amountWETHAfter = tokenA.balanceOf(deployer.address);
            amountUSDCAfter = tokenB.balanceOf(deployer.address);
            expect((amountUSDCAfter > amountUSDCBefore) && (amountWETHAfter > amountWETHBefore));
        });
    });
});
