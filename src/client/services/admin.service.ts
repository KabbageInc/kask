import {Injectable} from '@angular/core';
import {Http} from '@angular/http';

@Injectable()
export class AdminService {
    constructor(
        private http: Http
    ) {}

    search(beerName: string) {
        return this.http.get(`/api/admin/search/${encodeURIComponent(beerName)}`)
            .map(res => res.json());
    }

    store(beerId: number, size: string, locationId: number) {
        return this.http.post(`/api/admin/store`, {
            BeerId: beerId,
            Size: size,
            LocationId: locationId
        }).map(res => res.json());
    }

    loadTap(tapId: number, beerId: number, size: string) {
        return this.http.post(`/api/admin/tap/${tapId}`, {
            BeerId: beerId,
            Size: size
        }).map(res => res.json());
    }

    loadTapFromStorage(tapId: number, kegId: number) {
        return this.http.post(`/api/admin/tap/${tapId}`, {
            KegId: kegId
        }).map(res => res.json());
    }

    clearKeg(kegId: number) {
        return this.http.post(`/api/admin/clear/${kegId}`, {});
    }

    move(kegId: number, locationId: number) {
        return this.http.post('/api/admin/move', {
            KegId: kegId,
            LocationId: locationId
        });
    }
    saveBeerLabelImage(beerId: number, tapId: number, scale: number, xOffset: number, yOffset: number) {
        return this.http.post('/api/admin/beers/scale', {
            BeerId: beerId,
            TapId: tapId,
            Scale: scale,
            XOffset: xOffset,
            YOffset: yOffset
        });
    }
}
