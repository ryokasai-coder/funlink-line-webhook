require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { getFlByLineUser } = require('./src/flCodes');
const { notifySlack } = require('./src/slack');
const { matchPattern } = require('./src/replyPatterns');

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
