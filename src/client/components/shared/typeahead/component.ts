import { Component, OnInit, Input, Output, EventEmitter } from "@angular/core";
import { Subject } from "rxjs/Rx";
import { TypeaheadProvider } from "./typeahead_provider";

@Component({
    selector: 'typeahead',
    templateUrl: './template.html',
    styleUrls: ['./styles.scss']
})

export class TypeaheadComponent implements OnInit {
    @Input('provider') typeaheadProvider: TypeaheadProvider<any>;
    @Output('onSuggestionClick') suggestionClick = new EventEmitter<string>();

    private _valueChanges: Subject<string> = new Subject<string>();

    value: string;
    focused = false;
    suggestions: any[] = [];

    constructor() {}
    ngOnInit() {
        this._valueChanges.asObservable()
        .debounceTime(400)
        .map(value => value.trim())
        .do(value => {
            if (value.length <= 5) {
                this.suggestions = [];
            }
        })
        .filter(value => value.length > 5)
        .distinctUntilChanged()
        .flatMap(value => this.typeaheadProvider.getSuggestions(value))
        .subscribe(suggestions => {
            if (this.focused) {
                this.suggestions = suggestions;
            }
        });
    }

    onInput(event: FocusEvent) {
        this._valueChanges.next(this.value);
    }

    emitSuggestion(suggestion: any) {
        this.value = this.typeaheadProvider.getLabel(suggestion);
        this.suggestionClick.emit(suggestion);
    }
}