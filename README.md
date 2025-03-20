# Auth0Strategy

The Auth0 strategy is used to authenticate users against an Auth0 account. It extends the OAuth2Strategy.

## Supported runtimes

| Runtime    | Has Support |
| ---------- | ----------- |
| Node.js    | ✅          |
| Cloudflare | ✅          |

## How to use

### Installation

```bash
npm add remix-auth remix-auth-auth0
```

## Usage

### Create an Auth0 tenant

Follow the steps on [the Auth0 documentation](https://auth0.com/docs/get-started/create-tenants) to create a tenant and get a client ID, client secret and domain.

### Create the strategy instance

```tsx
import { Auth0Strategy } from "remix-auth-auth0";

export let authenticator = new Authenticator<User>();

authenticator.use(
  new Auth0Strategy(
    {
      domain: "xxx.auth0.com",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectURI: "https://example.app/auth/callback",
      scopes: ["openid", "email"], // optional
    },
    async ({ tokens, request }) => {
      // here you can use the params above to get the user and return it
      // what you do inside this and how you find the user is up to you
      return await getUser(tokens, request);
    }
  ),
  // this is optional, but if you setup more than one Auth0 instance you will
  // need to set a custom name to each one, by default is "auth0"
  "provider-name"
);
```

Then you will need to setup your routes, for the OAuth2 flows you will need to call the `authenticate` method twice.

First, you will call the `authenticate` method with the provider name you set in the authenticator.

```ts
export async function action({ request }: Route.ActionArgs) {
  await authenticator.authenticate("provider-name", request);
}
```

> [!NOTE]
> This route can be an `action` or a `loader`, it depends if you trigger the flow doing a POST or GET request.

This will start the OAuth2 flow and redirect the user to the provider's login page. Once the user logs in and authorizes your application, the provider will redirect the user back to your application redirect URI.

You will now need a route on that URI to handle the callback from the provider.

```ts
export async function loader({ request }: Route.LoaderArgs) {
  let user = await authenticator.authenticate("provider-name", request);
  // now you have the user object with the data you returned in the verify function
}
```

> [!NOTE]
> This route must be a `loader` as the redirect will trigger a `GET` request.

Once you have the `user` object returned by your strategy verify function, you can do whatever you want with that information. This can be storing the user in a session, creating a new user in your database, link the account to an existing user in your database, etc.

### Using the Refresh Token

The strategy exposes a public `refreshToken` method that you can use to refresh the access token.

```ts
let strategy = new Auth0Strategy<User>(options, verify);
let tokens = await strategy.refreshToken(refreshToken);
```

The refresh token is part of the `tokens` object the verify function receives. How you store it to call `strategy.refreshToken` and what you do with the `tokens` object after it is up to you.

The most common approach would be to store the refresh token in the user data and then update the session after refreshing the token.

```ts
authenticator.use(
  new Auth0Strategy<User>(
    options,
    async ({ tokens, request }) => {
      let user = await getUser(tokens, request);
      return {
        ...user,
        accessToken: tokens.accessToken()
        refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
      }
    }
  )
);

// later in your code you can use it to get new tokens object
let tokens = await strategy.refreshToken(user.refreshToken);
```

### Revoking Tokens

You can revoke the access token the user has with the provider.

```ts
await strategy.revokeToken(user.accessToken);
```

### Customizing the Cookie

You can customize the cookie options by passing an object to the `cookie` option.

```ts
authenticator.use(
  new Auth0Strategy<User>(
    {
      cookie: {
        name: "auth0",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/auth",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      ...otherOptions,
    },
    async ({ tokens, request }) => {
      return await getUser(tokens, request);
    }
  )
);
```

This will set the cookie with the name `auth0`, with a max age of 1 week, only accessible on the `/auth` path, http only, same site lax and secure if the application is running in production.

### Scopes

The `Auth0Strategy` constructor accepts a `scopes` option that is an array of strings with the scopes you want to request from Auth0.

The scopes are the permissions you are requesting from the user. The strategy providers a type with all the supported scopes by Polar to the date of the package release.

```ts
import { Auth0Strategy } from "remix-auth-auth0";

const scopes: Array<Auth0Strategy.Scope> = [
  "openid",
  "email",
  "profile",
  // ...more scopes
];
```

## Testing

```bash
bun test
```

## Contributing

Please see [CONTRIBUTING](CONTRIBUTING.md) for details.

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.
