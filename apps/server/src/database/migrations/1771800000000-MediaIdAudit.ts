import { MigrationInterface, QueryRunner } from 'typeorm'

export class MediaIdAudit1771800000000 implements MigrationInterface {
  name = 'MediaIdAudit1771800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD COLUMN "media_id_audit_job_cron" varchar NOT NULL DEFAULT ('0 9 * * *')`,
    )
    await queryRunner.query(`
      CREATE TABLE "media_id_audit_run" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "startedAt" datetime NOT NULL,
        "completedAt" datetime,
        "status" varchar NOT NULL DEFAULT ('running'),
        "error" text,
        "totalPlexItems" integer NOT NULL DEFAULT (0),
        "matchedCount" integer NOT NULL DEFAULT (0),
        "findingCount" integer NOT NULL DEFAULT (0),
        "newCount" integer NOT NULL DEFAULT (0),
        "resolvedCount" integer NOT NULL DEFAULT (0),
        "probableMismatchCount" integer NOT NULL DEFAULT (0),
        "missingPlexIdCount" integer NOT NULL DEFAULT (0),
        "notFoundInArrCount" integer NOT NULL DEFAULT (0),
        "duplicatePlexIdCount" integer NOT NULL DEFAULT (0),
        "ambiguousTitleMatchCount" integer NOT NULL DEFAULT (0)
      )
    `)
    await queryRunner.query(`
      CREATE TABLE "media_id_audit_finding" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "runId" integer NOT NULL,
        "fingerprint" varchar NOT NULL,
        "category" varchar NOT NULL,
        "state" varchar NOT NULL DEFAULT ('current'),
        "isNew" boolean NOT NULL DEFAULT (0),
        "mediaType" varchar NOT NULL,
        "title" varchar NOT NULL,
        "year" integer,
        "plexLibraryId" varchar NOT NULL,
        "plexLibraryTitle" varchar NOT NULL,
        "plexRatingKey" varchar NOT NULL,
        "plexProviderId" varchar,
        "arrProviderId" varchar,
        "arrServerName" varchar,
        "arrItemId" integer,
        "confidence" varchar NOT NULL,
        "reason" text NOT NULL,
        "firstDetectedAt" datetime NOT NULL,
        "lastDetectedAt" datetime NOT NULL,
        "resolvedAt" datetime,
        CONSTRAINT "FK_media_id_audit_finding_run" FOREIGN KEY ("runId") REFERENCES "media_id_audit_run" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `)
    await queryRunner.query(
      `CREATE INDEX "IDX_media_id_audit_fingerprint" ON "media_id_audit_finding" ("fingerprint")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_media_id_audit_run_state" ON "media_id_audit_finding" ("runId", "state")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_media_id_audit_run_state"`)
    await queryRunner.query(`DROP INDEX "IDX_media_id_audit_fingerprint"`)
    await queryRunner.query(`DROP TABLE "media_id_audit_finding"`)
    await queryRunner.query(`DROP TABLE "media_id_audit_run"`)
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "media_id_audit_job_cron"`,
    )
  }
}
