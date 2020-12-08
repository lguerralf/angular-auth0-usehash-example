/**
 *
 * updates
 * 2020-12-03: v0.0.10
 * - use requestId instead of returnTo directly
 *
 * updated: 2020-11-05 v0.0.9
 *
 * v0.0.9 force login if cookie exists
 *
 *
 * v0.0.8 Force login on public pages if cookie exists
 *  - refactor login()
 *  - refactor construct()
 *  - refactor localAuthSetup()
 *  - added initializeApplication()
 *  - added checkUserSessionByCookie()
 *
 * v0.0.7 Last Update:
 *  Using auth0 from CDN instead of npm module
 *  please review index.html
 */

declare let window;

import { Injectable } from '@angular/core';
import {
  from,
  of,
  Observable,
  BehaviorSubject,
  combineLatest,
  throwError,
} from 'rxjs';
import { tap, catchError, concatMap, shareReplay } from 'rxjs/operators';
import { Router } from '@angular/router';
import * as querystring from 'query-string';
import Url from 'url-parse';

function log(text: any, value: any = {}) {
  console.log(`> ${text}`, JSON.stringify(value, null, 2));
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  auth0Options = {
    domain: 'linuxfoundation-dev.auth0.com',
    clientId: 'O8sQ4Jbr3At8buVR3IkrTRlejPZFWenI',
    callbackUrl: window.location.origin,
    logoutUrl: window.location.origin,
    // https://auth0.com/docs/libraries/auth0-single-page-app-sdk#get-access-token-with-no-interaction
    // If you active useRefreshTokens: true , please update lfx-header directly too in index.html
    // *info make sure of using `userefreshtoken="true"` in  <lfx-header> element
    useRefreshTokens: true,
    useRequestId: true,
  };

  currentHref = window.location.href;

  loading$ = new BehaviorSubject<any>(true);
  // Create an observable of Auth0 instance of client
  auth0Client$ = (from(
    window.createAuth0Client({
      domain: this.auth0Options.domain,
      client_id: this.auth0Options.clientId,
      // redirect_uri: this.auth0Options.callbackUrl,
      useRefreshTokens: this.auth0Options.useRefreshTokens,
    })
  ) as Observable<any>).pipe(
    shareReplay(1), // Every subscription receives the same shared value
    catchError((err) => {
      this.loading$.next(false);
      return throwError(err);
    })
  );
  // Define observables for SDK methods that return promises by default
  // For each Auth0 SDK method, first ensure the client instance is ready
  // concatMap: Using the client instance, call SDK method; SDK returns a promise
  // from: Convert that resulting promise into an observable
  isAuthenticated$ = this.auth0Client$.pipe(
    concatMap((client: any) => from(client.isAuthenticated())),
    tap((res: any) => {
      // *info: once isAuthenticated$ responses , SSO sessiong is loaded
      // this.loading$.next(false);
      this.loggedIn = res;
    })
  );
  handleRedirectCallback$ = this.auth0Client$.pipe(
    concatMap((client: any) =>
      from(client.handleRedirectCallback(this.currentHref))
    ),
    catchError(() => {
      window.history.replaceState({}, document.title, '/');
      return of(true);
    })
  );
  // Create subject and public observable of user profile data
  private userProfileSubject$ = new BehaviorSubject<any>(null);
  userProfile$ = this.userProfileSubject$.asObservable();
  // Create a local property for login status
  loggedIn = false;

  constructor(private router: Router) {
    this.initializeApplication();
  }

  async initializeApplication() {
    // On initial load, check authentication state with authorization server
    // Set up local auth streams if user is already authenticated
    const params = this.currentHref;
    if (params.includes('code=') && params.includes('state=')) {
      this.handleAuthCallback();
      return;
    }

    await this.localAuthSetup();
    this.handlerReturnToAferlogout();
  }

  handlerReturnToAferlogout() {
    const { query } = querystring.parseUrl(this.currentHref) || {};
    const { returnTo, requestId } = query || {};

    const requestIdURL = this.getURLFromRequestId(requestId as string);
    if (requestIdURL) {
      this.router.navigateByUrl(requestIdURL);
      return;
    }

    if (returnTo) {
      const target = this.getTargetRouteFromReturnTo(returnTo);
      this.router.navigateByUrl(target);
    }
  }

  // When calling, options can be passed if desired
  // https://auth0.github.io/auth0-spa-js/classes/auth0client.html#getuser
  getUser$(options?): Observable<any> {
    return this.auth0Client$.pipe(
      concatMap((client: any) => from(client.getUser(options))),
      tap((user) => {
        this.userProfileSubject$.next(user);
      })
    );
  }

  checkSession() {
    return this.auth0Client$.pipe(
      concatMap((client) => from(client.checkSession()))
    );
  }

  private async localAuthSetup() {
    // This should only be called on app initialization
    // Set up local authentication streams
    const checkAuth$ = this.isAuthenticated$.pipe(
      concatMap((loggedIn: boolean) => {
        if (loggedIn) {
          // If authenticated, get user and set in app
          // NOTE: you could pass options here if needed
          this.loading$.next(false);
          return this.getUser$();
        }
        this.auth0Client$
          .pipe(
            // https://auth0.com/docs/libraries/auth0-single-page-app-sdk#get-access-token-with-no-interaction
            // *info: Allow check user session in public pages to avoid redirecting to login page
            concatMap((client: any) =>
              from(client.getTokenSilently({ ignoreCache: true }))
            ),
            concatMap(() => this.getUser$()),
            concatMap((user) => {
              if (user) {
                return this.isAuthenticated$;
              }
              this.checkUserSessionByCookie();
              return of(null);
            }),
            catchError((error) => {
              // *info: by pass error, no needed, it is login_required
              this.checkUserSessionByCookie();
              return of(null);
            })
          )
          .subscribe(() => {
            this.loading$.next(false);
          });
        // If not authenticated, return stream that emits 'false'
        return of(loggedIn);
      })
    );
    checkAuth$.subscribe();
  }

  checkUserSessionByCookie() {
    const cookieName = `auth-${this.auth0Options.domain}`;
    const cookieExists = this.getCookie(cookieName);
    if (cookieExists) {
      this.login();
      return;
    }
  }

  getCookie(cname) {
    const name = cname + '=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');

    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return '';
  }

  private getTargetRouteFromAppState(appState) {
    if (!appState) {
      return '/';
    }

    const { requestId, returnTo, target, targetUrl } = appState;

    const requestIdURL = this.getURLFromRequestId(requestId);

    return (
      requestIdURL ||
      this.getTargetRouteFromReturnTo(returnTo) ||
      target ||
      targetUrl ||
      '/'
    );
  }

  getURLFromRequestId(requestId: string) {
    if (!requestId) {
      return '';
    }

    const str = window.localStorage.getItem(requestId);
    const URL = str && str.replace(window.location.origin, '');
    window.localStorage.removeItem(requestId);
    return URL;
  }

  private getTargetRouteFromReturnTo(returnTo) {
    if (!returnTo) {
      return '';
    }

    const { fragmentIdentifier } = querystring.parseUrl(returnTo, {
      parseFragmentIdentifier: true,
    });

    if (fragmentIdentifier) {
      return fragmentIdentifier;
    }

    const { pathname } = new Url(returnTo);
    return pathname || '/';
  }

  private handleAuthCallback() {
    // Call when app reloads after user logs in with Auth0
    const params = this.currentHref;

    if (params.includes('code=') && params.includes('state=')) {
      let targetRoute = '/'; // Path to redirect to after login processsed
      const authComplete$ = this.handleRedirectCallback$.pipe(
        // Have client, now call method to handle auth callback redirect
        tap((cbRes: any) => {
          log('handleAuthCallback > cbres', { cbRes });
          targetRoute = this.getTargetRouteFromAppState(cbRes.appState);
          log('handleAuthCallback > targetRoute ? ', { targetRoute });
        }),
        concatMap(() => {
          // Redirect callback complete; get user and login status
          return combineLatest([this.getUser$(), this.isAuthenticated$]);
        })
      );
      // Subscribe to authentication completion observable
      // Response will be an array of user and login status
      authComplete$.subscribe(() => {
        // Redirect to target route after callback processing
        // *info: this url change will remove the code and state from the URL
        // * this is need to avoid invalid state in the next refresh
        this.loading$.next(false);
        this.router.navigateByUrl(targetRoute);
      });
    }
  }


  login(redirectPath: string = '/') {
    const button = document
      .querySelector("#lfx-header")
      .shadowRoot.querySelector(".lfx-header.is-login-link") as HTMLElement;
    if (button) {
      button.click();
    }
  }

  logout() {
    const button = document
    .querySelector("#lfx-header")
      .shadowRoot.querySelector(".lfx-header.is-logout-link") as HTMLElement;
      if (button) {
        button.click();
      }
  }

  getTokenSilently$(options?): Observable<any> {
    return this.auth0Client$.pipe(
      concatMap((client: any) =>
        from(client.getTokenSilently({ ignoreCache: true }))
      )
    );
  }

  getIdToken$(options?): Observable<any> {
    return this.auth0Client$.pipe(
      // *info: if getIdToken fails , just return empty in the catchError
      concatMap((client: any) => from(client.getIdTokenClaims(options))),
      concatMap((claims: any) => of((claims && claims.__raw) || '')),
      catchError(() => of(''))
    );
  }
}
