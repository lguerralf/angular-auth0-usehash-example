import { Component, OnInit } from '@angular/core';
import { ApiService } from 'src/app/api.service';

@Component({
  selector: 'app-authCallback',
  templateUrl: './authCallback.componen.html',
})
export class AuthCallbackComponent implements OnInit {
  responseJson: string;

  constructor(private api: ApiService) {}

  ngOnInit() {}

}
