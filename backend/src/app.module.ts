import { Module } from '@nestjs/common';

import { UsersService } from './users/users.service';
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
import { MenuPermissionModule } from './menu-permission/menu-permission.module';
import { DeveloperModule } from './developer/developer.module';
import { DeveloperSeedService } from './developer/developer.seed.service';
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
    CollegesModule,
    MenuPermissionModule,
    DeveloperModule
  ],
  controllers: [],
  providers: [DeveloperSeedService],
})
export class AppModule {}

