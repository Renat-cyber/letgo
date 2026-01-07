import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db, getSetting, setSetting } from '../db/schema.js';
import { 
  getAllAccounts, 
  getAccountById, 
  updateAccount, 
  syncAccountsFromSessions,
  getConversations,
  getConversationById,
  getMessages,
  addMessage,
  updateConversationAiMode,
  getDatingProfiles
} from '../services/accounts.js';
import { 
  getAllPatterns, 
  getPatternById, 
  updatePattern, 
  deletePattern,
  startPatternRecording,
  stopPatternRecording,
  isRecording,
  getRecordedActions,
  getLogs
} from '../services/patterns.js';
import { telegramManager } from '../services/telegram-client.js';
import { generateAIResponse } from '../services/ai.js';

export const router = Router();

// Auth middleware
function authMiddleware(req: Request, res: Response, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Login
router.post('/auth/login', async (req: Request, res: Response) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

  if (password === adminPassword) {
    const token = jwt.sign(
      { role: 'admin' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '30d' }
    );
    return res.json({ token });
  }

  return res.status(401).json({ error: 'Invalid password' });
});

// Verify token
router.get('/auth/verify', authMiddleware, (req: Request, res: Response) => {
  res.json({ valid: true, user: (req as any).user });
});

// Apply auth to all routes below
router.use(authMiddleware);

// ============ ACCOUNTS ============

router.get('/accounts', (req: Request, res: Response) => {
  const accounts = getAllAccounts();
  const running = telegramManager.getRunningClients();
  
  const result = accounts.map(acc => ({
    ...acc,
    isRunning: running.includes(acc.sessionId),
    isRecording: isRecording(acc.id)
  }));
  
  res.json(result);
});

router.get('/accounts/sync', (req: Request, res: Response) => {
  const accounts = syncAccountsFromSessions();
  res.json(accounts);
});

router.get('/accounts/:id', (req: Request, res: Response) => {
  const account = getAccountById(parseInt(req.params.id));
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  res.json(account);
});

router.patch('/accounts/:id', (req: Request, res: Response) => {
  const success = updateAccount(parseInt(req.params.id), req.body);
  if (!success) {
    return res.status(404).json({ error: 'Account not found' });
  }
  res.json({ success: true });
});

