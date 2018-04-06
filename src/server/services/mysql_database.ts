import {Observable} from 'rxjs/Rx';
import {createPool, escape, IPoolConfig, Pool} from 'mysql';
import {ErrorObservable} from 'rxjs/observable/ErrorObservable';
import { Beer, BeerSession, Brewery, Database, Keg, KegSize, Location, Style, Tap } from '../models';
import { Order, OrderStatus } from '../models/order.model';
import { OrderBeer } from '../models/orderbeer.model';
import { OrderVote, Vote } from '../models/ordervote.model';

export class MysqlDatabase implements Database {

    private pool: Pool;

    constructor(config?: IPoolConfig) {
        let poolconfig = Object.assign({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            database: process.env.DB_DATABASE || 'ontap',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'admin'
        }, config || {});

        this.pool = createPool(poolconfig);
    }

    private query(q, params?): Observable<any> {
        return Observable.create(observer => {
            this.pool.getConnection((err, conn) => {
                if (err) {
                    if (conn && conn.release) {
                        conn.release();
                    }
                    return observer.error(err);
                }
                conn.query(q, params || [], (error, result) => {
                    conn.release();
                    if (error) {
                        console.error('DATABASE ERROR', error);
                        return observer.error(error);
                    }
                    observer.next(result);
                    observer.complete();
                });
            });
        });
    }

    private mapBeerSession(result: any): BeerSession {
        let session: BeerSession = {
            Active: result.Active,
            SessionId: result.SessionId,
            NetVote: result.NetVote,
            UserVote: result.UserVote,
            TapId: result.TapId,
            Keg: this.mapKeg(result),
            TappedTime: result.TappedTime,
            RemovalTime: result.RemovalTime
        };
        return session;
    }

    private mapKeg(result: any): Keg {
        let gallons = 15.5;
        let mlPerGallon = 3785;
        if ('Size' in result) {
            if (result.Size === '1/2') {
                gallons = 15.5;
            } else if (result.Size === '1/4') {
                gallons = 7.75;
            } else {
                gallons = 5.16;
            }
        }
        let initialVolume = gallons * mlPerGallon;
        let keg: Keg = {
            KegId: result.KegId,
            Beer: this.mapBeer(result),
            Size: result.Size,
            InitialVolume: initialVolume,
            RemovedVolume: result.RemovedVolume || 0,
        };
        if ('TapId' in result) {
            keg.TapId = result.TapId;
        }
        if ('LocationId' in result) {
            keg.LocationId = result.LocationId;
        }
        return keg;
    }

    private mapBeer(result: any, verbose = true): Beer {
        let beer: Beer = {
            BeerId: result.BeerId,
            BeerName: result.BeerName,
            Brewery: this.mapBrewery(result, verbose),
            Style: this.mapStyle(result, verbose),
        };

        if (verbose) {
            Object.assign(beer, {
                BeerBDBID: result.BeerBDBID,
                BeerDescription: result.BeerDescription,
                ABV: result.ABV,
                IBU: result.IBU,
                LabelUrl: result.LabelUrl,
                LabelScalingFactor: result.LabelScalingFactor,
                LabelOffsetX: result.LabelOffsetX,
                LabelOffsetY: result.LabelOffsetY
            });
        }

        return beer;
    }

    private mapStyle(result: any, verbose = true): Style {
        let style: Style = {
            StyleId: result.StyleId,
            StyleName: result.StyleName
        }

        if (verbose) {
            Object.assign(style,  {
                StyleBDBID: result.StyleBDBID,
                StyleDescription: result.StyleDescription,
                ABVMin: result.ABVMin,
                ABVMax: result.ABVMax,
                IBUMin: result.IBUMin,
                IBUMax: result.IBUMax,
                SRMMin: result.SRMMin,
                SRMMax: result.SRMMax
            });
        }

        return style;
    }

    private mapBrewery(result: any, verbose = true): Brewery {
        let brewery: Brewery = {
            BreweryId: result.BreweryId,
            BreweryName: result.BreweryName
        };

        if (verbose) {
            Object.assign(brewery, {
                BreweryBDBID: result.BreweryBDBID,
                BreweryDescription: result.BreweryDescription,
                Established: result.Established,
                Image: result.Image,
                Website: result.Website
            });
        }
        return brewery;
    }

    private mapOrder(result: any): Order {
        let order: Order = {
            OrderId: result.OrderId,
            Title: result.Title,
            Description: result.Description,
            VotesPerUser: result.VotesPerUser,
            PlacedDate: result.PlacedDate,
            ReceivedDate: result.ReceivedDate,
            Status: result.Status
        };
        return order;
    }

