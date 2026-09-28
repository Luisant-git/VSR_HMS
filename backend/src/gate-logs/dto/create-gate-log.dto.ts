
export class CreateGateLogDto {
  studentId: string;
  movementType: 'EXIT' | 'ENTRY';
  time: string;
  purpose?: string;
  expectedReturnTime?: string;
  remarks?: string;
}

