FROM alpine:3.18

WORKDIR /alertmanager

RUN apk update && apk add --no-cache wget curl &&\
    wget https://github.com/prometheus/alertmanager/releases/download/v0.27.0/alertmanager-0.27.0.linux-amd64.tar.gz &&\
    tar -xf alertmanager-0.27.0.linux-amd64.tar.gz &&\
    mv alertmanager-0.27.0.linux-amd64/* ./ &&\
    rm -rf alertmanager-0.27.0.linux-amd64 alertmanager-0.27.0.linux-amd64.tar.gz

COPY /config/alertmanager.yml /alertmanager/alertmanager.yml
    
COPY /config/alertmanager.yml /alertmanager/alertmanager.yml.tmp

COPY /config/config.sh /alertmanager/start.sh

RUN chmod +x /alertmanager/start.sh
    
EXPOSE 9093

ENTRYPOINT [ "/alertmanager/start.sh" ]