import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import {
  Atomical,
  OrderInfo,
  SignedOrderInfo,
} from '../arc20-psbt/arc20-psbt.dto';
import { Arc20PsbtService } from '../arc20-psbt/arc20-psbt.service';
import * as bitcoin from 'bitcoinjs-lib';
import { initEccLib } from 'bitcoinjs-lib';
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
import { getKeypairInfo, KeyPairInfo } from '../utils/util';
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [Arc20PsbtService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  const sellerKeyPair = ECPair.fromWIF('KwHninPcVBb64LQgEd9gKdwDap7V5EAcScXQC6rL16LXwgVk6YTr');
  const buyerKeyPair = ECPair.fromWIF('L3jdqz2nPpY8KAYhiy9ofoxXPcX5n6Jijc65LKqARh44QFDWA2B3');

  describe('root', () => {
    it('selled by tap root address should succeed', async () => {
      const orderInfo: OrderInfo = {
        atomicalId: '10581aa0fa9b5b1846131663f1513140e69530a9cc0e7ad1d831095443e7a851i0',
        unitPrice: 2,
        platformReceiveAddress: 'bcrt1p9mcphvr9xa37xxlgas2ps9e6yakupj6jg58g3j94pdwmm4wwlj7q4zd28a',
        sellerAtomicals: [{
          txid: '6cb25b250c972ccbc7c0963c3446f3ca302b2db3d095afb30375eee8925f9760',
          vout: 0,
          value: 1000,
          atomicals: ['10581aa0fa9b5b1846131663f1513140e69530a9cc0e7ad1d831095443e7a851i0']
        }],
        sellerInfo: {
          publicKey: '02cadeaffb297ce6713c93085f7bb66bebc24424e17f529c358c80ff242de0970b',
          address: 'bcrt1pgrl9w4fg4hylrzzuevulz89nxwsqetm334wz3pdz2emnqkqlrursw67nnt',
          receiveAddress: 'bcrt1pgrl9w4fg4hylrzzuevulz89nxwsqetm334wz3pdz2emnqkqlrursw67nnt',
          serviceFeeRate: 0.1,
        }
      }

      const buyerInfo = {
        publicKey: '03980de2d22baf41dc1bfc8dd4a441e2998df1026c23f94eb18aaf5db2a4a3229e',
        address: 'bcrt1pqv42vjw50k0p29svd3l6er4s8r460evhylva0v3rmwmmnerl752qvpqq89',
        receiveAddress: 'bcrt1pqv42vjw50k0p29svd3l6er4s8r460evhylva0v3rmwmmnerl752qvpqq89',
        serviceFeeRate: 0.2,
        networkFeeRate: 30
      };

      const buyerUtxos = [{
        txid: '5642451463b124a2a95860ac66d921fd19d4f15ab853adf9c6a2cb7e0dada2b3',
        vout: 0,
        value: 100000000,
      }];
      const sellerKeyPairInfo: KeyPairInfo = getKeypairInfo(sellerKeyPair)
      const buyerKeyPairInfo: KeyPairInfo = getKeypairInfo(buyerKeyPair)

      // 1. generate seller unsigned psbt
      const sellerPsbtToSign = await appController.generateUnsignedSellerPsbt(orderInfo)
      console.log(sellerPsbtToSign)

      // 2. seller sign psbt
      const sellerPsbt = bitcoin.Psbt.fromBase64(sellerPsbtToSign.psbtBase64);
      for (const signIndex of sellerPsbtToSign.signIndex) {
        sellerPsbt.signInput(signIndex.index, sellerKeyPairInfo.tweakedChildNode, [signIndex.sighashType]);
      }

      // 3. verify seller signed psbt
      const signedOrderInfo: SignedOrderInfo = {
        orderInfo: orderInfo,
        sellerPsbt: sellerPsbt.toBase64(),
      }
      appController.verifySignedSellerPsbt(signedOrderInfo)

      // 4. generate buyer unsigned psbt
      orderInfo.buyerInfo = buyerInfo;
      orderInfo.buyerUtxos = buyerUtxos;
      const buyerPsbtToSign = await appController.generateUnsignedBuyerPsbt(orderInfo)
      console.log(buyerPsbtToSign)

      // 5. buyer sign psbt
      const buyerPsbt = bitcoin.Psbt.fromBase64(buyerPsbtToSign.psbtBase64);
      for (const signIndex of buyerPsbtToSign.signIndex) {
        buyerPsbt.signInput(signIndex.index, buyerKeyPairInfo.tweakedChildNode, [signIndex.sighashType])
      }

      // 6. merge and extract tx
      signedOrderInfo.buyerPsbt = buyerPsbt.toBase64();
      const rawTx = appController.extractSellerBuyerTxFromPsbt(signedOrderInfo)
      const tx = bitcoin.Transaction.fromHex(rawTx)

      console.log(rawTx)
      console.log(tx)

      expect(rawTx).toEqual('02000000000102b3a2ad0d7ecba2c6f9ad53b85af1d419fd21d966ac6058a9a224b163144542560000000000ffffffff60975f92e8ee7503b3af95d0b32d2b30caf346343c96c0c7cb2c970c255bb26c0000000000ffffffff04e803000000000000225120032aa649d47d9e15160c6c7fac8eb038eba7e59727d9d7b223dbb7b9e47ff514f00a00000000000022512040fe575528adc9f1885ccb39f11cb333a00caf718d5c2885a2567730581f1f0758020000000000002251202ef01bb0653763e31be8ec1418173a276dc0cb52450e88c8b50b5dbdd5cefcbc6c98f50500000000225120032aa649d47d9e15160c6c7fac8eb038eba7e59727d9d7b223dbb7b9e47ff5140141f54de1fb5ab4f1f114e1a7f95a500a5cda36f41224a3e7148eda3fd9704ad2f5fd2c5e6ad5c0aef2b5f92360a6e38f4fef1ccab38d45407c7006bbd005e809e70101417f49b855d209e11625486d85eda34643d5769113f6e51152074714443d39c3eca25d05ac6611ebdaf3e3157e32064bc01cf072982fa9b6421c3efe328fb16adf8300000000')
    });

    it('selled by tap root address 2 should succeed', async () => {
      const orderInfo: OrderInfo = {
        atomicalId: '10581aa0fa9b5b1846131663f1513140e69530a9cc0e7ad1d831095443e7a851i0',
        unitPrice: 2,
        platformReceiveAddress: 'bcrt1p9mcphvr9xa37xxlgas2ps9e6yakupj6jg58g3j94pdwmm4wwlj7q4zd28a',
        sellerAtomicals: [{
          txid: '6cb25b250c972ccbc7c0963c3446f3ca302b2db3d095afb30375eee8925f9760',
          vout: 0,
          value: 1000,
          atomicals: ['10581aa0fa9b5b1846131663f1513140e69530a9cc0e7ad1d831095443e7a851i0']
        }],
        sellerInfo: {
          publicKey: '02cadeaffb297ce6713c93085f7bb66bebc24424e17f529c358c80ff242de0970b',
          address: 'bcrt1pgrl9w4fg4hylrzzuevulz89nxwsqetm334wz3pdz2emnqkqlrursw67nnt',
          receiveAddress: 'bcrt1pgrl9w4fg4hylrzzuevulz89nxwsqetm334wz3pdz2emnqkqlrursw67nnt',
          serviceFeeRate: 0.1,
        }
      }

      const buyerInfo = {
        publicKey: '03980de2d22baf41dc1bfc8dd4a441e2998df1026c23f94eb18aaf5db2a4a3229e',
        address: 'bcrt1pqv42vjw50k0p29svd3l6er4s8r460evhylva0v3rmwmmnerl752qvpqq89',
        receiveAddress: 'bcrt1pqv42vjw50k0p29svd3l6er4s8r460evhylva0v3rmwmmnerl752qvpqq89',
        serviceFeeRate: 0.2,
        networkFeeRate: 30
      };

      const buyerUtxos = [{
        txid: '5642451463b124a2a95860ac66d921fd19d4f15ab853adf9c6a2cb7e0dada2b3',
        vout: 0,
        value: 100000000,
      }];
      const sellerKeyPairInfo: KeyPairInfo = getKeypairInfo(sellerKeyPair)
      const buyerKeyPairInfo: KeyPairInfo = getKeypairInfo(buyerKeyPair)

      // 1. generate seller unsigned psbt
      const sellerPsbtToSign = await appController.generateUnsignedSellerPsbt(orderInfo)
      console.log(sellerPsbtToSign)

      // 2. seller sign psbt
      const sellerPsbt = bitcoin.Psbt.fromBase64(sellerPsbtToSign.psbtBase64);
      for (const signIndex of sellerPsbtToSign.signIndex) {
        sellerPsbt.signInput(signIndex.index, sellerKeyPairInfo.tweakedChildNode, [signIndex.sighashType]);
      }

      // 3. verify seller signed psbt
      const signedOrderInfo: SignedOrderInfo = {
        orderInfo: orderInfo,
        sellerPsbt: sellerPsbt.toBase64(),
      }
      appController.verifySignedSellerPsbt(signedOrderInfo)

      // 4. generate buyer unsigned psbt
      orderInfo.buyerInfo = buyerInfo;
      orderInfo.buyerUtxos = buyerUtxos;
      const buyerPsbtToSign = await appController.generateUnsignedBuyerPsbt(orderInfo)
      console.log(buyerPsbtToSign)

      // 5. buyer sign psbt
      const buyerPsbt = bitcoin.Psbt.fromBase64(buyerPsbtToSign.psbtBase64);
      for (const signIndex of buyerPsbtToSign.signIndex) {
        buyerPsbt.signInput(signIndex.index, buyerKeyPairInfo.tweakedChildNode, [signIndex.sighashType])
      }

      // 6. merge and extract tx
      signedOrderInfo.buyerPsbt = buyerPsbt.toBase64();
      const rawTx = appController.extractSellerBuyerTxFromPsbt(signedOrderInfo)
      const tx = bitcoin.Transaction.fromHex(rawTx)

      console.log(rawTx)
      console.log(tx)

      expect(rawTx).toEqual('02000000000102b3a2ad0d7ecba2c6f9ad53b85af1d419fd21d966ac6058a9a224b163144542560000000000ffffffff60975f92e8ee7503b3af95d0b32d2b30caf346343c96c0c7cb2c970c255bb26c0000000000ffffffff04e803000000000000225120032aa649d47d9e15160c6c7fac8eb038eba7e59727d9d7b223dbb7b9e47ff514f00a00000000000022512040fe575528adc9f1885ccb39f11cb333a00caf718d5c2885a2567730581f1f0758020000000000002251202ef01bb0653763e31be8ec1418173a276dc0cb52450e88c8b50b5dbdd5cefcbc6c98f50500000000225120032aa649d47d9e15160c6c7fac8eb038eba7e59727d9d7b223dbb7b9e47ff5140141f54de1fb5ab4f1f114e1a7f95a500a5cda36f41224a3e7148eda3fd9704ad2f5fd2c5e6ad5c0aef2b5f92360a6e38f4fef1ccab38d45407c7006bbd005e809e70101417f49b855d209e11625486d85eda34643d5769113f6e51152074714443d39c3eca25d05ac6611ebdaf3e3157e32064bc01cf072982fa9b6421c3efe328fb16adf8300000000')
    });


    it('parse psbt', async () => {
      const psbt = 'NzA3MzYyNzRmZjAxMDA1ZTAyMDAwMDAwMDFlN2M4NTAwNjVkM2QwMjUyNTY2Y2YwODU3MWE1ZTEyZDQyY2E0ZmJkOTFmYWYyYzAyYWU1ZTg1N2YyMDM3NTc4MDAwMDAwMDAwMGZmZmZmZmZmMDE2ODc0MDAwMDAwMDAwMDAwMjI1MTIwZDcyNzYxNTFmOTA5YzI3MmEzMzBhNTQ1YmYxY2U5NjgxN2JiZjgzM2JlYzQ5ODVjMjZlMzVmOGU5ODZlMjhiZTAwMDAwMDAwMDAwMTAwZmQzODAxMDIwMDAwMDAwMDAxMDI2YWRlODU2NjMxODE5OGJlZDc5YmY5NGIwYzJjYmQ2OGU3MWFlYWVlZTRiZDAyN2M1OTA0MDkzMWJkMDkzN2EzMDEwMDAwMDAwMGZmZmZmZmZmMDE3YzI2OTVlNmRmMTBiYzkwMWQwN2M4YWNkYTlkYzJlNTkwMzgxNDIwYzI1YzQ2YTNkMDQ2MjE5YTJjNWNkMzAwMDAwMDAwMDBmZmZmZmZmZjAyMTAyNzAwMDAwMDAwMDAwMDIyNTEyMGQ3Mjc2MTUxZjkwOWMyNzJhMzMwYTU0NWJmMWNlOTY4MTdiYmY4MzNiZWM0OTg1YzI2ZTM1ZjhlOTg2ZTI4YmU2MGVhMDAwMDAwMDAwMDAwMjI1MTIwMDYwODA0OWE5M2E5OTcxMDRkNWM4NThmZTQ1NjI1ZjZkZDk3OTRjYTBhNDVmZmNkMGUwNGJmNjljMjY0MzRjYzAxNDBhMDQwOTkyYzI4NTM2MjYwNTEwOWJjZGNmZDdkZTYwZDdhMGUxY2M3MzdhNzVjNWQzNWEyYzgxMWEwZjdhMzk5Y2IwMmE5ZGEzYmI4Y2E0ZWJkMGFhYzhmMDRhMDVhM2ViOTk4OWFkY2E0ZWJiNjM5NGI1MmJhY2MxMjQxNzczNDAxNDBjZjk5NTFkNTAxMGM0ODBhNDcyMzJlY2U1ZTc5Yjc5YjU4NjA1OTc2ZDY0ZGE3NGRjYTVkZDIyYzdmMGIxMjAxYmNlNjVjZjdlODc5MGI3M2NhYjRiYjM1NDc5MTBmYzgxNGEzNDAwYjgxZDY3ZDIzNDFhNzVhNjc0ZjQzMTVkNTAwMDAwMDAwMDEwMTJiMTAyNzAwMDAwMDAwMDAwMDIyNTEyMGQ3Mjc2MTUxZjkwOWMyNzJhMzMwYTU0NWJmMWNlOTY4MTdiYmY4MzNiZWM0OTg1YzI2ZTM1ZjhlOTg2ZTI4YmUwMTA4NDMwMTQxYWZiM2Y0NmUxNzk3NmFmOTA4N2VjODBjNDg4ZDIzNmM5ZWVjNTRmNGM4MjlkNmRlZjcyM2YzN2I3ZDY0YzFlMTJiOGFkMTY5NmZmZTA4Njc5Yjc5MzhjNTJjYTMyYWY1NjRiNGE5M2Y4MTc1MzFhNWNiOTkzM2YxYTRjMmE0NDY4MzAwMDA='
      const sellerPsbt = bitcoin.Psbt.fromBase64(psbt, {network: bitcoin.networks.testnet});});
  });
});

function genOrderInfo(sellerPublicKey: string, sellerAddress: string, sellerReceiveAddress: string, atomicals: Atomical[], unitPrice: number) {
  const orderInfo: OrderInfo = {
    atomicalId: '10581aa0fa9b5b1846131663f1513140e69530a9cc0e7ad1d831095443e7a851i0',
    unitPrice: 2,
    platformReceiveAddress: 'bcrt1p9mcphvr9xa37xxlgas2ps9e6yakupj6jg58g3j94pdwmm4wwlj7q4zd28a',
    sellerAtomicals: [{
      txid: '6cb25b250c972ccbc7c0963c3446f3ca302b2db3d095afb30375eee8925f9760',
      vout: 0,
      value: 1000,
      atomicals: ['10581aa0fa9b5b1846131663f1513140e69530a9cc0e7ad1d831095443e7a851i0']
    }],
    sellerInfo: {
      publicKey: sellerPublicKey,
      address: sellerAddress,
      receiveAddress: 'bcrt1pgrl9w4fg4hylrzzuevulz89nxwsqetm334wz3pdz2emnqkqlrursw67nnt',
      serviceFeeRate: 0.1,
    }
  }


}
