const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const PRODUCTS = {
  'Bar i Sala': {
    '🍺 Piwo': ['Tyskie 0.5L','Żywiec 0.5L','Heineken 0.33L','Desperados 0.4L','Piwo bezalk. 0.33L','Żubr 0.5L'],
    '🥃 Wódka': ['Nemiroff Orig. 0.7L','Nemiroff De Lux 0.7L','Żubrówka Biała 0.7L','Khortytsа Premium 0.7L','Dwór Sieraków Superior 0.7L','Kozacka Rada Classic 0.7L'],
    '🍷 Wina': ['Wino Domu Czerwone','Wino Domu Białe','Prosecco Novpalma 0.75L','Champagne Devaux 0.75L'],
    '🥂 Wina musujące': ['Cin&Cin Prosecco','Mionetto Rose 0.75L','Cava Palau 0.75L','Freixenet White 0.75L'],
    '🥃 Whisky': ["Ballantine's 1L","J.Daniel's 0.7L","Jim Beam 0.7L","Edradour 10yo 0.7L"],
    '🥃 Likier': ['Baileys 0.7L','Jagermeister 0.7L','Aperol 0.7L','Malibu 0.7L','Kahlua 0.7L'],
    '🍸 Gin / Rum': ["Seagram's Gin 0.7L","Bacardi 0.7L","Captain Morgan Gold 1L","Captain Morgan Spiced 0.7L"],
    '🧃 Soki': ['Sok pomarańczowy 1L','Sok jabłkowy 1L','Sok ananas 1L','Sok pomidorowy 1L','Sok mango 1L'],
    '💧 Woda i napoje': ['Cisowianka ng. 0.5L','Cisowianka gaz. szkl.','Coca-Cola 0.33L','Pepsi 0.33L','Sprite 0.33L','Fanta 0.33L','Red Bull','Tonic Schweppes 0.85L'],
    '🍯 Syropy Rioba': ['Rioba malinowy 0.7L','Rioba karmelowy 0.7L','Rioba waniliowy 0.7L','Rioba truskawkowy 0.7L','Rioba imbir 0.7L','Rioba brzoskwiniowy 0.7L'],
    '☕ Herbata i kawa': ['Sir W. Ceylon Gold 50k','Sir W. Earl Grey 50k','Richmont Mango Maui','Richmont Raspberry Pear','RA Piacetto Espresso kg'],
    '🍹 Bar dodatki': ['Cytryna kg','Limonka kg','Pomarańcza kg','Mięta cięta kg','Cukier kostka kg','Cukier trzcinowy kg'],
  },
  'Kuchnia': {
    '🥩 Mięso': ['Filet kurczaka kg','Karkówka WP b/k kg','Schab WP b/k kg','Łopatka wołowa kg','Ozór wołowy kg','Kiełbasa jałowcowa kg','Boczek wędzony kg','Szynka włoska kg'],
    '🐟 Ryby': ['Łosoś atl. kg','Sandacz filet kg','Karp patroszony kg','Makrela szt','Raki surowe kg'],
    '🥦 Warzywa': ['Ziemniaki kg','Cebula kg','Marchewka kg','Pomidory kg','Papryka czerwona kg','Ogórek kg','Bakłażan kg','Cukinia kg','Kapusta biała kg','Buraki kg'],
    '🌿 Zielenina': ['Koperek kg','Pietruszka nać kg','Rukola kg','Bazylia kg','Szczypiorek kg','Sałata lodowa kg','Szpinak świeży kg','Rozmaryn kg'],
    '🍎 Owoce': ['Cytryna kg','Limonka kg','Awokado szt'],
    '🥛 Nabiał': ['Śmietana 18% kg','Masło kg','Ser twardy kg','Jajka szt','Mleko l','Kefir l','Twaróg kg'],
    '🍞 Chleb': ['Chleb litewski kg','Chleb żytni kg','Bagietka duża kg','Bułka tarta kg','Lawasz 325g szt'],
    '🥫 Konserwy': ['Koncentrat pomidorowy kg','Ogórki kiszone kg','Kapusta kiszona kg','Groszek kons. kg','Kukurydza kons. kg','Oliwki czarne kg','Oliwki zielone kg'],
    '🌾 Kasze i makarony': ['Kasza gryczana kg','Ryż kg','Kasza bulgur kg','Makaron spaghetti kg','Groch połówki kg'],
    '🫙 Sosy i przyprawy': ['Majonez kg','Ketchup kg','Musztarda stołowa kg','Sos sojowy kg','Vegeta kg','Sól kamienna kg','Pieprz czarny kg','Papryka słodka kg'],
    '🧂 Artykuły spożywcze': ['Mąka pszenna kg','Olej słonecznikowy l','Oliwa z oliwek l','Cukier kg','Skrobia kukurydziana kg'],
    '🥟 Pierogi i półprodukty': ['Pierogi z kapustą i grzybami kg','Pierogi ruskie kg','Uszka małe kg','Pielmieni kg'],
    '🍦 Lody': ['Lody śmietankowe kg','Lody czekoladowe kg','Lody truskawkowe kg'],
  }
};

