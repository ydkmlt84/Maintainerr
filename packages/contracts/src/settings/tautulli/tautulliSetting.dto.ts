import { createTypedDto } from '../../utils/createTypedDto'
import { tautulliSettingSchema } from './tautulliSetting'

export class TautulliSettingDto extends createTypedDto(tautulliSettingSchema) {}
