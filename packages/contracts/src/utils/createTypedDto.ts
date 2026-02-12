import { createZodDto, ZodDto } from 'nestjs-zod/dto'
import z from 'zod'

/**
 * A typed wrapper around nestjs-zod's `createZodDto` that properly exposes
 * z.infer properties on the returned class constructor.
 *
 * `createZodDto` returns `ZodDto<TSchema>` where instances are typed as
 * `ReturnType<TSchema['parse']>`. This generic chain doesn't always resolve
 * in compiled `.d.ts` output, causing downstream consumers to see DTO
 * instances as having no properties (TS2345 errors in clean builds).
 *
 * This wrapper re-casts the return type so that `new()` returns `z.output<T>`
 * directly, which TypeScript fully inlines in `.d.ts` files.
 */
export function createTypedDto<TSchema extends z.ZodType>(schema: TSchema) {
  return createZodDto(schema) as unknown as Omit<
    ZodDto<TSchema>,
    'new' | 'create'
  > & {
    new (): z.output<TSchema>
    create(input: unknown): z.output<TSchema>
  }
}
