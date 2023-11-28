import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Arc20PsbtService } from '../arc20-psbt/arc20-psbt.service';
import { OrderInfo, PsbtToSign } from '../arc20-psbt/arc20-psbt.dto';
import { ApiOkResponse } from '@nestjs/swagger';

@Controller('/api/v1')
export class AppController {
  constructor(
    private readonly arc20PsbtService: Arc20PsbtService) {}

  @Post('/psbt/seller')
  @ApiOkResponse({ type: PsbtToSign })
  generateUnsignedSellerPsbt(@Body() orderInfo: OrderInfo): Promise<PsbtToSign> {
    return this.arc20PsbtService.generateUnsignedSellerPsbt(orderInfo);
  }

  @Post('/psbt/buyer')
  @ApiOkResponse({ type: PsbtToSign })
  generateUnsignedBuyerPsbt(@Body() orderInfo: OrderInfo): Promise<PsbtToSign> {
    return this.arc20PsbtService.generateUnsignedBuyerPsbt(orderInfo);
  }

  @Get('/psbt/extract')
  extractTxFromPsbts(
    @Param('sellerPsbt') sellerPsbt: string,
    @Param('buyerPsbt') buyerPsbt: string): string {
    return this.arc20PsbtService.extractTxFromPSBTs(sellerPsbt, buyerPsbt);
  }
}
