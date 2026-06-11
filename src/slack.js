const axios = require('axios');

async function notifySlack({ lineUserId, customerName, message, caseInfo, category, replies }) {
  const flLine = caseInfo
    ? `*FLコード:* ${caseInfo.fl}　*店舗名:* ${caseInfo.name}`
    : `*LINE UserID:* \`${lineUserId}\`　⚠️ FLコード未登録`;

  const replyBlocks = replies.map((r, i) => ({
    type: 'section',
    text: { type: 'mrkdwn', text: `*返信案 ${i + 1}:*\n${r}` },
  }));

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📩 LINE新着メッセージ', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${flLine}\n*顧客名:* ${customerName}　*カテゴリ:* ${category}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*メッセージ:*\n${message}` },
      },
      { type: 'divider' },
      ...replyBlocks,
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: '👆 返信案をコピーしてLINEから手動送信してください' }],
      },
    ],
  };

  await axios.post(process.env.SLACK_WEBHOOK_URL, payload);
}

module.exports = { notifySlack };
