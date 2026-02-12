import { createZodDto } from 'nestjs-zod/dto'
import { jellyfinSettingSchema, JellyfinSetting } from './jellyfinSetting'

export class JellyfinSettingDto
  extends createZodDto(jellyfinSettingSchema)
  implements JellyfinSetting {}
