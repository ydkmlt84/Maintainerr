import { MediaItemType, MediaServerType } from '@maintainerr/contracts';
import { CollectionMedia } from '../entities/collection_media.entities';

export interface ICollection {
  id?: number;
  type: MediaItemType;
  mediaServerId?: string;
  mediaServerType?: MediaServerType;
  libraryId: string;
  title: string;
  description?: string;
  isActive: boolean;
  arrAction: number;
  visibleOnRecommended?: boolean;
  visibleOnHome?: boolean;
  listExclusions?: boolean;
  forceSeerr?: boolean;
  deleteAfterDays?: number; // amount of days after add
  media?: CollectionMedia[];
  manualCollection?: boolean;
  manualCollectionName?: string;
  keepLogsForMonths?: number;
  tautulliWatchedPercentOverride?: number;
  radarrSettingsId?: number;
  sonarrSettingsId?: number;
  sortTitle?: string;
}

export interface ICalendarCollectionMedia {
  id: number;
  mediaServerId: string;
  addDate: Date;
}

export interface ICalendarCollection {
  id: number;
  title: string;
  type: MediaItemType;
  arrAction: number;
  deleteAfterDays: number;
  radarrSettingsId?: number;
  sonarrSettingsId?: number;
  media: ICalendarCollectionMedia[];
}

export enum ServarrAction {
  DELETE,
  UNMONITOR_DELETE_ALL,
  UNMONITOR_DELETE_EXISTING,
  UNMONITOR,
  DO_NOTHING,
}
