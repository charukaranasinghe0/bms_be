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

  // FRONTEND_ORIGIN can be a comma-separated list of allowed origins
  // e.g. "https://myapp.vercel.app,https://myapp-git-main.vercel.app"
  const rawOrigin =
    configService.get<string>('FRONTEND_ORIGIN') ?? 'http://localhost:3000';

  const allowedOrigins = rawOrigin.split(',').map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // Check exact match
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Check wildcard Vercel preview pattern (*.vercel.app)
      const vercelPreview = allowedOrigins.some(
        (o) => o === '*.vercel.app' || o.endsWith('.vercel.app'),
      );
      if (vercelPreview && origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
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
