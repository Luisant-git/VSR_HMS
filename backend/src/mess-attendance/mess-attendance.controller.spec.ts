import { Test, TestingModule } from '@nestjs/testing';
import { MessAttendanceController } from './mess-attendance.controller';

describe('MessAttendanceController', () => {
  let controller: MessAttendanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessAttendanceController],
    }).compile();

    controller = module.get<MessAttendanceController>(MessAttendanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
