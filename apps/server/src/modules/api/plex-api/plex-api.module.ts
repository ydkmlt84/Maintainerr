import { Module } from '@nestjs/common';
import { SettingsModule } from '../../../modules/settings/settings.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exclusion } from '../../rules/entities/exclusion.entities';
import { CollectionMedia } from '../../collections/entities/collection_media.entities';
import { LibraryEnrichmentService } from './library-enrichment.service';
import { PlexSetupGuard } from './guards/plex-setup.guard';
import { PlexApiController } from './plex-api.controller';
import { PlexApiService } from './plex-api.service';

@Module({
  imports: [
    SettingsModule,
    TypeOrmModule.forFeature([Exclusion, CollectionMedia]),
  ],
  controllers: [PlexApiController],
  providers: [PlexApiService, PlexSetupGuard, LibraryEnrichmentService],
  exports: [PlexApiService, LibraryEnrichmentService],
})
export class PlexApiModule {}
