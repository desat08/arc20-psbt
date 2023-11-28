import * as bs58check from "bs58check";
import { sha256 } from "js-sha256";
import * as ecc from 'tiny-secp256k1';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import * as dotenv from 'dotenv'
import { NETWORK } from '../constant/constants';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
dotenv.config();

export function detectAddressTypeToScripthash(address: string): { output: string, scripthash: string, address: string } {
  // Detect legacy address
  try {
    bitcoin.address.fromBase58Check(address, NETWORK);
    const p2pkh = addressToP2PKH(address);
    const p2pkhBuf = Buffer.from(p2pkh, "hex");
    return {
      output: p2pkh,
      scripthash: Buffer.from(sha256(p2pkhBuf), "hex").reverse().toString("hex"),
      address
    }
  } catch (err) {
  }
  // Detect segwit or taproot
  // const detected = bitcoin.address.fromBech32(address);
  if (address.indexOf('bc1p') === 0) {
    const output = bitcoin.address.toOutputScript(address, NETWORK);
    return {
      output,
      scripthash: Buffer.from(sha256(output), "hex").reverse().toString("hex"),
      address
    }
  } else if (address.indexOf('bc1') === 0) {
    const output = bitcoin.address.toOutputScript(address, NETWORK);
    return {
      output,
      scripthash: Buffer.from(sha256(output), "hex").reverse().toString("hex"),
      address
    }
  } else if (address.indexOf('tb1') === 0) {
    const output = bitcoin.address.toOutputScript(address, NETWORK);
    return {
      output,
      scripthash: Buffer.from(sha256(output), "hex").reverse().toString("hex"),
      address
    }
  } else if (address.indexOf('bcrt1p') === 0) {
    const output = bitcoin.address.toOutputScript(address, NETWORK);
    return {
      output,
      scripthash: Buffer.from(sha256(output), "hex").reverse().toString("hex"),
      address
    }
  }
  else {
    throw "unrecognized address";
  }
}

export function addressToP2PKH(address: string): string {
  const addressDecoded = bs58check.decode(address);
  const addressDecodedSub = addressDecoded.toString().substr(2);
  const p2pkh = `76a914${addressDecodedSub}88ac`;
  return p2pkh;
}

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
  option: {
    override: {
      vout?: number;
      script?: string | Buffer;
    };
  },
) {
  const addressType = getAddressType(address);
  let script;

  if (option.override.script !== undefined) {
    script = Buffer.isBuffer(option.override.script!)
      ? option.override.script
      : Buffer.from(option.override.script!, 'hex');
  } else {
    script = utxo.script ? Buffer.from(utxo.script, 'hex') : undefined;
  }

  switch (addressType) {
    case AddressTypeString.p2pkh || AddressTypeString.p2pkh_testnet: {
      const { output } = detectAddressTypeToScripthash(address);
      // have transform script to scripthash, use witnessScript
      return {
        hash: utxo.txid,
        index: option.override.vout ?? utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script: Buffer.from(output as string, 'hex'),
        },
      };
    }
    case AddressTypeString.p2sh || AddressTypeString.p2sh_testnet: {
      const redeemData = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(publicKey, 'hex') });
      return {
        hash: utxo.txid,
        index: option.override.vout ?? utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script,
        },
        redeemScript: redeemData.output,
      };
    }
    case AddressTypeString.p2wpkh || AddressTypeString.p2wpkh_testnet: {
      return {
        hash: utxo.txid,
        index: option.override.vout ?? utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script,
        },
      };
    }
    case AddressTypeString.p2tr || AddressTypeString.p2tr_testnet || AddressTypeString.p2tr_regtest: {
      return {
        hash: utxo.txid,
        index: option.override.vout ?? utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script,
        },
        tapInternalKey: toXOnly(Buffer.from(publicKey, 'hex')),
      };
    }
  }
}