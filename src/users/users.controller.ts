import { Body, Controller, Get, Patch, Res, UseGuards } from '@nestjs/common';
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
    if (!user) { res.status(401).json({ message: 'Authentication required' }); return; }
    const dbUser = await this.usersService.getCurrentUser(user.userId);
    if (!dbUser) { res.status(404).json({ message: 'User not found' }); return; }
    res.status(200).json({ user: dbUser });
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: JwtUserPayload | undefined,
    @Body() body: { currentPassword: string; newPassword: string },
    @Res() res: Response,
  ): Promise<void> {
    if (!user) { res.status(401).json({ message: 'Authentication required' }); return; }
    await this.usersService.changePassword(user.userId, body.currentPassword, body.newPassword);
    res.status(200).json({ message: 'Password updated successfully' });
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getUsers(@Res() res: Response): Promise<void> {
    const users = await this.usersService.getAllUsers();
    res.status(200).json({ users });
  }
}

