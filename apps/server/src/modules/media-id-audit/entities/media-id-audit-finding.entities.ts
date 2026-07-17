import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import {
  MediaIdAuditCategory,
  MediaIdAuditFindingState,
  MediaIdAuditMediaType,
} from '../media-id-audit.types'
import { MediaIdAuditRun } from './media-id-audit-run.entities'

@Entity('media_id_audit_finding')
@Index(['runId', 'state'])
export class MediaIdAuditFinding {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  runId: number

  @ManyToOne(() => MediaIdAuditRun, (run) => run.findings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'runId' })
  run: MediaIdAuditRun

  @Column()
  @Index()
  fingerprint: string

  @Column({ type: 'varchar' })
  category: MediaIdAuditCategory

  @Column({ type: 'varchar', default: 'current' })
  state: MediaIdAuditFindingState

  @Column({ default: false })
  isNew: boolean

  @Column({ type: 'varchar' })
  mediaType: MediaIdAuditMediaType

  @Column()
  title: string

  @Column({ nullable: true })
  year?: number

  @Column()
  plexLibraryId: string

  @Column()
  plexLibraryTitle: string

  @Column()
  plexRatingKey: string

  @Column({ nullable: true })
  plexProviderId?: string

  @Column({ nullable: true })
  arrProviderId?: string

  @Column({ nullable: true })
  arrServerName?: string

  @Column({ nullable: true })
  arrItemId?: number

  @Column()
  confidence: string

  @Column({ type: 'text' })
  reason: string

  @Column({ type: 'datetime' })
  firstDetectedAt: Date

  @Column({ type: 'datetime' })
  lastDetectedAt: Date

  @Column({ type: 'datetime', nullable: true })
  resolvedAt?: Date
}
