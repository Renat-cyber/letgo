import { db } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import { sendNotification } from './telegram-bot.js';

export interface PatternAction {
  id?: number;
  type: 'click' | 'callback' | 'message' | 'like' | 'dislike' | 'wait' | 'next_profile';
  data: {
    buttonText?: string;
    callbackData?: string;
    messageText?: string;
    targetBot?: string;
    waitMs?: number;
    condition?: string;
  };
  sequenceOrder: number;
  delayAfterMs: number;
}

export interface Pattern {
  id?: number;
  name: string;
  description?: string;
  actions: PatternAction[];
  isActive: boolean;
  repeatCount: number;
  delayBetweenMs: number;
}

export interface PatternExecution {
  id: number;
  patternId: number;
  accountId: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  currentAction: number;
  errorMessage?: string;
}

// Хранилище активных записей паттернов
const activeRecordings: Map<number, PatternAction[]> = new Map();
const executionQueue: Map<string, PatternExecution> = new Map();

export function startPatternRecording(accountId: number): void {
  activeRecordings.set(accountId, []);
  console.log(`📹 Started pattern recording for account ${accountId}`);
}

export function recordAction(accountId: number, action: Omit<PatternAction, 'sequenceOrder'>): void {
  const actions = activeRecordings.get(accountId);
  if (!actions) {
    console.warn(`No active recording for account ${accountId}`);
    return;
  }
  
  const newAction: PatternAction = {
    ...action,
    sequenceOrder: actions.length + 1
  };
  
  actions.push(newAction);
  console.log(`📝 Recorded action #${newAction.sequenceOrder}: ${action.type}`);
}

