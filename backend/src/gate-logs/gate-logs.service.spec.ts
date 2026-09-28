import { Test, TestingModule } from '@nestjs/testing';
import { GateLogsService } from './gate-logs.service';

describe('GateLogsService', () => {
  let service: GateLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GateLogsService],
    }).compile();

    service = module.get<GateLogsService>(GateLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
