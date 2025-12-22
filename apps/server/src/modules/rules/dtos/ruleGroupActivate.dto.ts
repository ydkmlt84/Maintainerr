import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsInt } from 'class-validator';

export class RuleGroupActivateDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Type(() => Number)
  ids: number[];

  @IsBoolean()
  isActive: boolean;
}
