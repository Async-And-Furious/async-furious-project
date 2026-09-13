import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/infrastructure/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.header('x-correlation-id')?.trim() || randomUUID();
    res.setHeader('x-correlation-id', correlationId);
    res.locals.correlationId = correlationId;
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const route = req.route?.path ?? req.path;
      const latency = Number(latencyMs.toFixed(2));
      const error = res.statusCode >= 400;
      process.stdout.write(
        `${JSON.stringify({
          _aws: {
            Timestamp: Date.now(),
            CloudWatchMetrics: [
              {
                Namespace: process.env.CLOUDWATCH_METRIC_NAMESPACE ?? 'AsyncFurious/API',
                Dimensions: [['Method', 'Route']],
                Metrics: [
                  { Name: 'RequestCount', Unit: 'Count' },
                  { Name: 'ErrorCount', Unit: 'Count' },
                  { Name: 'LatencyMs', Unit: 'Milliseconds' },
                ],
              },
            ],
          },
          event: 'http_request',
          correlationId,
          method: req.method,
          path: req.originalUrl,
          Method: req.method,
          Route: route,
          statusCode: res.statusCode,
          latencyMs: latency,
          RequestCount: 1,
          ErrorCount: error ? 1 : 0,
          LatencyMs: latency,
          error,
        })}\n`
      );
      if (res.statusCode >= 500 || latency >= Number(process.env.HTTP_LATENCY_ALARM_MS ?? 2000)) {
        process.stdout.write(
          `${JSON.stringify({ event: 'http_alarm', correlationId, method: req.method, route, statusCode: res.statusCode, latencyMs: latency })}\n`
        );
      }
    });
    next();
  });

  app.use(
    helmet({
      crossOriginEmbedderPolicy: { policy: 'credentialless' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          // CSP: unsafe-inline required for Swagger UI / NestJS dev tools
          // OWASP ZAP alert 10055: This is an accepted trade-off for browser-based API docs.
          // Production APIs serving only mobile/desktop clients can remove unsafe-inline
          // if Swagger UI is not exposed (set NODE_ENV=production or disable in config).
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          upgradeInsecureRequests: [],
        },
      },
    })
  );

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  });

  // Redirect root to API entry point (fixes ZAP spider on /)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/' && req.method === 'GET') {
      res.redirect(302, '/api/v1');
      return;
    }
    next();
  });

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : process.env.NODE_ENV === 'production'
        ? false
        : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Async Furious API')
    .setDescription('RESTful API for managing service orders, customers, vehicles, and parts')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err) => {
  process.stderr.write(`Failed to bootstrap application: ${String(err)}\n`);
  process.exit(1);
});
