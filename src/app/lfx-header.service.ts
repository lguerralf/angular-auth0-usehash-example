/**
 * updated: 2020-10-26
 * v0.0.2
 * 
 */

import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';


function setScript() {
  const script = document.createElement('script');
  script.setAttribute('src','https://cdn.dev.platform.linuxfoundation.org' + '/lfx-header.js');
  // script.setAttribute('src','http://127.0.0.1:8080' + '/lfx-header.js');
  script.setAttribute('async', 'true');
  document.head.appendChild(script);
}

setScript();

@Injectable({
  providedIn: 'root'
})
export class LfxHeaderService {

  constructor(private auth: AuthService) {
    this.setUserInLFxHeader();
    this.setCallBackUrl();
    this.setLogoutUrl();
  }

  setCallBackUrl() {
    console.log('entered setCallBackUrl');
    const lfHeaderEl: any = document.getElementById('lfx-header');
    if (!lfHeaderEl) {
      return;
    }
    console.log('app setCallBackUrl ', this.auth.auth0Options.callbackUrl);
    lfHeaderEl.callbackurl = this.auth.auth0Options.callbackUrl;
  }
  setLogoutUrl() {
    const lfHeaderEl: any = document.getElementById('lfx-header');
    if (!lfHeaderEl) {
      return;
    }
    lfHeaderEl.logouturl = this.auth.auth0Options.logoutUrl;
  }

  setUserInLFxHeader(): void {
    const lfHeaderEl: any = document.getElementById('lfx-header');
    if (!lfHeaderEl) {
      return;
    }

    this.auth.userProfile$.subscribe((data) => {
      if (data) {
        lfHeaderEl.authuser = data;
      }
    });

  }
}
