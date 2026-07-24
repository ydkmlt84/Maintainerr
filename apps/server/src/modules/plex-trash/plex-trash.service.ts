import { MaintainerrEvent } from '@maintainerr/contracts'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PlexApiService } from '../api/plex-api/plex-api.service'
import { MaintainerrLogger } from '../logging/logs.service'
import { NotificationService } from '../notifications/notifications.service'
import { NotificationType } from '../notifications/notifications-interfaces'

interface PlexTrashItem {
  plexId: string
  title: string
  year?: number
  library: string
}

@Injectable()
export class PlexTrashService {
  private lastCollectionNotificationAt = 0

  constructor(
    private readonly plexApiService: PlexApiService,
    private readonly notificationService: NotificationService,
    private readonly logger: MaintainerrLogger,
  ) {
    logger.setContext(PlexTrashService.name)
  }

  public async getItems(abortSignal?: AbortSignal): Promise<PlexTrashItem[]> {
    const libraries = await this.plexApiService.getLibraries(false)
    if (!libraries) throw new Error('Could not fetch Plex libraries')

    const items: PlexTrashItem[] = []
    const pageSize = 500

    for (const library of libraries) {
      let offset = 0
      let totalSize = 0

      do {
        abortSignal?.throwIfAborted()
        const response = await this.plexApiService.getLibraryContents(
          library.key,
          { offset, size: pageSize, trash: true },
          undefined,
          false,
        )
        if (!response) {
          throw new Error(`Could not fetch Plex trash for ${library.title}`)
        }

        totalSize = response.totalSize ?? 0
        items.push(
          ...response.items.map((item) => ({
            plexId: item.ratingKey,
            title: item.title,
            year: item.year,
            library: library.title,
          })),
        )
        offset += response.items.length
      } while (offset < totalSize && offset > 0)
    }

    return items
  }

  public async sendNotification(abortSignal?: AbortSignal): Promise<void> {
    const items = await this.getItems(abortSignal)
    if (items.length === 0) {
      this.logger.log('Plex trash is empty; notification skipped')
      return
    }

    await this.notificationService.sendNotification(
      NotificationType.PLEX_TRASH_ABOUT_TO_BE_EMPTIED,
      {
        subject: `Plex trash contains ${items.length} item${items.length === 1 ? '' : 's'}`,
        message: this.formatItems(items),
      },
    )
    this.logger.log(`Sent Plex trash notification for ${items.length} items`)
  }

  @OnEvent(MaintainerrEvent.CollectionHandler_Finished)
  private onCollectionHandlerFinished(): void {
    if (!this.plexApiService.isPlexSetup()) return
    const now = Date.now()
    if (now - this.lastCollectionNotificationAt < 5000) return
    this.lastCollectionNotificationAt = now

    void this.sendNotification().catch((error) => {
      this.logger.error(
        'Failed to send the Plex trash notification after collection handling',
        error,
      )
    })
  }

  public async empty(): Promise<{
    libraryCount: number
    libraries: string[]
  }> {
    const items = await this.getItems()
    const result = await this.plexApiService.emptyTrash()

    await this.notificationService.sendNotification(
      NotificationType.PLEX_TRASH_EMPTIED,
      {
        subject: `Plex trash emptied${items.length > 0 ? `: ${items.length} item${items.length === 1 ? '' : 's'} removed` : ''}`,
        message:
          items.length > 0
            ? this.formatItems(items)
            : 'No items were present in Plex trash.',
      },
    )
    this.logger.log(
      `Sent Plex trash emptied notification for ${items.length} items`,
    )

    return result
  }

  private formatItems(items: PlexTrashItem[]): string {
    const visibleItems = items.slice(0, 25)
    const lines = visibleItems.map(
      (item) =>
        `- ${item.title}${item.year ? ` (${item.year})` : ''} - ${item.library} - Plex ID ${item.plexId}`,
    )
    if (items.length > visibleItems.length) {
      lines.push(`- ...and ${items.length - visibleItems.length} more`)
    }
    return lines.join('\n')
  }
}
