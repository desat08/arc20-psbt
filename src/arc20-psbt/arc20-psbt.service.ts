import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { RPCClient } from 'rpc-bitcoin';
import { Errors, getError } from '../constant/errors';
import {
  BITCOIN_RPC_HOST,
  BITCOIN_RPC_PASS,
  BITCOIN_RPC_PORT,
  BITCOIN_RPC_TIMEOUT,
  BITCOIN_RPC_USER,
  BRC20_UTXO_VALUE,
  BUYING_PSBT_SELLER_SIGNATURE_INDEX,
  DUMMY_UTXO_MIN_VALUE,
  NETWORK,
} from '../constant/constants';
import { satToBtc } from '../utils/util';
import { utxoToInput } from '../utils/address-helpers';
import { Atomical, OrderInfo, PsbtToSign, SignIndex } from './arc20-psbt.dto';

bitcoin.initEccLib(ecc);

@Injectable()
export class Arc20PsbtService {

  private readonly client: RPCClient;

  constructor() {
    this.client = new RPCClient({
      url: BITCOIN_RPC_HOST,
      port: BITCOIN_RPC_PORT,
      user: BITCOIN_RPC_USER,
      pass: BITCOIN_RPC_PASS,
      timeout: BITCOIN_RPC_TIMEOUT,
    });
  }

  async generateUnsignedSellerPsbt(orderInfo: OrderInfo): Promise<PsbtToSign> {
    const psbt = new bitcoin.Psbt({ network: NETWORK });
    const signIndex: SignIndex[] = [];
    const sighashType = bitcoin.Transaction.SIGHASH_SINGLE |
      bitcoin.Transaction.SIGHASH_ANYONECANPAY;

    for (const utxo of orderInfo.sellerAtomicals) {
      const input = utxoToInput(utxo, orderInfo.sellerInfo.address,
        orderInfo.sellerInfo.publicKey, sighashType);

      psbt.addInput(input);
      signIndex.push({
        sighashType,
        index: psbt.txInputs.length - 1
      });

      const sellerOutput = this.getSellerOutputValue(
        orderInfo.unitPrice * utxo.value,
        orderInfo.sellerInfo.serviceFeeRate,
        utxo.value,
      );

      psbt.addOutput({
        address: orderInfo.sellerInfo.receiveAddress,
        value: sellerOutput,
      });
    }

    return {
      psbtBase64: psbt.toBase64(),
      signIndex,
    };
  }

  async generateUnsignedBuyerPsbt(
    orderInfo: OrderInfo,
  ): Promise<PsbtToSign> {
    const psbt = new bitcoin.Psbt({ network: NETWORK });
    if (orderInfo.buyerUtxos.length === 0) {
      throw new HttpException(getError(Errors.ERR_NOT_ENOUGH_UTXO_TO_BUY),
        HttpStatus.OK);
    }

    let signIndex: SignIndex[] = [];
    const buyerUtxos = orderInfo.buyerUtxos.sort((a, b) => a.value - b.value).
      filter(utxo => utxo.value > BRC20_UTXO_VALUE);

    const input = utxoToInput(buyerUtxos[0], orderInfo.buyerInfo.address,
      orderInfo.buyerInfo.publicKey);
    psbt.addInput(input);
    signIndex.push({
      sighashType: bitcoin.Transaction.SIGHASH_ALL,
      index: psbt.txInputs.length - 1
    });

    const totalArc20Amount = orderInfo.sellerAtomicals.reduce(
      (accum, atomical) => accum + atomical.value, 0);
    psbt.addOutput({
      address: orderInfo.buyerInfo.receiveAddress,
      value: totalArc20Amount,
    });
    const inputOutputList = this.getSellerInputAndOutput(orderInfo);
    inputOutputList.forEach((item) => {
      psbt.addInput(item.sellerInput);
      psbt.addOutput(item.sellerOutput);
    });

    // Create a platform fee output
    let platformFeeValue = Math.floor(
      (orderInfo.unitPrice * totalArc20Amount *
        (orderInfo.buyerInfo.serviceFeeRate +
          orderInfo.sellerInfo.serviceFeeRate)),
    );
    platformFeeValue =
      platformFeeValue > DUMMY_UTXO_MIN_VALUE ? platformFeeValue : 0;

    if (platformFeeValue > 0) {
      psbt.addOutput({
        address: orderInfo.platformReceiveAddress,
        value: platformFeeValue,
      });
    }

    // Add payment utxo inputs
    let totalBuyBTCAmount = totalArc20Amount * orderInfo.unitPrice *
      (1 + orderInfo.buyerInfo.serviceFeeRate);
    let buyerInput = buyerUtxos[0].value;
    let utxoIndex = 1;
    while (true) {
      const fee = this.calculateTxBytesFeeWithRate(
        psbt.txInputs.length,
        psbt.txOutputs.length, // already taken care of the exchange output bytes calculation
        orderInfo.buyerInfo.networkFeeRate,
      );
      if (buyerInput >= totalBuyBTCAmount + fee) {
        break;
      }
      if (buyerUtxos.length <= utxoIndex) {
        throw new HttpException(getError(Errors.ERR_NOT_ENOUGH_UTXO_TO_BUY),
          HttpStatus.OK);
      }
      const input = utxoToInput(buyerUtxos[utxoIndex],
        orderInfo.buyerInfo.address,
        orderInfo.buyerInfo.publicKey);

      psbt.addInput(input);
      signIndex.push({
        sighashType: bitcoin.Transaction.SIGHASH_ALL,
        index: psbt.txInputs.length - 1
      });

      buyerInput += buyerUtxos[utxoIndex].value;
      utxoIndex++;
    }

    const fee = this.calculateTxBytesFeeWithRate(
      psbt.txInputs.length,
      psbt.txOutputs.length, // already taken care of the exchange output bytes calculation
      orderInfo.buyerInfo.networkFeeRate,
    );
    const totalOutput = psbt.txOutputs.reduce(
      (partialSum, a) => partialSum + a.value,
      0,
    );
    const changeValue = buyerInput + totalArc20Amount - totalOutput - fee;

    if (changeValue < 0) {
      console.log(`Your wallet address doesn't have enough funds to buy this inscription.
Price:      ${satToBtc(orderInfo.unitPrice * totalArc20Amount)} BTC
Required:   ${satToBtc(totalOutput + fee)} BTC
Missing:    ${satToBtc(-changeValue)} BTC`);
      throw new HttpException(getError(Errors.ERR_NOT_ENOUGH_UTXO_TO_BUY),
        HttpStatus.OK);
    }

    // Change utxo
    if (changeValue > DUMMY_UTXO_MIN_VALUE) {
      psbt.addOutput({
        address: orderInfo.buyerInfo.address,
        value: changeValue,
      });
    }

    return {
      psbtBase64: psbt.toBase64(),
      signIndex,
    };
  }

