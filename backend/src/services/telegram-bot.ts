import TelegramBot from 'node-telegram-bot-api';
import { db, getSetting, setSetting } from '../db/schema.js';

let bot: TelegramBot | null = null;
let adminChatId: string | null = null;

export function initTelegramBot(): TelegramBot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }

  bot = new TelegramBot(token, { polling: true });
  adminChatId = getSetting('notification_chat_id');

  // Команда start - устанавливает чат для уведомлений
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    setSetting('notification_chat_id', chatId);
    adminChatId = chatId;
    
    const frontendUrl = getSetting('frontend_url') || 'https://tg-automation.vercel.app';
    
    await bot!.sendMessage(chatId, 
      `🤖 *TG Automation Panel*\n\n` +
      `Привет! Теперь ты будешь получать уведомления о работе системы.\n\n` +
      `📊 *Панель управления:*\n${frontendUrl}?token=${generateAccessToken(chatId)}\n\n` +
      `Команды:\n` +
      `/status - статус системы\n` +
      `/accounts - список аккаунтов\n` +
      `/patterns - список паттернов\n` +
      `/logs - последние логи\n` +
      `/panel - ссылка на панель`,
      { parse_mode: 'Markdown' }
    );
  });

  // Команда status
  bot.onText(/\/status/, async (msg) => {
    if (!isAdmin(msg.chat.id.toString())) return;
    
    const accounts = db.prepare('SELECT COUNT(*) as count FROM accounts WHERE is_active = 1').get() as any;
    const patterns = db.prepare('SELECT COUNT(*) as count FROM patterns WHERE is_active = 1').get() as any;
    const executions = db.prepare('SELECT COUNT(*) as count FROM pattern_executions WHERE status = "running"').get() as any;
    const errors = db.prepare('SELECT COUNT(*) as count FROM logs WHERE level = "error" AND created_at > datetime("now", "-24 hours")').get() as any;
    
    await bot!.sendMessage(msg.chat.id,
      `📊 *Статус системы*\n\n` +
      `👤 Активных аккаунтов: ${accounts.count}\n` +
      `📋 Активных паттернов: ${patterns.count}\n` +
      `▶️ Выполняется сейчас: ${executions.count}\n` +
      `❌ Ошибок за 24ч: ${errors.count}`,
      { parse_mode: 'Markdown' }
    );
  });

  // Команда accounts
  bot.onText(/\/accounts/, async (msg) => {
    if (!isAdmin(msg.chat.id.toString())) return;
    
    const accounts = db.prepare('SELECT * FROM accounts').all() as any[];
    
    if (accounts.length === 0) {
      await bot!.sendMessage(msg.chat.id, '📭 Нет добавленных аккаунтов');
      return;
    }

    let message = '👥 *Аккаунты:*\n\n';
    for (const acc of accounts) {
      const status = acc.is_active ? '🟢' : '🔴';
      const ai = acc.ai_enabled ? '🤖' : '';
      message += `${status} ${ai} *${acc.session_id}*\n`;
      if (acc.username) message += `   @${acc.username}\n`;
    }

    await bot!.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  // Команда patterns
  bot.onText(/\/patterns/, async (msg) => {
    if (!isAdmin(msg.chat.id.toString())) return;
    
    const patterns = db.prepare('SELECT * FROM patterns ORDER BY created_at DESC LIMIT 10').all() as any[];
    
    if (patterns.length === 0) {
      await bot!.sendMessage(msg.chat.id, '📭 Нет сохранённых паттернов');
      return;
    }

    let message = '📋 *Паттерны:*\n\n';
    for (const p of patterns) {
      const status = p.is_active ? '🟢' : '🔴';
      const actions = JSON.parse(p.actions).length;
      message += `${status} *${p.name}* (${actions} действий)\n`;
      if (p.description) message += `   ${p.description}\n`;
    }

    await bot!.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  // Команда logs
  bot.onText(/\/logs/, async (msg) => {
    if (!isAdmin(msg.chat.id.toString())) return;
    
    const logs = db.prepare(`
      SELECT * FROM logs 
      ORDER BY created_at DESC LIMIT 10
    `).all() as any[];
    
    if (logs.length === 0) {
      await bot!.sendMessage(msg.chat.id, '📭 Нет логов');
      return;
    }

    let message = '📜 *Последние логи:*\n\n';
    for (const log of logs) {
      const icon = log.level === 'error' ? '❌' : log.level === 'warning' ? '⚠️' : 'ℹ️';
      const time = new Date(log.created_at).toLocaleTimeString('ru-RU');
      message += `${icon} [${time}] ${log.message}\n`;
    }

    await bot!.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  // Команда panel
  bot.onText(/\/panel/, async (msg) => {
    if (!isAdmin(msg.chat.id.toString())) return;
    
    const frontendUrl = getSetting('frontend_url') || 'https://tg-automation.vercel.app';
    const token = generateAccessToken(msg.chat.id.toString());
    
    await bot!.sendMessage(msg.chat.id,
      `🖥 *Панель управления*\n\n${frontendUrl}?token=${token}`,
      { parse_mode: 'Markdown' }
    );
  });

  // Callback для действий с ошибками
  bot.on('callback_query', async (query) => {
    if (!query.data) return;
    
    const [action, ...params] = query.data.split(':');
    
    if (action === 'retry_pattern') {
      const [patternId, accountId] = params.map(Number);
      await bot!.answerCallbackQuery(query.id, { text: 'Перезапуск паттерна...' });
      // Здесь будет логика перезапуска
    }
    
    if (action === 'view_log') {
      const logId = params[0];
      const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(logId) as any;
      if (log) {
        await bot!.sendMessage(query.message!.chat.id,
          `📜 *Детали лога #${logId}*\n\n` +
          `Уровень: ${log.level}\n` +
          `Категория: ${log.category}\n` +
          `Сообщение: ${log.message}\n` +
          `Данные: ${log.data || 'нет'}\n` +
          `Время: ${log.created_at}`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  });

  console.log('🤖 Telegram bot initialized');
  return bot;
}

export async function sendNotification(
  title: string,
  message: string,
  logId?: number
): Promise<void> {
  if (!bot || !adminChatId) {
    console.warn('Bot or admin chat not configured, skipping notification');
    return;
  }

  const keyboard = logId ? {
    inline_keyboard: [[
      { text: '📜 Подробнее', callback_data: `view_log:${logId}` },
      { text: '🔄 Повторить', callback_data: `retry_pattern:${logId}` }
    ]]
  } : undefined;

  try {
    await bot.sendMessage(adminChatId, 
      `*${title}*\n\n${message}`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

export async function sendErrorAlert(
  accountId: number,
  error: string,
  context?: string
): Promise<void> {
  const frontendUrl = getSetting('frontend_url') || 'https://tg-automation.vercel.app';
  const fixUrl = `${frontendUrl}/accounts/${accountId}/fix`;
  
  await sendNotification(
    '❌ Ошибка',
    `Аккаунт: ${accountId}\n` +
    `Ошибка: ${error}\n` +
    (context ? `Контекст: ${context}\n` : '') +
    `\n🔧 [Исправить](${fixUrl})`
  );
}

function isAdmin(chatId: string): boolean {
  return chatId === adminChatId;
}

function generateAccessToken(chatId: string): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { chatId, role: 'admin' },
    process.env.JWT_SECRET || 'default_secret',
    { expiresIn: '30d' }
  );
}

export function getBot(): TelegramBot | null {
  return bot;
}
