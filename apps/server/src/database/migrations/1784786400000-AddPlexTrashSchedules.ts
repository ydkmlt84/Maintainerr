import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPlexTrashSchedules1784786400000 implements MigrationInterface {
  name = 'AddPlexTrashSchedules1784786400000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "plex_trash_notification_job_cron" varchar NOT NULL DEFAULT ('')`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "plex_trash_empty_job_cron" varchar NOT NULL DEFAULT ('')`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "plex_trash_empty_job_cron"`,
    )
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "plex_trash_notification_job_cron"`,
    )
  }
}
