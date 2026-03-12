import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet());
  app.use(compression());
  app.use(cors({
    origin: configService.get('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000',
    credentials: true,
  }));

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // API prefix
  app.setGlobalPrefix('api/v1');

  const port = configService.get<number>('PORT') || 4000;
  await app.listen(port);

  console.log(`🚀 RestaurantIQ Backend running on port ${port}`);
  console.log(`📡 WebSocket Gateway ready`);
  console.log(`🔒 Security: Helmet + CORS enabled`);
}

bootstrap();