// LINE UserID → FLコード のマッピング（CMS管理画面で登録した値を反映）
// { lineUserId: { fl: 'FL00006', name: '店舗名' } }
const FL_MAP = {};

function getFlByLineUser(lineUserId) {
  return FL_MAP[lineUserId] || null;
}

function registerLineUser(lineUserId, fl, name) {
  FL_MAP[lineUserId] = { fl, name };
}

module.exports = { getFlByLineUser, registerLineUser, FL_MAP };
