import { Type } from '@nestjs/common';
export declare const validateDto: <T extends object>(cls: Type<T>, plain: unknown) => Promise<T>;
