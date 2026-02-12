import { createZodDto } from 'nestjs-zod/dto'
import { JellyseerrSetting, jellyseerrSettingSchema } from './jellyseerrSetting'

// Interface merging adds z.infer properties to the class declaration,
// ensuring they're visible in compiled .d.ts output for downstream consumers.
export interface JellyseerrSettingDto extends JellyseerrSetting {}
export class JellyseerrSettingDto extends createZodDto(
  jellyseerrSettingSchema,
) {}
