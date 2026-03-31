import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ REQUIRED FOR STRIPE WEBHOOK
  app.use(
    '/webhook/stripe',
    bodyParser.raw({ type: 'application/json' }),
  );

  // normal json parser
  app.use(bodyParser.json());

  await app.listen(3001);
}
bootstrap();