const sessions = {};

function getSession(chatId) {
  if (!sessions[chatId]) {
    sessions[chatId] = { step: 'start', dept: null, cat: null, products: [], prodIdx: 0, results: {}, lastKey: null };
  }
  return sessions[chatId];
}

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendMsg(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = { keyboard, resize_keyboard: true, one_time_keyboard: false };
  return tg('sendMessage', body);
}

async function saveToSheets(dept, results, userName) {
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const date = new Date().toLocaleDateString('pl-PL');
    const time = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const sheetTitle = dept === 'Bar i Sala' ? 'Bar i Sala' : 'Kuchnia';
    let sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) {
      sheet = await doc.addSheet({ title: sheetTitle, headerValues: ['Data', 'Czas', 'Pracownik', 'Kategoria', 'Produkt', 'Ilość'] });
    }
    const rows = [];
    for (const [key, qty] of Object.entries(results)) {
      const [cat, prod] = key.split('|||');
      rows.push({ Data: date, Czas: time, Pracownik: userName, Kategoria: cat, Produkt: prod, 'Ilość': qty });
    }
    await sheet.addRows(rows);
    return true;
  } catch (e) {
    console.error('Sheets error:', e);
    return false;
  }
}

async function showCategoryMenu(chatId, s) {
  const cats = Object.keys(PRODUCTS[s.dept]);
  const rows = cats.map(c => [c]);
  rows.push(['✅ Zakończ i wyślij raport']);
  rows.push(['🏠 Menu główne']);
  await sendMsg(chatId, `<b>${s.dept}</b> — wybierz kategorię:`, rows);
}

async function askNextProduct(chatId, s) {
  if (s.prodIdx >= s.products.length) {
    const done = Object.keys(s.results).filter(k => k.startsWith(s.cat + '|||')).length;
    await sendMsg(chatId,
      `✅ Kategoria <b>${s.cat}</b> gotowa!\nWpisano: <b>${done}</b> z ${s.products.length} pozycji.\n\nWybierz następną kategorię lub zakończ:`
    );
    s.step = 'cat';
    await showCategoryMenu(chatId, s);
    return;
  }
  const prod = s.products[s.prodIdx];
  const total = s.products.length;
  const done = s.prodIdx;
  const pct = Math.round(done / total * 100);
  const bar = '▓'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

  const keyboard = [['0'], ['0.5'], ['1'], ['2'], ['⏭ Pomiń'], ['↩️ Wróć do kategorii']];
  if (s.lastKey) keyboard.push(['✏️ Исправить последнее']);
  keyboard.push(['🏠 Menu główne']);

  await sendMsg(chatId,
    `${s.cat}\n${bar} ${pct}%  (${done + 1}/${total})\n\n<b>${prod}</b>\n\nIle naliczono?`,
    keyboard
  );
}

