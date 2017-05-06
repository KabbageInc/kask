import {Component, Input, OnInit} from '@angular/core';
import {Keg} from "../../../models/keg.model";
import {Location} from "../../../models/location.model";
import {LocationService} from "../../../services/location.service";
import {Beer} from "../../../models/beer.model";
import {Observable} from "rxjs/Rx";
import {AdminService} from "../../../services/admin.service";
import {Tap} from "../../../models/tap.model";

@Component({
    selector: 'location',
    templateUrl: './template.html',
    styleUrls: ['../../styles.scss', './styles.scss']
})
export class LocationComponent implements OnInit {

    contents: Keg[];
    loaded: boolean;
    editing: boolean;
    isAddingKeg: boolean;
    beerToLoad: Beer;
    kegSizeToLoad: string;

    @Input() info: Location;
    @Input() taps: Tap[];

    constructor(
        private _locationService: LocationService,
        private _adminService: AdminService
    ) { }

    ngOnInit() {
        if (this.info && this.info.LocationId) {
            this._locationService.getLocationContents(this.info.LocationId)
            .subscribe(
                beers => this.contents = beers,
                error => console.log(error),
                () => this.loaded = true
            );
        } else {
            this.editing = true;
            this.loaded = true;
        }
    }

    submitNewKeg() {
        this.loaded = false;
       this._adminService.store(this.beerToLoad.BeerId, this.kegSizeToLoad, this.info.LocationId)
           .subscribe(
               () => this.isAddingKeg = false,
               err => console.error(err),
               () => this.loaded = true
           );
    }

    search = (text$: Observable<string>) => {
        return text$
            .debounceTime(300)
            .distinctUntilChanged()
            .filter(term => term.length > 4)
            .switchMap(term => this._adminService.search(term))
            .map(result => result.beers)
    };

    getBeerName(beer:Beer) {
        return beer.BeerName
    }

    getBeerDisplay(beer:Beer) {
        return `${beer.Brewery.BreweryName}: ${beer.BeerName}`;
    }

    beerSelected(selection: any) {
        let beer: Beer = selection.item;
        this.beerToLoad = beer;
    }

    private addLocation() {
        this.loaded = false;
        this._locationService.addLocation(this.info)
        .subscribe(
            id => {
                this.info.LocationId = id;
            },
            err => console.log(err),
            () => this.loaded = true
        );
    }

    private editLocation() {
        this.loaded = false;
        this._locationService.updateLocation(this.info)
        .subscribe(
            success => {
                this.editing = false;
            },
            err => console.log(err),
            () => this.loaded = true
        );
    }

    private submitLocation() {
        if (this.info.LocationId) {
            this.editLocation();
        } else {
            this.addLocation();
        }
    }
}