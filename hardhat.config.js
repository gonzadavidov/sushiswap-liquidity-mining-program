/** @type import('hardhat/config').HardhatUserConfig */
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("@nomicfoundation/hardhat-network-helpers");
require('dotenv').config();

const API_URL = process.env.API_URL;

module.exports = {
  	solidity: "0.8.9",
	defaultNetwork: "hardhat",
	networks: {
		hardhat: {
			forking: {
				url: API_URL,
				blockNumber: 15250400
			}
		}
	}
};