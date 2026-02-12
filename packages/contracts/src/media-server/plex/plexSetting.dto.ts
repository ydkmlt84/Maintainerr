import { createTypedDto } from '../../utils/createTypedDto'
import { plexSettingSchema } from './plexSetting'

export class PlexSettingDto extends createTypedDto(plexSettingSchema) {}
