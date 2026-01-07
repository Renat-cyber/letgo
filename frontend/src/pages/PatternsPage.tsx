import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Play, 
  Trash2, 
  Edit, 
  ChevronDown,
  ChevronRight,
  MousePointer,
  MessageSquare,
  Heart,
  ThumbsDown,
  Clock,
  ArrowRight
} from 'lucide-react';
import { api, Pattern, PatternAction, Account } from '../lib/api';

const actionIcons: Record<string, any> = {
  click: MousePointer,
  callback: MousePointer,
  message: MessageSquare,
  like: Heart,
  dislike: ThumbsDown,
  wait: Clock,
  next_profile: ArrowRight,
};

const actionLabels: Record<string, string> = {
  click: 'Нажатие',
  callback: 'Callback',
  message: 'Сообщение',
  like: 'Лайк',
  dislike: 'Дизлайк',
  wait: 'Ожидание',
  next_profile: 'Следующий профиль',
};

export default function PatternsPage() {
  const queryClient = useQueryClient();
  const [expandedPattern, setExpandedPattern] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: patterns } = useQuery({
    queryKey: ['patterns'],
    queryFn: () => api.get<Pattern[]>('/patterns'),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/accounts'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/patterns/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patterns'] }),
  });

  const executeMutation = useMutation({
    mutationFn: ({ patternId, accountIds }: { patternId: number; accountIds: number[] }) =>
      api.post(`/patterns/${patternId}/execute`, { accountIds }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-wider">
            ПАТТЕРНЫ
          </h1>
          <p className="text-dark-500 font-mono text-sm mt-1">
            // записанные последовательности действий
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-cyber flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Создать паттерн
        </button>
      </div>

      {/* Patterns List */}
      <div className="space-y-4">
        {patterns?.map((pattern) => {
          const isExpanded = expandedPattern === pattern.id;
          
          return (
            <motion.div
              key={pattern.id}
              layout
              className="card-cyber rounded-xl overflow-hidden"
            >
              {/* Header */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-dark-700/50 transition-colors"
                onClick={() => setExpandedPattern(isExpanded ? null : pattern.id)}
              >
                <button className="p-1">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-dark-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-dark-500" />
                  )}
                </button>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display font-bold text-white">{pattern.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                      pattern.isActive 
                        ? 'bg-neon-green/20 text-neon-green' 
                        : 'bg-dark-600 text-dark-500'
                    }`}>
                      {pattern.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                  {pattern.description && (
                    <p className="text-sm text-dark-500 mt-1">{pattern.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-dark-500 font-mono">
                  <span>{pattern.actions.length} действий</span>
                  <span>×{pattern.repeatCount}</span>
                </div>

                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      const accountIds = accounts?.map(a => a.id) || [];
                      if (accountIds.length > 0) {
                        executeMutation.mutate({ patternId: pattern.id, accountIds });
                      }
                    }}
                    className="btn-cyber btn-success p-2"
                    title="Выполнить на всех аккаунтах"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(pattern.id)}
                    className="btn-cyber btn-danger p-2"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-dark-600"
                >
                  <div className="p-4 bg-dark-800/50">
                    <h4 className="text-sm font-mono text-dark-500 mb-3">Действия:</h4>
                    <div className="space-y-2">
                      {pattern.actions.map((action, index) => {
                        const Icon = actionIcons[action.type] || MousePointer;
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-3 bg-dark-700/50 rounded-lg"
                          >
                            <span className="w-6 h-6 rounded bg-dark-600 flex items-center justify-center text-xs font-mono text-dark-500">
                              {index + 1}
                            </span>
                            <Icon className="w-4 h-4 text-neon-blue" />
                            <span className="text-sm text-white">
                              {actionLabels[action.type] || action.type}
                            </span>
                            {action.data.buttonText && (
                              <span className="px-2 py-0.5 bg-dark-600 rounded text-xs font-mono text-dark-400">
                                "{action.data.buttonText}"
                              </span>
                            )}
                            {action.data.messageText && (
                              <span className="px-2 py-0.5 bg-dark-600 rounded text-xs font-mono text-dark-400 truncate max-w-xs">
                                "{action.data.messageText}"
                              </span>
                            )}
                            <span className="ml-auto text-xs text-dark-500 font-mono">
                              +{action.delayAfterMs}ms
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Execute on specific accounts */}
                    <div className="mt-4 pt-4 border-t border-dark-600">
                      <h4 className="text-sm font-mono text-dark-500 mb-3">Выполнить на:</h4>
                      <div className="flex flex-wrap gap-2">
                        {accounts?.map((account) => (
                          <button
                            key={account.id}
                            onClick={() => executeMutation.mutate({ 
                              patternId: pattern.id, 
                              accountIds: [account.id] 
                            })}
                            className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded text-sm font-mono text-gray-300 transition-colors"
                          >
                            {account.username ? `@${account.username}` : account.sessionId}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}

        {(!patterns || patterns.length === 0) && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-dark-700 flex items-center justify-center">
              <Play className="w-10 h-10 text-dark-500" />
            </div>
            <p className="text-dark-500 font-mono mb-4">Нет записанных паттернов</p>
            <p className="text-sm text-dark-600 max-w-md mx-auto">
              Откройте страницу аккаунта и нажмите "Записать" чтобы начать запись последовательности действий
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreatePatternModal onClose={() => setShowCreateModal(false)} />
      )}
    </motion.div>
  );
}

function CreatePatternModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      api.post('/patterns', { ...data, actions: [], repeatCount: 1, delayBetweenMs: 1000 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-dark-800 border border-dark-600 rounded-xl p-6 w-full max-w-md"
      >
        <h2 className="font-display font-bold text-xl text-white mb-4">
          Новый паттерн
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-mono text-dark-500 mb-2">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Автолайки"
              className="input-cyber"
            />
          </div>

          <div>
            <label className="block text-sm font-mono text-dark-500 mb-2">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите что делает этот паттерн..."
              className="input-cyber h-24 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-cyber flex-1">
            Отмена
          </button>
          <button
            onClick={() => createMutation.mutate({ name, description })}
            disabled={!name.trim() || createMutation.isPending}
            className="btn-cyber btn-success flex-1"
          >
            Создать
          </button>
        </div>
      </motion.div>
    </div>
  );
}
