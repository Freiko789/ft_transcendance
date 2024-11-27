#!/bin/ash

source .env/bin/activate

python manage.py makemigrations --no-input
python manage.py migrate --no-input
python manage.py collectstatic --no-input

exec gunicorn \
    --certfile=/app/ssl_certificates/gunicorn.crt \
    --keyfile=/app/ssl_certificates/gunicorn.key \
    --bind 0.0.0.0:443 \
    ft_trans.wsgi:application
