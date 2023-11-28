import { Test, TestingModule } from '@nestjs/testing';
import { Arc20PsbtService } from './arc20-psbt.service';

describe('Arc20PsbtService', () => {
  let service: Arc20PsbtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Arc20PsbtService],
    }).compile();

    service = module.get<Arc20PsbtService>(Arc20PsbtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
