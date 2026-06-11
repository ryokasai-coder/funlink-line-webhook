require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');
const { notifySlack } = require('./src/slack');
const { matchPattern } = require('./src/replyPatterns');

if (typeof WebSocket === 'undefined') {
  global.WebSocket = require('ws');
}

const _sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// SupabaseからFL紐付けを取得（簡易キャッシュ付き）
const _flCache = {};
let _flCacheAt = 0;
async function getFlByLineUser(lineUserId) {
  const now = Date.now();
  if (now - _flCacheAt > 5 * 60 * 1000) {
    const { data } = await _sb.from('line_user_fl_map').select('line_user_id,fl_code,display_name');
    if (data) {
      data.forEach(r => { _flCache[r.line_user_id] = { fl: r.fl_code, name: r.display_name }; });
      _flCacheAt = now;
    }
  }
  return _flCache[lineUserId] || null;
}

async function saveLineMessage(caseFL, lineUserId, customerName, messageText, category, replies) {
  const now = new Date().toISOString();
  await _sb.from('line_messages').insert({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    case_fl: caseFL || lineUserId,
    date: now.slice(0, 10),
    sender: '顧客',
    sender_name: customerName || '',
    category: category,
    message: messageText.slice(0, 500),
    reply_draft: replies[0] || '',
    status: '未対応',
    created_at: now,
  });
}

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const app = express();

app.get('/', (req, res) => res.send('FunLink LINE Webhook OK'));

app.post('/webhook',
  line.middleware(lineConfig),
  async (req, res) => {
    res.sendStatus(200);

    const events = req.body.events || [];
    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const lineUserId = event.source.userId;
      const messageText = event.message.text;

      let customerName = '不明';
      try {
        const profile = await client.getProfile(lineUserId);
        customerName = profile.displayName;
      } catch (_) {}

      const caseInfo = await getFlByLineUser(lineUserId);

      // FL紐付けがある場合、display_nameも更新
      if (caseInfo && customerName !== '不明') {
        _sb.from('line_user_fl_map').update({ display_name: customerName })
          .eq('line_user_id', lineUserId).then(() => {});
      }

      const { category, replies } = matchPattern(messageText);

      try {
        await saveLineMessage(caseInfo ? caseInfo.fl : null, lineUserId, customerName, messageText, category, replies);
        console.log(`[${new Date().toISOString()}] 保存: ${customerName} → ${caseInfo ? caseInfo.fl : lineUserId} [${category}]`);
      } catch (e) {
        console.error('Supabase save error:', e.message);
      }

      try {
        await notifySlack({ lineUserId, customerName, message: messageText, caseInfo, category, replies });
      } catch (e) {
        console.error('Slack error:', e.message);
      }
    }
  }
);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`FunLink LINE Webhook listening on port ${PORT}`));
