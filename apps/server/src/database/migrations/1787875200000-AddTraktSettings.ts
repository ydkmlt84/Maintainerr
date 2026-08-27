import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTraktSettings1787875200000 implements MigrationInterface {
  name = 'AddTraktSettings1787875200000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "trakt_client_id" varchar`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "trakt_client_secret" varchar`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "trakt_access_token" varchar`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "trakt_refresh_token" varchar`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "trakt_token_expires_at" datetime`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "trakt_username" varchar`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "trakt_username"`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "trakt_token_expires_at"`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "trakt_refresh_token"`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "trakt_access_token"`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "trakt_client_secret"`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "trakt_client_id"`,
    )
  }
}
