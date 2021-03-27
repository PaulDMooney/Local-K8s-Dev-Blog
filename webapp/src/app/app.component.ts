import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'webapp';
  count = '';
  constructor(private httpClient: HttpClient, @Inject(PLATFORM_ID) private platformId:any) {

  }
  ngOnInit(): void {

    const host = isPlatformBrowser(this.platformId) ? '' : process.env.API_SERVER;

    this.httpClient.get<string>(`${host}/request-count`)
      .subscribe((data: string) => { this.count = data });

  }

  
}
