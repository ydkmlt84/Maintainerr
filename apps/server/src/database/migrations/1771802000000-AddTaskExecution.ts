import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTaskExecution1771802000000 implements MigrationInterface {
  name = 'AddTaskExecution1771802000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "task_execution" (
        "name" varchar PRIMARY KEY NOT NULL,
        "lastRunAt" datetime,
        "lastCompletedAt" datetime,
        "status" varchar NOT NULL DEFAULT ('never'),
        "error" text
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "task_execution"`)
  }
}
