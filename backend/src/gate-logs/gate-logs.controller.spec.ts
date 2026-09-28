import { Test, TestingModule } from '@nestjs/testing';
import { GateLogsController } from './gate-logs.controller';

describe('GateLogsController', () => {
  let controller: GateLogsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GateLogsController],
    }).compile();

    controller = module.get<GateLogsController>(GateLogsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
