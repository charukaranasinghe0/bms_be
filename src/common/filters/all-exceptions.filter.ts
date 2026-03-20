import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isDev = (this.configService.get<string>('NODE_ENV') ?? 'development') === 'development';

    // Handle Nest HttpExceptions (validation, auth, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Special case: route not found -> mirror Express notFound middleware
      if (exception instanceof NotFoundException) {
        const original = request.originalUrl || request.url;
        response.status(404).json({
          message: `Not Found - ${original}`,
          ...(isDev ? { stack: (exception as any).stack } : {}),
        });
        return;
      }

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        // If controller/guard already shaped the response, pass it through
        response.status(status).json(exceptionResponse);
      } else {
        response.status(status).json({
          message: typeof exceptionResponse === 'string' ? exceptionResponse : exception.message,
        });
      }

      return;
    }

    // Fallback for unknown/unexpected errors -> mirror Express errorHandler
    const statusCode = 500;

    const error = exception as any;
    response.status(statusCode).json({
      message: error?.message || 'Something went wrong',
      ...(isDev ? { stack: error?.stack } : {}),
    });
  }
}

