import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException, Type } from '@nestjs/common';

export const validateDto = async <T extends object>(
  cls: Type<T>,
  plain: unknown,
): Promise<T> => {
  const instance = plainToInstance(cls, plain);

  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });

  if (errors.length > 0) {
    const formatted = errors.map((err) => ({
      property: err.property,
      constraints: err.constraints,
    }));

    throw new BadRequestException({
      message: 'Validation failed',
      errors: formatted,
    });
  }

  return instance;
};

