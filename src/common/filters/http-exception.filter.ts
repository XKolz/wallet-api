import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as
        | string
        | { message?: string | string[]; error?: string };

      const normalizedResponse =
        typeof exceptionResponse === 'string' ? { message: exceptionResponse } : exceptionResponse;
      const details = Array.isArray(normalizedResponse.message)
        ? normalizedResponse.message
        : [normalizedResponse.message ?? exception.message];

      response.status(status).json({
        success: false,
        message: null,
        data: null,
        error: {
          error: normalizedResponse.error ?? exception.name,
          details
        },
        timestamp: new Date().toISOString(),
        path: request.url
      });

      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: null,
      data: null,
      error: {
        error: 'InternalServerError',
        details: ['Internal server error']
      },
      timestamp: new Date().toISOString(),
      path: request.url
    });
  }
}
