import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/schema.js';
import { generateAIResponse } from './ai.js';
import { 
  getAccountBySessionId, 
  createOrUpdateConversation, 
  addMessage,
  saveDatingProfile,
  getConversation
} from './accounts.js';
import { recordAction, isRecording } from './patterns.js';
import { sendNotification } from './telegram-bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TelegramEvent {
  type: 'message' | 'callback' | 'button_click' | 'profile' | 'match' | 'error' | 'dialog_synced';
  sessionId: string;
  data: any;
}

class TelegramClientManager extends EventEmitter {
  private clients: Map<string, ChildProcess> = new Map();
  private messageQueues: Map<string, any[]> = new Map();

  async startClient(sessionId: string): Promise<void> {
    if (this.clients.has(sessionId)) {
      console.log(`Client ${sessionId} already running`);
      return;
    }

    const sessionsPath = process.env.SESSIONS_PATH || join(__dirname, '../../../');
    const pythonScript = join(__dirname, '../../python/telegram_client.py');

    const client = spawn('python3', [pythonScript, sessionId, sessionsPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    client.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as TelegramEvent;
          this.handleEvent(event);
        } catch {
          console.log(`[${sessionId}] ${line}`);
        }
      }
    });

    client.stderr?.on('data', (data) => {
      console.error(`[${sessionId}] Error: ${data}`);
    });

    client.on('close', (code) => {
      console.log(`[${sessionId}] Client exited with code ${code}`);
      this.clients.delete(sessionId);
      
      // Автоматический перезапуск при неожиданном выходе
      if (code !== 0) {
        sendNotification(
          '⚠️ Клиент отключился',
          `Аккаунт ${sessionId} отключился с кодом ${code}`
        );
        setTimeout(() => this.startClient(sessionId), 5000);
      }
    });

    this.clients.set(sessionId, client);
    console.log(`✅ Started client for ${sessionId}`);
  }

  async stopClient(sessionId: string): Promise<void> {
    const client = this.clients.get(sessionId);
    if (client) {
      client.kill();
      this.clients.delete(sessionId);
      console.log(`⏹ Stopped client for ${sessionId}`);
    }
  }

  async stopAllClients(): Promise<void> {
    for (const sessionId of this.clients.keys()) {
      await this.stopClient(sessionId);
    }
  }

  sendCommand(sessionId: string, command: any): void {
    const client = this.clients.get(sessionId);
    if (client && client.stdin) {
      client.stdin.write(JSON.stringify(command) + '\n');
    }
  }

  // Отправить сообщение
  async sendMessage(sessionId: string, chatId: string, text: string): Promise<void> {
    this.sendCommand(sessionId, {
      action: 'send_message',
      chat_id: chatId,
      text
    });
  }

  // Нажать кнопку (inline callback)
  async clickButton(sessionId: string, chatId: string, messageId: number, callbackData: string): Promise<void> {
    this.sendCommand(sessionId, {
      action: 'click_button',
      chat_id: chatId,
      message_id: messageId,
      callback_data: callbackData
    });
  }

  // Нажать reply keyboard кнопку
  async clickReplyButton(sessionId: string, chatId: string, buttonText: string): Promise<void> {
    this.sendCommand(sessionId, {
      action: 'click_reply_button',
      chat_id: chatId,
      button_text: buttonText
    });
  }

  // Лайк в боте знакомств
  async like(sessionId: string, chatId: string): Promise<void> {
    this.sendCommand(sessionId, {
      action: 'like',
      chat_id: chatId
    });
  }

  // Дизлайк в боте знакомств
  async dislike(sessionId: string, chatId: string): Promise<void> {
    this.sendCommand(sessionId, {
      action: 'dislike',
      chat_id: chatId
    });
  }

  // Получить следующий профиль
  async nextProfile(sessionId: string, chatId: string): Promise<void> {
    this.sendCommand(sessionId, {
      action: 'next_profile',
      chat_id: chatId
    });
  }

  isClientRunning(sessionId: string): boolean {
    return this.clients.has(sessionId);
  }

  getRunningClients(): string[] {
    return Array.from(this.clients.keys());
  }

  private async handleEvent(event: TelegramEvent): Promise<void> {
    const { type, sessionId, data } = event;
    
    // Emit for WebSocket broadcast
    this.emit('telegram_event', event);

    const account = getAccountBySessionId(sessionId);
    if (!account) {
      console.warn(`Unknown session: ${sessionId}`);
      return;
    }

    // Записываем действие если идёт запись паттерна
    if (isRecording(account.id) && (type === 'callback' || type === 'button_click')) {
      recordAction(account.id, {
        type: type === 'callback' ? 'callback' : 'click',
        data: {
          callbackData: data.callback_data,
          buttonText: data.button_text,
          targetBot: data.chat_id
        },
        delayAfterMs: 500
      });
    }

    switch (type) {
      case 'message':
        await this.handleMessage(account, data);
        break;
      case 'callback':
        console.log(`[${sessionId}] Callback: ${data.callback_data}`);
        break;
      case 'profile':
        await this.handleProfile(account, data);
        break;
      case 'match':
        await this.handleMatch(account, data);
        break;
      case 'dialog_synced':
        await this.handleDialogSynced(account, data);
        break;
      case 'error':
        sendNotification('❌ Ошибка клиента', `${sessionId}: ${data.message}`);
        break;
    }
  }

  private async handleMessage(account: any, data: any): Promise<void> {
    const chatId = data.chat_id.toString();
    const senderId = data.sender_id?.toString();
    const text = data.text || '';

    // Создаём/обновляем диалог
    const conversation = createOrUpdateConversation(account.id, chatId, {
      peerUserId: senderId,
      peerUsername: data.sender_username,
      peerFirstName: data.sender_name
    });

    // Сохраняем сообщение
    addMessage(conversation.id, 'user', text, data);

    // Проверяем AI режим
    if (account.aiEnabled && conversation.aiMode) {
      try {
        const response = await generateAIResponse(conversation.id, text);
        
        // Отправляем ответ
        await this.sendMessage(account.sessionId, chatId, response);
        
        // Сохраняем ответ
        addMessage(conversation.id, 'assistant', response);
        
        console.log(`[${account.sessionId}] AI reply: ${response}`);
      } catch (error: any) {
        console.error(`AI error for ${account.sessionId}:`, error);
      }
    }
  }

  private async handleProfile(account: any, data: any): Promise<void> {
    // Сохраняем профиль из бота знакомств
    saveDatingProfile(account.id, data.user_id, {
      name: data.name,
      age: data.age,
      description: data.description,
      photos: data.photos
    });

    console.log(`[${account.sessionId}] New profile: ${data.name}, ${data.age}`);
  }

  private async handleMatch(account: any, data: any): Promise<void> {
    // Обновляем статус матча
    saveDatingProfile(account.id, data.user_id, {
      matched: true
    });

    sendNotification(
      '💕 Новый матч!',
      `Аккаунт: ${account.sessionId}\nИмя: ${data.name}`
    );
  }

  private async handleDialogSynced(account: any, data: any): Promise<void> {
    // Сохраняем синхронизированный диалог
    const chatId = data.chat_id.toString();
    const name = data.name || 'Unknown';
    
    createOrUpdateConversation(account.id, chatId, {
      peerUsername: name,
      peerFirstName: name
    });

    console.log(`[${account.sessionId}] Synced dialog: ${name} (${chatId})`);
  }
}

export const telegramManager = new TelegramClientManager();
