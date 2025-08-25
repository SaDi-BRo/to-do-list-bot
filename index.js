const express = require('express');
const { Bot } = require('grammy');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('❌ Missing BOT_TOKEN in .env');
  process.exit(1);
}
const DB_FILE = path.resolve(__dirname, 'tasks.json');

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return {};
  }
}
function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const app = express();
const bot = new Bot(TOKEN);

app.use(express.json());

// Commands menu
bot.api.setMyCommands([
  { command: 'start', description: 'Start the bot' },
  { command: 'add', description: 'Add a new task' },
  { command: 'list', description: 'Show your tasks' },
  { command: 'done', description: 'Mark a task as done' },
  { command: 'delete', description: 'Delete a task' },
]);

// --- Commands
bot.command('start', async ctx => {
  await ctx.reply(
    "📝 Hi! I'm your To-Do List Bot.\n\n" +
      'Commands:\n' +
      '• /add Buy milk\n' +
      '• /list\n' +
      '• /done 2\n' +
      '• /delete 3'
  );
});

bot.command('add', async ctx => {
  const taskText = (ctx.match || '').trim();
  if (!taskText) return ctx.reply('❓ Usage: /add <task>');

  const db = readDB();
  const userId = ctx.from.id;
  if (!db[userId]) db[userId] = { lastId: 0, tasks: [] };

  const id = ++db[userId].lastId;
  db[userId].tasks.push({ id, text: taskText, done: false });
  writeDB(db);

  await ctx.reply(`✅ Added task #${id}: ${taskText}`);
});

bot.command('list', async ctx => {
  const db = readDB();
  const userId = ctx.from.id;
  const tasks = db[userId]?.tasks || [];

  if (!tasks.length) return ctx.reply('📭 Your list is empty.');

  const lines = tasks.map(t => `${t.done ? '✔️' : '🔲'} #${t.id} ${t.text}`);
  await ctx.reply('📝 Your tasks:\n' + lines.join('\n'));
});

bot.command('done', async ctx => {
  const id = Number((ctx.match || '').trim());
  if (!id) return ctx.reply('❓ Usage: /done <id>');

  const db = readDB();
  const userId = ctx.from.id;
  const task = db[userId]?.tasks.find(t => t.id === id);

  if (!task) return ctx.reply('⚠️ Task not found.');
  task.done = true;
  writeDB(db);

  await ctx.reply(`✔️ Marked task #${id} as done.`);
});

bot.command('delete', async ctx => {
  const id = Number((ctx.match || '').trim());
  if (!id) return ctx.reply('❓ Usage: /delete <id>');

  const db = readDB();
  const userId = ctx.from.id;
  if (!db[userId]) return ctx.reply('⚠️ You have no tasks.');

  const tasks = db[userId].tasks.filter(t => t.id !== id);
  if (tasks.length === db[userId].tasks.length) {
    return ctx.reply('⚠️ Task not found.');
  }
  db[userId].tasks = tasks;
  writeDB(db);

  await ctx.reply(`🗑️ Deleted task #${id}.`);
});

// Fallback
bot.on('message:text', async ctx => {
  await ctx.reply('💡 Try: /add Buy milk');
});

// Start bot
if (process.env.MODE === 'production') {
  app.post('/webhook', async (req, res) => {
    await bot.handleUpdate(req.body, res);
  });

  app.listen(3000, async () => {
    console.log('Server running on port 3000');
    await bot.api.setWebhook(process.env.WEBHOOK_URL + '/webhook');
  });
} else {
  bot.start({
    onStart: info => console.log(`🤖 @${info.username} is running…`),
  });
}
