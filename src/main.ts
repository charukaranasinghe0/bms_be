import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.use(cookieParser());
  app.use(helmet());
  app.use(morgan('dev'));

  app.enableCors({
    origin: true, // reflect request origin — allows all origins
    credentials: true,
  });

  // Match Express: /health is NOT under /api, but other routes are
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  app.useGlobalFilters(new AllExceptionsFilter(configService));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  const port = configService.get<number>('PORT') ?? 4000;
  await app.listen(port);
}

bootstrap();
