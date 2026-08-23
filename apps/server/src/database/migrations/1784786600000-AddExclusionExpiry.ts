import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddExclusionExpiry1784786600000 implements MigrationInterface {
  name = 'AddExclusionExpiry1784786600000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exclusion" ADD COLUMN "expiresAt" datetime`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exclusion" DROP COLUMN "expiresAt"`)
  }
}
