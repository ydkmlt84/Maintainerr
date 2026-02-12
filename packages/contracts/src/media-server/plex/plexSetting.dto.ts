import { createZodDto } from 'nestjs-zod/dto'
import { PlexSetting, plexSettingSchema } from './plexSetting'

// Interface merging adds z.infer properties to the class declaration,
// ensuring they're visible in compiled .d.ts output for downstream consumers.
export interface PlexSettingDto extends PlexSetting {}
export class PlexSettingDto extends createZodDto(plexSettingSchema) {}
