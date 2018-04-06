import {Observable} from 'rxjs/Rx';
import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChange, SimpleChanges} from '@angular/core';

@Component({
    selector: 'typeahead-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.scss'],
})
export class TypeaheadListComponent implements OnInit, OnChanges {
    @Input() elements: any[];
    @Input() labelSelector: (element: any) => string;
    @Input() focused: boolean;

    @Output() elementClick: EventEmitter<string> = new EventEmitter<string>();

    visible: boolean = false;
    hideUntilChange: boolean = false;

    constructor() {
    }

    highlightedItem: number = -1;

    ngOnInit() {
        document.onkeydown = event => {
            if (!this.focused || !this.elements || !this.elements.length) {
                return;
            }

            switch(event.keyCode) {
                case 38: // up
                    event.preventDefault();
                    this.cycleItem(-1);
                    break;
                case 40: // down
                    event.preventDefault();
                    this.cycleItem(1);
                    break;
                case 13: // enter
                    event.preventDefault();
                    if (this.highlightedItem >= 0) {
                        this.selectElement(this.elements[this.highlightedItem]);
                    }
                    break;
                case 27: // escape
                    this.visible = false;

            }
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        this.highlightedItem = -1;

        if(changes['focused'] && !this.hideUntilChange) {
            this.visible = changes['focused'].currentValue;
        }

        if (changes['elements'] && changes['elements'].currentValue.length) {
            this.visible = true;
            this.hideUntilChange = false;
        }
    }

    selectElement(element: string) {
        if (this.visible) {
            this.elementClick.emit(element);
            this.visible = false;
            this.hideUntilChange = true;
        }
    }

    cycleItem(amount) {
        this.highlightedItem += amount;
        this.highlightedItem = Math.max(-1, Math.min(this.highlightedItem, this.elements.length - 1));
    }
}
