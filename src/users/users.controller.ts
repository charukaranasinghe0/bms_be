import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth/jwt-payload.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: JwtUserPayload | undefined, @Res() res: Response): Promise<void> {
    if (!user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const dbUser = await this.usersService.getCurrentUser(user.userId);
    if (!dbUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({ user: dbUser });
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getUsers(@Res() res: Response): Promise<void> {
    const users = await this.usersService.getAllUsers();
    res.status(200).json({ users });
  }
}

