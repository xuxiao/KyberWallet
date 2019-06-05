import React from "react";
import { connect } from "react-redux";
import { getTranslate } from "react-localize-redux";
import { ImportAccount } from "../ImportAccount";
import { TopBalance, AccountBalance } from "../TransactionCommon";
import { Modal } from "../../components/CommonElement"
import * as limitOrderActions from "../../actions/limitOrderActions";
import * as globalActions from "../../actions/globalActions";
import BLOCKCHAIN_INFO from "../../../../env";

import { isUserLogin } from "../../utils/common";
import * as converters from "../../utils/converter";

@connect((store, props) => {
  const account = store.account.account;
  const translate = getTranslate(store.locale);
  const tokens = store.tokens.tokens;
  const limitOrder = store.limitOrder;
  const ethereum = store.connection.ethereum;
  const global = store.global;
  const { walletName } = store.account;

  return {
    translate,
    limitOrder,
    tokens,
    account,
    ethereum,
    global,
    walletName
  };
})
export default class LimitOrderAccount extends React.Component {
  constructor() {
    super();
    this.state = {
      isAdvanceTokenVisible: false,
      isReimport: false
    }
  }

  selectTokenBalance = () => {
    this.props.dispatch(limitOrderActions.setIsSelectTokenBalance(true));
  };

  getMaxGasApprove = () => {
    var tokens = this.props.tokens
    var sourceSymbol = this.props.limitOrder.sourceTokenSymbol
    if (tokens[sourceSymbol] && tokens[sourceSymbol].gasApprove) {
      return tokens[sourceSymbol].gasApprove
    } else {
      return this.props.limitOrder.max_gas_approve
    }
  }

  getMaxGasExchange = () => {
    const tokens = this.props.tokens
    var destTokenSymbol = BLOCKCHAIN_INFO.wrapETHToken
    var destTokenLimit = tokens[destTokenSymbol] && tokens[destTokenSymbol].gasLimit ? tokens[destTokenSymbol].gasLimit : this.props.limitOrder.max_gas

    return destTokenLimit;

  }

  calcualteMaxFee = () => {
    var gasApprove = this.getMaxGasApprove()
    var gasExchange = this.getMaxGasExchange()
    var totalGas = gasExchange + gasApprove * 2

    var totalFee = converters.calculateGasFee(this.props.limitOrder.gasPrice, totalGas)
    return totalFee
  }


  selectToken = (sourceSymbol) => {

    this.props.chooseToken(sourceSymbol, this.props.tokens[sourceSymbol].address, "source")

    // var sourceBalance = this.props.tokens[sourceSymbol].balance

    const tokens = this.getFilteredTokens();
    const srcToken = tokens.find(token => {
      return token.symbol === sourceSymbol;
    });
    var sourceBalance = srcToken.balance;

    var sourceDecimal = this.props.tokens[sourceSymbol].decimals

    sourceBalance = converters.toT(sourceBalance, sourceDecimal)
    if (sourceSymbol === BLOCKCHAIN_INFO.wrapETHToken) {

      //if souce token is weth, we spend a small amount to make approve tx, swap tx

      var ethBalance = this.props.tokens["ETH"].balance
      var fee = this.calcualteMaxFee()
      if (converters.compareTwoNumber(ethBalance, converters.toEther(fee)) === 1) {
        sourceBalance -= fee
      } else {
        sourceBalance -= converters.toEther(ethBalance)
      }

    }

    if (sourceBalance < 0) sourceBalance = 0;

    // if (this.props.screen === "swap" || this.props.screen === "limit_order") {
    //     this.props.dispatch(this.props.changeAmount('source', amount))
    //     this.props.dispatch(this.props.changeFocus('source'));
    // } else {
    //     this.props.dispatch(this.props.changeAmount(amount))
    //     // this.props.changeFocus()
    // }
    this.props.dispatch(limitOrderActions.inputChange('source', sourceBalance))
    this.props.dispatch(limitOrderActions.focusInput('source'));

    this.selectTokenBalance();
    this.props.global.analytics.callTrack("trackClickToken", sourceSymbol, "limit_order");
  }

  toggleAdvanceTokeBalance = () => {
    this.setState({
      isAdvanceTokenVisible: !this.state.isAdvanceTokenVisible
    });
  }

  openReImport = () => {
    this.setState({ isReImport: true });
  }

