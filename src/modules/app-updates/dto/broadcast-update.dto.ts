import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BroadcastUpdateDto {
  @ApiPropertyOptional({
    description: 'Specific release version to broadcast (e.g. "0.2.0"). Defaults to latest.',
    example: '0.2.0',
  })
  @IsOptional()
  @IsString()
  version?: string;
}