    private mapOrderVote(result: any): OrderVote {
        let orderVote: OrderVote = {
            OrderVoteId: result.OrderVoteId,
            OrderBeerId: result.OrderBeerId,
            UserId: result.UserId,
            Vote: result.Vote
        };

        return orderVote;
    }

    private mapOrderBeer(result: any): OrderBeer {
        let orderBeer: OrderBeer = {
            OrderBeerId: result.OrderBeerId,
            Size: result.Size,
            Beer: this.mapBeer(result, false),
            NetVote: 0
        };

        return orderBeer;
    }

    registerUser(username: string, salt: string, passHash: string): Observable<number> {
        let q = 'Insert into `users` (`Email`, `Salt`, `PasswordHash`) VALUES (?, ?, ?);';
        let params = [username, salt, passHash];
        return this.query(q, params)
        .map(
            result => result.insertId,
            err => this.logErrorAndThrow(err, 'Could not register new user')
        );
    }

    getPasswordInfo(username: string): Observable<any> {
        let q = 'Select * from `users` where `Email` = ? And `Active`=1 Limit 1;';
        let params = [username];
        return this.query(q, params)
        .map(
            results => {
                if (results.length < 1) {
                    console.log(`User ${username} could not be found`);
                    return Observable.throw('Error logging in');
                }
                return results[0];
            }, err => this.logErrorAndThrow(err, 'Could not look up user ' + username)
        );
    }

    generateSession(session: string, userId: number): Observable<string> {
        let q = 'Insert into `sessions` (`SessionId`, `UserId`) VALUES(?,?);';
        let params = [session, userId];
        return this.query(q, params).map(_ => session);
    }

    getUserInfoBySession(session: string): Observable<any> {
        let q = 'Select `users`.* from `sessions`'
        + ' join `users` on `users`.`UserId` = `sessions`.`UserId`'
        + ' where `SessionId` = ? AND `sessions`.`Active`=1 AND `users`.`Active`=1'
        + ' Limit 1;';
        let params = [session];
        return this.query(q, params)
        .map(
            results => {
                if (!results || results.length < 1) {
                    return Observable.throw('No found users');
                }
                return results[0];
            },
            err => this.logErrorAndThrow(err, 'Error getting user by session')
        );
    }

    invalidateSession(session: string): Observable<any> {
        let q = 'Update `sessions` Set `Active`=0 Where `SessionId` = ?;';
        let params = [session];
        return this.query(q, params);
    }

    searchForBeer(searchTerm: string): Observable<Beer[]> {
        let q = 'Select * from `beers`'
        + ' join `styles` on `styles`.`StyleId` = `beers`.`StyleId`'
        + ' join `breweries` on `breweries`.`BreweryId` = `beers`.`BreweryId`'
        + ' where `beerName` LIKE ? OR `breweryName` LIKE ? LIMIT 100';

        return this.query(q, [`%${searchTerm}%`, `%${searchTerm}%`])
        .map(results => results.map(beer => this.mapBeer(beer)));
    }

    saveBeer(beer: Beer): Observable<number> {
        let q = 'Insert into `beers` SET ? ON DUPLICATE KEY Update `BeerId`=LAST_INSERT_ID(`BeerId`);';
        let params = {...beer, StyleId: beer.Style.StyleId, BreweryId: beer.Brewery.BreweryId};
        delete params.Style;
        delete params.Brewery;
        return this.query(q, params)
        .map(
            results => results.insertId,
            err => this.logErrorAndThrow(err, 'Error saving beer to database')
        );
    }

    saveBeers(beers: Beer[]): Observable<Beer[]> {
        let insert_args = beers.map(b => {
            return [b.BeerName, b.BeerDescription, b.Style.StyleId, b.Brewery.BreweryId, b.ABV, b.IBU, b.LabelUrl, b.BeerBDBID];
        });
        let q = 'INSERT INTO `beers` ' +
        '(`BeerName`, `BeerDescription`, `StyleId`, `BreweryId`, `ABV`, `IBU`, `LabelUrl`, `BeerBDBID`) ' +
        'VALUES ' + escape(insert_args) + 'ON DUPLICATE KEY UPDATE `BeerName`=`BeerName`';
        return this.query(q)
        .flatMap(
            _ => {
                let map_q = 'Select * from `beers` ' +
                'join `breweries` on `beers`.`BreweryId`=`breweries`.`BreweryId` ' +
                'join  `styles` on `beers`.`StyleId`=`styles`.`StyleId` ' +
                'where `beers`.`BeerBDBID` in (' + escape(beers.map(b => b.BeerBDBID)) + ');';
                return this.query(map_q)
                .map(results => {
                    return results.map(r => this.mapBeer(r));
                });
            }
        );
    }

