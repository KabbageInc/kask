import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {NgModule} from '@angular/core';
import {SharedModule} from './shared.module';
import {PollsComponent} from '../components/polls';

@NgModule({
    imports: [
        SharedModule,
        FormsModule,
        RouterModule.forChild(
            [
                {path: '', component: PollsComponent},
            ]
        )
    ],
    declarations: [
        PollsComponent,
    ],
    exports: [
        PollsComponent,
    ]
})
export class LazyPollsModule { }