import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists for tests
const dataDir = join(__dirname, '../../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

import { db, initializeDatabase, getSetting, setSetting } from '../db/schema.js';
import { 
  syncAccountsFromSessions, 
  getAllAccounts, 
  updateAccount,
  createOrUpdateConversation,
  addMessage,
  getMessages
} from '../services/accounts.js';
import { 
  startPatternRecording, 
  recordAction, 
  stopPatternRecording, 
  getAllPatterns,
  getPatternById,
  isRecording
} from '../services/patterns.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message, duration: Date.now() - start });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

async function runTests() {
  console.log('\n🧪 Running TG Automation Tests\n');
  console.log('='.repeat(50));

  // ============ Database Tests ============
  await test('Database initialization', () => {
    initializeDatabase();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    assert(tables.length > 0, 'No tables created');
  });

  await test('Settings CRUD', () => {
    setSetting('test_key', 'test_value');
    const value = getSetting('test_key');
    assertEqual(value, 'test_value');
    
    setSetting('test_key', 'updated_value');
    const updated = getSetting('test_key');
    assertEqual(updated, 'updated_value');
  });

  await test('Default system prompt exists', () => {
    const prompt = getSetting('default_system_prompt');
    assert(prompt !== null && prompt.length > 0, 'Default prompt not set');
    assert(prompt!.includes('зумер'), 'Prompt should contain zumer persona');
  });

  // ============ Accounts Tests ============
  await test('Sync accounts from sessions', () => {
    const accounts = syncAccountsFromSessions();
    assert(Array.isArray(accounts), 'Should return array');
    console.log(`   Found ${accounts.length} session files`);
  });

  await test('Get all accounts', () => {
    const accounts = getAllAccounts();
    assert(Array.isArray(accounts), 'Should return array');
  });

  await test('Update account settings', () => {
    const accounts = getAllAccounts();
    if (accounts.length > 0) {
      const account = accounts[0];
      const success = updateAccount(account.id, { aiEnabled: true });
      assert(success, 'Update should succeed');
    }
  });

  // ============ Conversations Tests ============
  await test('Create conversation', () => {
    const accounts = getAllAccounts();
    if (accounts.length > 0) {
      const conv = createOrUpdateConversation(accounts[0].id, 'test_chat_123', {
        peerUsername: 'test_user',
        peerFirstName: 'Test'
      });
      assert(conv.id > 0, 'Conversation should have ID');
      assertEqual(conv.chatId, 'test_chat_123');
    }
  });

  await test('Add and retrieve messages', () => {
    const accounts = getAllAccounts();
    if (accounts.length > 0) {
      const conv = createOrUpdateConversation(accounts[0].id, 'test_chat_456', {});
      
      addMessage(conv.id, 'user', 'Hello!');
      addMessage(conv.id, 'assistant', 'привет чел');
      
      const messages = getMessages(conv.id);
      assert(messages.length >= 2, 'Should have at least 2 messages');
    }
  });

  // ============ Patterns Tests ============
  await test('Pattern recording workflow', () => {
    const accountId = 999; // Test ID
    
    // Start recording
    startPatternRecording(accountId);
    assert(isRecording(accountId), 'Should be recording');
    
    // Record actions
    recordAction(accountId, {
      type: 'click',
      data: { buttonText: '❤️' },
      delayAfterMs: 500
    });
    
    recordAction(accountId, {
      type: 'message',
      data: { messageText: 'привет' },
      delayAfterMs: 1000
    });
    
    // Stop and save
    const pattern = stopPatternRecording(accountId, 'Test Pattern', 'Test description');
    assert(pattern !== null, 'Pattern should be created');
    assertEqual(pattern!.actions.length, 2, 'Should have 2 actions');
    assertEqual(pattern!.name, 'Test Pattern');
    
    assert(!isRecording(accountId), 'Should not be recording after stop');
  });

  await test('Get all patterns', () => {
    const patterns = getAllPatterns();
    assert(Array.isArray(patterns), 'Should return array');
    assert(patterns.length > 0, 'Should have at least one pattern');
  });

  await test('Get pattern by ID', () => {
    const patterns = getAllPatterns();
    if (patterns.length > 0) {
      const pattern = getPatternById(patterns[0].id!);
      assert(pattern !== null, 'Should find pattern');
      assertEqual(pattern!.id, patterns[0].id);
    }
  });

  // ============ AI Tests ============
  await test('AI service configuration', async () => {
    const apiKey = process.env.NOVITA_API_KEY;
    assert(apiKey !== undefined && apiKey.length > 0, 'NOVITA_API_KEY should be set');
    
    const model = process.env.NOVITA_MODEL;
    assert(model !== undefined, 'NOVITA_MODEL should be set');
  });

  // ============ Summary ============
  console.log('\n' + '='.repeat(50));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`⏱  Total time: ${totalTime}ms\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    for (const result of results.filter(r => !r.passed)) {
      console.log(`  - ${result.name}: ${result.error}`);
    }
    process.exit(1);
  }
  
  process.exit(0);
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
