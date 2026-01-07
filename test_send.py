#!/usr/bin/env python3
import asyncio
from telethon import TelegramClient
import sys

# API credentials
API_ID = 28596352
API_HASH = "ba5785db0c13102a7e3ad6fa89f4c219"

# Сессия первого аккаунта (Айлина)
session_file = '208719581_telethon'

async def send_test_message():
    # Создаем клиент
    client = TelegramClient(session_file, API_ID, API_HASH)
    
    try:
        await client.connect()
        
        if not await client.is_user_authorized():
            print("❌ Сессия не авторизована")
            return
        
        me = await client.get_me()
        print(f"✅ Залогинен как: {me.first_name} (@{me.username})")
        
        # Пробуем отправить сообщение по username второго аккаунта
        target_username = "ailinka_ya"  # Попробуем отправить самой себе для теста
        print(f"\n📤 Отправляем сообщение пользователю @{target_username}")
        
        try:
            # Получаем entity по username
            target_user = await client.get_entity(target_username)
            print(f"✅ Найден пользователь: {target_user.first_name or 'Unknown'} (@{target_user.username}) ID: {target_user.id}")
            
            message_text = "Привет! Это тестовое сообщение от Айлины 👋 Проверяю работу системы!"
            
            message = await client.send_message(target_user, message_text)
            print(f"✅ Сообщение отправлено! ID: {message.id}")
            
            # Получаем последние сообщения
            print(f"\n📬 Последние 5 сообщений в диалоге:")
            async for msg in client.iter_messages(target_user, limit=5):
                sender = "Я" if msg.out else (target_user.first_name or "Unknown")
                text = msg.text[:60] if msg.text else '[медиа]'
                date = msg.date.strftime("%H:%M:%S")
                print(f"  [{date}] [{sender}]: {text}")
                
        except Exception as e:
            print(f"❌ Ошибка при отправке: {e}")
            print(f"\n💡 Возможные причины:")
            print(f"   1. Пользователь заблокировал вас")
            print(f"   2. Пользователь не существует")
            print(f"   3. Нужно сначала написать ему вручную")
        
    finally:
        await client.disconnect()

if __name__ == '__main__':
    asyncio.run(send_test_message())
