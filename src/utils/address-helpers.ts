import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import { NETWORK } from '../constant/constants';
const bitcoin = require('bitcoinjs-lib');

export enum AddressTypeString {
  p2pkh = 'p2pkh',
  p2tr = 'p2tr',
  p2sh = 'p2sh',
  p2wpkh = 'p2wpkh',
  p2wpkh_testnet = 'p2wpkh_testnet',
  p2tr_testnet = 'p2tr_testnet',
  p2sh_testnet = 'p2sh_testnet',
  p2pkh_testnet = 'p2pkh_testnet',
  p2tr_regtest = 'p2tr_regtest',
  unknown = 'unknown',
}

export function getAddressType(address: string): AddressTypeString {
  if (address.startsWith('bc1q')) {
    return AddressTypeString.p2wpkh;
  } else if (address.startsWith('bc1p')) {
    return AddressTypeString.p2tr;
  } else if (address.startsWith('1')) {
    return AddressTypeString.p2pkh;
  } else if (address.startsWith('3')) {
    return AddressTypeString.p2sh;
  } else if (address.startsWith('tb1q')) {
    return AddressTypeString.p2wpkh_testnet;
  } else if (address.startsWith('m')) {
    return AddressTypeString.p2pkh_testnet;
  } else if (address.startsWith('2')) {
    return AddressTypeString.p2sh_testnet;
  } else if (address.startsWith('tb1p')) {
    return AddressTypeString.p2tr_testnet;
  } else if (address.startsWith('bcrt1p')) {
    return AddressTypeString.p2tr_regtest;
  } else {
    return AddressTypeString.unknown;
  }
}

export function utxoToInput(
  utxo: any,
  address: string,
  publicKey: string,
  sighashType: number = bitcoin.Transaction.SIGHASH_ALL
) {
  const addressType = getAddressType(address);
  const output = bitcoin.address.toOutputScript(address, NETWORK);
  const script = Buffer.from(output as string, 'hex');

  switch (addressType) {
    case AddressTypeString.p2pkh:
    case AddressTypeString.p2pkh_testnet: {
      // have transform script to scripthash, use witnessScript
      return {
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script,
        },
        sighashType: sighashType
      };
    }
    case AddressTypeString.p2sh:
    case AddressTypeString.p2sh_testnet: {
      const redeemData = bitcoin.payments.p2wpkh(
        { pubkey: Buffer.from(publicKey, 'hex') });
      return {
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script,
        },
        redeemScript: redeemData.output,
        sighashType: sighashType
      };
    }
    case AddressTypeString.p2wpkh:
    case AddressTypeString.p2wpkh_testnet: {
      return {
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script,
        },
        sighashType: sighashType
      };
    }
    case AddressTypeString.p2tr:
    case AddressTypeString.p2tr_testnet :
    case AddressTypeString.p2tr_regtest: {
      return {
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script,
        },
        tapInternalKey: toXOnly(Buffer.from(publicKey, 'hex')),
        sighashType: sighashType
      };
    }
  }
}