// Start/Stop client
router.post('/accounts/:id/start', async (req: Request, res: Response) => {
  const account = getAccountById(parseInt(req.params.id));
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  try {
    await telegramManager.startClient(account.sessionId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/accounts/:id/stop', async (req: Request, res: Response) => {
  const account = getAccountById(parseInt(req.params.id));
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  
  await telegramManager.stopClient(account.sessionId);
  res.json({ success: true });
});

// ============ CONVERSATIONS ============

router.get('/accounts/:id/conversations', (req: Request, res: Response) => {
  const conversations = getConversations(parseInt(req.params.id));
  res.json(conversations);
});

router.post('/accounts/:id/sync-conversations', async (req: Request, res: Response) => {
  const accountId = parseInt(req.params.id);
  const account = getAccountById(accountId);
  
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  try {
    await telegramManager.sendCommand(account.sessionId, {
      type: 'sync_dialogs',
      data: {}
    });
    
    res.json({ success: true, message: 'Синхронизация диалогов запущена' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id', (req: Request, res: Response) => {
  const conversation = getConversationById(parseInt(req.params.id));
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json(conversation);
});

router.get('/conversations/:id/messages', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const messages = getMessages(parseInt(req.params.id), limit);
  res.json(messages.reverse());
});

router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  const { text, useAi } = req.body;
  const conversationId = parseInt(req.params.id);
  const conversation = getConversationById(conversationId);
  
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const account = getAccountById(conversation.accountId);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  try {
    let responseText = text;
    
    if (useAi) {
      responseText = await generateAIResponse(conversationId, text);
    }
    
    // Отправляем сообщение через Telegram
    await telegramManager.sendMessage(account.sessionId, conversation.chatId, responseText);
    
    // Сохраняем в БД
    addMessage(conversationId, 'assistant', responseText);
    
    res.json({ success: true, message: responseText });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/conversations/:id/ai-mode', (req: Request, res: Response) => {
  const { enabled } = req.body;
  const success = updateConversationAiMode(parseInt(req.params.id), enabled);
  res.json({ success });
});

// ============ PATTERNS ============

router.get('/patterns', (req: Request, res: Response) => {
  const patterns = getAllPatterns();
  res.json(patterns);
});

router.get('/patterns/:id', (req: Request, res: Response) => {
  const pattern = getPatternById(parseInt(req.params.id));
  if (!pattern) {
    return res.status(404).json({ error: 'Pattern not found' });
  }
  res.json(pattern);
});

router.post('/patterns', (req: Request, res: Response) => {
  const { name, description, actions, repeatCount, delayBetweenMs } = req.body;
  
  const result = db.prepare(`
    INSERT INTO patterns (name, description, actions, repeat_count, delay_between_ms)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, description || null, JSON.stringify(actions || []), repeatCount || 1, delayBetweenMs || 1000);
  
  res.json({ id: result.lastInsertRowid, success: true });
});

router.patch('/patterns/:id', (req: Request, res: Response) => {
  const success = updatePattern(parseInt(req.params.id), req.body);
  res.json({ success });
});

router.delete('/patterns/:id', (req: Request, res: Response) => {
  const success = deletePattern(parseInt(req.params.id));
  res.json({ success });
});

// Recording
router.post('/accounts/:id/recording/start', (req: Request, res: Response) => {
  const accountId = parseInt(req.params.id);
  startPatternRecording(accountId);
  res.json({ success: true });
});

router.post('/accounts/:id/recording/stop', (req: Request, res: Response) => {
  const accountId = parseInt(req.params.id);
  const { name, description } = req.body;
  const pattern = stopPatternRecording(accountId, name, description);
  res.json({ success: true, pattern });
});

router.get('/accounts/:id/recording/actions', (req: Request, res: Response) => {
  const actions = getRecordedActions(parseInt(req.params.id));
  res.json(actions);
});

// Execute pattern
router.post('/patterns/:id/execute', async (req: Request, res: Response) => {
  const { accountIds } = req.body;
  const patternId = parseInt(req.params.id);
  
  // Запускаем выполнение для каждого аккаунта
  // Это будет асинхронно, так что просто подтверждаем запуск
  res.json({ success: true, message: 'Pattern execution started' });
});

// ============ TELEGRAM ACTIONS ============

router.post('/telegram/send-message', async (req: Request, res: Response) => {
  const { sessionId, chatId, text } = req.body;
  
  try {
    await telegramManager.sendMessage(sessionId, chatId, text);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/telegram/click-button', async (req: Request, res: Response) => {
  const { sessionId, chatId, messageId, callbackData } = req.body;
  
  try {
    await telegramManager.clickButton(sessionId, chatId, messageId, callbackData);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/telegram/like', async (req: Request, res: Response) => {
  const { sessionId, chatId } = req.body;
  
  try {
    await telegramManager.like(sessionId, chatId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/telegram/dislike', async (req: Request, res: Response) => {
  const { sessionId, chatId } = req.body;
  
  try {
    await telegramManager.dislike(sessionId, chatId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DATING PROFILES ============

router.get('/accounts/:id/profiles', (req: Request, res: Response) => {
  const profiles = getDatingProfiles(parseInt(req.params.id));
  res.json(profiles);
});

// ============ SETTINGS ============

router.get('/settings', (req: Request, res: Response) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  const result: Record<string, string> = {};
  for (const s of settings as any[]) {
    result[s.key] = s.value;
  }
  res.json(result);
});

router.patch('/settings', (req: Request, res: Response) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    setSetting(key, value as string);
  }
  res.json({ success: true });
});

// ============ LOGS ============

router.get('/logs', (req: Request, res: Response) => {
  const { accountId, level, category, limit } = req.query;
  const logs = getLogs({
    accountId: accountId ? parseInt(accountId as string) : undefined,
    level: level as string,
    category: category as string,
    limit: limit ? parseInt(limit as string) : 100
  });
  res.json(logs);
});

// ============ AI ============

router.post('/ai/generate', async (req: Request, res: Response) => {
  const { conversationId, message, systemPrompt } = req.body;
  
  try {
    const response = await generateAIResponse(conversationId, message, systemPrompt);
    res.json({ response });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/test', async (req: Request, res: Response) => {
  const { message, systemPrompt } = req.body;
  const OpenAI = (await import('openai')).default;
  
  const client = new OpenAI({
    apiKey: process.env.NOVITA_API_KEY,
    baseURL: 'https://api.novita.ai/openai'
  });

  try {
    const response = await client.chat.completions.create({
      model: process.env.NOVITA_MODEL || 'moonshotai/kimi-k2-0905',
      messages: [
        { role: 'system', content: systemPrompt || getSetting('default_system_prompt') || '' },
        { role: 'user', content: message }
      ],
      max_tokens: parseInt(getSetting('ai_max_tokens') || '150'),
      temperature: parseFloat(getSetting('ai_temperature') || '0.9')
    });
    
    res.json({ response: response.choices[0]?.message?.content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
