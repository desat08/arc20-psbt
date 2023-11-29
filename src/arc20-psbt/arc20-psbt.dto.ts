import { ApiProperty } from '@nestjs/swagger';

export class Utxo {
  @ApiProperty()
  txid: string;
  @ApiProperty()
  vout: number;
  @ApiProperty()
  value: number;
}


export class Atomical extends Utxo {
  @ApiProperty({type: [String]})
  atomicals: string[];
}

export class UserInfo {
  @ApiProperty({name: 'public_key'})
  publicKey: string;
  @ApiProperty()
  address: string;
  @ApiProperty({name: 'receive_address'})
  receiveAddress: string;
  @ApiProperty({name: 'service_fee_rate'})
  serviceFeeRate: number;
  @ApiProperty({required: false, name: 'network_fee_rate'})
  networkFeeRate?: number;
}

export class OrderInfo {
  @ApiProperty({name: 'atomical_id'})
  atomicalId: string;
  @ApiProperty({name: 'unit_price'})
  unitPrice: number;
  @ApiProperty({ type: () => [Atomical], name: 'seller_atomicals' })
  sellerAtomicals: Atomical[];
  @ApiProperty({name: 'seller_info'})
  sellerInfo: UserInfo;
  @ApiProperty({ type: () => [Utxo] , required: false, name: 'buyer_utxos'})
  buyerUtxos?: Utxo[];
  @ApiProperty({required: false, name: 'buyer_info'})
  buyerInfo?: UserInfo;
  @ApiProperty({name: 'platform_receive_address'})
  platformReceiveAddress: string
}

export class PsbtToSign {
  @ApiProperty({name: 'psbt_base64'})
  psbtBase64: string;
  @ApiProperty({name: 'sighash_type'})
  sighashType: number;
  @ApiProperty({type: [Number]})
  index: number[];
}

export class PsbtToMerge {
  @ApiProperty({name: 'seller_psbt'})
  sellerPsbt: string;
  @ApiProperty({name: 'buyer_psbt'})
  buyerPsbt: string;
}