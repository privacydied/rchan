# rchan — LynxChan on Synology (DSM 7.3)

Imageboard engine (LynxChan) + MongoDB, in Docker, fronted by **DSM's built-in
reverse proxy**. TLS terminates at DSM (Let's Encrypt).

## Layout — single front port, split by Host
Every hostname enters one router port `127.0.0.1:8081` (DSM reverse proxy points both
there); the `rchan-landing` nginx container splits by `Host`:
- **boards.rchan.xyz** → the canonical imageboard: `proxy_pass` to the LynxChan engine at
  `lynxchan:8080` over the internal Docker network.
- **rchan.xyz** (apex, and any unknown Host) → **301 redirect** to
  `https://boards.rchan.xyz$request_uri` (path preserved). One canonical URL.

The engine (`rchan-lynxchan`) publishes **no host port** — it's reachable only inside
the compose network, so the whole stack presents exactly one localhost port to DSM.

> `/volume1/web/rchan/index.html` (the old standalone splash) is still bind-mounted but
> no longer served; flip the apex `server {}` block in `nginx/default.conf` back to a
> `root`/`try_files` if you ever want the splash instead of the redirect.

### Clean URLs (`.html` and nav `.js` hidden)
The boards `server {}` in `nginx/default.conf` does two cosmetic things:
1. **Accepts extension-less page URLs** via a `.html → .js → raw` fallback chain:
   `/login` → `/login.html`, `/boards` → (`.html` misses) → `/boards.js`, and bare
   segments fall through to the engine's own trailing-slash redirect. GET-only, so
   request methods are never changed.
2. **Strips extensions from links** in served HTML via `sub_filter`: `.html` everywhere,
   and `.js` **only inside `href="…"`** (navigation) for the known dynamic page
   endpoints (`boards`, `logs`, `graphs`, `archives`, `account`, the management pages…).

Two special cases the router also handles (both in `nginx/default.conf`): static
content pages under `/.static/pages/…` get their `.html` restored on the way in (the
`sub_filter` strips it from the link), and bare `/overboard` 301-redirects to
`/overboard/` (the overboard is a pseudo-board served only at the trailing-slash path).

**API `.js` is deliberately left intact.** LynxChan's posting/login/moderation API *is*
`/*.js`, used as form `action="…"` and in front-end fetch calls — those are never
touched (only `href="…"` is stripped), so `POST /login.js`, `/createBoard.js`,
`/boards.js` (search), etc. keep working. Several of those endpoints are dual-role
(`/boards.js` is both a GET page and a POST action); scoping the strip to `href` is what
keeps the GET link clean while the POST form still targets `/boards.js` directly.

## Files
| file | purpose |
|------|---------|
| `Dockerfile` | builds the LynxChan engine image (Node 16, ImageMagick, ffmpeg, exiftool…) |
| `entrypoint.sh` | waits for mongo, creates root once (sentinel-guarded), starts engine |
| `docker-compose.yml` | mongo + lynxchan + landing/router |
| `nginx/default.conf` | front router: Host-split (landing vs engine) + WebSocket + forwarded headers |
| `settings/general.json` | engine config (bind-mounted, edit freely then restart) |
| `settings/db.json` | mongo connection |
| `.env` | `ROOT_USER` / `ROOT_PASS` (git-ignored, keep private) |
| `state/` | first-run sentinel (`.root-created`) |
| `mongo-data/` | MongoDB data (gridfs media lives here) |

## Bring it up (requires sudo — the docker socket is root-only)
```sh
cd /volume1/docker/rchan
sudo docker compose build          # ~5–10 min first time (git clone + npm install)
sudo docker compose up -d
sudo docker compose logs -f lynxchan
```
Health check (local — both hostnames share port 8081, so pass the Host header):
```sh
curl -I -H 'Host: rchan.xyz'        http://127.0.0.1:8081/   # 301 -> https://boards.rchan.xyz/
curl -I -H 'Host: boards.rchan.xyz' http://127.0.0.1:8081/   # 200  LynxChan front page
```

## DSM reverse proxy (Control Panel → Login Portal → Advanced → Reverse Proxy)

Both entries point at the **same** destination (`localhost:8081`); the router splits
by hostname, so DSM never picks a backend port.

**Entry 1 — boards**
- Source: `HTTPS`, host `boards.rchan.xyz`, port `443`
- Destination: `HTTP`, host `localhost`, port `8081`
- Custom Header → **Create → WebSocket** (adds Upgrade/Connection — needed for the
  DSM→router hop; the router→engine hop already upgrades in `nginx/default.conf`)

**Entry 2 — landing**
- Source: `HTTPS`, host `rchan.xyz`, port `443`
- Destination: `HTTP`, host `localhost`, port `8081`

> The router already sets `Host` / `X-Forwarded-For` / `X-Forwarded-Proto` on the way
> to the engine, and honors the `X-Forwarded-Proto: https` that DSM adds — so LynxChan
> generates correct `https://boards.rchan.xyz` URLs with no extra DSM custom headers.

Then Control Panel → **Security → Certificate**: add a Let's Encrypt cert covering
`rchan.xyz` + `boards.rchan.xyz` and assign both reverse-proxy hostnames to it.

> Public DNS for `rchan.xyz` and `boards.rchan.xyz` must point at this NAS, and your
> router must forward :443 to the NAS host (192.168.1.2), **not** to the
> nginx-proxy-manager macvlan IP. See "Why not nginx-proxy-manager" below.

## Admin
Log in at `https://boards.rchan.xyz/login.html` with `ROOT_USER` / `ROOT_PASS` from `.env`.
Create boards from the account panel. To change the password later, use the account
settings UI (the sentinel stops the entrypoint from re-creating root).

## Config changes
Edit `settings/general.json`, then `sudo docker compose restart lynxchan`.

## Branding & front page
**Logo** — bind-mounted from `./branding/logo.png` to the engine's
`/lynxchan/src/fe/static/logo.png` (served at `/.static/logo.png`, shown in the header /
front page). The template hard-codes the `logo.png` name, so the file keeps that name
regardless of real format — it's currently an **animated GIF** (`earth.gif`), and the
router forces `Content-Type: image/gif` for that one path so Cloudflare won't mis-optimize
it. To rebrand, replace `./branding/logo.png` and `sudo docker compose restart lynxchan`
(the engine caches static files at boot). If it looks stale, hard-refresh and purge the
Cloudflare cache for the URL. If you switch back to a still PNG, drop the `image/gif`
override in `nginx/default.conf` (browsers sniff either way, so it'll still render).

**Front-page title text** — the "info box" under the logo is a static placeholder in
PenumbraLynx's `index.html` (ships as *"Insert title here"*). We override it with a
bind-mounted copy at `./fe-overrides/index.html` → the engine's
`templates/pages/index.html` (currently set to `rchan`). Edit that file, then
`sudo docker compose restart lynxchan && sudo docker exec rchan-lynxchan node boot.js -rf -nd`
to regenerate. If you rebuild the image and the upstream template changed, re-copy it
from the container and re-apply the edit.

**Front-page board list** — the front page only renders the board list / stats when
`topBoardsCount` (and/or `frontPageStats`) is set in `general.json`; they're `25` / `true`
here. A brand-new board won't appear until the cached front page is regenerated:
```sh
# rebuild the front page once (reads general.json, then exits — no port clash)
sudo docker exec rchan-lynxchan node boot.js -rf -nd
```
`entrypoint.sh` also passes `-rf` on boot, so a restart refreshes it too (that change
takes effect after the next image rebuild, since the script is baked into the image).
With `topBoardsCount` set, LynxChan's scheduler regenerates the front page periodically
on its own.

## Why not nginx-proxy-manager
Your NPM runs on a **macvlan** network (`nginx-macvlan` @ 192.168.0.254) with a
saturated `/30` range, and macvlan user-nets don't give reliable Docker DNS. Pointing
NPM at `rchan:8080` by container name isn't viable here, so DSM's reverse proxy (which
runs on the host and reaches `127.0.0.1:8081` directly) is the clean path.

## ⚠️ Most likely thing to break: front-end / engine version match
The Dockerfile pairs **upstream LynxChan master** with **PenumbraLynx master** (same
maintainer, designed together). If the front page/templates throw on boot, rebuild with
either a pinned engine tag or the placeholder front-end:
```sh
# option A: frozen fork engine
sudo docker compose build --build-arg ENGINE_REPO=https://github.com/skyssolutions/lynxchan.git --build-arg ENGINE_REF=master
# option B: placeholder front-end (proves the engine works, ugly UI)
sudo docker compose build --build-arg FE_REPO=https://gitgud.io/LynxChan/LynxChanFront-Placeholder.git
sudo docker compose up -d
```
