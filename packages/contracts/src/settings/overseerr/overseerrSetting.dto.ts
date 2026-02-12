import { createZodDto } from 'nestjs-zod/dto'
import { overseerrSettingSchema, OverseerrSetting } from './overseerrSetting'

export class OverseerrSettingDto
  extends createZodDto(overseerrSettingSchema)
  implements OverseerrSetting {}
