FROM alpine:3.18

WORKDIR /prometheus

RUN apk update && apk add --no-cache wget curl &&\
    wget https://github.com/prometheus/prometheus/releases/download/v2.53.0/prometheus-2.53.0.linux-amd64.tar.gz &&\
    tar -xf prometheus-2.53.0.linux-amd64.tar.gz &&\
    mv prometheus-2.53.0.linux-amd64/* ./ &&\
    rm -rf prometheus-2.53.0.linux-amd64 prometheus-2.53.0.linux-amd64.tar.gz

COPY config/prometheus.yml /prometheus/prometheus.yml

COPY config/alert_rules.yml /prometheus/alert_rules.yml

EXPOSE 9090

ENTRYPOINT [ "./prometheus" ]

CMD [ "--storage.tsdb.path=/prometheus/data", \
    "--config.file=/prometheus/prometheus.yml", \
    "--storage.tsdb.retention.size=512MB" ]