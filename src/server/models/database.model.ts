import {BeerSession} from './session.model';
import {Observable} from 'rxjs/Rx';
import {Style} from './style.model';
import {Brewery} from './brewery.model';
import {Location} from './location.model';
import {Beer} from './beer.model';
import {Tap} from './tap.model';
import {Keg, KegSize} from './keg.model';
import {Order} from './order.model';

export interface Database {
    // Auth methods
    registerUser(username: string, salt: string, passHash: string): Observable<number>;
    getPasswordInfo(username: string): Observable<any>;
    generateSession(session: string, userId: number): Observable<string>;
    getUserInfoBySession(session: string): Observable<any>;
    invalidateSession(session: string): Observable<any>;

    // Admin methods for saving data from searches
    searchForBeer(searchTerm: string): Observable<Beer[]>;
    saveBeer(beer: Beer): Observable<number>;
    saveBeers(beers: Beer[]): Observable<Beer[]>;
    saveBeerLabelImage(beerId: number, scale: number, xOffset: number, yOffset: number): Observable<any>;
    saveStyle(style: Style): Observable<number>;
    saveStyles(styles: Style[]): Observable<{[BDBID: string]: Style}>;
    saveBrewery(brewery: Brewery): Observable<number>;
    saveBreweries(breweries: Brewery[]): Observable<{[BDBID: string]: Brewery}>;

    // retrieve data from previous searches
    getStyles(): Observable<Style[]>;
    getStyle(styleId: number): Observable<Style & {Beers: Beer[]}>;
    getBreweries(): Observable<Brewery[]>;
    getBrewery(breweryId: number): Observable<Brewery & {Beers: Beer[]}>;
    getBeers(): Observable<Beer[]>;
    getBeer(styleId: number): Observable<Beer>;

    // work with storage locations
    getLocations(): Observable<Location[]>;
    getLocation(locationId: number): Observable<Location & {Beers: Beer[]}>;
    addLocation(name: string, description?: string): Observable<number>;
    editLocation(locationId: number, name: string, description?: string): Observable<boolean>;
    deleteLocation(locationId: number): Observable<boolean>;

    // taps operations
    getTaps(): Observable<Tap[]>;
    getTap(tapId: number): Observable<Tap>;
    addTap(name: string, description?: string, status?: string): Observable<number>;
    editTap(tapId: number, name: string, description?: string, status?: string): Observable<boolean>;
    deleteTap(tapId: number): Observable<boolean>;

    // Contents
    getLocationContents(locationId: number): Observable<Keg[]>;
    getTapContents(tapId: number, userId: number): Observable<BeerSession>;
    adjustKegVolume(kegId: number, volume: number): Observable<any>;
    adjustTapVolume(tapId: number, volume): Observable<any>;
    getPours(fromDate: string, toDate: string): Observable<any[]>;
    getKegSessionHistory(fromDate: string, toDate: string): Observable<BeerSession[]>;
    getKegLocation(kegId: number): Observable<number>;
    getKegTap(kegId: number): Observable<number>;
    findKeg(kegId: number): Observable<string>;

    // Order Managemet
    addOrder(title: string, description: string, votesPerUser: number): Observable<number>;
    getOrders(isAdmin: boolean, fromDate: string, toDate: string): Observable<Order[]>;
    getOrder(userId: number, orderId: number): Observable<Order>;
    addBeerToOrder(beerId: number, orderId: number, size: KegSize): Observable<number>;
    removeBeerFromOrder(orderId: number, orderBeerId: number): Observable<any>;
    updateOrder(orderId: number, partialOrder: any): Observable<any>;
    userCanVoteForOrder(userId: number, orderId: number): Observable<boolean>;

    // Voting
    voteForTap(tapId: number, userId: number, vote: string): Observable<any>;
    voteForSession(sessionId: number, userId: number, vote: string): Observable<any>;
    voteForOrderBeer(orderBeerId: number, userId: number, vote: string): Observable<any>;
    getSessionVotes(sessionId: number): Observable<any[]>;

    // beer movement
    // -----------------
    // Assign a beer from db to a storage location
    assignBeerToLocation(beerId: number, locationId: number, size: KegSize): Observable<boolean>;
    // move a keg from one storage location to another
    moveKegLocation(kegId: number, newLocationId: number): Observable<boolean>;
    // move a keg from storage location to tap
    tapKeg(kegId: number, tapId: number): Observable<number>;
    // tap a beer without adding it to storage (straight from supplier?)
    tapBeer(beerId: number, tapId: number, size: KegSize): Observable<number>;
    // remove keg from tap without replacing it with another keg (gasp!) only in a beer emergency
    emptyTap(tapId: number): Observable<boolean>;
}
