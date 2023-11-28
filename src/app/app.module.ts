import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { Arc20PsbtService } from '../arc20-psbt/arc20-psbt.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [Arc20PsbtService],
})
export class AppModule {}
