import OpenAI from 'openai';
import { db, getSetting } from '../db/schema.js';

const client = new OpenAI({
  apiKey: process.env.NOVITA_API_KEY,
  baseURL: 'https://api.novita.ai/openai'
});

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ConversationContext {
  conversationId: number;
  peerDescription?: string;
  messages: Message[];
}

export async function generateAIResponse(
  conversationId: number,
  userMessage: string,
  customSystemPrompt?: string
): Promise<string> {
  try {
    // Получаем контекст диалога
    const conversation = db.prepare(`
      SELECT c.*, a.system_prompt as account_prompt
      FROM conversations c
      JOIN accounts a ON c.account_id = a.id
      WHERE c.id = ?
    `).get(conversationId) as any;

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Получаем последние N сообщений для контекста
    const recentMessages = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(conversationId) as Message[];

    // Формируем системный промпт
    const defaultPrompt = getSetting('default_system_prompt') || '';
    const systemPrompt = customSystemPrompt || conversation.account_prompt || defaultPrompt;
    
    // Добавляем контекст о собеседнике если есть
    let enhancedPrompt = systemPrompt;
    if (conversation.peer_description) {
      enhancedPrompt += `\n\nИнформация о собеседнике: ${conversation.peer_description}`;
    }
    if (conversation.peer_first_name) {
      enhancedPrompt += `\nИмя собеседника: ${conversation.peer_first_name}`;
    }

    // Собираем сообщения в правильном порядке
    const messages: Message[] = [
      { role: 'system', content: enhancedPrompt },
      ...recentMessages.reverse(),
      { role: 'user', content: userMessage }
    ];

    const temperature = parseFloat(getSetting('ai_temperature') || '0.9');
    const maxTokens = parseInt(getSetting('ai_max_tokens') || '150');

    const response = await client.chat.completions.create({
      model: process.env.NOVITA_MODEL || 'moonshotai/kimi-k2-0905',
      messages,
      max_tokens: maxTokens,
      temperature
    });

    const aiResponse = response.choices[0]?.message?.content || 'хз чё сказать';

    // Сохраняем сообщения в БД
    const insertMessage = db.prepare(`
      INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)
    `);
    insertMessage.run(conversationId, 'user', userMessage);
    insertMessage.run(conversationId, 'assistant', aiResponse);

    // Обновляем время последнего сообщения
    db.prepare(`
      UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(conversationId);

    return aiResponse;
  } catch (error: any) {
    console.error('AI Error:', error);
    throw new Error(`AI generation failed: ${error.message}`);
  }
}

export async function analyzeProfile(description: string): Promise<{
  shouldLike: boolean;
  reason: string;
  suggestedOpener?: string;
}> {
  try {
    const response = await client.chat.completions.create({
      model: process.env.NOVITA_MODEL || 'moonshotai/kimi-k2-0905',
      messages: [
        {
          role: 'system',
          content: `Ты помощник для анализа профилей в приложении знакомств. 
Анализируй описание профиля и отвечай в JSON формате:
{
  "shouldLike": true/false,
  "reason": "краткая причина",
  "suggestedOpener": "предложение для начала диалога если лайк"
}
Критерии: интересное описание, чувство юмора, общие интересы.`
        },
        {
          role: 'user',
          content: `Проанализируй профиль: ${description}`
        }
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    const content = response.choices[0]?.message?.content || '{}';
    try {
      return JSON.parse(content);
    } catch {
      return { shouldLike: true, reason: 'Не удалось проанализировать' };
    }
  } catch (error: any) {
    console.error('Profile analysis error:', error);
    return { shouldLike: true, reason: 'Ошибка анализа' };
  }
}

export function getConversationHistory(conversationId: number, limit = 50): Message[] {
  return db.prepare(`
    SELECT role, content FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(conversationId, limit) as Message[];
}

export function clearConversationHistory(conversationId: number): void {
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
}
