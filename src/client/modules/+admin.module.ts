import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {NgModule} from '@angular/core';
import {SharedModule} from './shared.module';
import {AdminComponent} from '../components/admin';
import {LocationComponent} from '../components/admin/location/component';
import {TapEditComponent} from '../components/admin/tap/component';

@NgModule({
    imports: [
        SharedModule,
        FormsModule,
        RouterModule.forChild(
            [
                {path: '', component: AdminComponent},
            ]
        )
    ],
    declarations: [
        AdminComponent,
        LocationComponent,
        TapEditComponent
    ],
    exports: [
        AdminComponent,
        LocationComponent,
        TapEditComponent
    ]
})
export class LazyAdminModule { }
