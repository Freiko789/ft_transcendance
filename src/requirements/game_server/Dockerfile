FROM alpine:3.18

WORKDIR /app

COPY conf/* /app

RUN apk update &&\
    apk add --no-cache npm openssl curl &&\
    mkdir -p /app/ssl_certificates &&\
    openssl \
    req \
    -x509 \
    -nodes \
    -out /app/ssl_certificates/game_server.crt \
    -keyout /app/ssl_certificates/game_server.key \
    -subj "/C=FR/ST=PACA/L=Nice/O=42/OU=42Nice/CN=ft_transcendence.42nice.fr/UID=efirmino" &&\
    npm install

COPY /game /app

EXPOSE 443

ENTRYPOINT [ "node", "server.mjs" ]