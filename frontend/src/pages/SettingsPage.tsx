import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Save, 
  Bot, 
  Sliders, 
  Bell, 
  TestTube,
  Send,
  RefreshCw,
  Shield
} from 'lucide-react';
import { api, Settings } from '../lib/api';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Partial<Settings>>({});
  const [testMessage, setTestMessage] = useState('привет как дела');
  const [testResponse, setTestResponse] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => api.patch('/settings', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const handleSave = () => {
    saveMutation.mutate(localSettings);
  };

  const testAi = async () => {
    setIsTesting(true);
    setTestResponse('');
    try {
      const response = await api.post<{ response: string }>('/ai/test', {
        message: testMessage,
        systemPrompt: localSettings.default_system_prompt,
      });
      setTestResponse(response.response);
    } catch (error) {
      setTestResponse('Ошибка: ' + (error as Error).message);
    }
    setIsTesting(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 max-w-4xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-wider">
            НАСТРОЙКИ
          </h1>
          <p className="text-dark-500 font-mono text-sm mt-1">
            // конфигурация системы
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="btn-cyber btn-success flex items-center gap-2"
        >
          {saveMutation.isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Сохранить
        </button>
      </div>

      {/* AI Settings */}
      <div className="card-cyber rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Bot className="w-6 h-6 text-neon-purple" />
          <h2 className="font-display font-bold text-xl text-white">AI Настройки</h2>
        </div>

        {/* System Prompt */}
        <div className="mb-6">
          <label className="block text-sm font-mono text-dark-500 mb-2">
            Системный промпт по умолчанию
          </label>
          <textarea
            value={localSettings.default_system_prompt || ''}
            onChange={(e) => setLocalSettings({ ...localSettings, default_system_prompt: e.target.value })}
            placeholder="Опишите персонажа AI..."
            className="input-cyber h-40 resize-none font-mono text-sm"
          />
          <p className="text-xs text-dark-500 mt-2">
            Этот промпт будет использоваться для всех аккаунтов, если у них не задан свой
          </p>
        </div>

        {/* Preset Personas */}
        <div className="mb-6">
          <label className="block text-sm font-mono text-dark-500 mb-2">
            Готовые персонажи
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              {
                name: 'Зумер',
                prompt: `ты зумер которому всегда скучно. пишешь только маленькими буквами, без точек в конце предложений. используешь сленг типа "чел", "кринж", "вайб", "рофл", "имба". отвечаешь коротко и немного лениво. иногда вставляешь "хз", "мб", "лол". не ставишь знаки препинания кроме вопросительных знаков иногда. тебе как будто всё равно но при этом ты отвечаешь`
              },
              {
                name: 'Загадочный',
                prompt: `ты загадочный и немногословный. отвечаешь коротко и оставляешь недосказанность. используешь многоточие... иногда говоришь странные вещи. не отвечаешь прямо на вопросы. создаёшь ощущение тайны`
              },
              {
                name: 'Весёлый',
                prompt: `ты очень позитивный и весёлый человек. используешь много смайликов и восклицательных знаков! шутишь, подкалываешь. любишь общаться и всегда в хорошем настроении. но не переигрываешь`
              }
            ].map((persona) => (
              <button
                key={persona.name}
                onClick={() => setLocalSettings({ ...localSettings, default_system_prompt: persona.prompt })}
                className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded text-sm font-mono text-gray-300 transition-colors"
              >
                {persona.name}
              </button>
            ))}
          </div>
        </div>

        {/* AI Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-mono text-dark-500 mb-2">
              Temperature: {localSettings.ai_temperature || '0.9'}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localSettings.ai_temperature || '0.9'}
              onChange={(e) => setLocalSettings({ ...localSettings, ai_temperature: e.target.value })}
              className="w-full"
            />
            <p className="text-xs text-dark-500 mt-1">
              Выше = более креативные ответы
            </p>
          </div>

          <div>
            <label className="block text-sm font-mono text-dark-500 mb-2">
              Max Tokens
            </label>
            <input
              type="number"
              value={localSettings.ai_max_tokens || '150'}
              onChange={(e) => setLocalSettings({ ...localSettings, ai_max_tokens: e.target.value })}
              className="input-cyber"
              min="50"
              max="500"
            />
            <p className="text-xs text-dark-500 mt-1">
              Максимальная длина ответа
            </p>
          </div>
        </div>
      </div>

      {/* AI Test */}
      <div className="card-cyber rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <TestTube className="w-6 h-6 text-neon-green" />
          <h2 className="font-display font-bold text-xl text-white">Тест AI</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-mono text-dark-500 mb-2">
              Тестовое сообщение
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Введите сообщение для теста..."
                className="input-cyber flex-1"
              />
              <button
                onClick={testAi}
                disabled={isTesting || !testMessage.trim()}
                className="btn-cyber flex items-center gap-2"
              >
                {isTesting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Тест
              </button>
            </div>
          </div>

          {testResponse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-dark-700/50 rounded-lg border-l-2 border-neon-green"
            >
              <p className="text-xs text-dark-500 font-mono mb-2">Ответ AI:</p>
              <p className="text-gray-200 whitespace-pre-wrap">{testResponse}</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Pattern Settings */}
      <div className="card-cyber rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Sliders className="w-6 h-6 text-neon-blue" />
          <h2 className="font-display font-bold text-xl text-white">Паттерны</h2>
        </div>

        <div>
          <label className="block text-sm font-mono text-dark-500 mb-2">
            Задержка между действиями (мс)
          </label>
          <input
            type="number"
            value={localSettings.pattern_default_delay || '1500'}
            onChange={(e) => setLocalSettings({ ...localSettings, pattern_default_delay: e.target.value })}
            className="input-cyber w-48"
            min="500"
            max="10000"
            step="100"
          />
        </div>
      </div>

      {/* Safety Settings */}
      <div className="card-cyber rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-6 h-6 text-neon-green" />
          <h2 className="font-display font-bold text-xl text-white">Защита от блокировок</h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-400">
              ⚠️ <strong>Важно:</strong> Эти настройки помогают избежать блокировок Telegram. 
              Увеличьте задержки и уменьшите лимиты для максимальной безопасности.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-mono text-dark-500 mb-2">
                Минимальная задержка (мс)
              </label>
              <input
                type="number"
                value={localSettings.safety_min_delay || '3000'}
                onChange={(e) => setLocalSettings({ ...localSettings, safety_min_delay: e.target.value })}
                className="input-cyber w-full"
                min="1000"
                max="10000"
                step="500"
              />
              <p className="text-xs text-dark-500 mt-1">Минимум 3-5 секунд рекомендуется</p>
            </div>

            <div>
              <label className="block text-sm font-mono text-dark-500 mb-2">
                Максимальная задержка (мс)
              </label>
              <input
                type="number"
                value={localSettings.safety_max_delay || '8000'}
                onChange={(e) => setLocalSettings({ ...localSettings, safety_max_delay: e.target.value })}
                className="input-cyber w-full"
                min="2000"
                max="20000"
                step="500"
              />
              <p className="text-xs text-dark-500 mt-1">Максимум 8-15 секунд рекомендуется</p>
            </div>

            <div>
              <label className="block text-sm font-mono text-dark-500 mb-2">
                Действий в час (макс)
              </label>
              <input
                type="number"
                value={localSettings.safety_actions_per_hour || '30'}
                onChange={(e) => setLocalSettings({ ...localSettings, safety_actions_per_hour: e.target.value })}
                className="input-cyber w-full"
                min="10"
                max="100"
                step="5"
              />
              <p className="text-xs text-dark-500 mt-1">Лайки, дизлайки, клики</p>
            </div>

            <div>
              <label className="block text-sm font-mono text-dark-500 mb-2">
                Сообщений в час (макс)
              </label>
              <input
                type="number"
                value={localSettings.safety_messages_per_hour || '20'}
                onChange={(e) => setLocalSettings({ ...localSettings, safety_messages_per_hour: e.target.value })}
                className="input-cyber w-full"
                min="5"
                max="50"
                step="5"
              />
              <p className="text-xs text-dark-500 mt-1">AI и ручные сообщения</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card-cyber rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Bell className="w-6 h-6 text-neon-yellow" />
          <h2 className="font-display font-bold text-xl text-white">Уведомления</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-mono text-dark-500 mb-2">
              Chat ID для уведомлений
            </label>
            <input
              type="text"
              value={localSettings.notification_chat_id || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, notification_chat_id: e.target.value })}
              placeholder="Будет установлено автоматически при /start в боте"
              className="input-cyber"
              disabled
            />
            <p className="text-xs text-dark-500 mt-2">
              Отправьте /start боту чтобы получать уведомления
            </p>
          </div>

          <div>
            <label className="block text-sm font-mono text-dark-500 mb-2">
              URL фронтенда
            </label>
            <input
              type="text"
              value={localSettings.frontend_url || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, frontend_url: e.target.value })}
              placeholder="https://your-app.vercel.app"
              className="input-cyber"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