async function handleMessage(chatId, text, userName) {
  const s = getSession(chatId);
  const managerChatId = process.env.MANAGER_CHAT_ID;

  if (text === '/start' || text === '🏠 Menu główne') {
    sessions[chatId] = { step: 'dept', dept: null, cat: null, products: [], prodIdx: 0, results: {}, lastKey: null };
    await sendMsg(chatId,
      `Cześć <b>${userName}</b>! 👋\n\nBot do inwentaryzacji <b>Karczma Did Panas</b>.\n\nWybierz swoje stanowisko:`,
      [['🍷 Bar i Sala'], ['🍽️ Kuchnia']]
    );
    return;
  }

  if (s.step === 'dept' || text.includes('Bar i Sala') || text.includes('Kuchnia')) {
    if (text.includes('Bar')) {
      s.dept = 'Bar i Sala';
    } else if (text.includes('Kuchnia')) {
      s.dept = 'Kuchnia';
    } else {
      await sendMsg(chatId, 'Wybierz stanowisko:', [['🍷 Bar i Sala'], ['🍽️ Kuchnia']]);
      return;
    }
    s.step = 'cat';
    s.results = {};
    s.lastKey = null;
    await showCategoryMenu(chatId, s);
    return;
  }

  if (text === '✅ Zakończ i wyślij raport') {
    if (Object.keys(s.results).length === 0) {
      await sendMsg(chatId, '⚠️ Nie wpisano żadnych danych. Najpierw wybierz kategorię.');
      return;
    }
    await sendMsg(chatId, '⏳ Zapisuję dane w Google Sheets...');
    const saved = await saveToSheets(s.dept, s.results, userName);
    const bycat = {};
    for (const [key, qty] of Object.entries(s.results)) {
      const [cat, prod] = key.split('|||');
      if (!bycat[cat]) bycat[cat] = [];
      bycat[cat].push({ prod, qty });
    }
    const date = new Date().toLocaleString('pl-PL');
    let report = `📋 <b>RAPORT INWENTARYZACJI</b>\n📅 ${date}\n👤 ${userName}\n🏪 ${s.dept}\n─────────────────\n`;
    for (const [cat, items] of Object.entries(bycat)) {
      report += `\n<b>${cat}</b>\n`;
      for (const { prod, qty } of items) report += `• ${prod}: <b>${qty}</b>\n`;
    }
    report += `─────────────────\nPozycji: <b>${Object.keys(s.results).length}</b>\n`;
    report += saved ? `✅ Zapisano w Google Sheets` : `⚠️ Błąd zapisu`;
    await sendMsg(chatId, report);
    if (managerChatId && managerChatId !== String(chatId)) {
      await tg('sendMessage', { chat_id: managerChatId, text: report, parse_mode: 'HTML' });
    }
    await sendMsg(chatId, 'Gotowe! Chcesz zacząć od nowa?', [['🔄 Nowa inwentaryzacja'], ['🏠 Menu główne']]);
    s.step = 'done';
    return;
  }

  if (text === '🔄 Nowa inwentaryzacja') {
    await handleMessage(chatId, '/start', userName);
    return;
  }

  if (text === '✏️ Исправить последнее') {
    if (s.lastKey) {
      const [cat, prod] = s.lastKey.split('|||');
      const oldVal = s.results[s.lastKey];
      delete s.results[s.lastKey];
      s.prodIdx--;
      s.lastKey = null;
      await sendMsg(chatId,
        `✏️ Исправляем:\n<b>${prod}</b>\nБыло: <b>${oldVal}</b>\n\nВведи правильное количество:`,
        [['0'], ['0.5'], ['1'], ['2'], ['⏭ Pomiń'], ['↩️ Wróć do kategorii'], ['🏠 Menu główne']]
      );
    } else {
      await sendMsg(chatId, '⚠️ Нечего исправлять.');
    }
    return;
  }

  if (s.step === 'cat' || s.step === 'product') {
    const cats = Object.keys(PRODUCTS[s.dept] || {});
    const matchedCat = cats.find(c => text === c || text.includes(c.replace(/[^\w\s]/g, '').trim()));
    if (matchedCat) {
      s.cat = matchedCat;
      s.products = PRODUCTS[s.dept][matchedCat];
      s.prodIdx = 0;
      s.step = 'product';
      await askNextProduct(chatId, s);
      return;
    }
  }

  if (s.step === 'product') {
    if (text === '⏭ Pomiń') { s.prodIdx++; await askNextProduct(chatId, s); return; }
    if (text === '↩️ Wróć do kategorii') {
      s.step = 'cat';
      await showCategoryMenu(chatId, s);
      return;
    }
    const num = parseFloat(text.replace(',', '.'));
    if (!isNaN(num) && num >= 0) {
      const key = `${s.cat}|||${s.products[s.prodIdx]}`;
      s.results[key] = num;
      s.lastKey = key;
      s.prodIdx++;
      await askNextProduct(chatId, s);
    } else {
      await sendMsg(chatId,
        `⚠️ Wpisz liczbę (np. <b>2</b> lub <b>1.5</b>)\n\n<b>${s.products[s.prodIdx]}</b> — ile?`,
        [['0'], ['0.5'], ['1'], ['2'], ['⏭ Pomiń'], ['↩️ Wróć do kategorii'], ['🏠 Menu główne']]
      );
    }
    return;
  }

  await sendMsg(chatId, 'Użyj /start żeby zacząć.', [['/start']]);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 200, body: 'Karczma Bot OK' };
  try {
    const body = JSON.parse(event.body);
    const message = body.message || body.edited_message;
    if (!message) return { statusCode: 200, body: 'ok' };
    const chatId = message.chat.id;
    const text = message.text || '';
    const userName = message.from.first_name || 'Pracownik';
    await handleMessage(chatId, text, userName);
  } catch (e) {
    console.error(e);
  }
  return { statusCode: 200, body: 'ok' };
};
