import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddImageCacheSizeLimit1788048000000 implements MigrationInterface {
  name = 'AddImageCacheSizeLimit1788048000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "image_cache_max_gb" integer NOT NULL DEFAULT 10`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "image_cache_max_gb"`,
    )
  }
}
