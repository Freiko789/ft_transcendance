FROM alpine:3.18

WORKDIR /node-exporter

RUN apk update && apk add --no-cache wget curl &&\
    wget https://github.com/prometheus/node_exporter/releases/download/v1.8.1/node_exporter-1.8.1.linux-amd64.tar.gz &&\
    tar -xf node_exporter-1.8.1.linux-amd64.tar.gz &&\
    mv node_exporter-1.8.1.linux-amd64/* ./ &&\
    rm -rf node_exporter-1.8.1.linux-amd64 node_exporter-1.8.1.linux-amd64.tar.gz

EXPOSE 9100

ENTRYPOINT [ "/node-exporter/node_exporter" ]

CMD [ "--path.procfs=/host/proc", \
    "--path.sysfs=/host/sys", \
    "--path.rootfs=/host", \
    "--collector.filesystem.ignored-mount-points", \
    "^/(sys|proc|dev|host|etc|rootfs/var/lib/docker/containers|rootfs/var/lib/docker/overlay|rootfs/run/docker/netns|rootfs/var/lib/docker/aufs)($$|/)" ]