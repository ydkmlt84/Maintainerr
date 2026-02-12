import { createTypedDto } from '../../utils/createTypedDto'
import { jellyseerrSettingSchema } from './jellyseerrSetting'

export class JellyseerrSettingDto extends createTypedDto(
  jellyseerrSettingSchema,
) {}
