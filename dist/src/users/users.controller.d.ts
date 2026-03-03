import type { Response } from 'express';
import { UsersService } from './users.service';
import type { JwtUserPayload } from '../auth/jwt-payload.interface';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(user: JwtUserPayload | undefined, res: Response): Promise<void>;
    getUsers(res: Response): Promise<void>;
}
