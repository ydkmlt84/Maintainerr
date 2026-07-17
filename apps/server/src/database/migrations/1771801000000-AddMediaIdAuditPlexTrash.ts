import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMediaIdAuditPlexTrash1771801000000 implements MigrationInterface {
  name = 'AddMediaIdAuditPlexTrash1771801000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_id_audit_run" ADD COLUMN "plexTrashCount" integer NOT NULL DEFAULT (0)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_id_audit_run" DROP COLUMN "plexTrashCount"`,
    )
  }
}
