# Web app: build the React console into web/dist.
FROM node:22-slim AS web
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .nvmrc ./
COPY web/package.json web/
COPY packages/tokens/package.json packages/tokens/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile
COPY packages packages
COPY web web
RUN pnpm --filter ./web build

# Server: serves the API and the built web app on one port.
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /uvx /bin/
WORKDIR /app/server
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY server/pyproject.toml server/uv.lock ./
RUN uv sync --locked --no-dev
COPY server /app/server
COPY web /app/web
COPY --from=web /app/web/dist /app/web/dist
ENV PATH="/app/server/.venv/bin:$PATH"
# The Kokoro read-aloud voice (about 95 MB) is not in the repo. Bake it in with
# `--build-arg SPEECH_MODEL=1`; otherwise docker compose fetches it into a volume.
ENV MODELS_DIR=/models
ARG SPEECH_MODEL=0
RUN if [ "$SPEECH_MODEL" = "1" ]; then python -m blinqscribe.speech download; fi
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 8000
CMD ["uvicorn", "blinqscribe.main:app", "--host", "0.0.0.0", "--port", "8000"]
