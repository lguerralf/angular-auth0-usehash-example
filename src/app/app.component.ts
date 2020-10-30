import { AuthService } from './auth.service';
import { Component } from '@angular/core';
import { LfxHeaderService } from './lfx-header.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'spa-angular';

  constructor(
    private lfxheader: LfxHeaderService,
    private auth: AuthService,
  ) { }

  requesttoken() {
    this.auth.getTokenSilently$().subscribe((data) => {
      console.log('data ? ', { data });
    });
  }

  checkSession() {
    this.auth.checkSession().subscribe((data) => {
      console.log('checkSession > data ', { data });
    })
  }
  getUser() {
    this.auth.getUser$().subscribe((data) => {
      console.log('getUser > data ', { data });
    })
  }
}
