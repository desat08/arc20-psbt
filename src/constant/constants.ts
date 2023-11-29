import { networks } from 'bitcoinjs-lib';
import * as process from 'process';

export const BITCOIN_RPC_HOST =
  process.env.BITCOIN_RPC_HOST || 'http://localhost';
export const BITCOIN_RPC_PORT = Number(process.env.BITCOIN_RPC_PORT ?? 38332);
export const BITCOIN_RPC_USER = process.env.BITCOIN_RPC_USER || '__cookie__';
export const BITCOIN_RPC_PASS = process.env.BITCOIN_RPC_PASS || '';
export const BITCOIN_RPC_TIMEOUT = Number(
  process.env.BITCOIN_RPC_TIMEOUT ?? 120000,
);
export const NETWORK = process.env.NETWORK === 'testnet' ? networks.testnet : process.env.NETWORK === 'regtest'? networks.regtest:networks.bitcoin;

export const DUMMY_UTXO_MIN_VALUE = Number(
  process.env.DUMMY_UTXO_MIN_VALUE ?? 580,
);

export const BRC20_UTXO_VALUE = Number(546);
export const PLATFORM_FEE_ADDRESS = process.env.PLATFORM_FEE_ADDRESS || '';

export const BUYING_PSBT_SELLER_SIGNATURE_INDEX = 1;
export const BUYING_PSBT_BUYER_RECEIVE_INDEX = 0;
export const BUYING_PSBT_PLATFORM_FEE_INDEX = 2;