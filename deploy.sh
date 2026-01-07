#!/bin/bash
# Скрипт развёртывания VPN Subscription Server
# Запускать на сервере: bash deploy.sh

echo "🚀 Установка VPN Subscription Server"
echo "======================================"

# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Python и pip
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx

# Создание директории
mkdir -p /opt/vpn-subscription
cd /opt/vpn-subscription

# Копирование файлов (предполагается что они уже на сервере)
# scp -r vpn_subscription/* user@server:/opt/vpn-subscription/

# Виртуальное окружение
python3 -m venv venv
source venv/bin/activate

# Установка зависимостей
pip install flask gunicorn requests

# Создание systemd сервиса
sudo tee /etc/systemd/system/vpn-subscription.service > /dev/null <<EOF
[Unit]
Description=VPN Subscription Server
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/vpn-subscription
Environment="PATH=/opt/vpn-subscription/venv/bin"
ExecStart=/opt/vpn-subscription/venv/bin/gunicorn --workers 4 --bind 127.0.0.1:5000 server:app

[Install]
WantedBy=multi-user.target
EOF

# Nginx конфиг
sudo tee /etc/nginx/sites-available/vpn-subscription > /dev/null <<EOF
server {
    listen 80;
    server_name nacvaib.digital;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Активация сайта
sudo ln -sf /etc/nginx/sites-available/vpn-subscription /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Запуск сервиса
sudo systemctl daemon-reload
sudo systemctl enable vpn-subscription
sudo systemctl start vpn-subscription

echo ""
echo "✅ Сервер установлен!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Направь DNS nacvaib.digital на IP сервера"
echo "2. Получи SSL: sudo certbot --nginx -d nacvaib.digital"
echo "3. Проверь: curl http://nacvaib.digital"
echo ""
echo "📖 Команды управления:"
echo "   sudo systemctl status vpn-subscription"
echo "   sudo systemctl restart vpn-subscription"
echo "   sudo journalctl -u vpn-subscription -f"

