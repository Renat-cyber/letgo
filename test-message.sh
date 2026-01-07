#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3Njc3OTEwNzcsImV4cCI6MTc3MDM4MzA3N30.l18jv8ZZZyjCArfeZC4x9hfmrA80t9wgUaRjx5yvGOY"

echo "🔍 Проверяем аккаунты..."
curl -s http://localhost:3001/api/accounts -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, sessionId, username, isRunning}'

echo -e "\n📝 Отправляем сообщение от аккаунта 1 (Айлина) к аккаунту 2 (vibes)..."
echo "Username второго аккаунта: NsvjM1gvdZ"

# Отправляем команду на отправку сообщения
# chat_id для username - это сам username
curl -s -X POST http://localhost:3001/api/telegram/send-message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "208719581",
    "chatId": "NsvjM1gvdZ",
    "text": "Привет! Это тестовое сообщение от Айлины 👋"
  }' | jq '.'

echo -e "\n✅ Сообщение отправлено! Проверьте Telegram."
