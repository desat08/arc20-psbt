
export enum Errors {
  ERR_MULTIPLE_ATOMICALS_IN_SAME_UTXO = 0,
  ERR_NOT_ENOUGH_UTXO_TO_BUY = 1,
  ERR_MISSING_BUYER_INFO = 2,
  ERR_MISSING_BUYER_UTXO = 3,
  ERR_MISSING_BUYER_NETWORK_FEE_RATE = 4,
  ERR_INVALID_SIG_NO_FINAL_SCRIPT_WITNESS = 5,
  ERR_INVALID_SIG_NO_TR_SIG = 6,
  ERR_INVALID_SIGNATURE,
  ERR_INVALID_INPUT_COUNT ,
  ERR_INVALID_OUTPUT_COUNT,
  ERR_INVALID_INPUT,
  ERR_INVALID_OUTPUT,
}

export const ErrorMsg: { [error in Errors]: string } = {
  [Errors.ERR_MULTIPLE_ATOMICALS_IN_SAME_UTXO]: 'multiple atomicals in same utxo',
  [Errors.ERR_NOT_ENOUGH_UTXO_TO_BUY]: 'not enough utxo to buy',
  [Errors.ERR_MISSING_BUYER_INFO]: 'missing buyer info',
  [Errors.ERR_MISSING_BUYER_UTXO]: 'missing buyer utxo',
  [Errors.ERR_MISSING_BUYER_NETWORK_FEE_RATE]: 'missing buyer network fee rate',
  [Errors.ERR_INVALID_SIG_NO_FINAL_SCRIPT_WITNESS]: 'invalid signature: no final script witness',
  [Errors.ERR_INVALID_SIG_NO_TR_SIG]: 'invalid signature: no taproot signature present on the finalScriptWitness',
  [Errors.ERR_INVALID_SIGNATURE]: 'invalid signature',
  [Errors.ERR_INVALID_INPUT_COUNT]: 'invalid input count',
  [Errors.ERR_INVALID_OUTPUT_COUNT]: 'invalid output count',
  [Errors.ERR_INVALID_INPUT]: 'invalid input',
  [Errors.ERR_INVALID_OUTPUT]: 'invalid output',
}

export function getError(error: Errors) {
  return {
    code: error,
    message: ErrorMsg[error],
  }
}