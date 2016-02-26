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
    bool expired;
    bool hasPosition;
  }
  struct OptionChain {
    uint expiration;
    string underlying;
    mapping(uint => Option) options;
    uint numOptions;
    bool expired;
    mapping(address => Position) positions;
    uint numPositions;
    uint numPositionsExpired;
  }
  mapping(uint => OptionChain) optionChains;
  uint numOptionChains;
  struct Account {
    address user;
    int capital;
  }
  mapping(uint => Account) accounts;
  uint numAccounts;
  mapping(address => uint) accountIDs; //starts at 1

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
      if (int(amount)<=getFunds(msg.sender, true)) {
        accounts[accountIDs[msg.sender]].capital -= int(amount);
        cancelOrders();
        msg.sender.send(amount);
      }
    }
  }

  function getFunds(address user, bool onlyAvailable) constant returns(int) {
    if (accountIDs[user]>0) {
      if (onlyAvailable == false) {
        return accounts[accountIDs[user]].capital;
      } else {
        return accounts[accountIDs[user]].capital + getMaxLossAfterTrade(user, 0, 0, 0, 0);
      }
    } else {
      return 0;
    }
  }

  function getFundsAndAvailable(address user) constant returns(int, int) {
    return (getFunds(user, false), getFunds(user, true));
  }

  function getOptionChain(uint optionChainID) constant returns (uint, string) {
    return (optionChains[optionChainID].expiration, optionChains[optionChainID].underlying);
  }

  function getMarket(address user) constant returns(uint[], uint[], uint[], int[], int[]) {
    uint[] memory optionIDs = new uint[](30);
    uint[] memory strikes = new uint[](30);
    uint[] memory ids = new uint[](30);
    int[] memory positions = new int[](30);
    int[] memory cashes = new int[](30);
    uint z = 0;
    for (int optionChainID=int(numOptionChains)-1; optionChainID>=0 && z<30; optionChainID--) {
      if (optionChains[uint(optionChainID)].expired == false) {
        for (uint optionID=0; optionID<optionChains[uint(optionChainID)].numOptions; optionID++) {
          optionIDs[z] = uint(optionChainID)*1000 + optionID;
          strikes[z] = optionChains[uint(optionChainID)].options[optionID].strike;
          ids[z] = optionChains[uint(optionChainID)].options[optionID].id;
          positions[z] = optionChains[uint(optionChainID)].positions[user].positions[optionID];
          cashes[z] = optionChains[uint(optionChainID)].positions[user].cash;
          z++;
        }
      }
    }
    return (optionIDs, strikes, ids, positions, cashes);
  }

  function getMarketTopLevels() constant returns(uint[], uint[], uint[], uint[]) {
    uint[] memory buyPrices = new uint[](30);
    uint[] memory buySizes = new uint[](30);
    uint[] memory sellPrices = new uint[](30);
    uint[] memory sellSizes = new uint[](30);
    uint z = 0;
    for (int optionChainID=int(numOptionChains)-1; optionChainID>=0 && z<30; optionChainID--) {
      if (optionChains[uint(optionChainID)].expired == false) {
        for (uint optionID=0; optionID<optionChains[uint(optionChainID)].numOptions; optionID++) {
          (buyPrices[z], buySizes[z], sellPrices[z], sellSizes[z]) = getTopLevel(uint(optionChainID), optionID);
          z++;
        }
      }
    }
    return (buyPrices, buySizes, sellPrices, sellSizes);
  }

  function expire(uint accountID, uint optionChainID, uint8[] v, bytes32[] r, bytes32[] s, uint[] value) {
    bool allSigned = true;
    if (optionChains[optionChainID].expired == false) {
      for (uint optionID=0; optionID<optionChains[optionChainID].numOptions; optionID++) {
        address signerAddress = ecrecover(sha3(optionChains[optionChainID].options[optionID].factHash, value[optionID]), v[optionID], r[optionID], s[optionID]);
        if (signerAddress != optionChains[optionChainID].options[optionID].ethAddr) {
          allSigned = false;
        }
      }
      if (allSigned) {
        uint lastAccount = numAccounts;
        if (accountID==0) {
          accountID = 1;
        } else {
          lastAccount = accountID;
        }
        for (accountID=accountID; accountID<=lastAccount; accountID++) {
          if (optionChains[optionChainID].positions[accounts[accountID].user].expired == false) {
            int result = optionChains[optionChainID].positions[accounts[accountID].user].cash;
            for (optionID=0; optionID<optionChains[optionChainID].numOptions; optionID++) {
              result += (int(value[optionID]) * optionChains[optionChainID].positions[accounts[accountID].user].positions[optionID]);
            }
            accounts[accountID].capital = accounts[accountID].capital + result;
            optionChains[optionChainID].positions[accounts[accountID].user].expired = true;
            optionChains[optionChainID].numPositionsExpired++;
          }
        }
        if (optionChains[optionChainID].numPositionsExpired == optionChains[optionChainID].numPositions) {
          optionChains[optionChainID].expired = true;
        }
      }
    }
  }

  function addOptionChain(uint existingOptionChainID, uint expiration, string underlying, uint[] ids, uint[] strikes, bytes32[] factHashes, address[] ethAddrs) {
    if (msg.sender==admin) {
      uint optionChainID = 6;
      if (numOptionChains<6) {
        optionChainID = numOptionChains++;
      } else {
        for (uint i=0; i < numOptionChains && optionChainID>=6; i++) {
          if (optionChains[i].expired==true || optionChains[i].numOptions==0) {
            optionChainID = i;
          }
        }
      }
      if (optionChainID<6) {
        if (existingOptionChainID<6) {
          optionChainID = existingOptionChainID;
        } else {
          delete optionChains[optionChainID];
        }
        OptionChain optionChain = optionChains[optionChainID];
        optionChain.expiration = expiration;
        optionChain.underlying = underlying;
        for (i=0; i < strikes.length; i++) {
          if (optionChain.numOptions<5) {
            uint optionID = optionChain.numOptions++;
            Option option = optionChain.options[i];
            option.id = ids[i];
            option.strike = strikes[i];
            option.factHash = factHashes[i];
            option.ethAddr = ethAddrs[i];
            optionChain.options[i] = option;
          }
        }
      }
    }
  }

  function placeBuyOrder(uint optionChainID, uint optionID, uint price, uint size) {
    if (size % 10000 != 0) {
      size -= size % 10000;
    }
    if (getFunds(msg.sender, false)+getMaxLossAfterTrade(msg.sender, optionChainID, optionID, int(size), -int(size * price / 10000))>0) {
      bool foundMatch = true;
      while (foundMatch && size>0) {
        int bestPriceID = -1;
        for (uint i=0; i<optionChains[optionChainID].options[optionID].numSellOrders; i++) {
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
        uint orderID = 5;
        if (optionChains[optionChainID].options[optionID].numBuyOrders < 5) {
          orderID = optionChains[optionChainID].options[optionID].numBuyOrders++;
        } else {
          for (i=0; i<optionChains[optionChainID].options[optionID].numBuyOrders && (orderID>=5 || optionChains[optionChainID].options[optionID].buyOrders[orderID].size!=0); i++) {
            if (optionChains[optionChainID].options[optionID].buyOrders[i].size==0) {
              orderID = i;
            } else if (optionChains[optionChainID].options[optionID].buyOrders[i].price<price && (orderID>=5 || (optionChains[optionChainID].options[optionID].buyOrders[i].price<optionChains[optionChainID].options[optionID].buyOrders[orderID].price))) {
              orderID = i;
            }
          }
        }
        if (orderID<5) {
          optionChains[optionChainID].options[optionID].buyOrders[orderID] = Order(price, size, msg.sender);
        }
      }
    }
  }

  function placeSellOrder(uint optionChainID, uint optionID, uint price, uint size) {
    if (size % 10000 != 0) {
      size -= size % 10000;
    }
    if (getFunds(msg.sender, false)+getMaxLossAfterTrade(msg.sender, optionChainID, optionID, -int(size), int(size * price / 10000))>0) {
      bool foundMatch = true;
      while (foundMatch && size>0) {
        int bestPriceID = -1;
        for (uint i=0; i<optionChains[optionChainID].options[optionID].numBuyOrders; i++) {
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
        uint orderID = 5;
        if (optionChains[optionChainID].options[optionID].numSellOrders < 5) {
          orderID = optionChains[optionChainID].options[optionID].numSellOrders++;
        } else {
          for (i=0; i<optionChains[optionChainID].options[optionID].numSellOrders && (orderID>=5 || optionChains[optionChainID].options[optionID].sellOrders[orderID].size!=0); i++) {
            if (optionChains[optionChainID].options[optionID].sellOrders[i].size==0) {
              orderID = i;
            } else if (optionChains[optionChainID].options[optionID].sellOrders[i].price>price && (orderID>=5 || (optionChains[optionChainID].options[optionID].sellOrders[i].price>optionChains[optionChainID].options[optionID].sellOrders[orderID].price))) {
              orderID = i;
            }
          }
        }
        if (orderID<5) {
          optionChains[optionChainID].options[optionID].sellOrders[orderID] = Order(price, size, msg.sender);
        }
      }
    }
  }

  function orderMatchBuy(uint optionChainID, uint optionID, uint price, uint size, uint bestPriceID) private returns(uint) {
    uint sizeChange = min(optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].size, size);
    if (getFunds(optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].user, false)+getMaxLossAfterTrade(optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].user, optionChainID, optionID, -int(sizeChange), int(sizeChange * optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].price / 10000))>0) {
      size -= sizeChange;
      if (optionChains[optionChainID].positions[msg.sender].hasPosition == false) {
        optionChains[optionChainID].positions[msg.sender].hasPosition = true;
        optionChains[optionChainID].numPositions++;
      }
      if (optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].user].hasPosition == false) {
        optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].user].hasPosition = true;
        optionChains[optionChainID].numPositions++;
      }
      optionChains[optionChainID].positions[msg.sender].positions[optionID] += int(sizeChange);
      optionChains[optionChainID].positions[msg.sender].cash -= int(sizeChange * optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].price / 10000);
      optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].size -= sizeChange;
      optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].user].positions[optionID] -= int(sizeChange);
      optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].user].cash += int(sizeChange * optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].price / 10000);
    } else {
      optionChains[optionChainID].options[optionID].sellOrders[bestPriceID].size = 0;
    }
    return size;
  }

  function orderMatchSell(uint optionChainID, uint optionID, uint price, uint size, uint bestPriceID) private returns(uint) {
    uint sizeChange = min(optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].size, size);
    if (getFunds(optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].user, false)+getMaxLossAfterTrade(optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].user, optionChainID, optionID, int(sizeChange), -int(sizeChange * optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].price / 10000))>0) {
      size -= sizeChange;
      if (optionChains[optionChainID].positions[msg.sender].hasPosition == false) {
        optionChains[optionChainID].positions[msg.sender].hasPosition = true;
        optionChains[optionChainID].numPositions++;
      }
      if (optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].user].hasPosition == false) {
        optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].user].hasPosition = true;
        optionChains[optionChainID].numPositions++;
      }
      optionChains[optionChainID].positions[msg.sender].positions[optionID] -= int(sizeChange);
      optionChains[optionChainID].positions[msg.sender].cash += int(sizeChange * optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].price / 10000);
      optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].size -= sizeChange;
      optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].user].positions[optionID] += int(sizeChange);
      optionChains[optionChainID].positions[optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].user].cash -= int(sizeChange * optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].price / 10000);
    } else {
      optionChains[optionChainID].options[optionID].buyOrders[bestPriceID].size = 0;
    }
    return size;
  }

  function getTopLevel(uint optionChainID, uint optionID) private constant returns(uint, uint, uint, uint) {
    uint buyPrice = 0;
    uint buySize = 0;
    uint sellPrice = 0;
    uint sellSize = 0;
    uint watermark = 0;
    uint size = 0;
    for (uint i=0; i<optionChains[optionChainID].options[optionID].numBuyOrders; i++) {
      if (optionChains[optionChainID].options[optionID].buyOrders[i].size>0 && optionChains[optionChainID].options[optionID].buyOrders[i].price>=watermark) {
        if (optionChains[optionChainID].options[optionID].buyOrders[i].price>watermark) {
          size = 0;
          watermark = optionChains[optionChainID].options[optionID].buyOrders[i].price;
        }
        size += optionChains[optionChainID].options[optionID].buyOrders[i].size;
      }
    }
    buyPrice = watermark;
    buySize = size;
    watermark = 10000;
    size = 0;
    for (i=0; i<optionChains[optionChainID].options[optionID].numSellOrders; i++) {
      if (optionChains[optionChainID].options[optionID].sellOrders[i].size>0 && optionChains[optionChainID].options[optionID].sellOrders[i].price<=watermark) {
        if (optionChains[optionChainID].options[optionID].sellOrders[i].price<watermark) {
          size = 0;
          watermark = optionChains[optionChainID].options[optionID].sellOrders[i].price;
        }
        size += optionChains[optionChainID].options[optionID].sellOrders[i].size;
      }
    }
    sellPrice = watermark;
    sellSize = size;
    return (buyPrice, buySize, sellPrice, sellSize);
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

  function changeAdmin(address newAdmin) {
    if (msg.sender == admin) {
      admin = newAdmin;
    }
  }

  function min(uint a, uint b) constant returns(uint) {
    if (a<b) {
      return a;
    } else {
      return b;
    }
  }
}
