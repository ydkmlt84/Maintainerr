import { createTypedDto } from '../../utils/createTypedDto'
import { overseerrSettingSchema } from './overseerrSetting'

export class OverseerrSettingDto extends createTypedDto(
  overseerrSettingSchema,
) {}
