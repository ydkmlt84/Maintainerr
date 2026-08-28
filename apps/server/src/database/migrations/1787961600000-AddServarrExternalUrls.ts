import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddServarrExternalUrls1787961600000 implements MigrationInterface {
  name = 'AddServarrExternalUrls1787961600000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "radarr_settings" ADD COLUMN "externalUrl" varchar`,
    )
    await queryRunner.query(
      `ALTER TABLE "sonarr_settings" ADD COLUMN "externalUrl" varchar`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sonarr_settings" DROP COLUMN "externalUrl"`,
    )
    await queryRunner.query(
      `ALTER TABLE "radarr_settings" DROP COLUMN "externalUrl"`,
    )
  }
}
