import { RuleOperators, RulePossibility } from '../constants/rules.constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class RuleDto {
  operator: RuleOperators | null;
  action: RulePossibility;
  firstVal: [number, number];
  lastVal?: [number, number];
  customVal?: { ruleTypeId: number; value: string };
  section: number;
}
