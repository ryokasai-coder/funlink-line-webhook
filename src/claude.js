const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateReply(customerMessage, caseInfo) {
  const casePart = caseInfo
    ? `顧客情報:\n- FLコード: ${caseInfo.fl}\n- 店舗名: ${caseInfo.name}\n\n`
    : '';

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `あなたはFunLink（MEO対策サービス）のカスタマーサポート担当です。\n${casePart}顧客からのLINEメッセージに対して、丁寧で簡潔な返信案を1つ作成してください。\n担当者が確認してから送信するので、自然な日本語で書いてください。\n\n顧客メッセージ:\n${customerMessage}`,
    }],
  });

  return message.content[0].text;
}

module.exports = { generateReply };
