import { Module } from '@nestjs/common';
import { UploadModule } from './upload/upload.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { StudentsModule } from './students/students.module';

@Module({
  imports: [UploadModule, AuthModule, UsersModule, RoomsModule, StudentsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
