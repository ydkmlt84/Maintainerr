import { createZodDto } from 'nestjs-zod/dto'
import { logSettingSchema, LogSetting } from './logSetting'

export class LogSettingDto
  extends createZodDto(logSettingSchema)
  implements LogSetting {}
