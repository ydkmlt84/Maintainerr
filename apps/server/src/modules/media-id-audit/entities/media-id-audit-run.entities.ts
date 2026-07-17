import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { MediaIdAuditRunStatus } from '../media-id-audit.types'
import { MediaIdAuditFinding } from './media-id-audit-finding.entities'

@Entity('media_id_audit_run')
export class MediaIdAuditRun {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'datetime' })
  startedAt: Date

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date

  @Column({ type: 'varchar', default: 'running' })
  status: MediaIdAuditRunStatus

  @Column({ type: 'text', nullable: true })
  error?: string

  @Column({ default: 0 })
  totalPlexItems: number

  @Column({ default: 0 })
  matchedCount: number

  @Column({ default: 0 })
  findingCount: number

  @Column({ default: 0 })
  newCount: number

  @Column({ default: 0 })
  resolvedCount: number

  @Column({ default: 0 })
  probableMismatchCount: number

  @Column({ default: 0 })
  missingPlexIdCount: number

  @Column({ default: 0 })
  notFoundInArrCount: number

  @Column({ default: 0 })
  duplicatePlexIdCount: number

  @Column({ default: 0 })
  ambiguousTitleMatchCount: number

  @Column({ default: 0 })
  plexTrashCount: number

  @OneToMany(() => MediaIdAuditFinding, (finding) => finding.run, {
    cascade: true,
  })
  findings: MediaIdAuditFinding[]
}
