import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('task_execution')
export class TaskExecution {
  @PrimaryColumn()
  name: string

  @Column({ type: 'datetime', nullable: true })
  lastRunAt: Date | null

  @Column({ type: 'datetime', nullable: true })
  lastCompletedAt: Date | null

  @Column({ type: 'varchar', default: 'never' })
  status: 'never' | 'running' | 'success' | 'failed'

  @Column({ type: 'text', nullable: true })
  error: string | null
}
