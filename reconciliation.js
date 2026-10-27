export function summarize(ledger, row) {
  const ids = row.pages.flat();
  const unique = [...new Set(ids)];
  const duplicate = unique.filter(id => ids.filter(x => x === id).length > 1);
  const missing = ledger.ids.filter(id => !unique.includes(id));
  const extra = unique.filter(id => !ledger.ids.includes(id));
  const versions = [...new Set(row.versions)];
  const blockers = [];
  if (duplicate.length || missing.length || extra.length) blockers.push('資料IDの重複・不足・余分');
  if (row.continuation !== 'なし') blockers.push(row.continuation === 'あり' ? '続きあり' : '続きの記録なし・不明');
  if (row.completion !== '完了') blockers.push(row.completion === '未完了' ? '検索未完了' : '検索完了の記録なし・不明');
  if (versions.length !== 1 || versions[0] !== ledger.version || versions.includes(null)) blockers.push('ページの版の混在・不明・台帳との違い');
  return {rows: ids.length, unique: unique.length, duplicate, missing, extra, versions, blockers};
}
const symbol = /^[A-Z][A-Z0-9-]{0,15}$/;
export function validateInput(input) {
  const {ledger, conditions} = input;
  if (!ledger || !Array.isArray(ledger.ids) || !ledger.ids.length || !ledger.ids.every(x => typeof x === 'string' && symbol.test(x)) || new Set(ledger.ids).size !== ledger.ids.length) throw Error('台帳IDは重複のない教材内の記号で入力してください。');
  if (!symbol.test(ledger.version) || typeof ledger.scope !== 'string' || !ledger.scope.trim() || typeof ledger.at !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(ledger.at)) throw Error('台帳の版・対象範囲・基準時点を確認してください。');
  if (!Array.isArray(conditions) || !conditions.length || conditions.length > 30 || new Set(conditions.map(r => r.id)).size !== conditions.length) throw Error('条件は重複のない1〜30件にしてください。');
  for (const row of conditions) {
    if (!symbol.test(row.id) || !Array.isArray(row.pages) || !row.pages.length || row.pages.length > 20 || !row.pages.every(page => Array.isArray(page) && page.length > 0 && page.length <= 100 && page.every(x => typeof x === 'string' && symbol.test(x)))) throw Error('条件名とページの資料IDは教材内の記号で入力してください。空のページは使えません。');
    if (![null, 'あり', 'なし', '不明'].includes(row.continuation) || ![null, '完了', '未完了', '不明'].includes(row.completion)) throw Error('続き・検索完了に想定外の値があります。空欄はnullとして扱います。');
    if (!Array.isArray(row.versions) || row.versions.length !== row.pages.length || !row.versions.every(x => x === null || (typeof x === 'string' && symbol.test(x)))) throw Error('ページごとに版を入力してください。版の空欄は不明です。');
  }
  return input;
}
// 引用符内の改行・カンマ・二重引用符も読み込む。空欄は推測で埋めない。
export function parseCSV(text) {
  const rows = []; let row = []; let field = ''; let quoted = false; let closed = false;
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === ',' || ch === '\n') {
      row.push(field); field = ''; closed = false;
      if (ch === '\n') { rows.push(row); row = []; }
    } else if (ch === '"' && field === '' && !closed) quoted = true;
    else { if (closed || ch === '"') throw Error('CSVの引用符を確認してください。'); field += ch; }
  }
  if (quoted) throw Error('CSVの引用符が閉じていません。');
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  if (rows.shift()?.join(',') !== 'condition,pages,continuation,completion,versions') throw Error('CSVの見出しは condition,pages,continuation,completion,versions にしてください。');
  return rows.map(cols => {
    if (cols.length !== 5) throw Error('CSVは5列で入力してください。');
    const [id, pages, continuation, completion, versions] = cols.map(x => x.trim());
    return {id, pages: pages.split('|').map(x => x.trim().split(/\s+/).filter(Boolean)), continuation: continuation || null, completion: completion || null, versions: versions.split('|').map(x => x.trim() || null)};
  });
}
export const csvCell = value => '"' + String(value ?? '').replaceAll('"', '""').replace(/^([=+@-])/, "'$1") + '"';
