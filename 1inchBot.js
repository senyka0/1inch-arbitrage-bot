const ethers = require("ethers");
const fetch = require("node-fetch");

const chainId = 137;
const sum = 100;
const minProfit = 0.5;
const user = ""; //your wallet address
const key = ""; //your private key
let totalProfit = 0;

const provider = new ethers.providers.JsonRpcProvider(
  "https://polygon-mainnet.infura.io/v3/44d0fea624674cde9a12f7960341840d"
);
const signer = new ethers.Wallet(key, provider);
const mainCurrency = {
  symbol: "USDT",
  name: "Tether USD",
  decimals: 6,
  address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  logoURI:
    "https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png",
};
const usdt = new ethers.Contract(
  mainCurrency.address,
  [
    {
      constant: true,
      inputs: [{ name: "who", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "", type: "uint256" }],
      payable: false,
      stateMutability: "view",
      type: "function",
    },
  ],
  signer
);
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const safeFetch = async (url) => {
  while (true) {
    const result = await fetch(url).then((result) => {
      if (result.status === 200) {
        return result.json();
      }
    });
    if (result !== undefined) {
      return result;
    } else {
      console.log("API recall");
      await sleep(2000);
      continue;
    }
  }
};
async function main() {
  let result1 = await fetch(
    `https://api.1inch.exchange/v4.0/${chainId}/tokens`
  ).then((result) => {
    if (result.status === 200) {
      return result.json();
    }
  });
  let arr = Object.keys(result1.tokens);
  arr.shift();
  for (const tokenAddress of arr) {
    let result2 = await fetch(
      `https://api.1inch.exchange/v4.0/${chainId}/quote?fromTokenAddress=${
        mainCurrency.address
      }&toTokenAddress=${tokenAddress}&amount=${
        sum * Math.pow(10, mainCurrency.decimals)
      }`
    ).then((result) => {
      if (result.status === 200) {
        return result.json();
      }
    });
    if (result2 !== undefined) {
      let result3 = await fetch(
        `https://api.1inch.exchange/v4.0/${chainId}/quote?fromTokenAddress=${tokenAddress}&toTokenAddress=${mainCurrency.address}&amount=${result2.toTokenAmount}`
      ).then((result) => {
        if (result.status === 200) {
          return result.json();
        }
      });
      if (result3 !== undefined) {
        if (
          result3.toTokenAmount / Math.pow(10, mainCurrency.decimals) - sum >
          (sum / 100) * minProfit
        ) {
          let ExpectedProfit = (
            ((result3.toTokenAmount / Math.pow(10, mainCurrency.decimals) -
              sum) /
              sum) *
            100
          ).toFixed(2);
          let result4 = await fetch(
            `https://api.1inch.exchange/v4.0/${chainId}/swap?fromTokenAddress=${
              mainCurrency.address
            }&toTokenAddress=${tokenAddress}&amount=${
              sum * Math.pow(10, mainCurrency.decimals)
            }&fromAddress=${user}&slippage=${ExpectedProfit - minProfit}`
          ).then((result) => {
            if (result.status === 200) {
              return result.json();
            }
          });
          if (result4 !== undefined) {
            let updatedProfit =
              ((result4.toTokenAmount / Math.pow(10, result4.toToken.decimals) -
                result2.toTokenAmount /
                  Math.pow(10, result2.toToken.decimals)) /
                (result2.toTokenAmount /
                  Math.pow(10, result2.toToken.decimals))) *
              100;
            let dif =
              ((result3.toTokenAmount / Math.pow(10, mainCurrency.decimals) -
                sum) /
                sum) *
                100 +
              updatedProfit;
            console.log(updatedProfit);
            console.log(dif);
            if (dif > minProfit) {
              try {
                console.log({
                  Route: `${result2.fromToken.symbol} => ${result3.fromToken.symbol} => ${result2.fromToken.symbol}`,
                  ExpectedProfit: `${
                    ((result3.toTokenAmount /
                      Math.pow(10, mainCurrency.decimals) -
                      sum) /
                      sum) *
                      100 +
                    updatedProfit
                  } %`,
                });
                let startBalance =
                  (await usdt.balanceOf(user)).toString() /
                  Math.pow(10, mainCurrency.decimals);
                let tx1 = result4.tx;
                tx1.gasLimit = tx1.gas;
                delete tx1.gas;
                console.log(
                  `swap ${result2.fromToken.symbol} => ${result3.fromToken.symbol}`
                );
                let buy = await signer.sendTransaction(tx1);
                await buy.wait();
                let token = new ethers.Contract(
                  tokenAddress,
                  [
                    {
                      constant: true,
                      inputs: [{ name: "who", type: "address" }],
                      name: "balanceOf",
                      outputs: [{ name: "", type: "uint256" }],
                      payable: false,
                      stateMutability: "view",
                      type: "function",
                    },
                  ],
                  signer
                );
                let balance = (await token.balanceOf(user)).toString();
                let result5 = await safeFetch(
                  `https://api.1inch.exchange/v4.0/${chainId}/approve/transaction?tokenAddress=${result4.toToken.address}&amount=${balance}`
                );
                let tx2 = result5;
                console.log(`approve ${result3.fromToken.symbol}`);
                let approve = await signer.sendTransaction(tx2);
                await approve.wait();
                let result6 = await safeFetch(
                  `https://api.1inch.exchange/v4.0/${chainId}/swap?fromTokenAddress=${tokenAddress}&toTokenAddress=${mainCurrency.address}&amount=${balance}&fromAddress=${user}&slippage=5`
                );
                let tx3 = result6.tx;
                tx3.gasLimit = tx3.gas;
                delete tx3.gas;
                console.log(
                  `swap ${result3.fromToken.symbol} => ${result2.fromToken.symbol}`
                );
                let sell = await signer.sendTransaction(tx3);
                await sell.wait();
                let endBalance =
                  (await usdt.balanceOf(user)).toString() /
                  Math.pow(10, mainCurrency.decimals);
                totalProfit = totalProfit + (endBalance - startBalance);
                console.log({
                  Route: `${result2.fromToken.symbol} => ${result3.fromToken.symbol} => ${result2.fromToken.symbol}`,
                  Profit: `${((endBalance - startBalance) / sum) * 100} %`,
                  TotalProfit: `${totalProfit} $`,
                });
              } catch (e) {
                console.log("slippage error");
                console.log(e);
                continue;
              }
            }
          }
        }
      }
    }
  }
  main();
}
main();
