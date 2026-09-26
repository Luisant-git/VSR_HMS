import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [AuthModule, UsersModule, RoomsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
