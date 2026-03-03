import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
export type JwtPayload = {
    sub: string;
    username: string;
    role?: string;
};
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(config: ConfigService);
    validate(payload: JwtPayload): Promise<{
        userId: string;
        username: string;
        role: string | undefined;
    }>;
}
export {};
