import { Test, TestingModule } from '@nestjs/testing';
import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';
import { RazorpayPaymentService } from './razorpay-payment.service';

describe('FeesController', () => {
  let controller: FeesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeesController],
      providers: [
        { provide: FeesService, useValue: {} },
        { provide: RazorpayPaymentService, useValue: {} },
      ],
    }).compile();

    controller = module.get<FeesController>(FeesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
