import { createZodDto } from 'nestjs-zod/dto'
import { logSettingSchema, LogSetting } from './logSetting'

// Interface merging adds z.infer properties to the class declaration,
// ensuring they're visible in compiled .d.ts output for downstream consumers.
export interface LogSettingDto extends LogSetting {}
export class LogSettingDto extends createZodDto(logSettingSchema) {}