    saveBeerLabelImage(beerId: number, scale: number, xOffset: number, yOffset: number): Observable<any> {
        let q = 'Update `beers` set `LabelScalingFactor`=?, `LabelOffsetX`=?, `LabelOffsetY`=? Where `BeerId`=?;';
        return this.query(q, [scale, xOffset, yOffset, beerId]);
    }

    saveStyle(style: Style): Observable<number> {
        let q = 'Insert into `styles` SET ? ON DUPLICATE KEY Update `StyleId`=LAST_INSERT_ID(`StyleId`);';
        return this.query(q, style)
        .map(
            results => results.insertId,
            err => this.logErrorAndThrow(err, 'Error saving style to database')
        );
    }

    saveStyles(styles: Style[]): Observable<{[BDBID: string]: Style}> {
        let insert_args = styles.map(s => {
            return [s.StyleName, s.StyleDescription, s.SRMMin, s.SRMMax, s.IBUMin, s.IBUMax, s.ABVMin, s.ABVMax, s.StyleBDBID];
        });
        let q = 'INSERT INTO `styles` ' +
        '(`StyleName`, `StyleDescription`, `SRMMin`, `SRMMax`, `IBUMin`, `IBUMax`, `ABVMin`, `ABVMax`, `StyleBDBID`) ' +
        'VALUES ' + escape(insert_args) + ' ON DUPLICATE KEY UPDATE `StyleName`=`StyleName`;';
        return this.query(q).flatMap(
            _ => {
                let map_q = 'Select * from `styles` where `StyleBDBID` in (' + escape(styles.map(s => s.StyleBDBID + '')) + ');';
                return this.query(map_q)
                .map(results => {
                    let styleMap = {};
                    results.forEach(r => {
                        let clean_style = this.mapStyle(r);
                        styleMap[clean_style.StyleBDBID + ''] = clean_style;
                    });
                    return styleMap;
                });
            }
        );
    }

    saveBrewery(brewery: Brewery): Observable<number> {
        let q = 'Insert into `breweries` SET ? ON DUPLICATE KEY Update `BreweryId`=LAST_INSERT_ID(`BreweryId`);';
        return this.query(q, brewery)
        .map(
            results => results.insertId,
            err => this.logErrorAndThrow(err, 'Error saving brewery to database')
        );
    }

    saveBreweries(breweries: Brewery[]): Observable<{[BDBID: string]: Brewery}> {
        let insert_args = breweries.map(b => {
            return [b.BreweryName, b.BreweryDescription, b.Image, b.Established, b.Website, b.BreweryBDBID];
        });
        let q = 'INSERT INTO `breweries` ' +
        '(`BreweryName`, `BreweryDescription`, `Image`, `Established`, `Website`, `BreweryBDBID`) ' +
        'VALUES ' + escape(insert_args) + ' ON DUPLICATE KEY UPDATE `BreweryName` = `BreweryName`;';
        return this.query(q).flatMap(
            _ => {
                let map_q = 'Select * from `breweries` where `BreweryBDBID` in (' + escape(breweries.map(b => b.BreweryBDBID)) + ');';
                return this.query(map_q)
                .map(results => {
                    let breweryMap = {};
                    results.forEach(r => {
                        let clean_brewery = this.mapBrewery(r);
                        breweryMap[clean_brewery.BreweryBDBID] = clean_brewery;
                    });
                    return breweryMap;
                });
            }
        );
    }

    getStyles(): Observable<Style[]> {
        let q = 'Select * from `styles`;';
        return this.query(q)
        .map(
            results => results,
            err => this.logErrorAndThrow(err, 'Error retrieving styles')
        );
    }

    getStyle(styleId: number): Observable<Style> {
        let q = 'Select * from `styles` WHERE `StyleId` = ? LIMIT 1;';
        return this.query(q, [styleId])
        .map(
            results => {
                if (!results || results.length < 1) {
                    return Observable.throw('Could not find style');
                }
                return results[0];
            },
            err => this.logErrorAndThrow(err, 'Error retrieving style')
        );
    }

    getBreweries(): Observable<Brewery[]> {
        let q = 'Select * from `breweries`;';
        return this.query(q)
        .map(
            results => results,
            err => this.logErrorAndThrow(err, 'Error retrieving breweries')
        );
    }

    getBrewery(breweryId: number): Observable<Brewery> {
        let q = 'Select * from `breweries` WHERE `BreweryId` = ? LIMIT 1;';
        return this.query(q, [breweryId])
        .map(
            results => {
                if (!results || results.length < 1) {
                    return Observable.throw('Could not find brewery');
                }
                return results[0];
            },
            err => this.logErrorAndThrow(err, 'Error retrieving brewery')
        );
    }

