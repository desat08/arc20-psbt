import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import { NETWORK } from '../constant/constants';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairAPI, ECPairFactory } from 'ecpair';
import { AddressTypeString, getAddressType } from './address-helpers';
bitcoin.initEccLib(ecc);

const ECPair: ECPairAPI = ECPairFactory(ecc);
export const satToBtc = (sat: number) => sat / 100000000;

export interface KeyPairInfo {
  address: string;
  output: string;
  childNodeXOnlyPubkey: any;
  tweakedChildNode: any;
  childNode: any;
}

export const getKeypairInfo = (childNode: any): KeyPairInfo => {
  const childNodeXOnlyPubkey = toXOnly(childNode.publicKey);
  // This is new for taproot
  // Note: we are using mainnet here to get the correct address
  // The output is the same no matter what the network is.
  const { address, output } = bitcoin.payments.p2tr({
    internalPubkey: childNodeXOnlyPubkey,
    network: NETWORK
  });

  // Used for signing, since the output and address are using a tweaked key
  // We must tweak the signer in the same way.
  const tweakedChildNode = childNode.tweak(
    bitcoin.crypto.taggedHash('TapTweak', childNodeXOnlyPubkey),
  );

  return {
    address,
    tweakedChildNode,
    childNodeXOnlyPubkey,
    output: output.toString(),
    childNode
  }
}


const validator = (
  pubkey: Buffer,
  msghash: Buffer,
  signature: Buffer,
): boolean => ECPair.fromPublicKey(pubkey).verify(msghash, signature);

const schnorrValidator = (
  pubkey: Buffer,
  msghash: Buffer,
  signature: Buffer,
): boolean => ecc.verifySchnorr(msghash, pubkey, signature);


export function getValidator(address: string) {
  const addressType = getAddressType(address);
  switch (addressType) {
    case AddressTypeString.p2pkh:
    case AddressTypeString.p2pkh_testnet:
    case AddressTypeString.p2sh:
    case AddressTypeString.p2sh_testnet:
    case AddressTypeString.p2wpkh:
    case AddressTypeString.p2wpkh_testnet:
      return validator;
    case AddressTypeString.p2tr:
    case AddressTypeString.p2tr_testnet:
    case AddressTypeString.p2tr_regtest:
      return schnorrValidator;
    default:
      throw new Error('Invalid address type');
  }
}