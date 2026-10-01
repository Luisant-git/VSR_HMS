import { Injectable, OnModuleInit } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class DeveloperSeedService implements OnModuleInit {
  constructor(private readonly usersService: UsersService) {}

  async onModuleInit() {
    const existing = await this.usersService.findByEmail('developer@gmail.com');
    if (!existing) {
      await this.usersService.create({
        email: 'developer@gmail.com',
        password: 'password123',
        name: 'Developer',
        role: 'DEVELOPER',
      });
    }
  }
}
