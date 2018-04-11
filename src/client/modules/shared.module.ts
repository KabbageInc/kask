import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import { NgModule } from '@angular/core';
import { HttpModule } from '@angular/http';
import {RouterModule} from '@angular/router';
import {ParallaxScrollDirective} from '../directives';
import {ChalkboardBottomComponent} from '../components/app/chalkboard_bottom/component';
import {KegProgressComponent} from '../components/shared/keg_progress_bar/component';
import {KegAddComponent} from '../components/shared/keg_add/component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { KegMoveComponent } from '../components/shared/keg_move/component';
import { DateRangeComponent } from '../components/shared/date_range/component';
import { NgbDateHelper } from '../helpers/ngb_date';
import { TypeaheadComponent } from '../components/shared/typeahead/component';
import { TypeaheadListComponent } from '../components/shared/typeahead/list/component';

@NgModule({
    imports: [
        HttpModule,
        FormsModule,
        CommonModule,
        RouterModule,
        NgbModule.forRoot(),
    ],
    declarations: [
        ParallaxScrollDirective,
        ChalkboardBottomComponent,
        KegProgressComponent,
        KegAddComponent,
        KegMoveComponent,
        DateRangeComponent,
        TypeaheadComponent,
        TypeaheadListComponent
    ],
    exports: [
        HttpModule,
        FormsModule,
        CommonModule,
        RouterModule,
        ParallaxScrollDirective,
        ChalkboardBottomComponent,
        KegProgressComponent,
        KegAddComponent,
        KegMoveComponent,
        DateRangeComponent,
        TypeaheadComponent,
        TypeaheadListComponent
    ]
})
export class SharedModule { }