    getBeers(): Observable<Beer[]> {
        let q = 'Select * from `beers`'
        + ' join `styles` on `styles`.`StyleId` = `beers`.`StyleId`'
        + ' join `breweries` on `breweries`.`BreweryId` = `beers`.`BreweryId`';
        return this.query(q)
        .map(
            results => results.map(b => this.mapBeer(b)),
            error => {
                console.error(error);
                return Observable.throw('Error retrieving beers');
            }
        );
    }

    getBeer(beerId: number): Observable<Beer> {
        let q = 'Select * from `beers`'
        + ' join `styles` on `styles`.`StyleId` = `beers`.`StyleId`'
        + ' join `breweries` on `breweries`.`BreweryId` = `beers`.`BreweryId`'
        + ' WHERE `BeerId` = ? Limit 1;';
        return this.query(q, [beerId])
        .map(
            results => {
                if (!results || results.length < 1) {
                    return Observable.throw('Could not find beer');
                }
                return this.mapBeer(results[0]);
            },
            err => this.logErrorAndThrow(err, 'Error retrieving beer')
        );
    }

    getLocations(): Observable<Location[]> {
        let q = 'Select * from `off_tap_locations`;';
        return this.query(q)
        .map(
            results => results,
            err => this.logErrorAndThrow(err, 'Error getting locations')
        );
    }

    getLocation(locationId: number): Observable<Location> {
        let q = 'Select * from `off_tap_locations` WHERE `LocationId` = ? Limit 1;';
        return this.query(q, [locationId])
        .map(
            results => {
                if (!results || results.length < 1) {
                    return Observable.throw('Could not find location');
                }
                return results[0];
            },
            err => this.logErrorAndThrow(err, 'Error getting location')
        );
    }

    addLocation(name: string, description?: string): Observable<number> {
        let q = 'Insert into `off_tap_locations` (`Name`, `Description`) VALUES (?,?);';
        return this.query(q, [name, description])
        .map(
            result => result.insertId,
            err => this.logErrorAndThrow(err, 'Error adding location')
        );
    }

    editLocation(locationId: number, name: string, description?: string): Observable<boolean> {
        let q = 'Update `off_tap_locations` SET `Name`=?, `Description`=? WHERE `LocationId`=?;';
        return this.query(q, [name, description, locationId])
        .map(
            result => !!result,
            err => this.logErrorAndThrow(err, 'Could not update location')
        );
    }

    deleteLocation(locationId: number): Observable<boolean> {
        let q = 'Delete from `off_tap_locations` where `LocationId`=?;';
        return this.query(q, [locationId])
        .map(
            result => !!result,
            err => this.logErrorAndThrow(err, 'Could not delete location')
        );
    }

    getTaps(): Observable<Tap[]> {
        let q = 'Select * from `taps`;';
        return this.query(q)
        .map(
            results => results,
            err => this.logErrorAndThrow(err, 'Error getting taps')
        );
    }

    getTap(tapId: number): Observable<Tap> {
        let q = 'Select * from `taps` WHERE `TapId` = ? Limit 1;';
        return this.query(q, [tapId])
        .map(
            results => {
                if (!results || results.length < 1) {
                    return Observable.throw('Could not find tap');
                }
                return results[0];
            },
            err => this.logErrorAndThrow(err, 'Error getting tap')
        );
    }

    addTap(name: string, description?: string, status?: string): Observable<number> {
        let q = 'Insert into `taps` (`TapName`, `Description`, `Status`) VALUES (?,?,?);';
        return this.query(q, [name, description, status])
        .map(
            result => result.insertId,
            err => this.logErrorAndThrow(err, 'Error adding tap')
        );
    }

    editTap(tapId: number, name: string, description?: string, status?: string): Observable<boolean> {
        let q = 'Update `taps` SET `TapName`=?, `Description`=?, `Status`=? WHERE `TapId`=?;';
        return this.query(q, [name, description, status, tapId])
        .map(
            result => !!result,
            err => this.logErrorAndThrow(err, 'Could not update tap')
        );
    }

    deleteTap(tapId: number): Observable<boolean> {
        let q = 'Delete from `taps` where `TapId`=?;';
        return this.query(q, [tapId])
        .map(
            result => !!result,
            err => this.logErrorAndThrow(err, 'Could not delete tap')
        );
    }

