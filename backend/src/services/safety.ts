import { db, getSetting } from '../db/schema.js';

interface ActionLog {
  accountId: number;
  timestamp: number;
  type: 'message' | 'action' | 'pattern';
}

class SafetyManager {
  private actionLogs: Map<number, ActionLog[]> = new Map();

  /**
   * Получить случайную задержку в безопасном диапазоне
   */
  getRandomDelay(): number {
    const minDelay = parseInt(getSetting('safety_min_delay') || '3000');
    const maxDelay = parseInt(getSetting('safety_max_delay') || '8000');
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  }

  /**
   * Проверить, можно ли выполнить действие (не превышен ли лимит)
   */
  canPerformAction(accountId: number, type: 'message' | 'action'): boolean {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Очистка старых логов
    this.cleanOldLogs(accountId, oneHourAgo);

    const logs = this.actionLogs.get(accountId) || [];
    
    // Проверка лимитов
    const actionsPerHour = parseInt(getSetting('safety_actions_per_hour') || '30');
    const messagesPerHour = parseInt(getSetting('safety_messages_per_hour') || '20');

    const recentActions = logs.filter(log => log.type === 'action').length;
    const recentMessages = logs.filter(log => log.type === 'message').length;

    if (type === 'action' && recentActions >= actionsPerHour) {
      console.warn(`⚠️ Account ${accountId}: Action limit reached (${recentActions}/${actionsPerHour})`);
      return false;
    }

    if (type === 'message' && recentMessages >= messagesPerHour) {
      console.warn(`⚠️ Account ${accountId}: Message limit reached (${recentMessages}/${messagesPerHour})`);
      return false;
    }

    return true;
  }

  /**
   * Зарегистрировать выполненное действие
   */
  logAction(accountId: number, type: 'message' | 'action' | 'pattern'): void {
    if (!this.actionLogs.has(accountId)) {
      this.actionLogs.set(accountId, []);
    }

    const logs = this.actionLogs.get(accountId)!;
    logs.push({
      accountId,
      timestamp: Date.now(),
      type
    });

    // Сохраняем в БД для статистики
    db.prepare(`
      INSERT INTO logs (level, message, account_id, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run('info', `Action performed: ${type}`, accountId);
  }

  /**
   * Очистить старые логи (старше 1 часа)
   */
  private cleanOldLogs(accountId: number, cutoffTime: number): void {
    const logs = this.actionLogs.get(accountId);
    if (!logs) return;

    const filtered = logs.filter(log => log.timestamp >= cutoffTime);
    this.actionLogs.set(accountId, filtered);
  }

  /**
   * Получить статистику по аккаунту
   */
  getAccountStats(accountId: number): {
    actionsLastHour: number;
    messagesLastHour: number;
    patternsLastHour: number;
    canSendMessage: boolean;
    canPerformAction: boolean;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    this.cleanOldLogs(accountId, oneHourAgo);
    
    const logs = this.actionLogs.get(accountId) || [];
    
    return {
      actionsLastHour: logs.filter(log => log.type === 'action').length,
      messagesLastHour: logs.filter(log => log.type === 'message').length,
      patternsLastHour: logs.filter(log => log.type === 'pattern').length,
      canSendMessage: this.canPerformAction(accountId, 'message'),
      canPerformAction: this.canPerformAction(accountId, 'action')
    };
  }

  /**
   * Сбросить лимиты для аккаунта (для тестирования)
   */
  resetLimits(accountId: number): void {
    this.actionLogs.delete(accountId);
    console.log(`🔄 Limits reset for account ${accountId}`);
  }

  /**
   * Задержка с рандомизацией (для использования в async функциях)
   */
  async randomDelay(): Promise<void> {
    const delay = this.getRandomDelay();
    console.log(`⏱️ Waiting ${delay}ms for safety...`);
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

export const safetyManager = new SafetyManager();