  hasMultipleAtomicalsAtSameUtxos(
    atomicalId: string, selectedUtxos: Atomical[]): boolean {
    for (const utxo of selectedUtxos) {
      for (const atomical of utxo.atomicals) {
        if (atomicalId !== atomical) {
          return true;
        }
      }
    }

    return false;
  }

  getSellerOutputValue(
    price: number,
    serviceFeeRate: number,
    prevUtxoValue: number,
  ): number {
    return (
      price -
      Math.floor(price * serviceFeeRate) + // less maker fees, seller implicitly pays this
      prevUtxoValue // seller should get the rest of ord utxo back
    );
  }

  getSellerInputAndOutput(orderInfo: OrderInfo): any[] {
    const ret = [];
    for (const sellerUtxo of orderInfo.sellerAtomicals) {
      const sellerInput = utxoToInput(sellerUtxo, orderInfo.sellerInfo.address,
        orderInfo.sellerInfo.publicKey);
      const sellerOutput = {
        address: orderInfo.sellerInfo.receiveAddress,
        value: this.getSellerOutputValue(
          orderInfo.unitPrice * sellerUtxo.value,
          orderInfo.sellerInfo.serviceFeeRate,
          sellerUtxo.value,
        ),
      };

      ret.push({ sellerInput, sellerOutput });
    }

    return ret;
  }

  extractTxFromPSBTs(
    signedSellingPSBTBase64: string,
    signedBuyingPSBTBase64: string,
  ): string {
    const sellerSignedPsbt = bitcoin.Psbt.fromBase64(signedSellingPSBTBase64);
    const buyerSignedPsbt = bitcoin.Psbt.fromBase64(signedBuyingPSBTBase64);

    (buyerSignedPsbt.data.globalMap.unsignedTx as any).tx.ins[
      BUYING_PSBT_SELLER_SIGNATURE_INDEX
      ] = (sellerSignedPsbt.data.globalMap.unsignedTx as any).tx.ins[0];
    buyerSignedPsbt.data.inputs[BUYING_PSBT_SELLER_SIGNATURE_INDEX] =
      sellerSignedPsbt.data.inputs[0];

    buyerSignedPsbt.finalizeAllInputs();
    const tx = buyerSignedPsbt.extractTransaction();

    return tx.toHex();
  }

  calculateTxBytesFeeWithRate(
    vinsLength: number,
    voutsLength: number,
    feeRate: number,
    includeChangeOutput: 0 | 1 = 1,
  ): number {
    const baseTxSize = 10;
    const inSize = 180;
    const outSize = 34;

    const txSize =
      baseTxSize +
      vinsLength * inSize +
      voutsLength * outSize +
      includeChangeOutput * outSize;
    return txSize * feeRate;
  }
}
