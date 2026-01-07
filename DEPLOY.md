# 🚀 Инструкции по деплою

## Репозиторий
Код загружен в: https://github.com/Renat-cyber/letgo

## 📦 Деплой Backend (на сервер 193.178.170.153)

### 1. Подключитесь к серверу
```bash
ssh root@193.178.170.153
```

### 2. Установите зависимости
```bash
# Node.js (если не установлен)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python и pip
sudo apt-get install -y python3 python3-pip

# PM2 для управления процессами
npm install -g pm2
```

### 3. Клонируйте репозиторий
```bash
cd /opt
git clone https://github.com/Renat-cyber/letgo.git tg-automation
cd tg-automation
```

### 4. Скопируйте сессии Telegram
```bash
# Скопируйте ваши .session файлы в корень проекта
scp *.session root@193.178.170.153:/opt/tg-automation/
```

### 5. Настройте Backend
```bash
cd backend

# Создайте .env файл
cat > .env << 'EOF'
NOVITA_API_KEY=sk_UQNdPi03xgTq61SYwM2TebE6HvXCQcAh1pOcQej62NM
NOVITA_MODEL=moonshotai/kimi-k2-0905
TELEGRAM_BOT_TOKEN=8388495342:AAEWdqtX9My5gY2gv8rHA1Ipf-2Sl_ep-W-
JWT_SECRET=tg_auto_super_secret_key_2024_very_secure
ADMIN_PASSWORD=leodaivpnchik2024
PORT=3001
SESSIONS_PATH=../
EOF

# Установите зависимости
npm install

# Установите Python зависимости
pip3 install -r python/requirements.txt

# Создайте директорию для БД
mkdir -p data
```

### 6. Запустите Backend
```bash
# Сборка TypeScript
npm run build

# Запуск через PM2
pm2 start dist/index.js --name tg-automation
pm2 save
pm2 startup
```

### 7. Настройте Nginx (опционально, для HTTPS)
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Создайте конфиг
sudo tee /etc/nginx/sites-available/tg-automation << 'EOF'
server {
    listen 80;
    server_name 193.178.170.153;

    location /api {
        proxy_pass http://localhost:3001/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3001/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/tg-automation /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🌐 Деплой Frontend (Vercel)

### Вариант 1: Через Vercel CLI
```bash
cd frontend

# Установите Vercel CLI
npm i -g vercel

# Деплой
vercel --prod
```

### Вариант 2: Через Vercel Dashboard
1. Зайдите на https://vercel.com
2. Нажмите "New Project"
3. Импортируйте репозиторий: https://github.com/Renat-cyber/letgo
4. Настройте проект:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Добавьте переменную окружения:
   - `VITE_API_URL` = `http://193.178.170.153:3001/api`
6. Нажмите "Deploy"

### Вариант 3: Через Netlify
```bash
cd frontend

# Установите Netlify CLI
npm i -g netlify-cli

# Деплой
netlify deploy --prod
```

## ✅ Проверка работы

### Backend
```bash
# Проверьте статус
pm2 status

# Проверьте логи
pm2 logs tg-automation

# Проверьте API
curl http://193.178.170.153:3001/api/accounts
```

### Frontend
После деплоя откройте URL от Vercel/Netlify и войдите с паролем: `leodaivpnchik2024`

## 🔧 Управление

### Остановить/перезапустить Backend
```bash
pm2 stop tg-automation
pm2 restart tg-automation
pm2 delete tg-automation
```

### Обновить код
```bash
cd /opt/tg-automation
git pull origin main
cd backend
npm install
npm run build
pm2 restart tg-automation
```

### Просмотр логов
```bash
pm2 logs tg-automation
pm2 logs tg-automation --lines 100
```

## 📱 Использование системы

1. **Войдите в панель** с паролем `leodaivpnchik2024`
2. **Запустите аккаунт** - нажмите "Запустить" на нужном аккаунте
3. **Синхронизируйте диалоги** - нажмите кнопку "Синхронизировать диалоги" на странице аккаунта
4. **Включите AI** - активируйте автоответчик для автоматических ответов
5. **Записывайте паттерны** - включите запись, выполните действия в Telegram, остановите запись
6. **Воспроизводите паттерны** - на странице "Паттерны" выберите паттерн и запустите его

## 🆘 Решение проблем

### Диалоги не отображаются
1. Убедитесь что аккаунт запущен
2. Нажмите "Синхронизировать диалоги"
3. Подождите 3-5 секунд и обновите страницу

### Backend не запускается
```bash
# Проверьте логи
pm2 logs tg-automation

# Проверьте что порт свободен
sudo lsof -i :3001

# Проверьте Python зависимости
pip3 list | grep -i telethon
```

### Frontend не подключается к Backend
1. Проверьте что Backend запущен: `pm2 status`
2. Проверьте переменную `VITE_API_URL` в настройках Vercel
3. Убедитесь что порт 3001 открыт на сервере

## 📞 Telegram бот

Отправьте `/start` боту для получения ссылки на панель и уведомлений об ошибках.

---

**Готово!** Система полностью настроена и готова к работе 🎉
