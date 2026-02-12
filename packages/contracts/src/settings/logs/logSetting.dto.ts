import { createTypedDto } from '../../utils/createTypedDto'
import { logSettingSchema } from './logSetting'

export class LogSettingDto extends createTypedDto(logSettingSchema) {}
