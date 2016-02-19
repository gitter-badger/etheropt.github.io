contract Market {

  address admin = 0x18e79a47d8a58bef5aaecbba85ea1420649c64a8;

  struct Order {
    uint price;
    uint size;
    address user;
  }
  struct Option {
    uint id;
    bytes32 factHash;
    address ethAddr;
    uint strike;
    mapping(uint => Order) buyOrders;
    uint numBuyOrders;
    mapping(uint => Order) sellOrders;
    uint numSellOrders;
  }
  struct Position {
    mapping(uint => int) positions;
    int cash;
  }
  struct OptionChain {
    mapping(uint => Option) options;
    uint numOptions;
    bool expired;
    mapping(address => Position) positions;
  }
  mapping(uint => OptionChain) optionChains;
  uint numOptionChains;
  struct Account {
    address user;
    int capital;
  }
  mapping(uint => Account) accounts;
  uint numAccounts;
  mapping(address => uint) accountIDs;

  function addFunds() {
    if (accountIDs[msg.sender]>0) {
      accounts[accountIDs[msg.sender]].capital += int(msg.value);
    } else {
      uint accountID = ++numAccounts;
      accounts[accountID].user = msg.sender;
      accounts[accountID].capital += int(msg.value);
      accountIDs[msg.sender] = accountID;
    }
  }

  function withdrawFunds(uint amount) {
    if (accountIDs[msg.sender]>0) {
      if (int(amount)<=getAvailableFunds(msg.sender)) {
        accounts[accountIDs[msg.sender]].capital -= int(amount);
        cancelOrders();
        msg.sender.send(amount);
      }
    }
  }

  function getFunds(address user) constant returns(int) {
    if (accountIDs[user]>0) {
      return accounts[accountIDs[user]].capital;
    } else {
      return 0;
    }
  }

  function getAvailableFunds(address user) constant returns(int) {
    if (accountIDs[user]>0) {
      return accounts[accountIDs[user]].capital + getMaxLoss(user);
    } else {
      return 0;
    }
  }

  function expire(uint optionChainID, uint8[] v, bytes32[] r, bytes32[] s, uint256[] value) {
    bool allSigned = true;
    for (uint optionID=0; optionID<optionChains[optionChainID].numOptions; optionID++) {
      var hash = sha256(optionChains[optionChainID].options[optionID].factHash, value[optionID]);
      var signerAddress = ecrecover(hash, v[optionID], r[optionID], s[optionID]);
      if (signerAddress != optionChains[optionChainID].options[optionID].ethAddr) {
        allSigned = false;
      }
    }
    if (allSigned) {
      for (optionID=0; optionID<optionChains[optionChainID].numOptions; optionID++) {
        for (uint accountID=0; accountID<numAccounts; accountID++) {
          int result = optionChains[optionChainID].positions[accounts[accountID].user].cash;
          for (uint j=0; j<optionChains[optionChainID].numOptions; j++) {
            result += (int(value[j]) * optionChains[optionChainID].positions[accounts[accountID].user].positions[j]);
          }
          accounts[accountID].capital = accounts[accountID].capital + result;
        }
      }
      optionChains[optionChainID].expired = true;
    }
  }

  function addOptionChain(uint[] ids, uint[] strikes, bytes32[] factHashes, address[] ethAddrs) {
    if (msg.sender==admin) {
      var optionChainID = numOptionChains++;
      OptionChain optionChain = optionChains[optionChainID];
      optionChain.expired = false;
      for (uint i=0; i < strikes.length; i++) {
        var optionID = optionChain.numOptions++;
        Option option = optionChain.options[optionID];
        option.id = ids[i];
        option.strike = strikes[i];
        option.factHash = factHashes[i];
        option.ethAddr = ethAddrs[i];
      }
    }
  }

  function getNumOptionChains() constant returns(uint) {
    return numOptionChains;
  }
  function getNumOptions(uint optionChainID) constant returns(uint) {
    return optionChains[optionChainID].numOptions;
  }
  function getOption(uint optionChainID, uint optionID) constant returns(uint, uint, bytes32, address) {
    return (optionChains[optionChainID].options[optionID].id, optionChains[optionChainID].options[optionID].strike, optionChains[optionChainID].options[optionID].factHash, optionChains[optionChainID].options[optionID].ethAddr);
  }
  function getPosition(uint optionChainID, uint optionID, address user) constant returns(int) {
    return optionChains[optionChainID].positions[user].positions[optionID];
  }
  function getCash(uint optionChainID, address user) constant returns(int) {
    return optionChains[optionChainID].positions[user].cash;
  }

  function placeBuyOrder(uint optionChainID, uint optionID, uint price, uint size) {
    if (size % 10000 != 0) {
      size -= size % 10000;
    }
    if (max(price * size / 10000,(10000-price) * size / 10000)<=uint(getAvailableFunds(msg.sender))) {
      bool foundMatch = true;
      while (foundMatch && size>0) {
        int256 bestPriceID = -1;
        for (uint256 i=0; i<optionChains[optionChainID].options[optionID].numSellOrders; i++) {
          if (optionChains[optionChainID].options[optionID].sellOrders[i].price<=price && optionChains[optionChainID].options[optionID].sellOrders[i].size>0 && (bestPriceID<0 || optionChains[optionChainID].options[optionID].sellOrders[i].price<optionChains[optionChainID].options[optionID].sellOrders[uint(bestPriceID)].price)) {
            bestPriceID = int(i);
          }
        }
        if (bestPriceID<0) {
          foundMatch = false;
        } else {
          size = orderMatchBuy(optionChainID, optionID, price, size, uint(bestPriceID));
        }
      }
      if (size>0) {
        uint orderID = optionChains[optionChainID].options[optionID].numBuyOrders++;
        Order order = optionChains[optionChainID].options[optionID].buyOrders[orderID];
        order.price = price;
        order.size = size;
        order.user = msg.sender;
      }
    }
  }

  function placeSellOrder(uint optionChainID, uint optionID, uint price, uint size) {
    if (size % 10000 != 0) {
      size -= size % 10000;
    }
    if (max(price * size / 10000,(10000-price) * size / 10000)<=uint(getAvailableFunds(msg.sender))) {
      bool foundMatch = true;
      while (foundMatch && size>0) {
        int256 bestPriceID = -1;
        for (uint256 i=0; i<optionChains[optionChainID].options[optionID].numBuyOrders; i++) {
          if (optionChains[optionChainID].options[optionID].buyOrders[i].price>=price && optionChains[optionChainID].options[optionID].buyOrders[i].size>0 && (bestPriceID<0 || optionChains[optionChainID].options[optionID].buyOrders[i].price>optionChains[optionChainID].options[optionID].buyOrders[uint(bestPriceID)].price)) {
            bestPriceID = int(i);
          }
        }
        if (bestPriceID<0) {
          foundMatch = false;
        } else {
          size = orderMatchSell(optionChainID, optionID, price, size, uint(bestPriceID));
        }
      }
      if (size>0) {
        uint orderID = optionChains[optionChainID].options[optionID].numSellOrders++;
        Order order = optionChains[optionChainID].options[optionID].sellOrders[orderID];
        order.price = price;
        order.size = size;
        order.user = msg.sender;
      }
    }
  }

  function orderMatchBuy(uint optionChainID, uint optionID, uint price, uint size, uint bestPriceID) private returns(uint) {
    uint sizeChange = min(optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].size, size);
    if (getFunds(optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].user)+getMaxLossAfterTrade(optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].user, optionChainID, optionID, int(-sizeChange), int(sizeChange * optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].price / 10000))>0) {
      if (getFunds(msg.sender)+getMaxLossAfterTrade(msg.sender, optionChainID, optionID, int(sizeChange), int(-sizeChange * optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].price / 10000))>0) {
        size -= sizeChange;
        optionChains[optionChainID].positions[msg.sender].positions[optionID] += int(sizeChange);
        optionChains[optionChainID].positions[msg.sender].cash -= int(sizeChange * optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].price / 10000);
        optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].size -= sizeChange;
        optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].user].positions[optionID] -= int(sizeChange);
        optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].user].cash += int(sizeChange * optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].price / 10000);
      }
    } else {
      optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].size = 0;
    }
    return size;
  }

  function orderMatchSell(uint optionChainID, uint optionID, uint price, uint size, uint bestPriceID) private returns(uint) {
    uint sizeChange = min(optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].size, size);
    if (getFunds(optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].user)+getMaxLossAfterTrade(optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].user, optionChainID, optionID, int(sizeChange), int(-sizeChange * optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].price / 10000))>0) {
      if (getFunds(msg.sender)+getMaxLossAfterTrade(msg.sender, optionChainID, optionID, int(-sizeChange), int(sizeChange * optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].price / 10000))>0) {
        size -= sizeChange;
        optionChains[optionChainID].positions[msg.sender].positions[optionID] -= int(sizeChange);
        optionChains[optionChainID].positions[msg.sender].cash += int(sizeChange * optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].price / 10000);
        optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].size -= sizeChange;
        optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].user].positions[optionID] += int(sizeChange);
        optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].user].cash -= int(sizeChange * optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].price / 10000);
      }
    } else {
      optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].size = 0;
    }
    return size;
  }

  function getOptionBuyOrders(uint optionChainID, uint optionID) constant returns(uint[], uint[]) {
    uint[] memory buyPrices = new uint[](3);
    uint[] memory buySizes = new uint[](3);
    uint z = 0;
    uint bestLevel = 10000;
    while (z<3) {
      uint watermark = 0;
      uint size = 0;
      for (uint i=0; i<optionChains[optionChainID].options[optionID].numBuyOrders; i++) {
        if (optionChains[optionChainID].options[optionID].buyOrders[i].size>0 && optionChains[optionChainID].options[optionID].buyOrders[i].price>=watermark && optionChains[optionChainID].options[optionID].buyOrders[i].price<bestLevel) {
          if (optionChains[optionChainID].options[optionID].buyOrders[i].price>watermark) {
            size = 0;
            watermark = optionChains[optionChainID].options[optionID].buyOrders[i].price;
          }
          size += optionChains[optionChainID].options[optionID].buyOrders[i].size;
        }
      }
      if (watermark>0) {
        bestLevel = watermark;
        buyPrices[z] = watermark;
        buySizes[z] = size;
      }
      z = z + 1;
    }
    return (buyPrices, buySizes);
  }

  function getOptionSellOrders(uint optionChainID, uint optionID) constant returns(uint[], uint[]) {
    uint[] memory sellPrices = new uint[](3);
    uint[] memory sellSizes = new uint[](3);
    uint z = 0;
    uint bestLevel = 0;
    while (z<3) {
      uint watermark = 10000;
      uint size = 0;
      for (uint i=0; i<optionChains[optionChainID].options[optionID].numSellOrders; i++) {
        if (optionChains[optionChainID].options[optionID].sellOrders[i].size>0 && optionChains[optionChainID].options[optionID].sellOrders[i].price<=watermark && optionChains[optionChainID].options[optionID].sellOrders[i].price>bestLevel) {
          if (optionChains[optionChainID].options[optionID].sellOrders[i].price<watermark) {
            size = 0;
            watermark = optionChains[optionChainID].options[optionID].sellOrders[i].price;
          }
          size += optionChains[optionChainID].options[optionID].sellOrders[i].size;
        }
      }
      if (watermark<10000) {
        bestLevel = watermark;
        sellPrices[z] = watermark;
        sellSizes[z] = size;
      }
      z = z + 1;
    }
    return (sellPrices, sellSizes);
  }

  function cancelOrders() {
    for (uint optionChainID=0; optionChainID<numOptionChains; optionChainID++) {
      for (uint i=0; i<optionChains[optionChainID].numOptions; i++) {
        for (uint j=0; j<optionChains[optionChainID].options[i].numBuyOrders; j++) {
          if (optionChains[optionChainID].options[i].buyOrders[j].user==msg.sender) {
            optionChains[optionChainID].options[i].buyOrders[j].size = 0;
          }
        }
        for (j=0; j<optionChains[optionChainID].options[i].numSellOrders; j++) {
          if (optionChains[optionChainID].options[i].sellOrders[j].user==msg.sender) {
            optionChains[optionChainID].options[i].sellOrders[j].size = 0;
          }
        }
      }
    }
  }

  function cancelOrdersOnChain(uint optionChainID) {
    for (uint i=0; j<optionChains[optionChainID].numOptions; i++) {
      for (uint j=0; j<optionChains[optionChainID].options[i].numBuyOrders; j++) {
        if (optionChains[optionChainID].options[i].buyOrders[j].user==msg.sender) {
          optionChains[optionChainID].options[i].buyOrders[j].size = 0;
        }
      }
      for (j=0; j<optionChains[optionChainID].options[i].numSellOrders; j++) {
        if (optionChains[optionChainID].options[i].sellOrders[j].user==msg.sender) {
          optionChains[optionChainID].options[i].sellOrders[j].size = 0;
        }
      }
    }
  }

  function getMaxLossAfterTrade(address user, uint optionChainID, uint optionID, int positionChange, int cashChange) constant returns(int) {
    int totalMaxLoss = 0;
    for (uint i=0; i<numOptionChains; i++) {
      if (optionChains[i].expired == false) {
        int maxLoss = 0;
        int pnl = optionChains[i].positions[user].cash;
        if (i==optionChainID) {
          pnl += cashChange;
        }
        maxLoss = pnl;
        for (uint j=0; j<optionChains[i].numOptions; j++) {
          pnl += optionChains[i].positions[user].positions[j];
          if (i==optionChainID && j==optionID) {
            pnl += positionChange;
          }
          if (pnl<maxLoss) {
            maxLoss = pnl;
          }
        }
        totalMaxLoss += maxLoss;
      }
    }
    return totalMaxLoss;
  }

  function getMaxLoss(address user) constant returns(int) {
    int totalMaxLoss = 0;
    for (uint i=0; i<numOptionChains; i++) {
      if (optionChains[i].expired == false) {
        int maxLoss = 0;
        int pnl = optionChains[i].positions[user].cash;
        maxLoss = pnl;
        for (uint j=0; j<optionChains[i].numOptions; j++) {
          pnl += optionChains[i].positions[user].positions[j];
          if (pnl<maxLoss) {
            maxLoss = pnl;
          }
        }
        totalMaxLoss += maxLoss;
      }
    }
    return totalMaxLoss;
  }

  function min(uint a, uint b) constant returns(uint) {
    if (a<b) {
      return a;
    } else {
      return b;
    }
  }
  function max(uint a, uint b) constant returns(uint) {
    if (a>b) {
      return a;
    } else {
      return b;
    }
  }
}