    getKegLocation(kegId: number): Observable<number> {
        let q = 'Select `keg_locations`.`LocationId`'
        + ' from `kegs`'
        + ' join `keg_locations` on `kegs`.`KegId`=`keg_locations`.`KegId`'
        + ' where `kegs`.`KegId`= ?;';
        return this.query(q, [kegId])
        .map(results => {
            if (results.length < 1) {
                return -1;
            }
            return results[0].LocationId;
        }, err => console.error(err));
    }

    getKegTap(kegId: number): Observable<number> {
        let q = 'Select `beer_sessions`.`TapId`'
        + ' from `kegs`'
        + ' join `beer_sessions` on `kegs`.`KegId`=`beer_sessions`.`KegId`'
        + ' where `kegs`.`KegId` = ?;';
        return this.query(q, [kegId])
        .map(results => {
            if (results.length < 1) {
                return -1;
            }
            return results[0].TapId;
        }, err => console.error(err));
    }

    findKeg(kegId: number): Observable<string> {
        return this.getKegTap(kegId)
        .flatMap(
            tapId => {
                if (tapId > 0) {
                    return Observable.of('tap_' + tapId);
                } else {
                    return this.getKegLocation(kegId)
                    .map(
                        locId => {
                            if (locId > 0) {
                                return 'loc_' + locId;
                            } else {
                                console.log('Could not find keg');
                            }
                        }
                    );
                }
            }
        );
    }

    assignBeerToLocation(beerId: number, locationId: number, size: KegSize): Observable<boolean> {
        let q = 'Insert into `kegs` (`BeerId`, `Size`) VALUES(?, ?);';
        return this.query(q, [beerId, size])
        .flatMap(
            result => {
                let q2 = 'Insert into `keg_locations` (`LocationId`, `KegId`) VALUES (?, ?);';
                return this.query(q2, [locationId, result.insertId])
                .map(results => !!results);
            }
        );
    }

    moveKegLocation(kegId: number, newLocationId: number): Observable<boolean> {
        let q = 'Update `keg_locations` SET `LocationId` = ?, Active = 1 WHERE `KegId` = ?;';
        return this.query(q, [newLocationId, kegId])
        .map(results => !!results);
    }

    tapBeer(beerId: number, tapId: number, size: KegSize): Observable<number> {
        let q = 'Insert into `kegs` (`BeerId`, `Size`) VALUES(?, ?);';
        return this.query(q, [beerId, size])
        .flatMap(
            result => this.tapKeg(result.insertId, tapId)
        )
        .map(
            _ => _,
            err => this.logErrorAndThrow(err, 'Could not tap beer')
        );
    }

