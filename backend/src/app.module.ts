import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UploadModule } from './upload/upload.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { StudentsModule } from './students/students.module';
import { FeesModule } from './fees/fees.module';
import { GateLogsModule } from './gate-logs/gate-logs.module';
import { EbBillsModule } from './eb-bills/eb-bills.module';
import { ClearanceModule } from './clearance/clearance.module';
import { OutpassModule } from './outpass/outpass.module';
import { CollegesModule } from './colleges/colleges.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    UploadModule, 
    AuthModule, 
    UsersModule, 
    RoomsModule, 
    StudentsModule, 
    FeesModule, 
    GateLogsModule, 
    EbBillsModule, 
    ClearanceModule, 
    OutpassModule, 
    CollegesModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

