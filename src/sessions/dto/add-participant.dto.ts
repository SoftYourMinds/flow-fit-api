import { IsInt, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AddParticipantDto {
  @ApiPropertyOptional()
  @ValidateIf((o) => !o.customName)
  @IsInt()
  @IsOptional()
  clientId?: number;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.clientId)
  @IsString()
  @IsOptional()
  customName?: string;
}
