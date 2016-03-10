Etheropt
=============
[![Gitter](https://badges.gitter.im/Etherboost/etheropt.svg)](https://gitter.im/Etherboost/etheropt?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Etheropt is a decentralized options exchange built on [Ethereum](https://ethereum.org/). The options you see here are vanilla call and put options on the price of Ethereum in USD as reported by [Poloniex](https://poloniex.com/exchange#btc_eth) and [Coindesk](http://www.coindesk.com/price) and verified by [Reality Keys](https://www.realitykeys.com). Etheropt has no owner. Its entire operation is described and executed by an Ethereum [smart contract](market.sol). Etheropt does not make any money as the smart contract does not charge any fees (not for trading, not for adding funds, not for withdrawing, not for anything).

Installation
----------
In order to ease interaction with the smart contract, Etheropt has a graphical user interface (GUI).

There is no installation necessary to use the GUI. Just go to the main Etheropt page and the GUI will be running in your Web browser. You can also choose to download the GitHub repository and run the GUI locally.

Ethereum network
----------
The GUI can connect to the Ethereum network in one of two ways. If you have Geth running locally in RPC mode (at http://localhost:8545), Etheropt will automatically connect to it. If you don't have Geth running locally, Etheropt will connect to the Ethereum network through the public API provided by Etherscan. You can find out whether your are connected to Geth or Etherscan by looking for the  icon in the footer.

Accounts
----------
In the bar at the top of the GUI, there is a dropdown on the far right. The first time you load the GUI, you will see it is initialized with the zero account (0x0000000000000000000000000000000000000000). You can click the dropdown and choose "Add existing account" to add your own existing Ethereum account. You will need to do this in order to add funds and make trades on Etheropt. If you are using Geth, make sure you have unlocked the appropriate account by using the "personal.unlockAccount('0x...', 'password')" command. If you are not using Geth, you will need to enter your private key associated with your account in order to send transactions via the Etherscan API. If you need a new account to use with Etheropt, click the dropdown and choose "Create new account." You may also choose to go to MyEtherWallet and use the address and unencrypted private key it generates.

Adding / withdrawing funds
----------
In the bar at the top of the GUI, there is a "Funds" number and an "Available" number. The "Funds" number is the total amount you have deposited to Etheropt. The "Available" number is the total amount that is available to invest or withdraw. At any given time, your available funds will be equal to the funds you deposited plus the maximum possible loss you could experience from expiring options.

Click the "Funds" number and a dialog box will help you add funds. Click the "Available" number and a dialog box will help you withdraw funds.

Contracts
----------
Anyone can add an option chain by calling the addOptionChain() function. There is a limit on the number of unexpired option chains that can exist (the limit is 6). Normally, it's a good idea for the person who has decided to expire an option chain (when the expiration date has passed) to create a new option chain to replace it. An option chain can contain up to 10 contracts. A contract consists of an expiration, a strike, a kind (call or put), and an underlying (ETH/USD). Note that there is a margin requirement that limits the potential upside of an option. For example, if the margin requirement is 5.0000 and you buy 10 eth worth of the 7 call expiring March 1 for 0.2000 and ETH/USD settles at 13.0000, your net profit will be 10 eth * (-0.2000 + min(5.0000, 13.0000 - 7.0000)) = 4.8 eth. If the settlement value is below the strike, your net profit will be 10 eth * (-0.2000) = -2 eth.

Placing orders
----------
To place an order, simply click the buy or sell button next to the contract and enter the size and price you wish to trade. Every contract shows your current position under "My position."

If you place an order but you don't have enough available funds in your account, the order will be cancelled. If your order does not execute immediately, it will rest on the order book. If at any time someone tries to trade with your order and you no longer have enough available funds, your resting order will be cancelled. Note that there could be resting orders that no longer have available funds in the book. If you try to trade with them, they will be cancelled automatically. You can always cancel all your outstanding orders by clicking the "Cancel all my orders" button at the bottom of the screen.

Cash usage and expiration
----------
Etheropt keeps track of your cash usage for each expiration. When you buy an option, your cash usage becomes more negative. When you sell an option, your cash usage becomes more positive. For example, if you buy 10 eth worth of the 5 call expiring March 1 for 0.2000, your cash usage will decrease by 2 eth. If you had sold the option, your cash usage would increase by 2 eth.

The contracts belonging to an expiration must be manually expired using the smart contract's expire function. Anyone can do this using the expire.js script, or one person can do it for everyone.

It is worth noting how exactly expiration works. For example, if you buy 10 eth worth of the 5 call expiring March 1 for 0.2000, your cash usage becomes -2 eth and your position is 10 eth. If ETH/USD expires at 6.0000, your funds change by 10 eth * (-0.2000 + (6.0000 - 5.0000)) = 8 eth. If ETH/USD expires below the strike, your funds change by 10 eth * (-0.2000) = -2 eth. Similarly, if you are short the option, your possible balance changes will be -8 eth if ETH/USD expires at 6.0000 and +2 eth if ETH/USD expires below the strike.

The smart contract
----------
The Solidity code for the smart contract can be found in the GitHub repository at market.sol. It has been compiled and deployed to the Ethereum network. You are encouraged to read and understand it yourself. You may even want to write your own code to generate transactions to send to the smart contract instead of using the GUI. The contract's functions are listed below.

* **Market()**: This function initializes the contract. It doesn't do anything special.

* **addFunds()**: This function adds the sent value to the user's account.

* **withdrawFunds(uint amount)**: This function withdraw's the specified amount from the user's account and cancels all the user's outstanding orders. If the user doesn't have enough available funds to cover the withdrawal, then no withdrawal takes place.

* **getFunds(address user, bool onlyAvailable) constant returns(int)**: This function gets the total sum of all deposits less withdrawals in the user's account. If the onlyAvailable flag is true, it adds in the maximum possible loss so that it will return the total available funds.

* **getFundsAndAvailable(address user) constant returns(int, int)**: This function gets the funds and available funds in the user's account.

* **getOptionChain(uint optionChainID) constant returns (uint, string, uint, uint, bytes32, address)**: This function returns the expiration (timestamp), underlying, margin, Reality Keys ID, Reality Keys fact hash, and Reality Keys address of the given option chain.

* **getMarket(address user) constant returns(uint[], int[], int[], int[])**: This function gets an overview of the market, including the specified user's position. It will return up to 25 options. The return values are the option IDs (plus 1000 times the option chain IDs), strikes, positions, and cash usage amounts.

* **getMarketTopLevels() constant returns(uint[], uint[], uint[], uint[])**: This function gets an overview of the market top levels. It will return up to 25 top levels that correspond to the top levels of the 25 options returned by getMarket(). The return values are the buy prices, buy sizes, sell prices, and sell sizes.

* **expire(uint accountID, uint optionChainID, uint8 v, bytes32 r, bytes32 s, bytes32 value)**: This function expires the specified option chain if the provided signature is valid. If the accountID is 0, it expires all accounts. If the accountID is greater than zero, then it expires just the specified account (and marks it as expired).

* **getMoneyness(int strike, uint settlement, uint margin) constant returns(int)**: Takes the strike (put is negative), settlement, and margin (all these values are scaled by 1000000000000000000) and returns the moneyness (also scaled by 1000000000000000000), taking into account the margin.

* **addOptionChain(uint existingOptionChainID, uint expiration, string underlying, uint margin, uint realityID, bytes32 factHash, bytes32 ethAddr, int[] strikes)**: If the existingOptionChainID parameter is greater than 6, it adds an option chain, which consists of an expiration, an underlying, a margin amount, a Reality Keys ID, a Reality Keys fact hash, a Reality Keys address, and a collection of strikes (calls are positive, puts are negative). There is a limit on the number of option chains that can be created (the limit is 6). Once that limit is met, new option chains must replace expired ones. If the existingOptionChainID is less than 6, this function will append the new strikes to an existing option chain. There is also a limit on the number of strikes an option chain can contain (the limit is 10).

* **placeBuyOrder(uint optionChainID, uint optionID, uint price, uint size)**: This function places a buy order, executes it against existing sell orders, and leaves the remainder on the book. There is a limit on the number of resting orders (the limit is 5). Once the limit is met, new orders will only rest if they improve the price of the worst order, which will be replaced. If the user does not have enough available funds, the order will be cancelled. Also, any sell orders that would otherwise be immediatelly executed against this order but don't have enough available funds will be cancelled.

* **placeSellOrder(uint optionChainID, uint optionID, uint price, uint size)**: This function is similar to placeBuyOrder.

* **orderMatchBuy(uint optionChainID, uint optionID, uint price, uint size, uint bestPriceID) private returns(uint)**: This function is used by orderMatchSell to match the new sell order with an existing buy order.

* **orderMatchSell(uint optionChainID, uint optionID, uint price, uint size, uint bestPriceID) private returns(uint)**: This function is used by orderMatchBuy to match the new buy order with an existing sell order.

* **getTopLevel(uint optionChainID, uint optionID) private constant returns(uint, uint, uint, uint)**: This function gets the top level buy and sell price and returns buy price, buy size, sell price, and sell size.

* **cancelOrders()**: This function cancels all the user's outstanding orders in all options.

* **getMaxLossAfterTrade(address user, uint optionChainID, uint optionID, int positionChange, int cashChange) constant returns(int)**: This function returns the user's maximum possible loss after doing the specified trade.

* **min(uint a, uint b) constant returns(uint)**: This function returns the minimum of two numbers.
