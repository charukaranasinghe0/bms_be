import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtUserPayload } from '../jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtUserPayload | undefined;
  },
);

