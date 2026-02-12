import { createZodDto } from 'nestjs-zod/dto'
import { jellyseerrSettingSchema, JellyseerrSetting } from './jellyseerrSetting'

export class JellyseerrSettingDto
  extends createZodDto(jellyseerrSettingSchema)
  implements JellyseerrSetting {}
