import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  
  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    if (!accountId) {
      this.logger.warn('R2_ACCOUNT_ID is not set in environment variables');
    }
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrlBase = process.env.R2_PUBLIC_URL;
    
    if (!bucketName || !publicUrlBase) {
      throw new InternalServerErrorException('Storage configuration is missing');
    }
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const fileName = `notes/${uniqueSuffix}${ext}`;
    
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
      
      return `${publicUrlBase}/${fileName}`;
    } catch (error: any) {
      this.logger.error(`Error uploading file to R2: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }
}
