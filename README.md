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

## Deploying with Docker

Campfire's Docker image contains everything needed for a fully-functional,
single-machine deployment. This includes the web app, background jobs, caching,
file serving, and SSL.

To persist storage of the database and file attachments, map a volume to `/rails/storage`.

To configure additional features, you can set the following environment variables:

- `SSL_DOMAIN` - enable automatic SSL via Let's Encrypt for the given domain name
- `DISABLE_SSL` - alternatively, set `DISABLE_SSL` to serve over plain HTTP
- `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` - set these to a valid keypair to
  allow sending Web Push notifications. You can generate a new keypair by running
  `/script/admin/create-vapid-key`
- `SENTRY_DSN` - to enable error reporting to sentry in production, supply your
  DSN here

### Voice / video (self-hosted)

Direct (1:1) calls use the browser WebRTC stack with **Action Cable** signaling.
Configure STUN/TURN so peers can connect behind NAT:

- `CAMPFIRE_ICE_SERVERS_JSON` – optional JSON array passed to `RTCPeerConnection`
  (overrides everything below when set).
- `CAMPFIRE_STUN_URL` – defaults to `stun:stun.l.google.com:19302` if unset.
- `CAMPFIRE_TURN_URL`, `CAMPFIRE_TURN_USERNAME`, `CAMPFIRE_TURN_CREDENTIAL` –
  optional; **[coturn](https://github.com/coturn/coturn)** on your own server is the usual choice for TURN.

Group calls use an embedded **Jitsi Meet** room (you run Jitsi on your infrastructure):

- `CAMPFIRE_JITSI_BASE_URL` – e.g. `https://meet.example.com` (no trailing path).
  When unset, the “Group call” button is hidden.

For example:

    docker build -t campfire .

    docker run \
      --publish 80:80 --publish 443:443 \
      --restart unless-stopped \
      --volume campfire:/rails/storage \
      --env SECRET_KEY_BASE=$YOUR_SECRET_KEY_BASE \
      --env VAPID_PUBLIC_KEY=$YOUR_PUBLIC_KEY \
      --env VAPID_PRIVATE_KEY=$YOUR_PRIVATE_KEY \
      --env TLS_DOMAIN=chat.example.com \
      campfire

## Running in development

    bin/setup
    bin/rails server

## Worth Noting

When you start Campfire for the first time, you’ll be guided through
creating an admin account.
The email address of this admin account will be shown on the login page
so that people who forget their password know who to contact for help.
(You can change this email later in the settings)

Campfire is single-tenant: any rooms designated "public" will be accessible by
all users in the system. To support entirely distinct groups of customers, you
would deploy multiple instances of the application.
