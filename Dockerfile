# rchan — LynxChan imageboard engine
# Engine targets Node 16.x — DO NOT bump the base image.
FROM node:16-bullseye

# ---- Engine + front-end sources (override at build time with --build-arg) ----
# Default pairing: upstream LynxChan master + PenumbraLynx master (same maintainer,
# designed together — lowest risk of front-end/engine template mismatch).
# Fallbacks if this pairing breaks:
#   ENGINE_REPO=https://github.com/skyssolutions/lynxchan.git  (frozen fork)
#   front-end  -> LynxChanFront-Placeholder (auto-fallback below)
ARG ENGINE_REPO=https://gitgud.io/LynxChan/LynxChan.git
ARG ENGINE_REF=master
ARG FE_REPO=https://gitgud.io/LynxChan/PenumbraLynx.git
ARG FE_REF=master

# ---- System dependencies (see brief: ImageMagick NOT graphicsmagick) ----
# NOTE: LynxChan's backend has a native addon (src/be/binding.gyp) that links,
# via pkg-config, against ImageMagick's C++ API (Magick++) AND four FFmpeg libs
# (libavformat/libavcodec/libavutil/libswscale — used by native/videoHandler.cpp).
# It needs the *-dev* packages (ship the .pc files + headers + linkable .so) plus
# pkg-config itself — not just the imagemagick/ffmpeg runtime CLIs — otherwise
# `npm install` dies at gyp configure with "No package '<lib>' found".
RUN apt-get update && apt-get install -y --no-install-recommends \
      imagemagick \
      libmagick++-dev \
      pkg-config \
      ffmpeg \
      bc \

      libavformat-dev \
      libavcodec-dev \
      libavutil-dev \
      libswscale-dev \
      libimage-exiftool-perl \
      file \
      unzip \
      curl \
      ghostscript \
      build-essential \
      python3 \
      python-is-python3 \
      make \
      g++ \
      netcat-openbsd \
      fonts-dejavu \
      git \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Relax Debian's ImageMagick security policy so thumbnailing/captcha don't hit
# "operation not allowed by the security policy" errors.
RUN for p in /etc/ImageMagick-6/policy.xml /etc/ImageMagick-7/policy.xml; do \
      [ -f "$p" ] && sed -i 's/rights="none"/rights="read|write"/g' "$p" || true; \
    done

# ---- Engine ----
WORKDIR /lynxchan
RUN git clone --depth 1 -b "${ENGINE_REF}" "${ENGINE_REPO}" .

# ---- Front-end (Penumbra; fall back to the placeholder if it can't be cloned) ----
RUN git clone --depth 1 -b "${FE_REF}" "${FE_REPO}" src/fe \
    || git clone --depth 1 https://gitgud.io/LynxChan/LynxChanFront-Placeholder.git src/fe

# ---- Backend deps (native node-addon-api modules build here) ----
WORKDIR /lynxchan/src/be
RUN npm install --unsafe-perm

# geoip-lite: self-contained GeoIP data for the geoflags addon (country flags by IP).
# Bundles its own dataset (postinstall), so no MaxMind license / compiled LynxChan DB needed.
RUN npm install --unsafe-perm geoip-lite

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080
WORKDIR /lynxchan/src/be
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
