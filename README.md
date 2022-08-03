# Sushiswap's liquidity mining program

Smart contract written in solidity to be able to join sushiswap's liquidity mining program in one transaction and earn SUSHI. The smart contract supports the following functions:
- addLiquidity(): Adds liquidity to the corresponding liquidity pool, and then it adds this liquidity to a yield farm managed by masterchef to start earning SUSHI.
- claimSushiRewards(): It claims the corresponding rewards in SUSHI and sends them to the user.
- exitLiquidity(): Also claims rewards and exits the yield farm and the liquidity pool, returning the tokens added.
