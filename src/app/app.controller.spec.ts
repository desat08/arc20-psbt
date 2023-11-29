import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { OrderInfo, PsbtToMerge } from '../arc20-psbt/arc20-psbt.dto';
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

  describe('root', () => {
    it('should succeed', async () => {
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
        },
        buyerInfo: {
          publicKey: '03980de2d22baf41dc1bfc8dd4a441e2998df1026c23f94eb18aaf5db2a4a3229e',
          address: 'bcrt1pqv42vjw50k0p29svd3l6er4s8r460evhylva0v3rmwmmnerl752qvpqq89',
          receiveAddress: 'bcrt1pqv42vjw50k0p29svd3l6er4s8r460evhylva0v3rmwmmnerl752qvpqq89',
          serviceFeeRate: 0.2,
          networkFeeRate: 30
        },
        buyerUtxos: [{
          txid: '5642451463b124a2a95860ac66d921fd19d4f15ab853adf9c6a2cb7e0dada2b3',
          vout: 0,
          value: 100000000,
        }]
      }

      const sellerKeyPair = ECPair.fromWIF('KwHninPcVBb64LQgEd9gKdwDap7V5EAcScXQC6rL16LXwgVk6YTr');
      const buyerKeyPair = ECPair.fromWIF('L3jdqz2nPpY8KAYhiy9ofoxXPcX5n6Jijc65LKqARh44QFDWA2B3');
      const sellerKeyPairInfo: KeyPairInfo = getKeypairInfo(sellerKeyPair)
      const buyerKeyPairInfo: KeyPairInfo = getKeypairInfo(buyerKeyPair)

      // 1. generate seller unsigned psbt
      const sellerPsbtToSign = await appController.generateUnsignedSellerPsbt(orderInfo)
      console.log(sellerPsbtToSign)

      // 2. seller sign psbt
      const sellerPsbt = bitcoin.Psbt.fromBase64(sellerPsbtToSign.psbtBase64);
      for (const signIndex of sellerPsbtToSign.signIndex) {
        sellerPsbt.signInput(signIndex.index, sellerKeyPairInfo.tweakedChildNode, [signIndex.sighashType])
      }

      // 3. generate buyer unsigned psbt
      const buyerPsbtToSign = await appController.generateUnsignedBuyerPsbt(orderInfo)
      console.log(buyerPsbtToSign)

      // 4. buyer sign psbt
      const buyerPsbt = bitcoin.Psbt.fromBase64(buyerPsbtToSign.psbtBase64);
      for (const signIndex of buyerPsbtToSign.signIndex) {
        buyerPsbt.signInput(signIndex.index, buyerKeyPairInfo.tweakedChildNode, [signIndex.sighashType])
      }

      // 4. merge and extract tx
      const psbtToMerge: PsbtToMerge = {
        sellerPsbt: sellerPsbt.toBase64(),
        buyerPsbt: buyerPsbt.toBase64()
      }
      const rawTx = appController.extractTxFromPsbts(psbtToMerge)
      const tx = bitcoin.Transaction.fromHex(rawTx)

      console.log(rawTx)
      console.log(tx)
    });
  });
});
