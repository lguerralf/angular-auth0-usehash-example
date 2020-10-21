/**
 * updated: 2020-10-21
 * v0.0.1
 * 
 */

import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

function log(text, value: any = '') {
  console.log(
    `(lfHeaderservice) ${text} > `,
    value ? JSON.stringify({ value }) : null
  );
}


@Injectable({
  providedIn: 'root'
})
export class LfxHeaderService {

  constructor(private auth: AuthService) {
    log('LfxHeaderService > constructor');
    this.setUserInLFxHeader();
  }

  setUserInLFxHeader(): void {
    const lfHeaderEl: any = document.getElementById('lfx-header');
    if (!lfHeaderEl) {
      log('setUserInLFxHeader >  lfHeaderEl not found');
      return;
    }

    this.auth.userProfile$.subscribe((data) => {
      log('setUserInLFxHeader > this.auth.userProfile$.subscribe > data', { data });
      if (data) {
        lfHeaderEl.authuser = data;
      }
    });

  }
}
