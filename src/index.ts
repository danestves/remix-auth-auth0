import { type SetCookieInit } from "@mjackson/headers";
import {
	Auth0,
	OAuth2RequestError,
	type OAuth2Tokens,
	UnexpectedErrorResponseBodyError,
	UnexpectedResponseError,
	generateCodeVerifier,
	generateState,
} from "arctic";
import createDebug from "debug";
import { Strategy } from "remix-auth/strategy";

import { redirect } from "./lib/redirect.js";
import { StateStore } from "./lib/store.js";

type URLConstructor = ConstructorParameters<typeof URL>[0];

const debug = createDebug("Auth0Strategy");

export {
	OAuth2RequestError,
	UnexpectedErrorResponseBodyError,
	UnexpectedResponseError,
};

export class Auth0Strategy<User> extends Strategy<
	User,
	Auth0Strategy.VerifyOptions
> {
	name = "auth0";

	protected client: Auth0;

	constructor(
		protected options: Auth0Strategy.ConstructorOptions,
		verify: Strategy.VerifyFunction<User, Auth0Strategy.VerifyOptions>,
	) {
		super(verify);

		this.client = new Auth0(
			options.domain,
			options.clientId,
			options.clientSecret,
			options.redirectURI.toString(),
		);
	}

	private get cookieName() {
		if (typeof this.options.cookie === "string") {
			return this.options.cookie || "auth0";
		}
		return this.options.cookie?.name ?? "auth0";
	}

	private get cookieOptions() {
		if (typeof this.options.cookie !== "object") return {};
		return this.options.cookie ?? {};
	}

	override async authenticate(request: Request): Promise<User> {
		debug("Request URL", request.url);

		let url = new URL(request.url);

		let stateUrl = url.searchParams.get("state");

		if (!stateUrl) {
			debug("No state found in the URL, redirecting to authorization endpoint");

			let { state, codeVerifier, url } = this.createAuthorizationURL();

			debug("State", state);
			debug("Code verifier", codeVerifier);

			url.search = this.authorizationParams(
				url.searchParams,
				request,
			).toString();

			debug("Authorization URL", url.toString());

			let store = StateStore.fromRequest(request, this.cookieName);
			store.set(state, codeVerifier);

			throw redirect(url.toString(), {
				headers: {
					"Set-Cookie": store
						.toSetCookie(this.cookieName, this.cookieOptions)
						.toString(),
				},
			});
		}

		let store = StateStore.fromRequest(request, this.cookieName);

		if (!store.has()) {
			throw new ReferenceError("Missing state on cookie.");
		}

		if (!store.has(stateUrl)) {
			throw new RangeError("State in URL doesn't match state in cookie.");
		}

		let error = url.searchParams.get("error");

		if (error) {
			let description = url.searchParams.get("error_description");
			let uri = url.searchParams.get("error_uri");
			throw new OAuth2RequestError(error, description, uri, stateUrl);
		}

		let code = url.searchParams.get("code");

		if (!code) throw new ReferenceError("Missing code in the URL");

		let codeVerifier = store.get(stateUrl);

		if (!codeVerifier) {
			throw new ReferenceError("Missing code verifier on cookie.");
		}

		debug("Validating authorization code");
		let tokens = await this.validateAuthorizationCode(code, codeVerifier);

		debug("Verifying the user profile");
		let user = await this.verify({ request, tokens });

		debug("User authenticated");
		return user;
	}

	protected createAuthorizationURL() {
		let state = generateState();
		let codeVerifier = generateCodeVerifier();

		let url = this.client.createAuthorizationURL(
			state,
			codeVerifier,
			this.options.scopes ?? [],
		);

		return { state, codeVerifier, url };
	}

	protected validateAuthorizationCode(code: string, codeVerifier: string) {
		return this.client.validateAuthorizationCode(code, codeVerifier);
	}

	/**
	 * Return extra parameters to be included in the authorization request.
	 *
	 * Some OAuth 2.0 providers allow additional, non-standard parameters to be
	 * included when requesting authorization.  Since these parameters are not
	 * standardized by the OAuth 2.0 specification, OAuth 2.0-based authentication
	 * strategies can override this function in order to populate these
	 * parameters as required by the provider.
	 */
	protected authorizationParams(
		params: URLSearchParams,
		request: Request,
	): URLSearchParams {
		const newParams = new URLSearchParams(params);
		const url = new URL(request.url);

		// Forward organization parameter if present
		const organization = url.searchParams.get("organization");
		if (organization) {
			newParams.set("organization", organization);
		}

		// Forward invitation parameter if present
		const invitation = url.searchParams.get("invitation");
		if (invitation) {
			newParams.set("invitation", invitation);
		}

		return newParams;
	}

	/**
	 * Get a new OAuth2 Tokens object using the refresh token once the previous
	 * access token has expired.
	 * @param refreshToken The refresh token to use to get a new access token
	 * @returns The new OAuth2 tokens object
	 * @example
	 * ```ts
	 * let tokens = await strategy.refreshToken(refreshToken);
	 * console.log(tokens.accessToken());
	 * ```
	 */
	public refreshToken(refreshToken: string) {
		return this.client.refreshAccessToken(refreshToken);
	}

	/**
	 * Users the token revocation endpoint of the identity provider to revoke the
	 * access token and make it invalid.
	 *
	 * @param token The access token to revoke
	 * @example
	 * ```ts
	 * // Get it from where you stored it
	 * let accessToken = await getAccessToken();
	 * await strategy.revokeToken(tokens.access_token);
	 * ```
	 */
	public revokeToken(token: string) {
		return this.client.revokeToken(token);
	}
}

export namespace Auth0Strategy {
	export interface VerifyOptions {
		/** The request that triggered the verification flow */
		request: Request;
		/** The OAuth2 tokens retrivied from the identity provider */
		tokens: OAuth2Tokens;
	}

	export interface ConstructorOptions {
		/**
		 * The name of the cookie used to keep state and code verifier around.
		 *
		 * The OAuth2 flow requires generating a random state and code verifier, and
		 * then checking that the state matches when the user is redirected back to
		 * the application. This is done to prevent CSRF attacks.
		 *
		 * The state and code verifier are stored in a cookie, and this option
		 * allows you to customize the name of that cookie if needed.
		 * @default "auth0"
		 */
		cookie?: string | (Omit<SetCookieInit, "value"> & { name: string });

		/**
		 * The domain of the Identity Provider you're using to authenticate users.
		 */
		domain: string;

		/**
		 * This is the Client ID of your application, provided to you by the Identity
		 * Provider you're using to authenticate users.
		 */
		clientId: string;

		/**
		 * This is the Client Secret of your application, provided to you by the
		 * Identity Provider you're using to authenticate users.
		 */
		clientSecret: string;

		/**
		 * The URL of your application where the Identity Provider will redirect the
		 * user after they've logged in or authorized your application.
		 */
		redirectURI: URLConstructor;

		/**
		 * The scopes you want to request from the Identity Provider, this is a list
		 * of strings that represent the permissions you want to request from the
		 * user.
		 */
		scopes?: Scope[];
	}

	/**
	 * @see https://auth0.com/docs/get-started/apis/scopes/openid-connect-scopes#standard-claims
	 */
	export type Scope = "openid" | "profile" | "email" | string;
}
