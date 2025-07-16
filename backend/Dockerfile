FROM rust:1.84.1-alpine3.21 AS base
RUN apk add --no-cache musl-dev openssl-dev openssl-libs-static pkgconfig curl
RUN cargo install cargo-chef


FROM base AS chef
WORKDIR /app
RUN cargo init --name passport
COPY Cargo.toml Cargo.lock ./
RUN cargo chef prepare --recipe-path recipe.json


FROM base AS planner
WORKDIR /app
RUN cargo init --name passport
COPY --from=chef /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json --target x86_64-unknown-linux-musl


FROM base AS builder
WORKDIR /app

COPY .sqlx .sqlx
COPY migrations migrations
COPY src src
COPY Cargo.toml Cargo.toml

COPY --from=planner /app/target target
COPY --from=planner /app/Cargo.lock Cargo.lock

RUN cargo build --release --target x86_64-unknown-linux-musl

FROM alpine AS certificates
RUN apk add --no-cache ca-certificates

FROM scratch AS final
WORKDIR /app
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/passport /app/passport
COPY --from=certificates /etc/ssl/certs /etc/ssl/certs
ENTRYPOINT [ "/app/passport" ]
