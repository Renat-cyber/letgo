import { db } from '../db/schema.js';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Account {
  id: number;
  sessionId: string;
  phone?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  aiEnabled: boolean;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: number;
  accountId: number;
  chatId: string;
  peerUserId?: string;
  peerUsername?: string;
  peerFirstName?: string;
  peerDescription?: string;
  lastMessageAt?: string;
  isActive: boolean;
  aiMode: boolean;
}

export function getSessionsPath(): string {
  return process.env.SESSIONS_PATH || join(__dirname, '../../../');
}

export function discoverSessions(): string[] {
  const sessionsPath = getSessionsPath();
  
  try {
    const files = readdirSync(sessionsPath);
    return files
      .filter((f: string) => f.endsWith('_telethon.session'))
      .map((f: string) => f.replace('_telethon.session', ''));
  } catch (error) {
    console.error('Error discovering sessions:', error);
    return [];
  }
}

export function syncAccountsFromSessions(): Account[] {
  const sessionIds = discoverSessions();
  const accounts: Account[] = [];

  for (const sessionId of sessionIds) {
    // Проверяем существует ли уже в БД
    const existing = db.prepare('SELECT * FROM accounts WHERE session_id = ?').get(sessionId) as any;
    
    if (!existing) {
      // Добавляем новый аккаунт
      const result = db.prepare(`
        INSERT INTO accounts (session_id, is_active, ai_enabled)
        VALUES (?, 1, 0)
      `).run(sessionId);
      
      accounts.push({
        id: result.lastInsertRowid as number,
        sessionId,
        isActive: true,
        aiEnabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      accounts.push(mapAccount(existing));
    }
  }

  return accounts;
}

export function getAllAccounts(): Account[] {
  const rows = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all() as any[];
  return rows.map(mapAccount);
}

export function getAccountById(id: number): Account | null {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
  return row ? mapAccount(row) : null;
}

export function getAccountBySessionId(sessionId: string): Account | null {
  const row = db.prepare('SELECT * FROM accounts WHERE session_id = ?').get(sessionId) as any;
  return row ? mapAccount(row) : null;
}

export function updateAccount(id: number, updates: Partial<Account>): boolean {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }
  if (updates.aiEnabled !== undefined) {
    fields.push('ai_enabled = ?');
    values.push(updates.aiEnabled ? 1 : 0);
  }
  if (updates.systemPrompt !== undefined) {
    fields.push('system_prompt = ?');
    values.push(updates.systemPrompt);
  }
  if (updates.phone !== undefined) {
    fields.push('phone = ?');
    values.push(updates.phone);
  }
  if (updates.username !== undefined) {
    fields.push('username = ?');
    values.push(updates.username);
  }
  if (updates.firstName !== undefined) {
    fields.push('first_name = ?');
    values.push(updates.firstName);
  }
  if (updates.lastName !== undefined) {
    fields.push('last_name = ?');
    values.push(updates.lastName);
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const result = db.prepare(`
    UPDATE accounts SET ${fields.join(', ')} WHERE id = ?
  `).run(...values);

  return result.changes > 0;
}

export function deleteAccount(id: number): boolean {
  const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  return result.changes > 0;
}

// Conversations
export function getConversations(accountId: number): Conversation[] {
  const rows = db.prepare(`
    SELECT * FROM conversations 
    WHERE account_id = ? 
    ORDER BY last_message_at DESC
  `).all(accountId) as any[];
  return rows.map(mapConversation);
}

export function getConversation(accountId: number, chatId: string): Conversation | null {
  const row = db.prepare(`
    SELECT * FROM conversations WHERE account_id = ? AND chat_id = ?
  `).get(accountId, chatId) as any;
  return row ? mapConversation(row) : null;
}

export function getConversationById(id: number): Conversation | null {
  const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
  return row ? mapConversation(row) : null;
}

export function createOrUpdateConversation(
  accountId: number,
  chatId: string,
  peerData: Partial<Conversation>
): Conversation {
  const existing = getConversation(accountId, chatId);
  
  if (existing) {
    // Update
    const fields: string[] = [];
    const values: any[] = [];
    
    if (peerData.peerUserId) { fields.push('peer_user_id = ?'); values.push(peerData.peerUserId); }
    if (peerData.peerUsername) { fields.push('peer_username = ?'); values.push(peerData.peerUsername); }
    if (peerData.peerFirstName) { fields.push('peer_first_name = ?'); values.push(peerData.peerFirstName); }
    if (peerData.peerDescription) { fields.push('peer_description = ?'); values.push(peerData.peerDescription); }
    if (peerData.aiMode !== undefined) { fields.push('ai_mode = ?'); values.push(peerData.aiMode ? 1 : 0); }
    
    if (fields.length > 0) {
      values.push(existing.id);
      db.prepare(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    
    return getConversationById(existing.id)!;
  } else {
    // Create
    const result = db.prepare(`
      INSERT INTO conversations (account_id, chat_id, peer_user_id, peer_username, peer_first_name, peer_description, ai_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      accountId,
      chatId,
      peerData.peerUserId || null,
      peerData.peerUsername || null,
      peerData.peerFirstName || null,
      peerData.peerDescription || null,
      peerData.aiMode !== false ? 1 : 0
    );
    
    return getConversationById(result.lastInsertRowid as number)!;
  }
}

export function updateConversationAiMode(conversationId: number, aiMode: boolean): boolean {
  const result = db.prepare('UPDATE conversations SET ai_mode = ? WHERE id = ?').run(aiMode ? 1 : 0, conversationId);
  return result.changes > 0;
}

export function getMessages(conversationId: number, limit = 50): any[] {
  return db.prepare(`
    SELECT * FROM messages 
    WHERE conversation_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(conversationId, limit);
}

export function addMessage(conversationId: number, role: string, content: string, rawData?: any): number {
  const result = db.prepare(`
    INSERT INTO messages (conversation_id, role, content, raw_data)
    VALUES (?, ?, ?, ?)
  `).run(conversationId, role, content, rawData ? JSON.stringify(rawData) : null);
  
  // Update last message time
  db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);
  
  return result.lastInsertRowid as number;
}

// Dating profiles
export function saveDatingProfile(
  accountId: number,
  targetUserId: string,
  data: {
    name?: string;
    age?: number;
    description?: string;
    photos?: string[];
    actionTaken?: string;
    matched?: boolean;
  }
): void {
  db.prepare(`
    INSERT INTO dating_profiles (account_id, target_user_id, name, age, description, photos, action_taken, matched)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, target_user_id) DO UPDATE SET
      name = COALESCE(excluded.name, name),
      age = COALESCE(excluded.age, age),
      description = COALESCE(excluded.description, description),
      photos = COALESCE(excluded.photos, photos),
      action_taken = COALESCE(excluded.action_taken, action_taken),
      matched = COALESCE(excluded.matched, matched)
  `).run(
    accountId,
    targetUserId,
    data.name || null,
    data.age || null,
    data.description || null,
    data.photos ? JSON.stringify(data.photos) : null,
    data.actionTaken || null,
    data.matched ? 1 : 0
  );
}

export function getDatingProfiles(accountId: number, limit = 100): any[] {
  return db.prepare(`
    SELECT * FROM dating_profiles 
    WHERE account_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(accountId, limit);
}

// Helpers
function mapAccount(row: any): Account {
  return {
    id: row.id,
    sessionId: row.session_id,
    phone: row.phone,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    isActive: row.is_active === 1,
    aiEnabled: row.ai_enabled === 1,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapConversation(row: any): Conversation {
  return {
    id: row.id,
    accountId: row.account_id,
    chatId: row.chat_id,
    peerUserId: row.peer_user_id,
    peerUsername: row.peer_username,
    peerFirstName: row.peer_first_name,
    peerDescription: row.peer_description,
    lastMessageAt: row.last_message_at,
    isActive: row.is_active === 1,
    aiMode: row.ai_mode === 1
  };
}
