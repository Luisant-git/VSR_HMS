import { Controller, Post, Delete, Body, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { unlink, readdir, writeFile } from 'fs/promises';
import type { Request } from 'express';
const sharp = require('sharp');

@Controller('upload')
export class UploadController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    const originalName = file.originalname;
    let filename: string;
    let buffer = file.buffer;

    if (originalName.startsWith('invoice-') || originalName.startsWith('packageslip-')) {
      filename = originalName;
    } else {
      const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        filename = `${randomName}.webp`;
        try {
          buffer = await sharp(file.buffer)
            .rotate()
            .resize({
              width: 1200,
              height: 1200,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({
              quality: 80,
              effort: 4,
            })
            .toBuffer();
        } catch (e) {
          console.error('Sharp processing failed:', e);
          filename = `${randomName}${extname(originalName)}`;
        }
      } else {
        filename = `${randomName}${extname(originalName)}`;
      }
    }

    const filePath = join('./uploads', filename);
    await writeFile(filePath, buffer);

    const requestHost = req.get('X-Forwarded-Host') || req.get('host');
    const protocol = req.get('X-Forwarded-Proto') || req.protocol;
    const requestBase = protocol && requestHost ? `${protocol}://${requestHost}` : '';
    const configuredBase = requestBase || process.env.UPLOAD_URL || process.env.API_BASE_URL || process.env.APP_URL || process.env.PUBLIC_URL || '';
    const baseUrl = configuredBase.replace(/\/$/, '').replace(/\/uploads$/, '');
    const uploadsBaseUrl = `${baseUrl}/uploads`;

    return {
      filename: filename,
      url: `${uploadsBaseUrl}/${filename}`,
    };
  }

  @Delete('file')
  async deleteFile(@Body('url') url: string) {
    try {
      const filename = url.split('/').pop()?.split('?')[0];
      if (!filename) throw new Error('Invalid URL');
      const filePath = join('./uploads', filename);
      await unlink(filePath);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
