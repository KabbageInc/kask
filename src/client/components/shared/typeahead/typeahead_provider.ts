import {Observable} from 'rxjs/Rx';

export interface TypeaheadProvider<T> {
    getSuggestions(text: string): Observable<T[]>;
    getLabel(item: T): string;
}
