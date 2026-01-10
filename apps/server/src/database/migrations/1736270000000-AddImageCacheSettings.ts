import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageCacheSettings1736270000000 implements MigrationInterface {
  name = 'AddImageCacheSettings1736270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "settings" ADD COLUMN "image_cache_enabled" boolean NOT NULL DEFAULT 1',
    );
    await queryRunner.query(
      'ALTER TABLE "settings" ADD COLUMN "image_cache_max_mb" integer NOT NULL DEFAULT 200',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "settings" DROP COLUMN "image_cache_max_mb"');
    await queryRunner.query('ALTER TABLE "settings" DROP COLUMN "image_cache_enabled"');
  }
}
