/* Кабинет команды ASTTA. Поставщики из Китая сюда не заходят: они только источник товара.
   Команда TT и основатели загружают каталоги, заказывают у поставщиков оплаченное, ведут посты в ленту.
   Без сервера страница работает на демо-данных в браузере, на сервере (/seller/, body[data-api]) —
   с настоящими через /api/seller. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const imgSrc = (id) => (/^(data:|https?:|\/|blob:)/.test(id || '') ? id : `assets/img/${id}.jpg`);
  const nf = new Intl.NumberFormat('ru-RU');
  const cny = (n) => `${nf.format(Math.round(n * 100) / 100)} ¥`;
  const rub = (n) => `${nf.format(Math.round(n))} ₽`;
  const round10 = (n) => Math.round(n / 10) * 10;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const num = (v) => Number(v);

  /* ---------- Демо-данные (на сервере приходят из API) ---------- */
  const CATS = { clothes: 'Одежда', shoes: 'Обувь', furniture: 'Мебель', home: 'Дом', tech: 'Электроника', acc: 'Аксессуары', bags: 'Сумки' };
  const SEED_SUPPLIERS = [
    { code: 'gz', name: 'TT · Гуанчжоу', city: 'Гуанчжоу', about: 'Одежда, рынок Baima', wechat: 'tt_gz_baima', phone: '+86 138 0000 0001', pay: 'Alipay через TT', is_active: true },
    { code: 'jj', name: 'TT · Цзиньцзян', city: 'Цзиньцзян', about: 'Обувь с фабрик Фуцзяни', wechat: 'tt_jinjiang', phone: '+86 138 0000 0002', pay: 'Банковский перевод', is_active: true },
    { code: 'fs', name: 'TT · Фошань', city: 'Фошань', about: 'Мебель, рынок Лэцун', wechat: 'tt_foshan', phone: '+86 138 0000 0003', pay: 'Alipay через TT', is_active: true },
    { code: 'sz', name: 'TT · Шэньчжэнь', city: 'Шэньчжэнь', about: 'Электроника, Хуацянбэй', wechat: 'tt_shenzhen', phone: '+86 138 0000 0004', pay: 'Наличные через агента', is_active: true },
    { code: 'yw', name: 'TT · Иу', city: 'Иу', about: 'Аксессуары и сумки, рынок Футянь', wechat: 'tt_yiwu', phone: '+86 138 0000 0005', pay: 'Alipay через TT', is_active: true },
  ];
  // id, поставщик, категория, название, название у поставщика, ¥, кг, опт, скидка, крупногабарит, размеры, цвета
  const RAW = [
    ['runner', 'jj', 'shoes', 'Кроссовки беговые Cloud', '轻便跑步鞋 Cloud', 268, 1.1, [[6, 198], [30, 176]], 0, false, '39-45', 'белый, чёрный'],
    ['loafers', 'jj', 'shoes', 'Лоферы замшевые', '麂皮乐福鞋', 210, 1, [[5, 165], [20, 148]], 15, false, '38-44', 'коричневый'],
    ['leather-jacket', 'gz', 'clothes', 'Косуха из натуральной кожи', '真皮机车夹克', 520, 1.6, [[3, 430], [10, 395]], 0, false, 'S, M, L, XL', 'чёрный'],
    ['bomber', 'gz', 'clothes', 'Бомбер oversize', '宽松飞行员夹克', 189, 0.9, [[5, 142], [30, 128]], 20, false, 'M, L, XL', 'хаки, чёрный'],
    ['tee-white', 'gz', 'clothes', 'Футболка базовая, 240 г/м²', '基础款纯棉T恤 240克', 39, 0.3, [[20, 26], [100, 22]], 0, false, 'S, M, L, XL, XXL', 'белый, чёрный, серый'],
    ['sweatshirt', 'gz', 'clothes', 'Свитшот, футер трёхнитка', '三线毛圈卫衣', 79, 0.6, [[10, 58], [50, 51]], 0, false, 'S, M, L, XL', 'серый, бежевый'],
    ['tee-black', 'gz', 'clothes', 'Футболка с принтом', '印花T恤', 45, 0.3, [[20, 31], [100, 27]], 10, false, 'M, L, XL', 'чёрный'],
    ['sofa', 'fs', 'furniture', 'Диван трёхместный, велюр', '三人位丝绒沙发', 2980, 48, [[2, 2690], [5, 2480]], 0, true, '', 'зелёный, серый'],
    ['lounge-chair', 'fs', 'furniture', 'Кресло на поворотной опоре', '旋转休闲椅', 1150, 16, [[2, 990], [6, 920]], 0, true, '', ''],
    ['stool', 'fs', 'furniture', 'Табурет барный, ясень', '白蜡木吧台凳', 160, 4.5, [[4, 128], [20, 112]], 12, false, '', ''],
    ['lamp', 'fs', 'home', 'Торшер с поворотным плафоном', '可调灯头落地灯', 230, 5, [[4, 185], [20, 166]], 0, false, '', 'чёрный, белый'],
    ['headphones', 'sz', 'tech', 'Наушники накладные, Bluetooth 5.3', '头戴式蓝牙耳机 5.3', 159, 0.5, [[10, 118], [50, 104]], 0, false, '', 'чёрный, белый'],
    ['headphones-anc', 'sz', 'tech', 'Наушники с шумоподавлением', '主动降噪耳机', 299, 0.7, [[5, 236], [30, 214]], 0, false, '', 'чёрный'],
    ['watch', 'yw', 'acc', 'Часы кварцевые, корпус 40 мм', '石英手表 40毫米表盘', 129, 0.3, [[10, 92], [50, 81]], 18, false, '', 'серебряный, золотой'],
    ['sunglasses', 'yw', 'acc', 'Очки солнцезащитные, UV400', '太阳镜 UV400', 58, 0.15, [[20, 34], [100, 28]], 0, false, '', 'чёрный'],
    ['bag', 'yw', 'bags', 'Сумка-портфель, экокожа', '环保皮革公文包', 245, 0.9, [[5, 188], [20, 170]], 0, false, '', 'чёрный, коричневый'],
    ['backpack', 'yw', 'bags', 'Рюкзак городской, 20 л', '城市双肩包 20升', 139, 0.8, [[10, 104], [40, 95]], 0, false, '', 'чёрный, серый'],
    ['armchair', 'fs', 'furniture', 'Кресло с каретной стяжкой', '拉扣单人沙发椅', 690, 11, [[2, 590], [6, 545]], 0, true, '', ''],
  ];
  const SEED_PRODUCTS = [
    ...RAW.map(([id, sup, cat, ru, zh, price, kg, tiers, sale, bulky, sizes, colors], i) => ({
      id, sup, cat, ru, zh, sku: `${sup.toUpperCase()}-${String(101 + i)}`, src: '', price, kg, tiers, sale, bulky, sizes, colors,
      img: id, photos: 1, desc: '', status: 'published', orders: (i * 7) % 23,
    })),
    { id: 'hoodie-380', sup: 'gz', cat: 'clothes', ru: 'Худи с начёсом, 380 г/м²', zh: '加绒连帽卫衣 380克', sku: 'GZ-201', src: 'https://detail.1688.com/offer/000000000.html', price: 96, kg: 0.8, tiers: [[10, 72], [50, 64]], sale: 0, bulky: false, sizes: 'S, M, L, XL', colors: 'серый, чёрный', img: 'banner-hoodie', photos: 1, desc: 'Ждём от поставщика фото всех цветов', status: 'draft', orders: 0 },
  ];
  // Оплаченные заказы покупателей, разложенные по поставщикам: их команда заказывает у поставщика.
  const SEED_ORDERS = [
    { id: 1, num: 'A-000131', sup: 'gz', date: '30.10 10:42', mode: 'retail', status: 'to_order', items: [['bomber', 'L', 'хаки', 1]] },
    { id: 2, num: 'A-000129', sup: 'gz', date: '30.10 09:15', mode: 'wholesale', status: 'to_order', items: [['tee-white', 'M', 'белый', 30], ['tee-black', 'L', 'чёрный', 20]] },
    { id: 3, num: 'A-000128', sup: 'gz', date: '30.10 08:02', mode: 'retail', status: 'to_order', items: [['tee-white', 'M', 'белый', 2]] },
    { id: 4, num: 'A-000124', sup: 'gz', date: '29.10 18:03', mode: 'retail', status: 'ordered', items: [['leather-jacket', 'M', 'чёрный', 1]] },
    { id: 5, num: 'A-000117', sup: 'gz', date: '28.10 12:30', mode: 'wholesale', status: 'shipped', tracking: 'YT7425581123', items: [['sweatshirt', 'L', 'серый', 20]] },
    { id: 6, num: 'A-000108', sup: 'gz', date: '26.10 16:47', mode: 'retail', status: 'received', items: [['tee-black', 'XL', 'чёрный', 2]] },
    { id: 7, num: 'A-000130', sup: 'jj', date: '30.10 10:05', mode: 'retail', status: 'to_order', items: [['runner', '42', 'белый', 1]] },
    { id: 8, num: 'A-000121', sup: 'jj', date: '29.10 11:20', mode: 'wholesale', status: 'ordered', items: [['loafers', '41', 'коричневый', 5]] },
    { id: 9, num: 'A-000127', sup: 'yw', date: '30.10 08:51', mode: 'wholesale', status: 'to_order', items: [['sunglasses', '', 'чёрный', 20]] },
    { id: 10, num: 'A-000120', sup: 'fs', date: '29.10 09:40', mode: 'retail', status: 'shipped', tracking: 'SF1302948871', items: [['sofa', '', 'серый', 1]] },
    { id: 11, num: 'A-000126', sup: 'sz', date: '29.10 21:12', mode: 'retail', status: 'received', items: [['headphones-anc', '', 'чёрный', 1]] },
  ];
  const SEED_POSTS = [
    { id: 1, sup: 'gz', pid: 'leather-jacket', kind: 'new', text: 'Новая партия косух из натуральной кожи. Перед отправкой каждую проверяем на складе и фотографируем.', images: ['leather-jacket'], date: '29.10.2026', status: 'published' },
  ];
  // Для подсказки «цена для покупателя»; на сервере курс берётся из /api/rate.
  const PRICING = { rate: 11.4, fee: 0.05, ship: { regular: 420, bulky: 190 } };

  /* ---------- Состояние ---------- */
  const API = document.body.dataset.api || '';
  const LIVE = !!API;
  const KEY = 'astta-team-v1';
  function fresh() {
    return {
      view: 'overview', sup: 'gz', pfilter: 'all', q: '', ofilter: 'to_order',
      suppliers: clone(SEED_SUPPLIERS), products: clone(SEED_PRODUCTS), orders: clone(SEED_ORDERS), posts: clone(SEED_POSTS),
    };
  }
  let S;
  if (LIVE) {
    S = { ...fresh(), suppliers: [], products: [], orders: [], posts: [], me: null, ai: false, overview: null, purchase: null };
  } else {
    try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  }
  function save() {
    if (LIVE) return;
    try {
      // Фото, выбранные в превью, не сохраняем: они большие и только для показа.
      const light = {
        ...S,
        products: S.products.map((p) => (/^(data:|blob:)/.test(p.img || '') ? { ...p, img: '' } : p)),
        posts: S.posts.map((x) => ({ ...x, images: x.images.filter((src) => !/^(data:|blob:)/.test(src)) })),
      };
      localStorage.setItem(KEY, JSON.stringify(light));
    } catch (e) { /* хранилище недоступно: работаем без сохранения */ }
  }

  const supplier = () => S.suppliers.find((s) => s.code === S.sup) || S.suppliers[0];
  const product = (id) => S.products.find((p) => String(p.id) === String(id));
  const mine = (list) => list.filter((x) => x.sup === S.sup);

  /* ---------- Цена для покупателя (как на сервере, только примерно) ---------- */
  function buyerRub(p) {
    const unit = p.sale ? Math.round(p.price * (1 - p.sale / 100)) : p.price;
    const goods = unit * PRICING.rate;
    return round10(goods + p.kg * (p.bulky ? PRICING.ship.bulky : PRICING.ship.regular) + goods * PRICING.fee);
  }

  /* ---------- Общие куски ---------- */
  const STATUS = { published: ['На сайте', 'st--ok'], draft: ['Черновик', 'st--wait'], moderation: ['Черновик', 'st--wait'], rejected: ['Снят', 'st--bad'] };
  const pStatus = (p) => `<span class="st ${(STATUS[p.status] || STATUS.draft)[1]}">${(STATUS[p.status] || STATUS.draft)[0]}</span>`;
  const OSTATUS = {
    to_order: ['Заказать', 'st--wait'], ordered: ['Заказано', 'st--go'], shipped: ['Едет на склад', 'st--go'],
    received: ['На складе', 'st--ok'], cancelled: ['Нет в наличии', 'st--bad'],
  };
  const KINDS = { new: 'Новинка', restock: 'Поступление', opt: 'Оптовое предложение' };
  const thumb = (p) => (p && p.img
    ? `<img class="thumb" src="${esc(imgSrc(p.img))}" alt="" width="48" height="48" loading="lazy">`
    : '<span class="thumb thumb--empty">нет фото</span>');
  const tiersText = (p) => p.tiers.map(([q, c]) => `${q}+ · ${cny(c)}`).join('<br>') || '<span class="muted">только розница</span>';

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  /* ---------- Каркас ---------- */
  const NAV = [['overview', 'home', 'Обзор'], ['products', 'box', 'Товары'], ['orders', 'truck', 'Заказы'], ['posts', 'spark', 'Посты'], ['suppliers', 'users', 'Поставщики']];
  function render() {
    $('#topDemo').hidden = LIVE;
    if (LIVE && !S.me) {
      $('#topRight').innerHTML = '';
      $('#side').innerHTML = '';
      $('#main').innerHTML = vLogin();
      return;
    }
    const active = S.suppliers.filter((s) => s.is_active !== false);
    $('#topRight').innerHTML = `<label class="suppick"><span>Поставщик</span>
        <select class="select" id="supPick">${active.map((s) => `<option value="${esc(s.code)}" ${s.code === S.sup ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      ${LIVE ? '<button class="btn btn--sm" type="button" data-act="logout">Выйти</button>' : ''}`;
    const toOrder = LIVE ? (S.overview ? S.overview.to_order : 0) : mine(S.orders).filter((o) => o.status === 'to_order').length;
    $('#side').innerHTML = NAV.map(([id, ic, name]) => `<button type="button" data-nav="${id}" ${S.view === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${name}</span>${id === 'orders' && toOrder ? `<span class="badge">${toOrder}</span>` : ''}</button>`).join('')
      + (LIVE ? `<a class="side__link" href="/admin/">${icon('arrow-ur')}<span>Админка: цены, заявки, ИИ</span></a>` : '');
    const views = { overview: vOverview, products: vProducts, orders: vOrders, posts: vPosts, suppliers: vSuppliers };
    $('#main').innerHTML = (views[S.view] || vOverview)();
  }

  /* ---------- Обзор ---------- */
  function counts() {
    if (LIVE && S.overview) return S.overview;
    const orders = mine(S.orders);
    const products = mine(S.products);
    const by = (st) => orders.filter((o) => o.status === st).length;
    return {
      to_order: by('to_order'), ordered: by('ordered'), shipped: by('shipped'), received_week: by('received'),
      published: products.filter((p) => p.status === 'published').length,
      drafts: products.filter((p) => p.status !== 'published').length,
      posts: mine(S.posts).length,
    };
  }
  function vOverview() {
    const s = supplier();
    const c = counts();
    const todo = [
      c.to_order && `<button type="button" data-goto="orders" data-ofilter="to_order"><span class="dot dot--warn"></span>Заказать у поставщика: ${c.to_order} ${plural(c.to_order, 'заказ', 'заказа', 'заказов')}${icon('arrow-ur')}</button>`,
      c.ordered && `<button type="button" data-goto="orders" data-ofilter="ordered"><span class="dot"></span>Ждём трек-номер от поставщика: ${c.ordered}${icon('arrow-ur')}</button>`,
      c.drafts && `<button type="button" data-goto="products" data-pfilter="draft"><span class="dot"></span>Черновики, не видны покупателям: ${c.drafts}${icon('arrow-ur')}</button>`,
    ].filter(Boolean);
    return `
      <div class="pagehead"><div><h1>${esc(s.name)}</h1><p>${esc([s.city, s.about, s.wechat && `WeChat ${s.wechat}`].filter(Boolean).join(' · '))}</p></div>
        <div class="pagehead__actions"><button class="btn" type="button" data-act="edit-supplier" data-code="${esc(s.code)}">Карточка поставщика</button></div></div>
      <div class="kpis">
        <button class="kpi kpi--hot" type="button" data-goto="orders" data-ofilter="to_order"><span>Заказать у поставщика</span><b>${c.to_order}</b></button>
        <button class="kpi" type="button" data-goto="orders" data-ofilter="shipped"><span>Едет на склад</span><b>${c.ordered + c.shipped}</b></button>
        <button class="kpi" type="button" data-goto="products" data-pfilter="published"><span>Товаров на сайте</span><b>${c.published}</b></button>
        <button class="kpi" type="button" data-goto="posts"><span>Постов в ленте</span><b>${c.posts}</b></button>
      </div>
      <div class="grid2">
        <section class="panel"><h2>Что сделать</h2>
          <div class="todo">${todo.join('') || '<p class="muted">Всё сделано: новых заказов у этого поставщика нет.</p>'}</div>
        </section>
        <section class="panel"><h2>Быстро</h2>
          <div class="todo todo--quick">
            <button type="button" data-act="import">${icon('upload')}Загрузить каталог поставщика: Excel и фото</button>
            <button type="button" data-act="add-product">${icon('plus')}Добавить товар вручную</button>
            <button type="button" data-goto="posts">${icon('spark')}Сделать пост в ленту</button>
          </div>
          <p class="note">Каталоги присылают поставщики, а на сайт их выкладываете вы: поставщики в систему не заходят.</p>
        </section>
      </div>`;
  }
  const plural = (n, one, few, many) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  /* ---------- Товары ---------- */
  function vProducts() {
    const list = mine(S.products);
    const shown = list
      .filter((p) => S.pfilter === 'all' || (S.pfilter === 'published' ? p.status === 'published' : p.status !== 'published'))
      .filter((p) => !S.q || `${p.ru} ${p.sku} ${p.zh}`.toLowerCase().includes(S.q.toLowerCase()));
    const chips = [['all', 'Все', list.length], ['published', 'На сайте', list.filter((p) => p.status === 'published').length], ['draft', 'Черновики', list.filter((p) => p.status !== 'published').length]]
      .map(([id, name, n]) => `<button class="chip" type="button" data-pfilter="${id}" aria-pressed="${S.pfilter === id}">${name}<em>${n}</em></button>`).join('');
    const rows = shown.map((p) => `<tr>
        <td><div class="pcell">${thumb(p)}<div><b>${esc(p.ru)}</b><span>${esc([p.sku, CATS[p.cat]].filter(Boolean).join(' · '))}</span></div></div></td>
        <td class="num">${cny(p.price)}${p.sale ? `<br><span class="muted">−${p.sale}%</span>` : ''}</td>
        <td class="num">${tiersText(p)}</td>
        <td class="num">${p.kg} кг</td>
        <td>${pStatus(p)}</td>
        <td class="num">${p.orders || 0}</td>
        <td><button class="btn btn--sm" type="button" data-act="edit-product" data-id="${p.id}">Изменить</button></td>
      </tr>`).join('');
    return `
      <div class="pagehead"><div><h1>Товары</h1><p>Каталог поставщика на сайте. Что сохраняете здесь, сразу видят покупатели, черновики — нет.</p></div>
        <div class="pagehead__actions">
          <button class="btn" type="button" data-act="import">${icon('upload')}Загрузить каталог</button>
          <button class="btn btn--lime" type="button" data-act="add-product">${icon('plus')}Добавить товар</button>
        </div></div>
      <div class="filters">${chips}<label class="search">${icon('search')}<span class="sr">Поиск</span><input id="pSearch" placeholder="Название или артикул" value="${esc(S.q)}" autocomplete="off"></label></div>
      ${shown.length ? `<div class="tablewrap"><table class="tbl"><thead><tr>
        <th>Товар</th><th class="num">Цена у поставщика</th><th class="num">Опт</th><th class="num">Вес</th><th>Статус</th><th class="num">Заказов</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<div class="empty">${list.length ? 'Ничего не нашлось' : 'Товаров пока нет: загрузите каталог поставщика или добавьте товар вручную.'}</div>`}`;
  }

  let draft = null;
  let draftFile = null;
  function openProductForm(id) {
    const p = id ? product(id) : null;
    draftFile = null;
    draft = p ? clone(p) : { id: '', sup: S.sup, cat: Object.keys(CATS)[0], ru: '', zh: '', sku: '', src: '', sizes: '', colors: '', price: '', kg: '', tiers: [], sale: 0, bulky: false, img: '', photos: 0, desc: '', status: 'published', orders: 0 };
    openDrawer(p ? 'Изменить товар' : 'Новый товар', productFormHTML());
  }
  function productFormHTML(errors = {}) {
    const d = draft;
    const err = (k) => (errors[k] ? `<span class="err">${errors[k]}</span>` : '');
    const cls = (k, extra = '') => `field ${extra} ${errors[k] ? 'is-error' : ''}`;
    const tiers = d.tiers.map(([q, c], i) => `<div class="tier">
        <input type="number" min="1" step="1" inputmode="numeric" aria-label="От, шт." placeholder="От, шт." value="${esc(q)}" data-tier="${i}" data-k="0">
        <input type="number" min="0.01" step="0.01" inputmode="decimal" aria-label="Цена, ¥" placeholder="Цена, ¥" value="${esc(c)}" data-tier="${i}" data-k="1">
        <button class="iconbtn" type="button" data-act="del-tier" data-i="${i}" aria-label="Убрать ступень">${icon('close')}</button></div>`).join('');
    const priceOk = Number(d.price) > 0 && Number(d.kg) > 0;
    return `<form class="form" id="productForm" novalidate>
      <label class="${cls('ru', 'field--full')}"><span>Название для покупателей</span><input id="fRu" value="${esc(d.ru)}" required>${err('ru')}</label>
      <label class="${cls('sku')}"><span>Артикул поставщика</span><input id="fSku" value="${esc(d.sku)}" maxlength="64">${err('sku')}</label>
      <label class="field"><span>Категория</span><select id="fCat">${Object.entries(CATS).map(([c, name]) => `<option value="${c}" ${c === d.cat ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>
      <label class="${cls('price')}"><span>Цена у поставщика, ¥</span><input id="fPrice" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(d.price)}">${err('price')}</label>
      <label class="field"><span>Скидка, %</span><input id="fSale" type="number" min="0" max="90" step="1" inputmode="numeric" value="${esc(d.sale)}"></label>
      <label class="${cls('kg')}"><span>Вес в упаковке, кг</span><input id="fKg" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(d.kg)}">${err('kg')}</label>
      <div class="field field--full"><span>Опт: от скольки штук и цена за штуку. Можно не заполнять, тогда товар только в розницу</span><div class="tiers">${tiers}</div>
        <button class="linkbtn" type="button" data-act="add-tier" style="align-self:flex-start">+ Оптовая ступень</button></div>
      <label class="field"><span>Размеры через запятую (S, M, L или 36-45)</span><input id="fSizes" value="${esc(d.sizes)}" maxlength="300"></label>
      <label class="field"><span>Цвета через запятую</span><input id="fColors" value="${esc(d.colors)}" maxlength="300"></label>
      <p class="note field--full">Покупатель выберет размер и цвет только из этих списков, и поставщик получит заказ без ошибок. Пусто — без выбора.</p>
      <label class="check field--full"><input id="fBulky" type="checkbox" ${d.bulky ? 'checked' : ''}>Крупногабарит (мебель, едет сборным грузом)</label>
      <label class="field field--full"><span>Главное фото</span><input id="fPhoto" type="file" accept="image/*"></label>
      ${d.img ? `<div class="preview field--full"><img src="${esc(imgSrc(d.img))}" alt=""><span class="muted">${d.photos > 1 ? `Фото у товара: ${d.photos}. Остальные загружайте архивом в «Загрузке каталога».` : esc(d.ru)}</span></div>` : ''}
      <label class="field field--full"><span>Описание</span><textarea id="fDesc">${esc(d.desc)}</textarea></label>
      <label class="${cls('src', 'field--full')}"><span>Ссылка у поставщика (1688, Taobao, Poizon)</span><input id="fSrc" type="url" inputmode="url" value="${esc(d.src)}" placeholder="https://">${err('src')}</label>
      <label class="field field--full"><span>Название у поставщика (как в его каталоге, для заказа в WeChat)</span><input id="fZh" value="${esc(d.zh)}"></label>
      ${LIVE && S.ai ? '<div class="field--full"><button class="linkbtn" type="button" data-act="translate">Перевести название и описание поставщика на русский (YandexGPT)</button></div>' : ''}
      <label class="check field--full"><input id="fPublish" type="checkbox" ${d.status === 'published' ? 'checked' : ''}>Показывать на сайте</label>
      ${priceOk ? `<div class="price-hint field--full">Цена для покупателя под ключ, примерно: <b>${rub(buyerRub(normalize(d)))}</b></div>` : ''}
      <div class="form__actions">
        <button class="btn" type="button" data-act="close-drawer">Отмена</button>
        <button class="btn btn--lime" type="submit">Сохранить</button>
      </div></form>`;
  }
  function normalize(d) {
    return { ...d, price: Number(d.price), kg: Number(d.kg), sale: Number(d.sale) || 0, tiers: d.tiers.map(([q, c]) => [Number(q), Number(c)]).filter(([q, c]) => q > 0 && c > 0).sort((a, b) => a[0] - b[0]) };
  }
  function readForm() {
    draft.ru = $('#fRu').value.trim();
    draft.sku = $('#fSku').value.trim();
    draft.cat = $('#fCat').value;
    draft.price = $('#fPrice').value;
    draft.sale = $('#fSale').value;
    draft.kg = $('#fKg').value;
    draft.sizes = $('#fSizes').value.trim();
    draft.colors = $('#fColors').value.trim();
    draft.bulky = $('#fBulky').checked;
    draft.desc = $('#fDesc').value.trim();
    draft.src = $('#fSrc').value.trim();
    draft.zh = $('#fZh').value.trim();
    draft.status = $('#fPublish').checked ? 'published' : 'draft';
  }
  let saving = false;
  async function submitProduct() {
    readForm();
    const n = normalize(draft);
    const errors = {};
    if (!n.ru) errors.ru = 'Обязательно';
    if (!(n.price > 0)) errors.price = 'Больше 0';
    if (!(n.kg > 0)) errors.kg = 'Больше 0';
    if (n.src && !/^https?:\/\/\S+$/i.test(n.src)) errors.src = 'Нужна ссылка вида https://…';
    if (n.sku && S.products.some((p) => p.sup === S.sup && p.sku === n.sku && String(p.id) !== String(n.id))) errors.sku = 'Такой артикул уже есть у этого поставщика';
    if (Object.keys(errors).length) { $('#drawerBody').innerHTML = productFormHTML(errors); return; }
    if (!LIVE) {
      if (!n.id) { n.id = `p${Date.now().toString(36)}`; S.products.unshift(n); } else { S.products[S.products.findIndex((p) => String(p.id) === String(n.id))] = n; }
      save(); closeDrawer(); render();
      toast(n.status === 'published' ? 'Сохранено, товар на сайте' : 'Сохранено черновиком');
      return;
    }
    if (saving) return; // двойной клик по «Сохранить» не должен создавать два товара
    saving = true;
    try {
      const body = { ru: n.ru, zh: n.zh, sku: n.sku, src: n.src, sizes: n.sizes, colors: n.colors, cat: n.cat, price: n.price, sale: n.sale, kg: n.kg, bulky: n.bulky, tiers: n.tiers, desc: n.desc, publish: n.status === 'published' };
      let saved;
      try {
        saved = await api(n.id ? `/products/${n.id}` : '/products', { method: n.id ? 'PUT' : 'POST', body });
      } catch (e) {
        if (/'sku': 'duplicate'/.test(e.message)) { $('#drawerBody').innerHTML = productFormHTML({ sku: 'Такой артикул уже есть у этого поставщика' }); return; }
        toast(`Не сохранилось: ${e.message}`);
        return;
      }
      // Если фото не загрузится, шторка остаётся открытой, а повторное сохранение обновит этот же товар.
      draft.id = String(saved.id);
      upsert(S.products, mapProduct(saved));
      if (draftFile) {
        const form = new FormData();
        form.append('file', draftFile);
        const withImage = await liveTry(() => api(`/products/${saved.id}/image`, { method: 'POST', form }));
        if (!withImage) return;
        upsert(S.products, mapProduct(withImage));
      }
      closeDrawer(); render();
      toast(saved.status === 'published' ? 'Сохранено, товар на сайте' : 'Сохранено черновиком');
    } finally {
      saving = false;
    }
  }

  /* ---------- Загрузка каталога ---------- */
  function openImport() {
    const cols = ['Артикул', 'Название', 'Категория', 'Цена у поставщика, ¥', 'Вес, кг', 'Опт (можно пусто)', 'Размеры', 'Цвета', 'Крупногабарит', 'Описание', 'Ссылка у поставщика', 'Название у поставщика'];
    openDrawer(`Каталог: ${supplier().name}`, `
      <ol class="steps">
        <li>Скачайте шаблон и перенесите туда каталог поставщика: одна строка — один товар.</li>
        <li>Фото сложите в ZIP: имя файла начинается с артикула (A-101.jpg, A-101_2.jpg) или фото лежат в папке с артикулом. Новые фото заменяют старые. Если товары уже есть, можно загрузить только архив.</li>
        <li>Если в файле или архиве ошибка, не загрузится ничего, и вы увидите, что исправить.</li>
      </ol>
      <div><p class="note">Колонки шаблона</p><div class="cols">${cols.map((c) => `<span>${esc(c)}</span>`).join('')}</div></div>
      <button class="btn" type="button" data-act="template" style="align-self:flex-start">${icon('upload')}Скачать шаблон</button>
      <form class="form" id="importForm" novalidate style="grid-template-columns:minmax(0,1fr)">
        <label class="drop">${icon('upload')}<b>Файл Excel .xlsx</b><input type="file" id="importFile" accept=".xlsx"></label>
        <label class="drop">${icon('camera')}<b>Архив с фото .zip (необязательно)</b><input type="file" id="importPhotos" accept=".zip,application/zip"></label>
        <label class="check"><input id="importPublish" type="checkbox" checked>Сразу показывать на сайте</label>
        ${LIVE && S.ai ? '<label class="check"><input id="importTranslate" type="checkbox">Перевести названия поставщика на русский, где русского нет (YandexGPT)</label>' : ''}
        <div class="form__actions"><button class="btn btn--lime" type="submit">${icon('upload')}Загрузить</button></div>
      </form>
      ${LIVE ? '' : '<p class="note">Превью: файлы не уходят на сервер, добавятся 2 товара-примера.</p>'}
      <div id="importResult"></div>`);
  }
  let importing = false;
  async function doImport() {
    const file = $('#importFile').files[0];
    const photos = $('#importPhotos').files[0];
    const publish = $('#importPublish').checked;
    if (!file && !photos) { toast('Выберите файл Excel или архив с фото'); return; }
    const out = $('#importResult');
    if (!LIVE) {
      const added = [
        { cat: 'bags', ru: 'Мини-сумка через плечо', zh: '迷你斜挎包', price: 52, kg: 0.35, tiers: [[10, 38], [50, 33]], img: 'bag' },
        { cat: 'clothes', ru: 'Широкие брюки из вискозы', zh: '冰丝阔腿裤', price: 69, kg: 0.4, tiers: [[10, 49], [50, 43]], img: '' },
      ].map((x, i) => ({ id: `imp${Date.now().toString(36)}${i}`, sup: S.sup, sku: `IMP-${i + 1}`, src: '', sizes: '', colors: '', sale: 0, bulky: false, photos: x.img ? 1 : 0, desc: '', status: publish ? 'published' : 'draft', orders: 0, ...x }));
      S.products.unshift(...added);
      save();
      out.innerHTML = `<div class="result">Готово: новых ${added.length}. ${publish ? 'Товары уже на сайте.' : 'Сохранены черновиками.'}</div>`;
      render();
      return;
    }
    if (importing) return;
    importing = true;
    out.innerHTML = `<p class="note">Загружаю…${photos ? ' Фото уменьшаем и сохраняем, на большой архив уходит пара минут.' : ''}</p>`;
    const form = new FormData();
    if (file) form.append('file', file);
    if (photos) form.append('photos', photos);
    form.append('publish', publish ? 'true' : 'false');
    if ($('#importTranslate') && $('#importTranslate').checked) form.append('translate', 'true');
    let res;
    try { res = await liveTry(() => api('/import', { method: 'POST', form })); } finally { importing = false; }
    if (!res) { out.innerHTML = ''; return; }
    const warnings = (res.warnings || []).length ? `<div class="panel" style="border-color:var(--warn)"><ul class="tips">${res.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
    if (!res.ok) {
      out.innerHTML = `<div class="panel" style="border-color:var(--bad)"><b>Ничего не загружено. Исправьте ошибки:</b><ul class="tips">${res.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>${warnings}`;
      return;
    }
    await loadSupplier();
    out.innerHTML = `<div class="result">Готово: новых ${res.created}, обновлено ${res.updated}, фото ${res.photos}${res.translated ? `, переведено названий ${res.translated}` : ''}. ${publish ? 'Товары уже на сайте.' : 'Сохранены черновиками.'}</div>${warnings}`;
    render();
  }

  /* ---------- Заказы у поставщика ---------- */
  const COLORS_ZH = { 'чёрный': '黑色', 'белый': '白色', 'серый': '灰色', 'бежевый': '米色', 'коричневый': '棕色', 'хаки': '卡其色', 'зелёный': '绿色', 'серебряный': '银色', 'золотой': '金色' };
  function demoPurchase() {
    const orders = mine(S.orders).filter((o) => o.status === 'to_order');
    const lines = [];
    for (const o of orders) {
      for (const [pid, size, color, qty] of o.items) {
        const p = product(pid);
        const unit = o.mode === 'wholesale' ? (p.tiers.filter(([from]) => qty >= from).pop() || p.tiers[0] || [0, p.price])[1] : p.price;
        const same = lines.find((l) => l.pid === pid && l.size === size && l.color === color && l.unit === unit);
        if (same) same.qty += qty; else lines.push({ pid, title: p.ru, zh: p.zh, sku: p.sku, size, color, qty, unit });
      }
    }
    const total = lines.reduce((s, l) => s + l.unit * l.qty, 0);
    const rows = ['您好！ASTTA 下单：', ...lines.map((l, i) => {
      const det = [l.sku && `货号 ${l.sku}`, l.color && `颜色 ${COLORS_ZH[l.color] ? `${COLORS_ZH[l.color]}（${l.color}）` : l.color}`, l.size && `尺码 ${l.size}`].filter(Boolean).join(' · ');
      return `${i + 1}. ${l.zh || l.title}${det ? `（${det}）` : ''} × ${l.qty} 件，单价 ${l.unit} 元`;
    }), `合计 ${lines.reduce((s, l) => s + l.qty, 0)} 件，${total} 元。`, `请确认有货并发往 TT 仓库，包裹上请写订单号：${orders.map((o) => o.num).join(', ')}。谢谢！`];
    return { lines, orders: orders.map((o) => o.id), total_qty: lines.reduce((s, l) => s + l.qty, 0), total_cny: total, text_zh: lines.length ? rows.join('\n') : '' };
  }
  function purchasePanel() {
    const pu = LIVE ? S.purchase : demoPurchase();
    if (S.ofilter !== 'to_order' || !pu || !pu.lines.length) return '';
    const s = supplier();
    const rows = pu.lines.map((l) => `<li>${esc(l.title)}${l.color ? ` · ${esc(l.color)}` : ''}${l.size ? ` · ${esc(l.size)}` : ''} — <b>${l.qty} шт.</b> × ${cny(l.unit)}</li>`).join('');
    return `<section class="panel purchase"><h2>Сводный заказ поставщику</h2>
      <p class="muted">Покупатели оплатили, одинаковые товары сложены в одну строку. Отправьте сообщение поставщику${s.wechat ? ` в WeChat ${esc(s.wechat)}` : ''}, потом отметьте заказанным.</p>
      <ul class="tips">${rows}</ul>
      <p><b>Итого: ${pu.total_qty} шт., ${cny(pu.total_cny)}</b></p>
      <label class="field"><span>Сообщение поставщику в WeChat (на китайском)</span><textarea id="puText" readonly rows="${Math.min(12, pu.lines.length * 2 + 3)}">${esc(pu.text_zh)}</textarea></label>
      <div class="form__actions"><button class="btn" type="button" data-act="copy-purchase">Скопировать</button>
        <button class="btn btn--lime" type="button" data-act="purchase-ordered">${icon('check')}Отметить всё заказанным</button></div>
    </section>`;
  }
  function vOrders() {
    const list = mine(S.orders);
    const chips = Object.entries(OSTATUS).map(([st, [name]]) => `<button class="chip" type="button" data-ofilter="${st}" aria-pressed="${S.ofilter === st}">${name}<em>${list.filter((o) => o.status === st).length}</em></button>`).join('');
    const shown = list.filter((o) => o.status === S.ofilter);
    return `
      <div class="pagehead"><div><h1>Заказы у поставщика</h1><p>Только оплаченные заказы покупателей: их можно сразу заказывать у поставщика.</p></div></div>
      <div class="filters">${chips}</div>
      ${purchasePanel()}
      <div class="orders">${shown.map(orderCard).join('') || '<div class="empty">Заказов с таким статусом нет</div>'}</div>`;
  }
  function orderItems(o) {
    return o.items.map((i) => (Array.isArray(i)
      ? (() => { const [pid, size, color, qty] = i; const p = product(pid) || {}; return { ru: p.ru, img: p.img, size, color, qty, unit: o.mode === 'wholesale' ? ((p.tiers || []).filter(([from]) => qty >= from).pop() || (p.tiers || [])[0] || [0, p.price])[1] : p.price }; })()
      : i));
  }
  function orderCard(o) {
    const items = orderItems(o);
    const rows = items.map((i) => `<div class="oitem">${thumb(i)}<div><b>${esc(i.ru)}</b><span>${[i.color, i.size && `размер ${i.size}`].filter(Boolean).map(esc).join(' · ')}${i.color || i.size ? ' · ' : ''}${i.qty} шт. × ${cny(i.unit)}</span></div><div class="num">${cny(i.unit * i.qty)}</div></div>`).join('');
    const total = items.reduce((s, i) => s + i.unit * i.qty, 0);
    let actions = '';
    let extra = '';
    if (o.status === 'to_order') {
      actions = `<button class="btn btn--sm btn--bad" type="button" data-act="out-of-stock" data-id="${o.id}">Нет в наличии: вернуть деньги</button>
        <button class="btn btn--sm btn--lime" type="button" data-act="ordered" data-id="${o.id}">${icon('check')}Заказано у поставщика</button>`;
    } else if (o.status === 'ordered') {
      extra = `<div class="ocard__wh"><b>Ждём, когда поставщик отправит на склад TT</b><span class="muted">Впишите трек-номер, который пришлёт поставщик.</span>
        <form data-ship-form="${o.id}" novalidate><label class="sr" for="tr-${o.id}">Трек-номер</label>
          <input id="tr-${o.id}" placeholder="Трек-номер" autocomplete="off">
          <button class="btn btn--lime" type="submit">${icon('truck')}Отправлено на склад</button></form></div>`;
      actions = `<button class="btn btn--sm btn--bad" type="button" data-act="out-of-stock" data-id="${o.id}">Нет в наличии: вернуть деньги</button>`;
    } else if (o.status === 'shipped') {
      actions = `<span class="muted">Трек ${esc(o.tracking)} · приёмку отмечает склад в админке</span>`;
    } else if (o.status === 'received') {
      actions = '<span class="muted">Склад TT принял посылку</span>';
    } else {
      actions = '<span class="muted">Отменено, деньги за эту часть вернём покупателю</span>';
    }
    return `<article class="ocard">
      <div class="ocard__head"><span class="ocard__num">${esc(o.num)}</span><span class="muted">${esc(o.date)} · ${o.mode === 'wholesale' ? 'Опт' : 'Розница'}</span>
        <span class="st ${OSTATUS[o.status][1]}">${OSTATUS[o.status][0]}</span></div>
      <div class="oitems">${rows}</div>${extra}
      <div class="ocard__foot"><span class="ocard__total">Итого у поставщика: ${cny(total)}</span><div class="ocard__actions">${actions}</div></div>
    </article>`;
  }
  async function orderAction(id, action, body) {
    if (!LIVE) {
      const o = S.orders.find((x) => String(x.id) === String(id));
      o.status = { confirm: 'ordered', cancel: 'cancelled', ship: 'shipped' }[action];
      if (body && body.tracking) o.tracking = body.tracking;
      save(); render();
      return true;
    }
    const res = await liveTry(() => api(`/orders/${id}/${action}`, { method: 'POST', body }));
    if (!res) return false;
    upsert(S.orders, mapOrder(res));
    await refreshCounts();
    render();
    return true;
  }

  /* ---------- Посты ---------- */
  function vPosts() {
    const published = mine(S.products).filter((p) => p.status === 'published');
    const posts = mine(S.posts);
    const card = (x) => {
      const p = x.pid ? product(x.pid) : null;
      return `<article class="postcard">
        ${x.images.length ? `<div class="postthumbs">${x.images.slice(0, 4).map((src) => `<img src="${esc(imgSrc(src))}" alt="" loading="lazy">`).join('')}${x.images.length > 4 ? `<span class="more">+${x.images.length - 4}</span>` : ''}</div>` : ''}
        ${x.text ? `<p>${esc(x.text)}</p>` : ''}
        <div class="postcard__meta"><span class="muted">${esc(x.date || '')}${p ? ` · ${esc(p.ru)}` : ''} · ${KINDS[x.kind] || ''}</span>
          <span class="st st--ok">В ленте</span>
          <button class="btn btn--sm btn--bad" type="button" data-act="del-post" data-id="${x.id}">Удалить</button></div>
      </article>`;
    };
    return `
      <div class="pagehead"><div><h1>Посты в ленту</h1><p>Пост с фото сразу появляется в ленте на сайте от имени поставщика. Видео сделаем следующим этапом контент-завода.</p></div></div>
      <div class="grid2">
        <section class="panel"><h2>Новый пост</h2>
          <form class="form" id="postForm" novalidate>
            <label class="field field--full"><span>Текст для покупателей</span><textarea id="poText" placeholder="Например: новая партия худи, плотный хлопок, 6 цветов"></textarea></label>
            <label class="field field--full"><span>Фото, до 10 штук</span><input id="poImages" type="file" accept="image/*" multiple></label>
            <div class="postthumbs field--full" id="poPreview"></div>
            <label class="field"><span>Товар (можно без него)</span><select id="poProduct"><option value="">Без товара</option>${published.map((p) => `<option value="${p.id}">${esc(p.ru)}</option>`).join('')}</select></label>
            <label class="field"><span>Тип</span><select id="poKind">${Object.entries(KINDS).map(([k, name]) => `<option value="${k}">${name}</option>`).join('')}</select></label>
            <div class="form__actions"><button class="btn btn--lime" type="submit">Опубликовать</button></div>
          </form>
        </section>
        <section class="panel"><h2>Посты поставщика</h2>
          ${posts.length ? `<div class="postlist">${posts.map(card).join('')}</div>` : '<p class="muted">Постов пока нет</p>'}
        </section>
      </div>`;
  }
  let postFiles = [];
  function postPreview(files) {
    postFiles = [...files];
    const box = $('#poPreview');
    box.innerHTML = postFiles.slice(0, 10).map((f) => `<img src="${URL.createObjectURL(f)}" alt="">`).join('')
      + (postFiles.length > 10 ? '<span class="err">Больше 10 фото: оставьте до 10</span>' : '');
  }
  let posting = false;
  async function submitPost() {
    const text = $('#poText').value.trim();
    if (!text && !postFiles.length) { toast('Добавьте текст или фото'); $('#poText').focus(); return; }
    if (postFiles.length > 10) { toast('Не больше 10 фото в посте'); return; }
    const pid = $('#poProduct').value;
    const kind = $('#poKind').value;
    if (!LIVE) {
      S.posts.unshift({ id: Date.now(), sup: S.sup, pid, kind, text, images: postFiles.map((f) => URL.createObjectURL(f)), date: new Date().toLocaleDateString('ru-RU'), status: 'published' });
      postFiles = [];
      save(); render(); toast('Опубликовано');
      return;
    }
    if (posting) return;
    posting = true;
    const form = new FormData();
    form.append('text', text);
    form.append('kind', kind);
    if (pid) form.append('product', pid);
    for (const f of postFiles) form.append('images', f);
    let res;
    try { res = await liveTry(() => api('/posts', { method: 'POST', form })); } finally { posting = false; }
    if (!res) return;
    postFiles = [];
    S.posts.unshift(mapPost(res));
    render(); toast('Опубликовано');
  }

  /* ---------- Поставщики ---------- */
  function supplierStats(s) {
    if (LIVE) return s;
    const products = S.products.filter((p) => p.sup === s.code);
    return {
      ...s, published: products.filter((p) => p.status === 'published').length, drafts: products.filter((p) => p.status !== 'published').length,
      to_order: S.orders.filter((o) => o.sup === s.code && o.status === 'to_order').length,
    };
  }
  function vSuppliers() {
    const rows = S.suppliers.map(supplierStats).map((s) => `<tr>
        <td><b>${esc(s.name)}</b><br><span class="muted">${esc([s.city, s.about].filter(Boolean).join(' · '))}</span></td>
        <td>${esc(s.wechat || '—')}<br><span class="muted">${esc(s.phone || '')}</span></td>
        <td class="num">${s.published}${s.drafts ? `<br><span class="muted">черновиков ${s.drafts}</span>` : ''}</td>
        <td class="num">${s.to_order ? `<b>${s.to_order}</b>` : '0'}</td>
        <td>${s.is_active === false ? '<span class="st st--bad">Не работаем</span>' : '<span class="st st--ok">Работаем</span>'}</td>
        <td><div class="rowbtns"><button class="btn btn--sm btn--lime" type="button" data-act="open-supplier" data-code="${esc(s.code)}">Открыть</button>
          <button class="btn btn--sm" type="button" data-act="edit-supplier" data-code="${esc(s.code)}">Изменить</button></div></td></tr>`).join('');
    return `
      <div class="pagehead"><div><h1>Поставщики</h1><p>Откуда берём товар. Поставщики в систему не заходят: это карточки для команды.</p></div>
        <div class="pagehead__actions"><button class="btn btn--lime" type="button" data-act="add-supplier">${icon('plus')}Добавить поставщика</button></div></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Поставщик</th><th>WeChat, телефон</th><th class="num">На сайте</th><th class="num">Заказать</th><th>Статус</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
  }
  let editingSupplier = null;
  function openSupplierForm(code) {
    const s = code ? S.suppliers.find((x) => x.code === code) : null;
    editingSupplier = s ? s.code : null;
    const v = s || { name: '', city: '', about: '', wechat: '', phone: '', pay: '', is_active: true };
    openDrawer(s ? 'Карточка поставщика' : 'Новый поставщик', `<form class="form" id="supplierForm" novalidate>
      <label class="field field--full"><span>Название (его видят покупатели в ленте)</span><input id="sName" value="${esc(v.name)}" required></label>
      <label class="field"><span>Город</span><input id="sCity" value="${esc(v.city)}"></label>
      <label class="field"><span>WeChat</span><input id="sWechat" value="${esc(v.wechat)}"></label>
      <label class="field"><span>Телефон</span><input id="sPhone" value="${esc(v.phone)}"></label>
      <label class="field"><span>Как платим поставщику</span><input id="sPay" value="${esc(v.pay)}" placeholder="Alipay через TT, банк, наличные"></label>
      <label class="field field--full"><span>Коротко: что у него берём</span><input id="sAbout" value="${esc(v.about)}" maxlength="200" placeholder="Обувь с фабрик Фуцзяни"></label>
      <label class="check field--full"><input id="sActive" type="checkbox" ${v.is_active !== false ? 'checked' : ''}>Работаем с поставщиком</label>
      <div class="form__actions"><button class="btn" type="button" data-act="close-drawer">Отмена</button><button class="btn btn--lime" type="submit">Сохранить</button></div>
    </form>`);
  }
  async function submitSupplier() {
    const body = {
      name: $('#sName').value.trim(), city: $('#sCity').value.trim(), about: $('#sAbout').value.trim(), wechat: $('#sWechat').value.trim(),
      phone: $('#sPhone').value.trim(), pay: $('#sPay').value.trim(), is_active: $('#sActive').checked,
    };
    if (!body.name) { toast('Впишите название поставщика'); $('#sName').focus(); return; }
    let saved = body;
    if (LIVE) {
      saved = await liveTry(() => api(editingSupplier ? `/suppliers/${editingSupplier}` : '/suppliers', { method: editingSupplier ? 'PUT' : 'POST', body }));
      if (!saved) return;
    } else {
      saved = { ...body, code: editingSupplier || `s${Date.now().toString(36)}` };
    }
    upsert(S.suppliers, saved, 'code');
    if (!editingSupplier) S.sup = saved.code;
    if (LIVE) await loadSupplier();
    save(); closeDrawer(); render();
    toast(editingSupplier ? 'Карточка сохранена' : `Поставщик «${saved.name}» добавлен: загрузите его каталог`);
  }

  /* ---------- Сервер ---------- */
  function cookie(name) {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : '';
  }
  async function api(path, { method = 'GET', body, form } = {}) {
    const headers = { 'X-CSRFToken': cookie('csrftoken') };
    if (S.sup) headers['X-Act-As'] = S.sup;
    if (body) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(`${API}${path}`, { method, headers, credentials: 'same-origin', body: form || (body ? JSON.stringify(body) : undefined) });
    } catch (e) {
      throw new Error('Ошибка сети, попробуйте ещё раз');
    }
    if (res.status === 401 && path !== '/login') { S.me = null; render(); throw new Error('Войдите снова'); }
    if (!res.ok) {
      let detail = `${res.status}`;
      try { detail = (await res.json()).detail || detail; } catch (e) { /* не JSON */ }
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    const type = res.headers.get('Content-Type') || '';
    return type.includes('application/json') ? res.json() : res;
  }
  async function liveTry(fn) {
    try { return await fn(); } catch (e) { toast(`Не получилось: ${e.message}`); return null; }
  }
  function upsert(list, item, key = 'id') {
    const i = list.findIndex((x) => String(x[key]) === String(item[key]));
    if (i >= 0) list[i] = item; else list.unshift(item);
  }
  const mapProduct = (p) => ({
    id: String(p.id), sup: S.sup, cat: p.cat, ru: p.ru, zh: p.zh, sku: p.sku || '', src: p.src || '', sizes: p.sizes || '', colors: p.colors || '',
    price: num(p.price), kg: num(p.kg), sale: p.sale, bulky: p.bulky, tiers: p.tiers.map(([q, c]) => [q, num(c)]),
    img: p.img || '', photos: p.photos || 0, desc: p.desc, status: p.status, orders: p.orders,
  });
  const mapOrder = (o) => ({
    id: o.id, num: o.num, sup: S.sup, date: o.date, mode: o.mode, status: o.status, tracking: o.tracking,
    items: o.items.map((i) => ({ ru: i.ru, img: i.img || '', size: i.size, color: i.color, qty: i.qty, unit: num(i.unit) })),
  });
  const mapPost = (x) => ({ id: x.id, sup: S.sup, pid: x.product ? String(x.product) : '', kind: x.kind, text: x.text, status: x.status, images: x.images || [], date: x.date || '' });
  const mapPurchase = (p) => ({ ...p, total_cny: num(p.total_cny), lines: p.lines.map((l) => ({ ...l, unit: num(l.unit) })) });
  async function refreshCounts() {
    const [overview, purchase] = await Promise.all([api('/overview'), api('/purchase')]);
    S.overview = overview;
    S.purchase = mapPurchase(purchase);
  }
  async function loadSupplier() {
    const [products, orders, posts] = await Promise.all(['/products', '/orders', '/posts'].map((path) => api(path)));
    S.products = products.map(mapProduct);
    S.orders = orders.map(mapOrder);
    S.posts = posts.map(mapPost);
    await refreshCounts();
  }
  async function startSession() {
    S.ai = !!S.me.ai;
    S.suppliers = await api('/suppliers');
    const active = S.suppliers.filter((s) => s.is_active);
    const wanted = new URLSearchParams(location.search).get('act') || S.sup;
    S.sup = (active.find((s) => s.code === wanted) || active[0] || {}).code || '';
    // Подсказку цены считаем по сегодняшнему курсу, если он есть.
    fetch(API.replace(/\/seller$/, '/rate'), { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null))
      .then((r) => { if (r) PRICING.rate = num(r.rub_per_unit); }).catch(() => {});
    // Категории ведутся в админке: берём их с сервера.
    const cats = await fetch(API.replace(/\/seller$/, '/categories'), { credentials: 'same-origin' }).then((r) => r.json());
    for (const key of Object.keys(CATS)) delete CATS[key];
    for (const c of cats) CATS[c.slug] = c.name_ru;
    if (S.sup) await loadSupplier();
    render();
  }
  function vLogin() {
    return `<section class="panel" style="max-width:420px;margin:24px auto;width:100%">
      <h2>Вход для команды</h2>
      <form class="form" id="loginForm" novalidate style="grid-template-columns:minmax(0,1fr)">
        <label class="field"><span>Логин</span><input id="lUser" autocomplete="username" required></label>
        <label class="field"><span>Пароль</span><input id="lPass" type="password" autocomplete="current-password" required></label>
        <p class="reason" id="loginErr" hidden></p>
        <button class="btn btn--lime" type="submit">Войти</button>
        <p class="note">Аккаунты выдают основатели в админке.</p>
      </form></section>`;
  }

  /* ---------- Шторка ---------- */
  let lastFocus = null;
  function openDrawer(title, html) {
    lastFocus = document.activeElement;
    $('#drawerTitle').textContent = title;
    $('#drawerBody').innerHTML = html;
    $('#drawer').hidden = false;
    document.documentElement.classList.add('is-locked');
    $('.drawer__panel').focus();
  }
  function closeDrawer() {
    $('#drawer').hidden = true;
    document.documentElement.classList.remove('is-locked');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  /* ---------- События ---------- */
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-nav], [data-goto], [data-pfilter], [data-ofilter], [data-act]');
    if (!el) return;
    const d = el.dataset;
    if (d.nav) { S.view = d.nav; save(); render(); $('#main').focus({ preventScroll: true }); window.scrollTo(0, 0); return; }
    if (d.goto) {
      S.view = d.goto;
      if (d.ofilter) S.ofilter = d.ofilter;
      if (d.pfilter) S.pfilter = d.pfilter;
      save(); render();
      return;
    }
    if (d.pfilter) { S.pfilter = d.pfilter; save(); render(); return; }
    if (d.ofilter) { S.ofilter = d.ofilter; save(); render(); return; }
    switch (d.act) {
      case 'close-drawer': closeDrawer(); break;
      case 'add-product': openProductForm(null); break;
      case 'edit-product': openProductForm(d.id); break;
      case 'add-tier': readForm(); draft.tiers.push(['', '']); $('#drawerBody').innerHTML = productFormHTML(); break;
      case 'del-tier': readForm(); draft.tiers.splice(Number(d.i), 1); $('#drawerBody').innerHTML = productFormHTML(); break;
      case 'translate': {
        readForm();
        if (!draft.zh) { toast('Сначала впишите название у поставщика'); $('#fZh').focus(); break; }
        // Описание переводим, только если в нём есть иероглифы: русское не трогаем.
        const desc = /[一-鿿]/.test(draft.desc) ? draft.desc : '';
        toast('Перевожу…');
        const res = await liveTry(() => api('/translate', { method: 'POST', body: { items: [{ zh: draft.zh, desc }] } }));
        if (!res) break;
        draft.ru = res.items[0].ru || draft.ru;
        if (desc && res.items[0].desc) draft.desc = res.items[0].desc;
        $('#drawerBody').innerHTML = productFormHTML();
        toast('Переведено, проверьте перед сохранением');
        break;
      }
      case 'import': openImport(); break;
      case 'template': {
        if (!LIVE) { toast('В превью скачивание отключено, в рабочей версии скачается шаблон Excel'); break; }
        const res = await liveTry(() => api('/template'));
        if (!res) break;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(await res.blob());
        a.download = 'astta-catalog-template.xlsx';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        break;
      }
      case 'ordered':
        if (await orderAction(d.id, 'confirm')) toast('Отмечено: заказано у поставщика');
        break;
      case 'out-of-stock':
        if (!window.confirm('Товара нет у поставщика? Эта часть заказа отменится, деньги за неё вернём покупателю.')) break;
        if (await orderAction(d.id, 'cancel')) toast('Часть заказа отменена, деньги вернём покупателю');
        break;
      case 'copy-purchase': {
        const text = $('#puText').value;
        try { await navigator.clipboard.writeText(text); toast('Скопировано, вставьте в WeChat поставщику'); } catch (err) { $('#puText').select(); toast('Выделено: нажмите Ctrl+C'); }
        break;
      }
      case 'purchase-ordered': {
        if (!LIVE) {
          const n = mine(S.orders).filter((o) => o.status === 'to_order').map((o) => { o.status = 'ordered'; return o; }).length;
          save(); render(); toast(`Заказано: ${n}`);
          break;
        }
        const res = await liveTry(() => api('/purchase/ordered', { method: 'POST', body: { orders: S.purchase.orders } }));
        if (!res) break;
        await loadSupplier();
        render(); toast(`Заказано: ${res.ordered}`);
        break;
      }
      case 'del-post': {
        if (!window.confirm('Удалить пост из ленты?')) break;
        if (LIVE && !(await liveTry(() => api(`/posts/${d.id}`, { method: 'DELETE' })))) break;
        S.posts = S.posts.filter((x) => String(x.id) !== String(d.id));
        save(); render(); toast('Пост удалён');
        break;
      }
      case 'add-supplier': openSupplierForm(null); break;
      case 'edit-supplier': openSupplierForm(d.code); break;
      case 'open-supplier':
        S.sup = d.code; S.view = 'products';
        if (LIVE) await liveTry(loadSupplier);
        save(); render();
        break;
      case 'logout':
        await liveTry(() => api('/logout', { method: 'POST' }));
        S.me = null; render();
        break;
      default: break;
    }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target;
    e.preventDefault();
    if (form.id === 'productForm') { submitProduct(); return; }
    if (form.id === 'importForm') { doImport(); return; }
    if (form.id === 'postForm') { submitPost(); return; }
    if (form.id === 'supplierForm') { submitSupplier(); return; }
    if (form.dataset.shipForm) {
      const input = form.querySelector('input');
      if (!input.value.trim()) { toast('Укажите трек-номер'); input.focus(); return; }
      if (await orderAction(form.dataset.shipForm, 'ship', { tracking: input.value.trim() })) toast('Отмечено: едет на склад');
      return;
    }
    if (form.id === 'loginForm') {
      const err = $('#loginErr');
      err.hidden = true;
      try {
        S.me = await api('/login', { method: 'POST', body: { username: $('#lUser').value, password: $('#lPass').value } });
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
        return;
      }
      await liveTry(startSession);
    }
  });

  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.id === 'supPick') {
      S.sup = el.value;
      if (LIVE) await liveTry(loadSupplier);
      save(); render();
      return;
    }
    if (el.id === 'fPhoto' && el.files[0]) {
      readForm();
      draftFile = el.files[0];
      draft.img = URL.createObjectURL(el.files[0]);
      $('#drawerBody').innerHTML = productFormHTML();
      return;
    }
    if ((el.id === 'importFile' || el.id === 'importPhotos') && el.files[0]) { el.closest('.drop').querySelector('b').textContent = el.files[0].name; return; }
    if (el.id === 'poImages') { postPreview(el.files); return; }
    if (el.dataset.tier !== undefined) { draft.tiers[Number(el.dataset.tier)][Number(el.dataset.k)] = el.value; }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'pSearch') {
      S.q = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const input = $('#pSearch');
      input.focus();
      input.setSelectionRange(pos, pos);
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });

  /* ---------- Старт ---------- */
  if (LIVE) {
    render();
    api('/me').then((me) => { S.me = me; return startSession(); }).catch(() => { S.me = null; render(); });
  } else {
    render();
  }
})();
