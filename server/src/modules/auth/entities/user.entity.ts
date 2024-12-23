import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'
import { RegisterDto } from '../dtos/register.dto'

@Entity()
export class User implements RegisterDto {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  username: string

  @Column()
  password: string // Store hashed passwords!

  @Column()
  apikey: string // Apikey from settings table
}
