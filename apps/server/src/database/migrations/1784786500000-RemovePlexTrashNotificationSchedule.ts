import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemovePlexTrashNotificationSchedule1784786500000 implements MigrationInterface {
  name = 'RemovePlexTrashNotificationSchedule1784786500000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "plex_trash_notification_job_cron"`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "plex_trash_notification_job_cron" varchar NOT NULL DEFAULT ('')`,
    )
  }
}
