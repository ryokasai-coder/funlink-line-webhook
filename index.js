require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');
const { getFlByLineUser } = require('./src/flCodes');
const { notifySlack } = require('./src/slack');
const { matchPattern } = require('./src/replyPatterns');

const _sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function saveLineMessage(caseFL, lineUserId, customerName, messageText, category, replies) {
  const now = new Date().toISOString();
  // cms_storeのmainレコードを取得して更新
  const { data, error } = await _sb.from('cms_store').select('data').eq('id','main').single();
  const store = (data && data.data) ? data.data : {};
  if (!store.lineMessages) store.lineMessages = [];
  store.lineMessages.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    caseFL: caseFL || lineUserId,
    date: now.slice(0,10),
    sender: '顧客',
    category: category,
    message: messageText,
    replyDraft: replies[0] || '',
    status: '未対応',
    createdAt: now,
    lineUserId: lineUserId,
    customerName: customerName,
  });
  await _sb.from('cms_store').upsert({ id:'main', data:store, updated_at: now });
}

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const app = express();

// ヘルスチェック（Cloud Run用）
app.get('/', (req, res) => res.send('FunLink LINE Webhook OK'));

// LINE Webhook
app.post('/webhook',
  line.middleware(lineConfig),
  async (req, res) => {
    res.sendStatus(200); // LINEには即レスポンス

    const events = req.body.events || [];
    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const lineUserId = event.source.userId;
      const messageText = event.message.text;

      // プロフィール取得
      let customerName = '不明';
      try {
        const profile = await client.getProfile(lineUserId);
        customerName = profile.displayName;
      } catch (_) {}

      // FLコード照合
      const caseInfo = getFlByLineUser(lineUserId);

      // パターンマッチで返信案を生成
      const { category, replies } = matchPattern(messageText);

      // Supabase に保存
      try {
        await saveLineMessage(caseInfo ? caseInfo.fl : null, lineUserId, customerName, messageText, category, replies);
      } catch (e) {
        console.error('Supabase save error:', e.message);
      }

      // Slack に通知
      try {
        await notifySlack({ lineUserId, customerName, message: messageText, caseInfo, category, replies });
        console.log(`[${new Date().toISOString()}] Slack通知送信: ${customerName} [${category}] → ${messageText.slice(0, 50)}`);
      } catch (e) {
        console.error('Slack error:', e.message);
      }
    }
  }
);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`FunLink LINE Webhook listening on port ${PORT}`));
