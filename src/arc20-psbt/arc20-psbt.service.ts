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
import { getValidator, satToBtc } from '../utils/util';
import { utxoToInput } from '../utils/address-helpers';
import {
  OrderCancel,
  OrderInfo,
  PsbtToSign,
  SignedOrderCancel,
  SignedOrderInfo,
  SignIndex,
} from './arc20-psbt.dto';
import { Psbt } from 'bitcoinjs-lib';

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

    let totalServiceFee = 0;
    const inputOutputList = await this.getSellerInputAndOutput(orderInfo);
    inputOutputList.forEach((item) => {
      psbt.addInput(item.sellerInput);
      psbt.addOutput(item.sellerOutput);
      signIndex.push({
        sighashType,
        index: psbt.txInputs.length - 1,
      });
      totalServiceFee += item.serviceFee;
    });

    return {
      psbtBase64: psbt.toBase64(),
      serviceFee: totalServiceFee,
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

    const input = await utxoToInput(buyerUtxos[0], orderInfo.buyerInfo.address,
      orderInfo.buyerInfo.publicKey, this.client);
    psbt.addInput(input);
    signIndex.push({
      sighashType: bitcoin.Transaction.SIGHASH_ALL,
      index: psbt.txInputs.length - 1,
    });

    const totalArc20Amount = orderInfo.sellerAtomicals.reduce(
      (accum, atomical) => accum + atomical.value, 0);
    psbt.addOutput({
      address: orderInfo.buyerInfo.receiveAddress,
      value: totalArc20Amount,
    });
    const inputOutputList = await this.getSellerInputAndOutput(orderInfo);
    inputOutputList.forEach((item) => {
      psbt.addInput(item.sellerInput);
      psbt.addOutput(item.sellerOutput);
    });

    // Create a platform fee output
    let platformFeeValue = Math.floor(
      orderInfo.unitPrice * totalArc20Amount *
      (orderInfo.buyerInfo.serviceFeeRate +
        orderInfo.sellerInfo.serviceFeeRate),
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
    let utxoIndex = 1;
    let networkFee: number = 0;
    let txSize: number = 0;
    let totalInput = buyerUtxos[0].value + totalArc20Amount;
    let totalOutput = psbt.txOutputs.reduce(
      (partialSum, a) => partialSum + a.value,
      0,
    );
    while (true) {
      [networkFee, txSize] = this.calculateTxBytesFeeWithRate(
        psbt.txInputs.length,
        psbt.txOutputs.length, // already taken care of the exchange output bytes calculation
        orderInfo.buyerInfo.networkFeeRate,
      );
      if (totalInput >= totalOutput + networkFee) {
        break;
      }
      if (buyerUtxos.length <= utxoIndex) {
        console.log(`Your wallet address doesn't have enough funds to buy this order.
Price:      ${satToBtc(orderInfo.unitPrice * totalArc20Amount)} BTC
Required:   ${satToBtc(totalOutput + networkFee - totalArc20Amount)} BTC
You have:    ${satToBtc(totalInput - totalArc20Amount)} BTC`);
        throw new HttpException(getError(Errors.ERR_NOT_ENOUGH_UTXO_TO_BUY),
          HttpStatus.OK);
      }
      const input = await utxoToInput(buyerUtxos[utxoIndex],
        orderInfo.buyerInfo.address,
        orderInfo.buyerInfo.publicKey, this.client);
      psbt.addInput(input);
      signIndex.push({
        sighashType: bitcoin.Transaction.SIGHASH_ALL,
        index: psbt.txInputs.length - 1,
      });

      totalInput += buyerUtxos[utxoIndex].value;
      utxoIndex++;
    }

    const changeValue = totalInput - totalOutput - networkFee;
    if (changeValue > DUMMY_UTXO_MIN_VALUE) {
      psbt.addOutput({
        address: orderInfo.buyerInfo.address,
        value: changeValue,
      });
    }

    return {
      psbtBase64: psbt.toBase64(),
      serviceFee: Math.ceil(totalArc20Amount * orderInfo.unitPrice *
        orderInfo.buyerInfo.serviceFeeRate),
      networkFee,
      txSize,
      signIndex,
    };
  }

  async generateUnsignedSellerCancelPsbt(orderCancel: OrderCancel): Promise<PsbtToSign> {
    const psbt = new bitcoin.Psbt({ network: NETWORK });
    const signIndex: SignIndex[] = [];

    for (const sellerUtxo of orderCancel.sellerAtomicals) {
      const sellerInput = await utxoToInput(sellerUtxo,
        orderCancel.sellerInfo.address,
        orderCancel.sellerInfo.publicKey, this.client);
      const sellerOutput = {
        address: orderCancel.sellerInfo.address,
        value: sellerUtxo.value,
      };

      psbt.addInput(sellerInput);
      psbt.addOutput(sellerOutput);
      signIndex.push({
        sighashType: bitcoin.Transaction.SIGHASH_ALL,
        index: psbt.txInputs.length - 1,
      });
    }

    const sellerUtxos = orderCancel.sellerUtxos.sort(
      (a, b) => a.value - b.value).
      filter(utxo => utxo.value > BRC20_UTXO_VALUE);

    const input = await utxoToInput(sellerUtxos[0],
      orderCancel.sellerInfo.address,
      orderCancel.sellerInfo.publicKey, this.client);
    psbt.addInput(input);
    signIndex.push({
      sighashType: bitcoin.Transaction.SIGHASH_ALL,
      index: psbt.txInputs.length - 1,
    });

    const totalArc20Amount = orderCancel.sellerAtomicals.reduce(
      (accum, atomical) => accum + atomical.value, 0);

    // Create a platform fee output
    let platformFeeValue = Math.floor(
      orderCancel.unitPrice * totalArc20Amount *
      orderCancel.sellerInfo.serviceFeeRate,
    );
    platformFeeValue =
      platformFeeValue > DUMMY_UTXO_MIN_VALUE ? platformFeeValue : 0;
    if (platformFeeValue > 0) {
      psbt.addOutput({
        address: orderCancel.platformReceiveAddress,
        value: platformFeeValue,
      });
    }

    // Add payment utxo inputs
    let utxoIndex = 1;
    let networkFee: number = 0;
    let txSize: number = 0;
    let totalInput = sellerUtxos[0].value;
    while (true) {
      [networkFee, txSize] = this.calculateTxBytesFeeWithRate(
        psbt.txInputs.length,
        psbt.txOutputs.length, // already taken care of the exchange output bytes calculation
        orderCancel.sellerInfo.networkFeeRate,
      );
      if (totalInput >= platformFeeValue + networkFee) {
        break;
      }
      if (sellerUtxos.length <= utxoIndex) {
        console.log(`Your wallet address doesn't have enough funds to cancel this order.
Required:   ${satToBtc(platformFeeValue + networkFee)} BTC
You have:    ${satToBtc(totalInput)} BTC`);
        throw new HttpException(getError(Errors.ERR_NOT_ENOUGH_UTXO_TO_BUY),
          HttpStatus.OK);
      }
      const input = await utxoToInput(sellerUtxos[utxoIndex],
        orderCancel.sellerInfo.address,
        orderCancel.sellerInfo.publicKey, this.client);
      psbt.addInput(input);
      signIndex.push({
        sighashType: bitcoin.Transaction.SIGHASH_ALL,
        index: psbt.txInputs.length - 1,
      });

      totalInput += sellerUtxos[utxoIndex].value;
      utxoIndex++;
    }

    const changeValue = totalInput - platformFeeValue - networkFee;
    if (changeValue > DUMMY_UTXO_MIN_VALUE) {
      psbt.addOutput({
        address: orderCancel.sellerInfo.address,
        value: changeValue,
      });
    }

    return {
      psbtBase64: psbt.toBase64(),
      serviceFee: platformFeeValue,
      networkFee,
      txSize,
      signIndex,
    };
  }

  async verifySignedSellerPsbt(signedOrderInfo: SignedOrderInfo) {
    const psbt = bitcoin.Psbt.fromBase64(signedOrderInfo.sellerPsbt, {
      network: NETWORK,
    });
    const sellerPsbt = await this.generateUnsignedSellerPsbt(
      signedOrderInfo.orderInfo);
    const psbtToSign = bitcoin.Psbt.fromBase64(sellerPsbt.psbtBase64, {
      network: NETWORK,
    });

    const validator = getValidator(
      signedOrderInfo.orderInfo.sellerInfo.address);
    if (!psbt.validateSignaturesOfAllInputs(validator)) {
      throw new HttpException(getError(Errors.ERR_INVALID_SIGNATURE),
        HttpStatus.OK);
    }

    const error = this.comparePsbt(psbt, psbtToSign);
    if (error) {
      throw new HttpException(getError(error), HttpStatus.OK);
    }
  }

  async verifyBuyerSignedPsbt(orderInfo: OrderInfo, psbt: Psbt) {
    const buyerPsbt = await this.generateUnsignedBuyerPsbt(orderInfo);
    const psbtToSign = bitcoin.Psbt.fromBase64(buyerPsbt.psbtBase64, {
      network: NETWORK,
    });

    const validator = getValidator(orderInfo.buyerInfo.address);
    for (const signIndex of buyerPsbt.signIndex) {
      if (!psbt.validateSignaturesOfInput(signIndex.index, validator)) {
        throw new HttpException(getError(Errors.ERR_INVALID_SIGNATURE),
          HttpStatus.OK);
      }
    }

    const error = this.comparePsbt(psbt, psbtToSign);
    if (error) {
      throw new HttpException(getError(error), HttpStatus.OK);
    }
  }

  async verifySellerCancelSignedPsbt(orderCancel: OrderCancel, psbt: Psbt) {
    const cancelPsbt = await this.generateUnsignedSellerCancelPsbt(orderCancel);
    const psbtToSign = bitcoin.Psbt.fromBase64(cancelPsbt.psbtBase64, {
      network: NETWORK,
    });

    const validator = getValidator(orderCancel.sellerInfo.address);
    if (!psbt.validateSignaturesOfAllInputs(validator)) {
      throw new HttpException(getError(Errors.ERR_INVALID_SIGNATURE),
        HttpStatus.OK);
    }

    const error = this.comparePsbt(psbt, psbtToSign);
    if (error) {
      throw new HttpException(getError(error), HttpStatus.OK);
    }
  }

  extractSellerBuyerTxFromPsbt(signedOrderInfo: SignedOrderInfo): string {
    const sellerSignedPsbt = bitcoin.Psbt.fromBase64(
      signedOrderInfo.sellerPsbt, { network: NETWORK });
    const buyerSignedPsbt = bitcoin.Psbt.fromBase64(signedOrderInfo.buyerPsbt, {
      network: NETWORK,
    });
    this.verifyBuyerSignedPsbt(signedOrderInfo.orderInfo, buyerSignedPsbt);

    (buyerSignedPsbt.data.globalMap.unsignedTx as any).tx.ins[
      BUYING_PSBT_SELLER_SIGNATURE_INDEX
      ] = (sellerSignedPsbt.data.globalMap.unsignedTx as any).tx.ins[0];
    buyerSignedPsbt.data.inputs[BUYING_PSBT_SELLER_SIGNATURE_INDEX] =
      sellerSignedPsbt.data.inputs[0];

    buyerSignedPsbt.finalizeAllInputs();
    const tx = buyerSignedPsbt.extractTransaction();

    return tx.toHex();
  }

  extractSellerCancelTxFromPsbt(
    signedOrderCancel: SignedOrderCancel,
  ): string {
    const sellerSignedPsbt = bitcoin.Psbt.fromBase64(
      signedOrderCancel.signedPsbt);
    this.verifySellerCancelSignedPsbt(signedOrderCancel.orderCancel,
      sellerSignedPsbt);

    sellerSignedPsbt.finalizeAllInputs();
    const tx = sellerSignedPsbt.extractTransaction();

    return tx.toHex();
  }

  async getSellerInputAndOutput(orderInfo: OrderInfo): Promise<any[]> {
    const ret = [];
    console.log(orderInfo)
    for (const sellerUtxo of orderInfo.sellerAtomicals) {
      const sellerInput = await utxoToInput(sellerUtxo,
        orderInfo.sellerInfo.address,
        orderInfo.sellerInfo.publicKey, this.client,
        bitcoin.Transaction.SIGHASH_SINGLE |
        bitcoin.Transaction.SIGHASH_ANYONECANPAY);

      const serviceFee = Math.floor(sellerUtxo.value * orderInfo.unitPrice *
        orderInfo.sellerInfo.serviceFeeRate);
      const sellerOutputValue = Math.floor(
        sellerUtxo.value * orderInfo.unitPrice - serviceFee + sellerUtxo.value);

      const sellerOutput = {
        address: orderInfo.sellerInfo.receiveAddress,
        value: sellerOutputValue,
      };

      ret.push({ sellerInput, sellerOutput, serviceFee });
    }

    return ret;
  }

  calculateTxBytesFeeWithRate(
    vinsLength: number,
    voutsLength: number,
    feeRate: number,
    includeChangeOutput: 0 | 1 = 1,
  ): [number, number] {
    const baseTxSize = 10;
    const inSize = 180;
    const outSize = 34;

    const txSize =
      baseTxSize +
      vinsLength * inSize +
      voutsLength * outSize +
      includeChangeOutput * outSize;
    return [txSize * feeRate, txSize];
  }

  comparePsbt(psbt1: Psbt, psbt2: Psbt): Errors | null {
    if (psbt1.txInputs.length !== psbt2.txInputs.length) {
      return Errors.ERR_INVALID_INPUT_COUNT;
    }

    if (psbt1.txOutputs.length !== psbt2.txOutputs.length) {
      return Errors.ERR_INVALID_OUTPUT_COUNT;
    }

    for (let i = 0; i < psbt1.txInputs.length; i++) {
      const input1 = psbt1.txInputs[i];
      const input2 = psbt2.txInputs[i];

      if (input1.hash.compare(input2.hash) !== 0 || input1.index !==
        input2.index) {
        return Errors.ERR_INVALID_INPUT;
      }
    }

    for (let i = 0; i < psbt1.txOutputs.length; i++) {
      const output1 = psbt1.txOutputs[i];
      const output2 = psbt2.txOutputs[i];
      if (output1.value !== output2.value || output1.address !==
        output2.address) {
        return Errors.ERR_INVALID_OUTPUT;
      }
    }

    return null;
  }
}
