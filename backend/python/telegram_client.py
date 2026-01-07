#!/usr/bin/env python3
"""
Telegram Client for automation.
Communicates with Node.js backend via stdin/stdout JSON.
"""

import sys
import json
import asyncio
import os
from telethon import TelegramClient, events
from telethon.tl.types import (
    KeyboardButtonCallback,
    ReplyKeyboardMarkup,
    KeyboardButton,
    MessageMediaPhoto
)
from telethon.tl.functions.messages import GetBotCallbackAnswerRequest

# Бот знакомств "Лео дай впнчик"
DATING_BOT_USERNAME = "leodayvpnchik_bot"
DATING_BOT_ID = None  # Will be resolved

# API credentials (нужно указать свои)
API_ID = 28596352  # Замените на свой api_id
API_HASH = "ba5785db0c13102a7e3ad6fa89f4c219"  # Замените на свой api_hash


def output(data: dict):
    """Send JSON to stdout for Node.js"""
    print(json.dumps(data), flush=True)


def log(message: str):
    """Log to stderr"""
    print(f"[PY] {message}", file=sys.stderr, flush=True)


class TelegramAutomation:
    def __init__(self, session_id: str, sessions_path: str):
        self.session_id = session_id
        self.session_file = os.path.join(sessions_path, f"{session_id}_telethon")
        self.client: TelegramClient = None
        self.running = True
        self.last_message_id = {}  # chat_id -> message_id
        
    async def start(self):
        log(f"Starting client for session {self.session_id}")
        
        self.client = TelegramClient(self.session_file, API_ID, API_HASH)
        await self.client.start()
        
        me = await self.client.get_me()
        log(f"Logged in as {me.first_name} (@{me.username})")
        
        output({
            "type": "connected",
            "sessionId": self.session_id,
            "data": {
                "user_id": me.id,
                "username": me.username,
                "first_name": me.first_name,
                "last_name": me.last_name,
                "phone": me.phone
            }
        })
        
        # Setup event handlers
        self.setup_handlers()
        
        # Start command listener
        asyncio.create_task(self.command_listener())
        
        # Keep running
        await self.client.run_until_disconnected()
    
    def setup_handlers(self):
        @self.client.on(events.NewMessage)
        async def on_message(event):
            try:
                sender = await event.get_sender()
                chat = await event.get_chat()
                
                # Store last message id for this chat
                self.last_message_id[chat.id] = event.id
                
                # Check if from dating bot
                is_dating_bot = (
                    hasattr(sender, 'username') and 
                    sender.username and 
                    sender.username.lower() == DATING_BOT_USERNAME.lower()
                )
                
                message_data = {
                    "type": "message",
                    "sessionId": self.session_id,
                    "data": {
                        "message_id": event.id,
                        "chat_id": chat.id,
                        "sender_id": sender.id if sender else None,
                        "sender_username": sender.username if sender else None,
                        "sender_name": getattr(sender, 'first_name', '') if sender else None,
                        "text": event.raw_text,
                        "is_bot": getattr(sender, 'bot', False) if sender else False,
                        "is_dating_bot": is_dating_bot,
                        "has_buttons": event.buttons is not None
                    }
                }
                
                # If has inline buttons, extract them
                if event.buttons:
                    buttons = []
                    for row in event.buttons:
                        row_buttons = []
                        for btn in row:
                            btn_data = {"text": btn.text}
                            if hasattr(btn, 'data') and btn.data:
                                btn_data["callback_data"] = btn.data.decode() if isinstance(btn.data, bytes) else btn.data
                            row_buttons.append(btn_data)
                        buttons.append(row_buttons)
                    message_data["data"]["buttons"] = buttons
                
                # If from dating bot, try to parse profile
                if is_dating_bot:
                    profile = self.parse_dating_profile(event.raw_text)
                    if profile:
                        output({
                            "type": "profile",
                            "sessionId": self.session_id,
                            "data": profile
                        })
                
                output(message_data)
                
            except Exception as e:
                log(f"Error handling message: {e}")
        
        @self.client.on(events.CallbackQuery)
        async def on_callback(event):
            try:
                output({
                    "type": "callback",
                    "sessionId": self.session_id,
                    "data": {
                        "callback_data": event.data.decode() if isinstance(event.data, bytes) else event.data,
                        "message_id": event.message_id,
                        "chat_id": event.chat_id
                    }
                })
            except Exception as e:
                log(f"Error handling callback: {e}")
    
    def parse_dating_profile(self, text: str) -> dict | None:
        """Parse dating bot profile from message text"""
        if not text:
            return None
            
        lines = text.strip().split('\n')
        if len(lines) < 2:
            return None
        
        # Try to extract name and age from first line
        # Format usually: "Name, Age"
        first_line = lines[0]
        name = None
        age = None
        
        if ',' in first_line:
            parts = first_line.split(',')
            name = parts[0].strip()
            try:
                age = int(parts[1].strip())
            except:
                pass
        else:
            name = first_line.strip()
        
        # Rest is description
        description = '\n'.join(lines[1:]).strip() if len(lines) > 1 else None
        
        if name:
            return {
                "name": name,
                "age": age,
                "description": description
            }
        
        return None
    
    async def command_listener(self):
        """Listen for commands from Node.js via stdin"""
        loop = asyncio.get_event_loop()
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await loop.connect_read_pipe(lambda: protocol, sys.stdin)
        
        while self.running:
            try:
                line = await reader.readline()
                if not line:
                    break
                
                command = json.loads(line.decode().strip())
                await self.handle_command(command)
                
            except json.JSONDecodeError:
                continue
            except Exception as e:
                log(f"Command error: {e}")
    
    async def handle_command(self, command: dict):
        """Handle command from Node.js"""
        action = command.get("action")
        
        try:
            if action == "send_message":
                chat_id = command["chat_id"]
                text = command["text"]
                msg = await self.client.send_message(int(chat_id), text)
                self.last_message_id[int(chat_id)] = msg.id
                log(f"Sent message to {chat_id}")
                
            elif action == "click_button":
                chat_id = int(command["chat_id"])
                message_id = command.get("message_id") or self.last_message_id.get(chat_id)
                callback_data = command["callback_data"]
                
                if message_id:
                    msg = await self.client.get_messages(chat_id, ids=message_id)
                    if msg and msg.buttons:
                        for row in msg.buttons:
                            for btn in row:
                                btn_data = btn.data.decode() if isinstance(btn.data, bytes) else btn.data
                                if btn_data == callback_data:
                                    await btn.click()
                                    log(f"Clicked button: {callback_data}")
                                    return
                log(f"Button not found: {callback_data}")
                
            elif action == "click_reply_button":
                chat_id = int(command["chat_id"])
                button_text = command["button_text"]
                await self.client.send_message(chat_id, button_text)
                log(f"Clicked reply button: {button_text}")
                
            elif action == "sync_dialogs":
                # Синхронизация диалогов
                dialogs = await self.client.get_dialogs(limit=50)
                for dialog in dialogs:
                    if dialog.is_user or dialog.is_group or dialog.is_channel:
                        emit_event({
                            "type": "dialog_synced",
                            "chat_id": dialog.id,
                            "name": dialog.name or "Unknown",
                            "is_user": dialog.is_user,
                            "is_group": dialog.is_group,
                            "unread_count": dialog.unread_count
                        })
                log(f"Synced {len(dialogs)} dialogs")
                
            elif action == "like":
                chat_id = int(command["chat_id"])
                # Usually "❤️" or "👍" button
                await self.click_dating_button(chat_id, ["❤️", "👍", "like", "лайк"])
                
            elif action == "dislike":
                chat_id = int(command["chat_id"])
                # Usually "👎" or "❌" button
                await self.click_dating_button(chat_id, ["👎", "❌", "dislike", "дизлайк", "пропустить"])
                
            elif action == "next_profile":
                chat_id = int(command["chat_id"])
                await self.click_dating_button(chat_id, ["➡️", "дальше", "next", "следующий"])
                
            elif action == "stop":
                self.running = False
                await self.client.disconnect()
                
        except Exception as e:
            output({
                "type": "error",
                "sessionId": self.session_id,
                "data": {"message": str(e), "action": action}
            })
            log(f"Command error: {e}")
    
    async def click_dating_button(self, chat_id: int, possible_texts: list):
        """Click a button in dating bot by text matching"""
        message_id = self.last_message_id.get(chat_id)
        if not message_id:
            log(f"No last message for chat {chat_id}")
            return
        
        msg = await self.client.get_messages(chat_id, ids=message_id)
        if not msg or not msg.buttons:
            log(f"No buttons in message {message_id}")
            return
        
        for row in msg.buttons:
            for btn in row:
                btn_text = btn.text.lower() if btn.text else ""
                for text in possible_texts:
                    if text.lower() in btn_text:
                        await btn.click()
                        log(f"Clicked dating button: {btn.text}")
                        return
        
        log(f"Dating button not found: {possible_texts}")


async def main():
    if len(sys.argv) < 3:
        print("Usage: python telegram_client.py <session_id> <sessions_path>", file=sys.stderr)
        sys.exit(1)
    
    session_id = sys.argv[1]
    sessions_path = sys.argv[2]
    
    automation = TelegramAutomation(session_id, sessions_path)
    await automation.start()


if __name__ == "__main__":
    asyncio.run(main())
