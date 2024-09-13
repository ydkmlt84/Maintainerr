import axios from 'axios';
import { ServarrService } from '../../../server/src/modules/api/servarr-api/servarr.service';
import { SettingDto } from "../../../server/src/modules/settings/dto's/setting.dto";
import { Settings } from '../../../server/src/modules/settings/entities/settings.entities';
import { Repository } from 'typeorm';

export const radarrAxiosInstance = axios.create({
    baseURL: "http://192.168.1.91:7878",
    headers: { 'X-Api-Key': 'e991b197b20b4159acb734ebb405ccc6' }
});
export const radarrfetcher = (url: string) => radarrAxiosInstance.get(url).then(res => res.data.path());


export const sonarrAxiosInstance = axios.create({
    baseURL: "http://192.168.1.91:8989",
    headers: { 'X-Api-Key': '6072d2342b7543bca70963444c3cd1f5' }
});
export const sonarrfetcher = (url: string) => sonarrAxiosInstance.get(url).then(res => res.data.path());

