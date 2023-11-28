import { ApiProperty } from '@nestjs/swagger';

export class Utxo {
  @ApiProperty()
  txid: string;
  @ApiProperty()
  vout: number;
  @ApiProperty()
  value: number;
  @ApiProperty()
  script: any;
}


export class Atomical extends Utxo {
  @ApiProperty({type: [String]})
  atomicals: string[];
}

export class UserInfo {
  @ApiProperty()
  publicKey: string;
  @ApiProperty()
  address: string;
  @ApiProperty()
  receiveAddress: string;
  @ApiProperty({required: false})
  feeRate?: number;
}

export class OrderInfo {
  @ApiProperty()
  atomicalId: string;
  @ApiProperty()
  unitPrice: number;
  @ApiProperty({ type: () => [Atomical] })
  sellerAtomicals: Atomical[];
  @ApiProperty()
  sellerInfo: UserInfo;
  @ApiProperty({ type: () => [Utxo] , required: false})
  buyerUtxos?: Utxo[];
  @ApiProperty({required: false})
  buyerInfo?: UserInfo;
}

export class PsbtToSign {
  @ApiProperty()
  psbtBase64: string;
  @ApiProperty()
  sighashType: number;
  @ApiProperty({type: [Number]})
  index: number[];
}