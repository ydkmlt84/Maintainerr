import { createZodDto } from 'nestjs-zod/dto'
import { overseerrSettingSchema, OverseerrSetting } from './overseerrSetting'

// Interface merging adds z.infer properties to the class declaration,
// ensuring they're visible in compiled .d.ts output for downstream consumers.
export interface OverseerrSettingDto extends OverseerrSetting {}
export class OverseerrSettingDto extends createZodDto(overseerrSettingSchema) {}
