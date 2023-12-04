import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Arc20PsbtService } from '../arc20-psbt/arc20-psbt.service';
import {
  OrderCancel,
  OrderInfo,
  PsbtToSign, SignedOrderCancel, SignedOrderInfo,
} from '../arc20-psbt/arc20-psbt.dto';
import { ApiOkResponse } from '@nestjs/swagger';
import { Errors, getError } from '../constant/errors';

@Controller('/api/v1')
export class AppController {
  constructor(
    private readonly arc20PsbtService: Arc20PsbtService) {}

  @Post('/psbt/seller')
  @ApiOkResponse({ type: PsbtToSign })
  generateUnsignedSellerPsbt(@Body() orderInfo: OrderInfo): PsbtToSign {
    return this.arc20PsbtService.generateUnsignedSellerPsbt(orderInfo);
  }

  @Post('/psbt/buyer')
  @ApiOkResponse({ type: PsbtToSign })
  generateUnsignedBuyerPsbt(@Body() orderInfo: OrderInfo): PsbtToSign {
    if (orderInfo.buyerInfo == undefined) {
      throw new HttpException(getError(Errors.ERR_MISSING_BUYER_INFO), HttpStatus.OK)
    }
    if (orderInfo.buyerUtxos == undefined) {
      throw new HttpException(getError(Errors.ERR_MISSING_BUYER_UTXO), HttpStatus.OK)
    }
    if (orderInfo.buyerInfo.networkFeeRate == undefined) {
      throw new HttpException(getError(Errors.ERR_MISSING_BUYER_NETWORK_FEE_RATE), HttpStatus.OK)
    }
    return this.arc20PsbtService.generateUnsignedBuyerPsbt(orderInfo);
  }

  @Post('/psbt/verify/seller')
  verifySignedSellerPsbt(@Body() signedOrderInfo: SignedOrderInfo) {
     this.arc20PsbtService.verifySignedSellerPsbt(signedOrderInfo);
  }

  @Post('/psbt/extract/seller_buyer')
  extractSellerBuyerTxFromPsbt(@Body() signedOrderInfo: SignedOrderInfo): string {
    return this.arc20PsbtService.extractSellerBuyerTxFromPsbt(signedOrderInfo);
  }

  @Post('/psbt/cancel')
  @ApiOkResponse({ type: PsbtToSign })
  cancelSellerPsbt(@Body() orderCancel: OrderCancel): PsbtToSign {
    return this.arc20PsbtService.generateUnsignedSellerCancelPsbt(orderCancel);
  }

  @Post('/psbt/extract/seller_cancel')
  extractSellerCancelTxFromPsbt(@Body() signedOrderCancel: SignedOrderCancel): string {
    return this.arc20PsbtService.extractSellerCancelTxFromPsbt(signedOrderCancel);
  }
}
