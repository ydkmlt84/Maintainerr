import { createZodDto } from 'nestjs-zod/dto'
import { tautulliSettingSchema, TautulliSetting } from './tautulliSetting'

export class TautulliSettingDto
  extends createZodDto(tautulliSettingSchema)
  implements TautulliSetting {}
