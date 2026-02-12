import { createZodDto } from 'nestjs-zod/dto'
import { jellyfinSettingSchema, JellyfinSetting } from './jellyfinSetting'

// Interface merging adds z.infer properties to the class declaration,
// ensuring they're visible in compiled .d.ts output for downstream consumers.
export interface JellyfinSettingDto extends JellyfinSetting {}
export class JellyfinSettingDto extends createZodDto(jellyfinSettingSchema) {}