  closeReImport = () => {
    this.setState({ isReImport: false, isAdvanceTokenVisible: false });
  }

  clearSession = () => {
    this.closeReImport();
    this.props.dispatch(globalActions.clearSession(this.props.limitOrder.gasPrice));
    this.props.global.analytics.callTrack("trackClickChangeWallet");
    // this.props.dispatch(globalActions.setGasPrice(this.props.ethereum))
  }

  reImportModal = () => {
    return (
      <div className="reimport-modal">
        <a className="x" onClick={this.closeReImport}>&times;</a>
        <div className="title">{this.props.translate("import.do_you_want_to_connect_other_wallet") || "Do you want to connect other Wallet?"}</div>
        <div className="content">
          <a className="button confirm-btn" onClick={this.clearSession}>{this.props.translate("import.yes") || "Yes"}</a>
          <a className="button cancel-btn" onClick={this.closeReImport}>{this.props.translate("import.no") || "No"}</a>
        </div>
      </div>
    )
  }

  getFilteredTokens = (orderByDesc = true, itemNumber = false) => {
    let filteredTokens = [];
    const tokens = this.props.getAvailableBalanceTokenList();

    if (orderByDesc) {
      filteredTokens = converters.sortEthBalance(tokens);
    } else {
      filteredTokens = converters.sortASCEthBalance(tokens);
    }

    const weth = this.props.mergeEthIntoWeth(filteredTokens);

    filteredTokens = this.props.getTokenListWithoutEthAndWeth(filteredTokens);

    if (weth) {
      filteredTokens.splice(0, 0, weth)
    }

    filteredTokens = itemNumber ? filteredTokens.slice(0, itemNumber) : filteredTokens;

    return filteredTokens;
  }

  render() {
    if (this.props.account === false) {
      return (
        <div className={"limit-order-account"}>
          <ImportAccount
            tradeType="limit_order"
            isAgreedTermOfService={this.props.global.termOfServiceAccepted}
            isAcceptConnectWallet={this.props.global.isAcceptConnectWallet}
          />
        </div>
      );
    } else {
      return (
        <div className={"limit-order-account"}>
          <div className="limit-order-account__title">
            <div>
              {this.props.translate("limit_order.your_balance") || "Your Available Balance"}
            </div>
            <div className="reimport-msg">
              <div onClick={this.openReImport}>
                {this.props.translate("import.connect_other_wallet") || "Connect other wallet"}
              </div>
              <Modal className={{
                base: 'reveal tiny reimport-modal',
                afterOpen: 'reveal tiny reimport-modal reimport-modal--tiny'
              }}
                isOpen={this.state.isReImport}
                onRequestClose={this.closeReImport}
                contentLabel="advance modal"
                content={this.reImportModal()}
                size="tiny"
              />
            </div>
          </div>

          <TopBalance
            // isLimitOrderTab={true}
            // getFilteredTokens={this.getFilteredTokens}
            showMore={this.toggleAdvanceTokeBalance}
            // chooseToken={this.props.chooseToken}
            activeSymbol={this.props.limitOrder.sourceTokenSymbol}
            screen="limit_order"
            // selectTokenBalance={this.selectTokenBalance}
            // changeAmount={limitOrderActions.inputChange}
            // changeFocus={limitOrderActions.focusInput}
            selectToken={this.selectToken}
            orderedTokens={this.getFilteredTokens(true, 3)}
          />

          {this.state.isAdvanceTokenVisible && <div className="limit-order-account__advance">
            <div className="advance-close" onClick={e => this.toggleAdvanceTokeBalance()}>
              <div className="advance-close_wrapper"></div>
            </div>
            <AccountBalance
              isLimitOrderTab={true}
              getFilteredTokens={this.getFilteredTokens}
              // chooseToken={this.props.chooseToken}
              sourceActive={this.props.limitOrder.sourceTokenSymbol}
              isBalanceActive={this.state.isAdvanceTokenVisible}
              isOnDAPP={this.props.account.isOnDAPP}
              walletName={this.props.walletName}
              screen="limit_order"
              // selectTokenBalance={this.selectTokenBalance}
              // changeAmount={limitOrderActions.inputChange}
              // changeFocus={limitOrderActions.focusInput}
              selectToken={this.selectToken}
            />
          </div>}
        </div>
      );
    }
  }
}