export function stopPatternRecording(accountId: number, name: string, description?: string): Pattern | null {
  const actions = activeRecordings.get(accountId);
  if (!actions || actions.length === 0) {
    activeRecordings.delete(accountId);
    return null;
  }

  const pattern: Pattern = {
    name,
    description,
    actions,
    isActive: true,
    repeatCount: 1,
    delayBetweenMs: 1000
  };

  // Сохраняем в БД
  const result = db.prepare(`
    INSERT INTO patterns (name, description, actions, is_active, repeat_count, delay_between_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    pattern.name,
    pattern.description || null,
    JSON.stringify(pattern.actions),
    pattern.isActive ? 1 : 0,
    pattern.repeatCount,
    pattern.delayBetweenMs
  );

  pattern.id = result.lastInsertRowid as number;
  activeRecordings.delete(accountId);
  
  console.log(`✅ Pattern "${name}" saved with ${actions.length} actions`);
  return pattern;
}

export function isRecording(accountId: number): boolean {
  return activeRecordings.has(accountId);
}

export function getRecordedActions(accountId: number): PatternAction[] {
  return activeRecordings.get(accountId) || [];
}

export function getAllPatterns(): Pattern[] {
  const rows = db.prepare('SELECT * FROM patterns ORDER BY created_at DESC').all() as any[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    actions: JSON.parse(row.actions),
    isActive: row.is_active === 1,
    repeatCount: row.repeat_count,
    delayBetweenMs: row.delay_between_ms
  }));
}

export function getPatternById(id: number): Pattern | null {
  const row = db.prepare('SELECT * FROM patterns WHERE id = ?').get(id) as any;
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    actions: JSON.parse(row.actions),
    isActive: row.is_active === 1,
    repeatCount: row.repeat_count,
    delayBetweenMs: row.delay_between_ms
  };
}

export function updatePattern(id: number, updates: Partial<Pattern>): boolean {
  const current = getPatternById(id);
  if (!current) return false;

  const merged = { ...current, ...updates };
  
  db.prepare(`
    UPDATE patterns 
    SET name = ?, description = ?, actions = ?, is_active = ?, repeat_count = ?, delay_between_ms = ?
    WHERE id = ?
  `).run(
    merged.name,
    merged.description || null,
    JSON.stringify(merged.actions),
    merged.isActive ? 1 : 0,
    merged.repeatCount,
    merged.delayBetweenMs,
    id
  );

  return true;
}

export function deletePattern(id: number): boolean {
  const result = db.prepare('DELETE FROM patterns WHERE id = ?').run(id);
  return result.changes > 0;
}

export async function executePattern(
  patternId: number,
  accountId: number,
  actionExecutor: (action: PatternAction) => Promise<boolean>
): Promise<void> {
  const pattern = getPatternById(patternId);
  if (!pattern) {
    throw new Error('Pattern not found');
  }

  const { safetyManager } = await import('./safety.js');

  // Создаём запись выполнения
  const result = db.prepare(`
    INSERT INTO pattern_executions (pattern_id, account_id, status, started_at)
    VALUES (?, ?, 'running', CURRENT_TIMESTAMP)
  `).run(patternId, accountId);

  const executionId = result.lastInsertRowid as number;
  const executionKey = `${patternId}-${accountId}`;

  try {
    for (let repeat = 0; repeat < pattern.repeatCount; repeat++) {
      for (let i = 0; i < pattern.actions.length; i++) {
        const action = pattern.actions[i];
        
        // Проверка лимитов безопасности
        if (!safetyManager.canPerformAction(accountId, 'action')) {
          throw new Error('Action limit reached. Please wait before continuing.');
        }
        
        // Обновляем текущее действие
        db.prepare(`
          UPDATE pattern_executions SET current_action = ? WHERE id = ?
        `).run(i + 1, executionId);

        // Выполняем действие
        const success = await actionExecutor(action);
        
        if (!success) {
          throw new Error(`Action ${i + 1} (${action.type}) failed`);
        }

        // Логируем действие
        safetyManager.logAction(accountId, 'action');
        
        // Задержка после действия с рандомизацией
        const baseDelay = action.delayAfterMs > 0 ? action.delayAfterMs : 1000;
        const randomizedDelay = baseDelay + safetyManager.getRandomDelay();
        await sleep(randomizedDelay);
      }

      // Задержка между повторениями с рандомизацией
      if (repeat < pattern.repeatCount - 1) {
        const baseDelay = pattern.delayBetweenMs > 0 ? pattern.delayBetweenMs : 2000;
        const randomizedDelay = baseDelay + safetyManager.getRandomDelay();
        await sleep(randomizedDelay);
      }
    }

    // Успешное завершение
    db.prepare(`
      UPDATE pattern_executions 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(executionId);

    logEvent(accountId, 'info', 'pattern', `Pattern "${pattern.name}" completed successfully`);
  } catch (error: any) {
    // Ошибка выполнения
    db.prepare(`
      UPDATE pattern_executions 
      SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(error.message, executionId);

    const errorLog = logEvent(accountId, 'error', 'pattern', `Pattern "${pattern.name}" failed: ${error.message}`);
    
    // Отправляем уведомление
    await sendNotification(
      `❌ Ошибка паттерна "${pattern.name}"`,
      `Аккаунт: ${accountId}\nОшибка: ${error.message}`,
      errorLog.id
    );

    throw error;
  }
}

export function getPatternExecutions(accountId?: number, limit = 50): PatternExecution[] {
  let query = `
    SELECT pe.*, p.name as pattern_name
    FROM pattern_executions pe
    JOIN patterns p ON pe.pattern_id = p.id
  `;
  
  if (accountId) {
    query += ` WHERE pe.account_id = ?`;
  }
  
  query += ` ORDER BY pe.created_at DESC LIMIT ?`;
  
  const params = accountId ? [accountId, limit] : [limit];
  return db.prepare(query).all(...params) as PatternExecution[];
}

export function logEvent(
  accountId: number | null,
  level: 'info' | 'warning' | 'error' | 'critical',
  category: string,
  message: string,
  data?: any
): { id: number } {
  const result = db.prepare(`
    INSERT INTO logs (account_id, level, category, message, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(accountId, level, category, message, data ? JSON.stringify(data) : null);

  return { id: result.lastInsertRowid as number };
}

export function getLogs(filters?: {
  accountId?: number;
  level?: string;
  category?: string;
  limit?: number;
}): any[] {
  let query = 'SELECT * FROM logs WHERE 1=1';
  const params: any[] = [];

  if (filters?.accountId) {
    query += ' AND account_id = ?';
    params.push(filters.accountId);
  }
  if (filters?.level) {
    query += ' AND level = ?';
    params.push(filters.level);
  }
  if (filters?.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(filters?.limit || 100);

  return db.prepare(query).all(...params);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
