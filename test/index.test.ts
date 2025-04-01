import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import { Cookie, SetCookie } from "@mjackson/headers";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/native";

import { Auth0Strategy } from "../src/index.js";
import { StateStore } from "../src/lib/store.js";
import { catchResponse, random } from "./helpers/index.js";

const server = setupServer(
	http.post("https://xxx.auth0.com/oauth/token", async () => {
		return HttpResponse.json({
			access_token: "mocked",
			expires_in: 3600,
			refresh_token: "mocked",
			scope: ["openid", "profile"].join(" "),
			token_type: "Bearer",
		});
	}),
);

describe(Auth0Strategy.name, () => {
	let verify = mock();

	let options = Object.freeze({
		domain: "xxx.auth0.com",
		clientId: "MY_CLIENT_ID",
		clientSecret: "MY_CLIENT_SECRET",
		redirectURI: "https://example.com/callback",
		scopes: ["openid", "profile"],
	} satisfies Auth0Strategy.ConstructorOptions);

	interface User {
		id: string;
	}

	beforeAll(() => {
		server.listen();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(() => {
		server.close();
	});

	test("handles organization invitation parameters", async () => {
		let strategy = new Auth0Strategy<User>(options, verify);

		let orgParam = "org_123";
		let invitationParam = "inv_456";

		let request = new Request(
			`https://remix.auth/login?organization=${orgParam}&invitation=${invitationParam}`,
		);

		let response = await catchResponse(strategy.authenticate(request));

		// biome-ignore lint/style/noNonNullAssertion: This is a test
		let redirect = new URL(response.headers.get("location")!);

		expect(redirect.searchParams.get("organization")).toBe(orgParam);
		expect(redirect.searchParams.get("invitation")).toBe(invitationParam);
	});

	test("should have the name `auth0`", () => {
		let strategy = new Auth0Strategy<User>(options, verify);
		expect(strategy.name).toBe("auth0");
	});

	test("redirects to authorization url if there's no state", async () => {
		let strategy = new Auth0Strategy<User>(options, verify);

		let request = new Request("https://remix.auth/login");

		let response = await catchResponse(strategy.authenticate(request));

		// biome-ignore lint/style/noNonNullAssertion: This is a test
		let redirect = new URL(response.headers.get("location")!);

		let setCookie = new SetCookie(response.headers.get("set-cookie") ?? "");
		let params = new URLSearchParams(setCookie.value);

		expect(redirect.pathname).toBe("/authorize");
		expect(redirect.searchParams.get("response_type")).toBe("code");
		expect(redirect.searchParams.get("client_id")).toBe(options.clientId);
		expect(redirect.searchParams.get("redirect_uri")).toBe(options.redirectURI);
		expect(redirect.searchParams.has("state")).toBeTruthy();
		expect(redirect.searchParams.get("scope")).toBe(options.scopes.join(" "));
		expect(params.get("state")).toBe(redirect.searchParams.get("state"));
		expect(redirect.searchParams.get("code_challenge_method")).toBe("S256");
	});

	test("throws if there's no state in the session", async () => {
		let strategy = new Auth0Strategy<User>(options, verify);

		let request = new Request(
			"https://example.com/callback?state=random-state&code=random-code",
		);

		expect(strategy.authenticate(request)).rejects.toThrowError(
			new ReferenceError("Missing state on cookie."),
		);
	});

	test("throws if the state in the url doesn't match the state in the session", async () => {
		let strategy = new Auth0Strategy<User>(options, verify);

		let store = new StateStore();
		store.set("random-state", "random-code-verifier");

		let cookie = new Cookie();
		cookie.set("polar", store.toString());

		let request = new Request(
			"https://example.com/callback?state=another-state&code=random-code",
			{ headers: { Cookie: cookie.toString() } },
		);

		expect(strategy.authenticate(request)).rejects.toThrowError(
			new ReferenceError("Missing state on cookie."),
		);
	});

	test("calls verify with the tokens and request", async () => {
		let strategy = new Auth0Strategy<User>(options, verify);

		let store = new StateStore();
		store.set("random-state", "random-code-verifier");

		let cookie = new Cookie();
		cookie.set(store.toSetCookie()?.name as string, store.toString());

		let request = new Request(
			"https://example.com/callback?state=random-state&code=random-code",
			{ headers: { cookie: cookie.toString() } },
		);

		await strategy.authenticate(request);

		expect(verify).toHaveBeenCalled();
	});

	test("returns the result of verify", () => {
		let user = { id: "123" };
		verify.mockResolvedValueOnce(user);

		let strategy = new Auth0Strategy<User>(options, verify);

		let store = new StateStore();
		store.set("random-state", "random-code-verifier");

		let cookie = new Cookie();
		cookie.set(store.toSetCookie()?.name as string, store.toString());

		let request = new Request(
			"https://example.com/callback?state=random-state&code=random-code",
			{ headers: { cookie: cookie.toString() } },
		);

		expect(strategy.authenticate(request)).resolves.toEqual(user);
	});

	test("handles race condition of state and code verifier", async () => {
		let verify = mock().mockImplementation(() => ({ id: "123" }));
		let strategy = new Auth0Strategy<User>(options, verify);

		let responses = await Promise.all(
			Array.from({ length: random() }, () =>
				catchResponse(
					strategy.authenticate(new Request("https://remix.auth/login")),
				),
			),
		);

		let setCookies: SetCookie[] = responses
			.flatMap((res) => res.headers.getSetCookie())
			.map((header) => new SetCookie(header));

		let cookie = new Cookie();

		for (let setCookie of setCookies) {
			cookie.set(setCookie.name as string, setCookie.value as string);
		}

		let urls = setCookies.map((setCookie) => {
			let params = new URLSearchParams(setCookie.value);
			let url = new URL("https://remix.auth/callback");
			url.searchParams.set("state", params.get("state") as string);
			url.searchParams.set("code", crypto.randomUUID());
			return url;
		});

		await Promise.all(
			urls.map((url) =>
				strategy.authenticate(
					new Request(url, { headers: { cookie: cookie.toString() } }),
				),
			),
		);

		expect(verify).toHaveBeenCalledTimes(responses.length);
	});
});
