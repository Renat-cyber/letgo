import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../data/automation.db');

export const db = new Database(dbPath);

export function initializeDatabase() {
  db.exec(`
    -- Аккаунты Telegram
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      phone TEXT,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      is_active INTEGER DEFAULT 1,
      ai_enabled INTEGER DEFAULT 0,
      system_prompt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Паттерны действий
    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      actions TEXT NOT NULL, -- JSON массив действий
      is_active INTEGER DEFAULT 1,
      repeat_count INTEGER DEFAULT 1,
      delay_between_ms INTEGER DEFAULT 1000,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Записанные действия для паттернов
    CREATE TABLE IF NOT EXISTS pattern_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern_id INTEGER,
      action_type TEXT NOT NULL, -- 'click', 'callback', 'message', 'like', 'dislike'
      action_data TEXT NOT NULL, -- JSON с данными действия
      sequence_order INTEGER NOT NULL,
      delay_after_ms INTEGER DEFAULT 500,
      FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
    );

    -- Диалоги и контекст общения
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      chat_id TEXT NOT NULL,
      peer_user_id TEXT,
      peer_username TEXT,
      peer_first_name TEXT,
      peer_description TEXT,
      last_message_at DATETIME,
      is_active INTEGER DEFAULT 1,
      ai_mode INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(account_id, chat_id)
    );

    -- История сообщений для контекста AI
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL, -- 'user', 'assistant', 'system'
      content TEXT NOT NULL,
      raw_data TEXT, -- JSON с оригинальными данными сообщения
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    -- Выполнение паттернов
    CREATE TABLE IF NOT EXISTS pattern_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
      current_action INTEGER DEFAULT 0,
      error_message TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    -- Логи ошибок и событий
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      level TEXT NOT NULL, -- 'info', 'warning', 'error', 'critical'
      category TEXT NOT NULL, -- 'pattern', 'ai', 'telegram', 'system'
      message TEXT NOT NULL,
      data TEXT, -- JSON с дополнительными данными
      notified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
    );

    -- Настройки системы
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Профили пользователей из бота знакомств (для запоминания)
    CREATE TABLE IF NOT EXISTS dating_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      target_user_id TEXT NOT NULL,
      name TEXT,
      age INTEGER,
      description TEXT,
      photos TEXT, -- JSON массив URL фото
      action_taken TEXT, -- 'like', 'dislike', 'skip'
      matched INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(account_id, target_user_id)
    );

    -- Индексы для производительности
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_account ON conversations(account_id);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
    CREATE INDEX IF NOT EXISTS idx_pattern_executions_status ON pattern_executions(status);
  `);

  // Дефолтные настройки
  const defaultSettings = [
    ['default_system_prompt', `ты зумер которому всегда скучно. пишешь только маленькими буквами, без точек в конце предложений. используешь сленг типа "чел", "кринж", "вайб", "рофл", "имба". отвечаешь коротко и немного лениво. иногда вставляешь "хз", "мб", "лол". не ставишь знаки препинания кроме вопросительных знаков иногда. тебе как будто всё равно но при этом ты отвечаешь`],
    ['ai_temperature', '0.9'],
    ['ai_max_tokens', '150'],
    ['pattern_default_delay', '1500'],
    ['notification_chat_id', ''],
    ['safety_min_delay', '3000'],
    ['safety_max_delay', '8000'],
    ['safety_actions_per_hour', '30'],
    ['safety_messages_per_hour', '20'],
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  console.log('✅ Database initialized successfully');
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, value);
}
