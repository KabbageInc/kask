import { Beer } from '../../../models';
import { AdminService } from '../../../services/admin.service';
import { Component, EventEmitter, Output } from '@angular/core';
import { Observable } from 'rxjs/Rx';
import { TypeaheadProvider } from '../typeahead/typeahead_provider';

@Component({
    selector: 'keg-add',
    templateUrl: './template.html',
    styleUrls: ['./styles.scss']
})
export class KegAddComponent {
    private subscriptions = [];

    beerToLoad: Beer;
    kegSizeToLoad: string;
    beerSuggestions: TypeaheadProvider<Beer>;

    @Output() kegSubmitted = new EventEmitter();
    @Output() cancelled = new EventEmitter();

    constructor(
        private _adminService: AdminService
    ) { }

    ngOnInit() {
        this.beerSuggestions = {
            getSuggestions: text => this._adminService.search(text).map(result => result.beers),
            getLabel: beer => `${beer.Brewery.BreweryName}: ${beer.BeerName}`
        };
    }

    ngOnDestroy() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
    }

    submitNewKeg() {
        this.kegSubmitted.emit({
            Beer: this.beerToLoad,
            Size: this.kegSizeToLoad
        });
    }

    search = (text: Observable<string>) => {
        return text
            .debounceTime(500)
            .distinctUntilChanged()
            .filter(term => term.length > 4)
            .switchMap(term => this._adminService.search(term))
            .map(result => result.beers);
    };

    beerSelected(selection: any) {
        let beer: Beer = selection;
        this.beerToLoad = beer;
    }

    cancelKegAdd() {
        this.cancelled.emit(true);
    }
}
