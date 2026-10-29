# Campfire

Campfire is a web-based chat application. It supports many of the features you'd
expect, including:

- Multiple rooms, with access controls
- Direct messages
- File attachments with previews
- Search
- Notifications (via Web Push)
- @mentions
- API, with support for bot integrations

## Running your own Campfire instance

Campfire's Docker image contains everything needed for a fully-functional,
single-machine deployment. This includes the web app, background jobs, caching,
file serving, and SSL. You can use our pre-built image at
`ghcr.io/basecamp/once-campfire:latest`, or build your own from this repo.

### Deploying with ONCE

The easiest way to self-host Campfire is with [ONCE](https://github.com/basecamp/once).
It will guide you through the initial set up and then keep your instance up to date automatically.

If you don't already have `once` installed, run this on the machine you want to run Campfire on:

```sh
curl https://get.once.com | sh
```

`once` will launch as soon as the install is finished.

Choose Campfire from the list of applications, follow the instructions, and ONCE will take care of the rest.

If you prefer the command line to the dashboard, you can deploy directly:

```sh
once deploy ghcr.io/basecamp/once-campfire --host chat.example.com
```

### Deploying with Docker

If you'd rather run the Docker image yourself, you can read more about that in the [self-hosting guide](docs/self-hosting.md).

> [!TIP]
> When you start Campfire for the first time, you'll be guided through a wizard to create an admin account.
> The email address that you enter for the admin account will be visible on the sign-in page, it's there so
> that people have someone to contact if they need help with their account. If that bothers you, put in any
> email address you want and create yourself a new admin account.

Authenticated room, message, sidebar and search pages use a bounded 64 MiB cache per worker.
Set `CAMPFIRE_RESPONSE_CACHE_MB=0` to disable it. Every request still checks authentication
and room access; commits from any SQLite writer invalidate complete cached HTML and gzip bodies.
Native HTML, JSON and stream fragments have a separate 64 MiB memory limit per worker;
shared rate limits retain their existing store.

### Coolify deployment for this fork

The checked-in `docker-compose.yaml` builds this fork with its Dockerfile.
Keep the persistent `campfire-storage` volume mounted at `/rails/storage`.
This includes the fork’s voice/video and structured-message formatting changes.

### Voice / video (self-hosted)

When Jitsi is configured, **Voice** and **Video** in both Ping (direct) chats and
group rooms open your own Jitsi server. People viewing the same room receive an
invitation with Accept and Decline; audio calls start with the camera disabled.
Closing the dialog, pressing Escape, or navigating away releases the call frame.
Invitations only reach people who currently have that room open.

Set these runtime variables in Coolify (the Compose file passes them to Rails):

- `CAMPFIRE_JITSI_BASE_URL`: HTTPS origin, e.g. `https://jitsi.example.com`.
- `CAMPFIRE_JITSI_APP_ID`: `campfire` by default; matches Jitsi `JWT_APP_ID`,
  `JWT_ACCEPTED_ISSUERS` and `JWT_ACCEPTED_AUDIENCES`.
- `CAMPFIRE_JITSI_APP_SECRET`: a random shared secret matching Jitsi `JWT_APP_SECRET`.
- `CAMPFIRE_JITSI_XMPP_DOMAIN`: `meet.jitsi` by default; matches Jitsi `XMPP_DOMAIN`.

Configure Jitsi with `ENABLE_AUTH=1`, `AUTH_TYPE=jwt`, `ENABLE_GUESTS=0`,
`JWT_ALLOW_EMPTY=0`, `JWT_ENABLE_DOMAIN_VERIFICATION=1`, and `JWT_SIGN_TYPE=HS256`.
The Rails endpoint checks room membership and issues a one-hour token scoped to
that room and user. Tokens are never cached; room names are derived with HMAC.
A reconnect after token expiry requires reopening the call. JWT secrets stay on
the server and must never be checked into Git.

The minimum Jitsi stack is web, Prosody, Jicofo and Jitsi Videobridge. Its HTTPS
origin and UDP port 10000 must be reachable. TURN is an optional addition for
networks that block direct UDP media. Recording and SIP services are unnecessary
for browser voice/video calls.

Without Jitsi configuration, Ping chats retain the browser WebRTC fallback.
`CAMPFIRE_ICE_SERVERS_JSON` overrides its ICE servers; otherwise
`CAMPFIRE_STUN_URL` and optional `CAMPFIRE_TURN_URL`, `CAMPFIRE_TURN_USERNAME`,
`CAMPFIRE_TURN_CREDENTIAL` configure STUN/TURN.

## Other implementations

Campfire also has implementations in Django, Laravel, Express, Elixir, Go, Rust and C:

| HTTP workload (requests/sec) | Rails | [Django](https://github.com/basecamp/once-campfire-django) | [Laravel](https://github.com/basecamp/once-campfire-laravel) | [Express](https://github.com/basecamp/once-campfire-express) | [Elixir](https://github.com/basecamp/once-campfire-elixir) | [Go](https://github.com/basecamp/once-campfire-go) | [Rust](https://github.com/basecamp/once-campfire-rust) | [C](https://github.com/basecamp/once-campfire-c) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Room page | 4,101 | 1,507 | 3,872 | 42,636 | 5,350 | 53,060 | 106,494 | 137,524 |
| Messages page | 4,115 | 1,596 | 3,995 | 74,362 | 5,712 | 54,800 | 102,697 | 144,642 |
| Sidebar | 4,333 | 1,873 | 4,493 | 94,329 | 5,949 | 59,144 | 120,294 | 152,002 |
| Search | 4,282 | 1,862 | 4,172 | 84,665 | 5,848 | 60,509 | 121,378 | 149,487 |
| Post a message | 330 | 262 | 794 | 2,155 | 1,278 | 9,021 | 8,037 | 7,530 |
| Backend KLOC | 5.5 | 5.3 | 4.1 | 6.8 | 11.6 | 23.2 | 30.7 | 94.8 |

KLOC counts backend code plus executable code in templates; excludes plain HTML, frontend, tests, dependencies and generated files.

[Shared verification](https://github.com/basecamp/once-campfire-verification) · [Detailed results](https://github.com/basecamp/once-campfire-verification/blob/main/docs/performance-review.md).

Measured with 16 concurrent clients on an AMD Ryzen AI MAX+ 395 with 32 GB RAM,
with four hardware cores allocated to each app.

## Development

You are welcome - and encouraged - to modify Campfire to your liking.
Please see our [development guide](docs/development.md) for how to get Campfire set up for local development.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability and a description of our trust model.

Browser writes use Rails’ `Sec-Fetch-Site` header-only protection and `Origin` check.
HTTPS requires browser metadata; plain HTTP retains the missing-header fallback.
Forms contain no CSRF tokens. Existing cookies, bot APIs and signed uploads remain compatible.
