import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import { NETWORK } from '../constant/constants';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
bitcoin.initEccLib(ecc);
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