    tapKeg(kegId: number, tapId: number): Observable<number> {
        return Observable.create(observer => {
            this.pool.getConnection((err, conn) => {
                if (err) {
                    console.error(err);
                    return observer.error('Could not establish connection to the database');
                }
                conn.beginTransaction(trans_err => {
                    if (trans_err) {
                        conn.release();
                        console.error(trans_err);
                        return observer.error('Failed to tap keg!');
                    }
                    let update_q = 'Update `beer_sessions` SET `Active`=0, `RemovalTime`=CURRENT_TIMESTAMP WHERE `TapId`=?;';
                    conn.query(update_q, [tapId], (error, result) => {
                        if (error) {
                            conn.release();
                            console.error(error);
                            return observer.error('Could not change active beer on tap');
                        }
                        let insert_q = 'Insert into `beer_sessions` (`TapId`, `KegId`) VALUES (?, ?);';
                        conn.query(insert_q, [tapId, kegId], (insert_err, insert_result) => {
                            if (insert_err) {
                                conn.release();
                                console.error(insert_err);
                                return observer.error('Could not change active beer on tap');
                            }
                            let location_update_q = 'Update `keg_locations` SET `Active`=0 WHERE `KegId` = ?;';
                            conn.query(location_update_q, [kegId], (location_update_err, location_update_result) => {
                                if (location_update_err) {
                                    conn.release();
                                    console.error(location_update_err);
                                    return observer.error('Could not change active beer on tap');
                                }
                                conn.commit(commit_err => {
                                    if (commit_err) {
                                        return conn.rollback(() => {
                                            conn.release();
                                            console.error(commit_err);
                                            return observer.error('Could not change active beer on tap');
                                        });
                                    }
                                    conn.release();
                                    observer.next(insert_result.insertId);
                                    return observer.complete();
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    emptyTap(tapId: number): Observable<boolean> {
        let q = 'Update `beer_sessions` SET `Active`=0 WHERE `TapId`=?;';
        return this.query(q, [tapId])
        .map(
            result => !!result,
            err => this.logErrorAndThrow(err, 'Could not untap keg!')
        );
    }

    deactivateKeg(kegId: number): Observable<boolean> {
        let q1 = 'Update `beer_sessions` SET `Active`=0 WHERE `KegId`=?';
        let q2 = 'Update `keg_locations` SET `Active`=0 WHERE `KegId`=?';

        return Observable.forkJoin([this.query(q1, [kegId]), this.query(q2, [kegId])])
        .map(results => results[0] || results[1]);
    }

    getLocationContents(locationId: number): Observable<Keg[]> {
        let q = 'Select * from `keg_locations` ' +
            'join `kegs` on `keg_locations`.`KegId`=`kegs`.`KegId` ' +
            'join `beers` on `beers`.`BeerId`=`kegs`.`BeerId` ' +
            'join `breweries` on `beers`.`BreweryId`=`breweries`.`BreweryId` ' +
            'join `styles` on `beers`.`StyleId`=`styles`.`StyleId` ' +
            'where `keg_locations`.`Active`=1 AND `LocationId`=?;';
        return this.query(q, [locationId])
        .map(
            results => results.map(keg => this.mapKeg(keg)),
            err => this.logErrorAndThrow(err, 'Could not get contents of location')
        );
    }

    voteForTap(tapId: number, userId: number, vote: string): Observable<any> {
        let q = 'Select `SessionId` from `beer_sessions` Where `TapId`=? and `Active`=1 LIMIT 1;';
        return this.query(q, [tapId]).flatMap(
            results => {
                if (!results || results.length < 1) {
                    return Observable.throw('Could not vote for tap');
                }
                let sessionId = results[0].SessionId;
                return this.voteForSession(sessionId, userId, vote);
            }
        );
    }

    voteForSession(sessionId: number, userId: number, vote: string): Observable<any> {
        let getVoteExists = 'SELECT bsv.`VoteId` FROM `beer_session_votes` bsv'
            + ' JOIN `votes` v ON bsv.`VoteId` = v.`VoteId`'
            + ' WHERE bsv.`BeerSessionId` = ? AND v.`UserId` = ?;';

        let voteInsert = 'INSERT INTO `votes` (`Vote`, `UserId`)'
        + ' VALUES (?, ?);';

        let sessionVoteInsert = 'INSERT INTO `beer_session_votes` (`BeerSessionId`, `VoteId`)'
        + ' VALUES (?, ?);';

        let voteUpdate = 'UPDATE `votes` SET `vote` = ? WHERE `VoteId` = ?;';

        let existingVoteId: number;

        return this.query(getVoteExists, [sessionId, userId])
            .do(result => existingVoteId = result[0] ? result[0].VoteId : null)
            .map(result => result.length ? voteUpdate : voteInsert)
            .flatMap(query => this.query(query, [vote.toLowerCase(), existingVoteId || userId]))
            .flatMap(result => result.insertId
                ? this.query(sessionVoteInsert, [sessionId, result.insertId])
                : Observable.of(result));
    }

    voteForOrderBeer(orderBeerId: number, userId: number, vote: string): Observable<any> {
        let getVoteExists = 'SELECT pv.`VoteId` FROM `order_votes` pv'
            + ' JOIN `votes` v ON pv.`VoteId` = v.`VoteId`'
            + ' WHERE pv.`OrderBeerId` = ? AND v.`UserId` = ?;';

        let voteInsert = 'INSERT INTO `votes` (`Vote`, `UserId`)'
        + ' VALUES (?, ?);';

        let sessionVoteInsert = 'INSERT INTO `order_votes` (`OrderBeerId`, `VoteId`)'
        + ' VALUES (?, ?);';

        let voteUpdate = 'UPDATE `votes` SET `Vote` = ? WHERE `VoteId` = ?;';

        let existingVoteId: number;

        return this.query(getVoteExists, [orderBeerId, userId])
            .do(result => existingVoteId = result[0] ? result[0].VoteId : null)
            .map(result => result.length ? voteUpdate : voteInsert)
            .flatMap(query => this.query(query, [vote.toLowerCase(), existingVoteId || userId]))
            .flatMap(result => result.insertId
                ? this.query(sessionVoteInsert, [orderBeerId, result.insertId])
                : Observable.of(result));
    }

    getSessionVotes(sessionId: number): Observable<any[]> {
        let q = 'SELECT v.`UserId`, (`Vote`-2) as Vote FROM `beer_session_votes` bsv'
            + ' JOIN `votes` v ON bsv.`VoteId` = v.`VoteId`'
            + ' WHERE bsv.`BeerSessionId` = ?;';

        return this.query(q, [sessionId])
        .map(
            results => results,
            err => this.logErrorAndThrow(err, 'Could not retrieve votes for beer session')
        );
    }

    getTapContents(tapId: number, userId?: number): Observable<BeerSession> {
        let q = 'Select * from `beer_sessions` ' +
            'join `kegs` on `beer_sessions`.`KegId`=`kegs`.`KegId` ' +
            'join `beers` on `kegs`.`BeerId`=`beers`.`BeerId` ' +
            'join `breweries` on `beers`.`BreweryId`=`breweries`.`BreweryId` ' +
            'join `styles` on `beers`.`StyleId`=`styles`.`StyleId` ' +
            'where `beer_sessions`.`Active`=1 AND `TapId`=? Limit 1;';
        return this.query(q, [tapId])
        .flatMap(
            results => {
                if (!results || results.length < 1) {
                    return Observable.of(null);
                }
                let contents = results[0];
                return this.getSessionVotes(contents.SessionId)
                .map(
                    votes => {
                        let netVote = votes.reduce((previous, current) => {
                            if (current && current.Vote) {
                                return previous + current.Vote;
                            } else {
                                return previous;
                            }
                        }, 0);
                        let userVote = 0;
                        if (userId) {
                            let userVotes = votes.find(v => v.UserId === userId);
                            userVote = userVotes ? userVotes.Vote : 0;
                        }
                        contents.NetVote = netVote;
                        contents.UserVote = userVote;
                        return this.mapBeerSession(contents);
                    }
                );
            })
        .map(
            _ => _,
            err => this.logErrorAndThrow(err, 'Could not get contents of location')
        );
    }

    adjustKegVolume(kegId: number, volume: number, pourtime?: string): Observable<any> {
        let q = 'Update `kegs` set `RemovedVolume` = `RemovedVolume`+? Where `KegId`=?;';
        return this.query(q, [volume, kegId])
        .flatMap(_ => {
            let pourQ = 'Insert into `pours` (`KegId`, `Volume`, `Timestamp`) VALUES (?, ?, ?);';
            return this.query(pourQ, [kegId, volume, pourtime]);
        });
    }

    adjustTapVolume(tapId: number, volume: number, pourtime?: string): Observable<any> {
        let q = 'Select `KegId` from `beer_sessions` Where `TapId`=? And `Active`=1 LIMIT 1;';
        return this.query(q, [tapId])
        .flatMap(
            results => {
                if (!results || results.length < 1) {
                    return Observable.throw('Could not get Keg Id from tap');
                }
                return this.adjustKegVolume(results[0].KegId, volume, pourtime);
            }
        );
    }

    getPours(fromDate: string, toDate: string): Observable<any[]> {
        let q = 'Select `PourId`, `Volume`, `Timestamp`, `TapId`, `beer_sessions`.`KegId` from `pours`' +
            ' join `beer_sessions` on `beer_sessions`.`KegId`=`pours`.`KegId`' +
            ' where `pours`.`Timestamp` > ? AND `pours`.`Timestamp` <= ? ' +
            ' order by `pours`.`Timestamp` asc;';
        return this.query(q, [fromDate, toDate]);
    }

    getKegSessionHistory(fromDate: string, toDate: string): Observable<BeerSession[]> {
        let q = 'Select * from `beer_sessions` ' +
            'join `kegs` on `beer_sessions`.`KegId`=`kegs`.`KegId` ' +
            'join `beers` on `kegs`.`BeerId`=`beers`.`BeerId` ' +
            'join `breweries` on `beers`.`BreweryId`=`breweries`.`BreweryId` ' +
            'join `styles` on `beers`.`StyleId`=`styles`.`StyleId` ' +
            'where `beer_sessions`.`TappedTime` < ? AND (`beer_sessions`.`RemovalTime` > ? OR `beer_sessions`.`Active` = 1) ' +
            'order by `beer_sessions`.`TappedTime` desc;';

        return this.query(q, [toDate, fromDate])
            .map(
                results => {
                    if (!results || results.length < 1) {
                        return null;
                    }

                    return results.map(contents => this.mapBeerSession(contents));
            })
            .map(
                _ => _,
                err => this.logErrorAndThrow(err, 'Could not get contents of location')
            );
    }

    getOrders(isAdmin: boolean, fromDate: string, toDate: string): Observable<Order[]> {
        let args = [];

        let q = 'SELECT * from `orders`'
            + ' WHERE `Status` != \'cancelled\''
            + (isAdmin ? '' : ' AND `Status` != \'incomplete\'');

        if (fromDate) {
            q += ' AND (`Timestamp` > ? OR `PlacedDate` > ?)';
            args = args.concat([fromDate, fromDate]);
        }
        if (toDate) {
            q += ' AND `Timestamp` <= ?';
            args.push(toDate);
        }

        q += ' ORDER BY Timestamp desc';

        return this.query(q, args)
            .map(results => results || [])
            .map(results => results.map(order => this.mapOrder(order)));
    }

    getOrder(userId: number, orderId: number): Observable<Order> {
        let q = 'SELECT p.OrderId, p.Title, p.Description, p.VotesPerUser, p.Status, p.PlacedDate,'
            + ' p.ReceivedDate, pb.OrderBeerId, pb.BeerId, pb.Size, b.BeerName,'
            + ' b.BeerDescription, b.StyleId, b.BreweryId, br.BreweryName, br.BreweryDescription, s.StyleName, s.StyleDescription,'
            + ' pv.OrderVoteId, pv.VoteId, v.UserId, (`Vote`-2) as Vote from `orders` p'
            + ' LEFT JOIN order_beers pb ON p.orderid = pb.orderid'
            + ' LEFT JOIN beers b on pb.BeerId = b.BeerId'
            + ' LEFT JOIN breweries br on b.BreweryId = br.BreweryId'
            + ' LEFT JOIN styles s on b.StyleId = s.StyleId'
            + ' LEFT JOIN `order_votes` pv on pb.OrderBeerId = pv.OrderBeerId'
            + ' LEFT JOIN `votes` v on pv.`VoteId` = v.`VoteId`'
            + ' WHERE p.`orderid` = ? AND (pb.`Removed` IS NULL OR pb.`Removed`= 0)'
            + ' ORDER BY b.BeerName;';

        return this.query(q, [orderId])
            .map(result => result.reduce((order, voteRow) => {
                if (!order) {
                    // init order on first iteration
                    order = this.mapOrder(voteRow);
                    order.OrderBeers = [];
                    order.UserVotes = [];
                }
                if (!voteRow.OrderBeerId) {
                    return order;
                }

                let orderBeer = order.OrderBeers.find(b => b.OrderBeerId === voteRow.OrderBeerId);

                if (!orderBeer) {
                    // init orderBeer if first encounter (there can be many votes per order beer)
                    orderBeer = this.mapOrderBeer(voteRow);
                    order.OrderBeers.push(orderBeer);
                }

                if (voteRow.Vote) {
                    orderBeer.NetVote += voteRow.Vote;
                    if (voteRow.UserId === userId) {
                        order.UserVotes.push(this.mapOrderVote(voteRow));
                    }
                }
               return order;
            }, null));
    }

    addOrder(title: string, description: string, votesPerUser: number): Observable<number> {
        let q = 'INSERT INTO `orders` (`title`, `description`, `votesperuser`)'
        + ' VALUES (?, ?, ?);';

        return this.query(q, [title, description, votesPerUser])
            .map(result => result.insertId,
                err => this.logErrorAndThrow(err, 'an error occurred adding order'));
    }

    addBeerToOrder(beerId: number, orderId: number, size: KegSize): Observable<number> {
        let q = 'INSERT INTO `order_beers` (`orderid`, `beerid`, `size`)'
        + ' VALUES (?, ?, ?)'
        + ' ON DUPLICATE KEY UPDATE `size`=VALUES(`size`);';

        return this.query(q, [beerId, orderId, size])
            .map(result => result.insertId,
                err => this.logErrorAndThrow(err, 'an error occurred adding beer to order'));
    }

    removeBeerFromOrder(orderId: number, orderBeerId: number): Observable<any> {
        let q = 'UPDATE `order_beers` SET `Removed` = 1 WHERE `orderid` = ? AND `orderbeerid` = ?;';

        return this.query(q, [orderId, orderBeerId])
            .map(result => result,
                err => this.logErrorAndThrow(err, 'an error occurred removing beer from order'));
    }

    updateOrder(orderId: number, partialOrder: any): Observable<any> {
        let keys = Object.keys(partialOrder);

        if (!keys.length) {
            return Observable.of(null);
        }

        let q = 'UPDATE `orders` SET';
        let args = [];

        keys.forEach(key => {
             q += ` ${key} = ?,`;
            args.push(partialOrder[key]);
        });

        q = q.slice(0, -1);

        q += ' WHERE `orderid` = ?;';
        args.push(orderId);

        return this.query(q, args)
            .map(result => result,
                err => this.logErrorAndThrow(err, 'an error occurred updating order'));
    }

    userCanVoteForOrder(userId: number, orderId: number): Observable<boolean> {
        return this.getOrder(userId, orderId)
            .map(order => order.Status === OrderStatus.Pending
                && order.UserVotes.filter(v => v.Vote !== Vote.None).length <= order.VotesPerUser);
    }

    private logErrorAndThrow(err: string, messageToThrow?: string): ErrorObservable<string> {
        console.error(err);
        return Observable.throw(messageToThrow || err);
    }
}
