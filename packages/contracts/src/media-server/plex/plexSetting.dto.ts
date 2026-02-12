import { createZodDto } from 'nestjs-zod/dto'
import { plexSettingSchema, PlexSetting } from './plexSetting'

export class PlexSettingDto
  extends createZodDto(plexSettingSchema)
  implements PlexSetting {}
