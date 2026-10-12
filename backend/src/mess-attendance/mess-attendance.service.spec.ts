import { Test, TestingModule } from '@nestjs/testing';
import { MessAttendanceService } from './mess-attendance.service';

describe('MessAttendanceService', () => {
  let service: MessAttendanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessAttendanceService],
    }).compile();

    service = module.get<MessAttendanceService>(MessAttendanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
