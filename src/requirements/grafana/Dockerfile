FROM grafana/grafana:11.0.0

COPY config/grafana.ini /etc/grafana/grafana.ini

COPY config/datasource.yaml /etc/grafana/provisioning/datasources/efirmino.yaml

COPY config/dashboard.yaml /etc/grafana/provisioning/dashboards/efirmino.yaml

COPY config/dashboard.json /etc/grafana/provisioning/dashboards/efirmino.json

EXPOSE 3000