
export enum Errors {
  ERR_MULTIPLE_ATOMICALS_IN_SAME_UTXO = 0,
  ERR_NOT_ENOUGH_UTXO_TO_BUY = 1,
}

export const ErrorMsg: { [error in Errors]: string } = {
  [Errors.ERR_MULTIPLE_ATOMICALS_IN_SAME_UTXO]: 'multiple atomicals in same utxo',
  [Errors.ERR_NOT_ENOUGH_UTXO_TO_BUY]: 'not enough utxo to buy',
}

export function getError(error: Errors) {
  return {
    code: error,
    message: ErrorMsg[error],
  }
}