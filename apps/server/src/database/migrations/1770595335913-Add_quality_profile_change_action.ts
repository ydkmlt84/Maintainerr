import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQualityProfileChangeAction1770595335913 implements MigrationInterface {
  name = 'AddQualityProfileChangeAction1770595335913';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collection" ADD COLUMN "qualityProfileId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection" ADD COLUMN "replaceExistingFilesAfterQualityProfileChange" boolean NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection" ADD COLUMN "searchAfterQualityProfileChange" boolean NOT NULL DEFAULT (0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collection" DROP COLUMN "searchAfterQualityProfileChange"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection" DROP COLUMN "replaceExistingFilesAfterQualityProfileChange"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection" DROP COLUMN "qualityProfileId"`,
    );
  }
}
