import Web3 from "web3"
import constants from "./constants"

import { updateBlock, updateBlockFailed, updateRate } from "../actions/globalActions"
import { updateAccount } from "../actions/accountActions"
import { updateWallet } from "../actions/walletActions"
import { updateTx } from "../actions/txActions"
import SupportedTokens from "./supported_tokens"
import * as ethUtil from 'ethereumjs-util'
import store from "../store"

export default class EthereumService {
  constructor() {
    // this.rpc = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))
    this.rpc = new Web3(new Web3.providers.HttpProvider("https://kovan.infura.io/0BRKxQ0SFvAxGL72cbXi", 9000))
    this.erc20Contract = this.rpc.eth.contract(constants.ERC20)
    this.networkAddress = constants.NETWORK_ADDRESS
    this.networkContract = this.rpc.eth.contract(constants.KYBER_NETWORK).at(this.networkAddress)
  }

  version() {
    return this.rpc.version.api
  }

  getBalance(address, callback) {
    this.rpc.eth.getBalance(address, (error, balance) => {
      if (error != null) {
        console.log(error)
      } else {
        callback(balance)
      }
    })
  }

  getNonce(address, callback) {
    this.rpc.eth.getTransactionCount(address, "pending", (error, nonce) => {
      if (error != null) {
        console.log(error)
      } else {
        callback(nonce)
      }
    })
  }

  getTokenBalance(address, ownerAddr, callback) {
    var instance = this.erc20Contract.at(address)
    instance.balanceOf(ownerAddr, (error, result) => {
      if (error != null) {
        console.log(error)
      } else {
        callback(result)
      }
    })
  }

  watch() {
    this.rpc.eth.filter("latest", this.actAndWatch.bind(this), (error) => {
      // the node is not support for filtering
      this.fetchData()
      this.intervalID = setInterval(this.fetchData.bind(this), 10000)
    })
  }

  fetchRateData() {
    var state = store.getState()
    var ethereum = state.connection.ethereum
    var tokens = [{
      name: "Ether",
      icon: "/img/ether.png",
      address: constants.ETHER_ADDRESS}]
    for (var i = 0; i < SupportedTokens.length; i++) {
      tokens.push({
        name: SupportedTokens[i].name,
        icon: SupportedTokens[i].icon,
        address: SupportedTokens[i].address
      })
    }
    var rates = {}
    for (var i = 0; i < tokens.length; i++) {
      for (var j = 0; j < tokens.length; j++) {
        if (i != j) {
          for (var k = 0; k < constants.RESERVES.length; k++) {
            var reserve = constants.RESERVES[k]
            store.dispatch(updateRate(ethereum, tokens[i], tokens[j], reserve))
          }
        }
      }
    }
  }

  fetchTxsData = () => {
    var state = store.getState()
    var tx
    var txs = state.txs
    var ethereum = state.connection.ethereum
    Object.keys(txs).forEach((hash) => {
      tx = txs[hash]
      if (tx.status == "pending") {
        store.dispatch(updateTx(ethereum, tx))
      }
    })
  }

  fetchAccountsData() {
    var state = store.getState()
    var ethereum = state.connection.ethereum
    var accounts = store.getState().accounts.accounts
    Object.keys(accounts).forEach((key) => {
      console.log("updating account: " + key)
      store.dispatch(updateAccount(ethereum, accounts[key]))
    })
  }

  fetchWalletsData() {
    var state = store.getState()
    var ethereum = state.connection.ethereum
    var wallets = store.getState().wallets.wallets
    Object.keys(wallets).forEach((key) => {
      console.log("updating wallet: " + key)
      store.dispatch(updateWallet(ethereum, wallets[key]))
    })
  }

  fetchData() {
    console.log("start fetching data")
    this.fetchTxsData()
    this.fetchRateData()
    this.fetchWalletsData()
    this.fetchAccountsData()
    console.log("done fetching and dispatching actions")
  }

  actAndWatch(error, result) {
    if (error != null) {
      store.dispatch(updateBlockFailed(error))
    } else {
      store.dispatch(updateBlock(result))
      this.fetchData()
    }
  }

  exchangeData(sourceToken, sourceAmount, destToken, destAddress,
    maxDestAmount, minConversionRate, throwOnFailure) {
    return this.networkContract.trade.getData(
      sourceToken, sourceAmount, destToken, destAddress,
      maxDestAmount, minConversionRate, throwOnFailure)
  }

  paymentData(walletAddress, sourceToken, sourceAmount, destToken, maxDestAmount,
    minConversionRate, destAddress, data, onlyApproveToken, throwOnFailure) {
    var wallet = this.rpc.eth.contract(constants.KYBER_WALLET).at(walletAddress)
    return wallet.convertAndCall.getData(
      sourceToken, sourceAmount, destToken, maxDestAmount,
      minConversionRate, destAddress, data, onlyApproveToken, throwOnFailure
    )
  }

  approveTokenData(sourceToken, sourceAmount) {
    var tokenContract = this.erc20Contract.at(sourceToken)
    return tokenContract.approve.getData(this.networkAddress, sourceAmount)
  }

  txMined(hash, callback) {
    this.rpc.eth.getTransactionReceipt(hash, (error, result) => {
      if (error != null) {
        console.log(error)
      } else {
        result == null ? callback(false, undefined) : callback(true, result.contractAddress)
      }
    })
  }

  getRate(source, dest, reserve, callback) {
    return this.networkContract.getRate(source, dest, reserve, (error, result) => {
      if (error != null) {
        console.log(error)
      } else {
        callback(result)
      }
    })
  }

  // tx should be ethereumjs-tx object
  sendRawTransaction(tx) {
    return this.rpc.eth.sendRawTransaction(
      ethUtil.bufferToHex(tx.serialize()))
  }

  deployKyberWalletData(from) {
    var _kyberNetwork = constants.NETWORK_ADDRESS
    var contract = this.rpc.eth.contract(constants.KYBER_WALLET)
    return contract.new.getData(_kyberNetwork, {
      data: constants.KYBER_WALLET_DATA,
    })
  }
}