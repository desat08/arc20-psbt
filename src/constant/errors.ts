
export enum Errors {
  ERR_MULTIPLE_ATOMICALS_IN_SAME_UTXO = 0,
  ERR_NOT_ENOUGH_UTXO_TO_BUY = 1,
  ERR_MISSING_BUYER_INFO = 2,
  ERR_MISSING_BUYER_UTXO = 3,
  ERR_MISSING_BUYER_NETWORK_FEE_RATE = 4,
}

export const ErrorMsg: { [error in Errors]: string } = {
  [Errors.ERR_MULTIPLE_ATOMICALS_IN_SAME_UTXO]: 'multiple atomicals in same utxo',
  [Errors.ERR_NOT_ENOUGH_UTXO_TO_BUY]: 'not enough utxo to buy',
  [Errors.ERR_MISSING_BUYER_INFO]: 'missing buyer info',
  [Errors.ERR_MISSING_BUYER_UTXO]: 'missing buyer utxo',
  [Errors.ERR_MISSING_BUYER_NETWORK_FEE_RATE]: 'missing buyer network fee rate',
}

export function getError(error: Errors) {
  return {
    code: error,
    message: ErrorMsg[error],
  }
}