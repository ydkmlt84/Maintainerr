import { createZodDto } from 'nestjs-zod/dto'
import { TautulliSetting, tautulliSettingSchema } from './tautulliSetting'

// Interface merging adds z.infer properties to the class declaration,
// ensuring they're visible in compiled .d.ts output for downstream consumers.
export interface TautulliSettingDto extends TautulliSetting {}
export class TautulliSettingDto extends createZodDto(tautulliSettingSchema) {}
