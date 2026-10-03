import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());

  app.useStaticAssets('uploads', {
    prefix: '/uploads/',
    maxAge: 31536000,
    setHeaders: (res, path) => {
      const lowerPath = path.toLowerCase();
      if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.png') || lowerPath.endsWith('.webp')) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        return;
      }
    }
  });


  const config = new DocumentBuilder()
    .setTitle('VSR HMS API')
    .setDescription('The VSR Hostel Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation is available at: http://localhost:${port}/api`);
}
bootstrap();

