const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const IUniswapV2Router02 = require("../artifacts/contracts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json");
const IWETH = require("../artifacts/contracts/interfaces/IWETH.sol/IWETH.json");
const IERC20 = require("../artifacts/contracts/interfaces/IERC20.sol/IERC20.json");
const { ethers } = require("hardhat");

const ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";  // WETH
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";  // USDC

const main = async () => {    
    // Get signer and instantiate necessary contracts
    const [deployer] = await ethers.getSigners();
    const tokenA = await new ethers.Contract(WETH, IERC20, deployer);
    const tokenB = await new ethers.Contract(USDC, IERC20, deployer);
    const iweth = await new ethers.Contract(WETH, IWETH, deployer);
    
    // Instantiate router´s smart contract
    const router = await new ethers.Contract(ROUTER, IUniswapV2Router02, deployer);

    // Start my smart contract
    const contractFactory = await ethers.getContractFactory("SushiAddLiquidity");
    const contract = await contractFactory.deploy(router.address);
    await contract.deployed();

    // Add eth to this account
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

    // Approve transactions for both tokens
    await tokenA.approve(
        contract.address,
        ethers.utils.parseEther("10"),
        { from: deployer.address }
    );
    await tokenB.approve(
        contract.address, 
        ethers.utils.parseUnits("2000", "9"), 
        { from: deployer.address }
    );

    // Check the exact amount of USDC for 1 ether
    const amountsOut = await router.getAmountsOut(ethers.utils.parseEther("1"), [WETH, USDC]);

    // Add liquidity to sushiswap's pool
    await contract.addLiquidity(
        tokenA.address,
        tokenB.address,
        amountsOut[0],
        amountsOut[1],
        true,
        1,
        { value: ethers.utils.parseEther("1"), from: deployer.address }
    );

    // Wait some blocks before claiming rewards
    await mineNBlocks(1000);
    await contract.claimSushiRewards(true, 1);
    await mineNBlocks(1000);
    console.log("USDC BEFORE:", await tokenB.balanceOf(deployer.address));
    // Exit liquidity
    await contract.exitLiquidity(
        tokenA.address,
        tokenB.address,
        true,
        1
    );
    console.log("USDC AFTER:", await tokenB.balanceOf(deployer.address));
    console.log("USDC DEPOSITED:", await tokenB.balanceOf(deployer.address)-282789);
}

async function mineNBlocks(n) {
    for (let index = 0; index < n; index++) {
      await ethers.provider.send('evm_mine');
    }
  }

main() 
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });