import { createTypedDto } from '../../utils/createTypedDto'
import { jellyfinSettingSchema } from './jellyfinSetting'

export class JellyfinSettingDto extends createTypedDto(jellyfinSettingSchema) {}
