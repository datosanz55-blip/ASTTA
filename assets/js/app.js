(() => {
  'use strict';

  /* ---------- Настройки (в рабочей версии приходят с сервера) ---------- */
  const RATE = 11.4;          // ₽ за 1 ¥, демо-значение
  const FEE_RETAIL = 0.05;    // сервисный сбор ASTTA с розничной продажи
  const FEE_OPT = 0.03;       // сервисный сбор ASTTA с оптовой продажи
  const SHIP = {
    auto:  { name: 'Авто', perKg: 420, days: [18, 25], icon: 'truck' },
    air:   { name: 'Авиа', perKg: 980, days: [8, 12], icon: 'plane' },
    cargo: { name: 'Сборный груз', perKg: 190, days: [25, 35], icon: 'truck' },
  };

  const CATS = [
    { id: 'clothes', name: 'Одежда', img: 'cat-clothes' },
    { id: 'shoes', name: 'Обувь', img: 'cat-shoes' },
    { id: 'furniture', name: 'Мебель', img: 'cat-furniture' },
    { id: 'home', name: 'Дом', img: 'cat-home' },
    { id: 'tech', name: 'Электроника', img: 'cat-tech' },
    { id: 'acc', name: 'Аксессуары', img: 'watch' },
    { id: 'bags', name: 'Сумки', img: 'bag' },
  ];

  const SUPPLIERS = {
    gz: { name: 'TT · Гуанчжоу', about: 'Одежда, рынок Baima', short: 'GZ', followers: 4820, fact: [17, 22] },
    jj: { name: 'TT · Цзиньцзян', about: 'Обувь с фабрик Фуцзяни', short: 'JJ', followers: 3110, fact: [16, 21] },
    fs: { name: 'TT · Фошань', about: 'Мебель, рынок Лэцун', short: 'FS', followers: 2270, fact: [27, 33] },
    sz: { name: 'TT · Шэньчжэнь', about: 'Электроника, Хуацянбэй', short: 'SZ', followers: 3950, fact: [15, 20] },
    yw: { name: 'TT · Иу', about: 'Аксессуары и сумки, рынок Футянь', short: 'YW', followers: 2640, fact: [18, 23] },
  };

  // tiers: [от N штук, цена за штуку в ¥]; первая ступень = минимальная партия
  const PRODUCTS = [
    { id: 'runner', t: 'Кроссовки беговые Cloud', cat: 'shoes', sup: 'jj', cny: 268, kg: 1.1, tiers: [[6, 198], [30, 176]], rating: 4.8, reviews: 214, sold: 1240, sizes: 'shoes', isNew: true,
      desc: 'Дышащий сетчатый верх, подошва из пены EVA, вес полупары 290 г. Маломерят на полразмера: сверяйтесь с длиной стопы.' },
    { id: 'loafers', t: 'Лоферы замшевые', cat: 'shoes', sup: 'jj', cny: 210, kg: 1, tiers: [[5, 165], [20, 148]], rating: 4.6, reviews: 87, sold: 410, sizes: 'shoes', sale: 15,
      desc: 'Натуральная замша, кожаная стелька, гибкая подошва. Отправляем в коробке с бумажными вставками.' },
    { id: 'leather-jacket', t: 'Косуха из натуральной кожи', cat: 'clothes', sup: 'gz', cny: 520, kg: 1.6, tiers: [[3, 430], [10, 395]], rating: 4.9, reviews: 156, sold: 620, sizes: 'clothes',
      desc: 'Кожа КРС толщиной 1,1 мм, подкладка из вискозы, металлическая фурнитура. Садится по фигуре, размер в размер.' },
    { id: 'bomber', t: 'Бомбер oversize', cat: 'clothes', sup: 'gz', cny: 189, kg: 0.9, tiers: [[5, 142], [30, 128]], rating: 4.7, reviews: 98, sold: 530, sizes: 'clothes', sale: 20,
      desc: 'Плотная плащёвка с водоотталкивающей пропиткой, утеплитель 80 г/м². Свободный крой, можно брать свой размер.' },
    { id: 'tee-white', t: 'Футболка базовая, 240 г/м²', cat: 'clothes', sup: 'gz', cny: 39, kg: 0.3, tiers: [[20, 26], [100, 22]], rating: 4.8, reviews: 532, sold: 4100, sizes: 'clothes',
      group: { have: 34, need: 50, cny: 24, days: 2 },
      desc: 'Хлопок 100%, плотность 240 г/м², усадка после стирки до 3%. Горловина с двойной строчкой.' },
    { id: 'sweatshirt', t: 'Свитшот, футер трёхнитка', cat: 'clothes', sup: 'gz', cny: 79, kg: 0.6, tiers: [[10, 58], [50, 51]], rating: 4.7, reviews: 203, sold: 1600, sizes: 'clothes',
      group: { have: 18, need: 30, cny: 55, days: 4 },
      desc: 'Футер с начёсом, 320 г/м². Манжеты и низ из кашкорсе, не растягиваются после носки.' },
    { id: 'tee-black', t: 'Футболка с принтом', cat: 'clothes', sup: 'gz', cny: 45, kg: 0.3, tiers: [[20, 31], [100, 27]], rating: 4.6, reviews: 311, sold: 2300, sizes: 'clothes', sale: 10,
      desc: 'Хлопок 100%, шелкография на груди. Принт выдерживает 50+ стирок при 30 °C.' },
    { id: 'sofa', t: 'Диван трёхместный, велюр', cat: 'furniture', sup: 'fs', cny: 2980, kg: 48, tiers: [[2, 2690], [5, 2480]], rating: 4.8, reviews: 41, sold: 96, bulky: true,
      desc: 'Каркас из массива сосны, ножки из бука, наполнитель ППУ высокой плотности. Ширина 210 см. Едет в деревянной обрешётке.' },
    { id: 'lounge-chair', t: 'Кресло на поворотной опоре', cat: 'furniture', sup: 'fs', cny: 1150, kg: 16, tiers: [[2, 990], [6, 920]], rating: 4.7, reviews: 58, sold: 180, bulky: true,
      desc: 'Обивка из рогожки, опора из стали с порошковой покраской. Поворот на 360°.' },
    { id: 'stool', t: 'Табурет барный, ясень', cat: 'furniture', sup: 'fs', cny: 160, kg: 4.5, tiers: [[4, 128], [20, 112]], rating: 4.6, reviews: 73, sold: 340, sale: 12,
      desc: 'Массив ясеня, высота сиденья 75 см. Поставляется в разборе, сборка 10 минут.' },
    { id: 'lamp', t: 'Торшер с поворотным плафоном', cat: 'home', sup: 'fs', cny: 230, kg: 5, tiers: [[4, 185], [20, 166]], rating: 4.7, reviews: 66, sold: 290,
      desc: 'Металлический плафон, цоколь E27, высота 155 см. Вилка под российскую розетку.' },
    { id: 'headphones', t: 'Наушники накладные, Bluetooth 5.3', cat: 'tech', sup: 'sz', cny: 159, kg: 0.5, tiers: [[10, 118], [50, 104]], rating: 4.6, reviews: 402, sold: 2900,
      group: { have: 41, need: 60, cny: 112, days: 3 },
      desc: 'До 40 часов работы, зарядка USB-C, складная конструкция. Каждую пару проверяем перед отправкой.' },
    { id: 'headphones-anc', t: 'Наушники с шумоподавлением', cat: 'tech', sup: 'sz', cny: 299, kg: 0.7, tiers: [[5, 236], [30, 214]], rating: 4.8, reviews: 188, sold: 980, isNew: true,
      desc: 'Активное шумоподавление до 35 дБ, режим прозрачности, 30 часов работы. Видео проверки приходит вам в заказ.' },
    { id: 'watch', t: 'Часы кварцевые, корпус 40 мм', cat: 'acc', sup: 'yw', cny: 129, kg: 0.3, tiers: [[10, 92], [50, 81]], rating: 4.5, reviews: 144, sold: 870, sale: 18,
      desc: 'Японский механизм, минеральное стекло, ремешок из силикона. Водозащита 3 ATM.' },
    { id: 'sunglasses', t: 'Очки солнцезащитные, UV400', cat: 'acc', sup: 'yw', cny: 58, kg: 0.15, tiers: [[20, 34], [100, 28]], rating: 4.7, reviews: 260, sold: 3300,
      desc: 'Линзы с фильтром UV400, металлическая оправа. В комплекте чехол и салфетка.' },
    { id: 'bag', t: 'Сумка-портфель, экокожа', cat: 'bags', sup: 'yw', cny: 245, kg: 0.9, tiers: [[5, 188], [20, 170]], rating: 4.8, reviews: 97, sold: 450, isNew: true,
      desc: 'Экокожа с тиснением, съёмный ремень, два отделения. Отправляем в пыльнике и коробке.' },
    { id: 'backpack', t: 'Рюкзак городской, 20 л', cat: 'bags', sup: 'yw', cny: 139, kg: 0.8, tiers: [[10, 104], [40, 95]], rating: 4.7, reviews: 176, sold: 1100,
      desc: 'Водоотталкивающая ткань, отделение для ноутбука до 15,6", скрытый карман на спинке.' },
    { id: 'armchair', t: 'Кресло с каретной стяжкой', cat: 'furniture', sup: 'fs', cny: 690, kg: 11, tiers: [[2, 590], [6, 545]], rating: 4.6, reviews: 34, sold: 120, bulky: true,
      desc: 'Обивка из велюра, резные ножки, каретная стяжка вручную. Едет в обрешётке.' },
  ];
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  // Фон под цвет товара: светлый центр и тёмный край, посчитаны по вырезанному фото
  const TONES = {
    "armchair": ["#838367", "#2f3026"],
    "backpack": ["#5a6c8f", "#222834"],
    "bag": ["#b14639", "#3f1b17"],
    "bomber": ["#a16149", "#3a241c"],
    "headphones-anc": ["#757575", "#2b2b2b"],
    "headphones": ["#757575", "#2b2b2b"],
    "lamp": ["#70797a", "#292c2d"],
    "leather-jacket": ["#737576", "#2a2b2b"],
    "loafers": ["#6b7f6d", "#272e28"],
    "lounge-chair": ["#857665", "#302b26"],
    "runner": ["#767673", "#2b2b2a"],
    "sofa": ["#599188", "#213431"],
    "stool": ["#757674", "#2b2b2a"],
    "sunglasses": ["#6c7d75", "#282e2b"],
    "sweatshirt": ["#7b6b7f", "#2d282e"],
    "tee-black": ["#817b68", "#2f2d27"],
    "tee-white": ["#787275", "#2c2a2b"],
    "watch": ["#757575", "#2b2b2b"],
  };

  const POSTS = [
    { id: 1, sup: 'gz', pid: 'leather-jacket', time: '2 ч назад', auto: false, kind: 'new', likes: 128, comments: 14,
      text: 'Новая партия косух из натуральной кожи. Перед отправкой каждую проверяем на складе и фотографируем. Опт от 3 штук.' },
    { id: 2, sup: 'gz', pid: 'tee-white', time: '4 ч назад', auto: true, kind: 'opt', likes: 86, comments: 9,
      text: 'Подборка недели: базовые футболки 240 г/м², хлопок 100%. Совместный опт закрывается через 2 дня, до цены 24 ¥ не хватает 16 штук.' },
    { id: 3, sup: 'sz', pid: 'headphones-anc', time: 'вчера', auto: false, kind: 'new', likes: 203, comments: 31,
      text: 'Проверяем каждую пару наушников перед отправкой: заряд, подключение, шумоподавление. Видео проверки приходит вам в заказ.' },
    { id: 4, sup: 'fs', pid: 'sofa', time: 'вчера', auto: false, kind: 'restock', likes: 64, comments: 7,
      text: 'Диван из велюра снова в наличии, три цвета. Едет в деревянной обрешётке, до Москвы 25–35 дней.' },
    { id: 5, sup: 'yw', pid: 'sunglasses', time: '2 дня назад', auto: true, kind: 'opt', likes: 52, comments: 4,
      text: 'Очки UV400 оптом от 20 штук, можно ассорти из 6 цветов. От 100 штук цена 28 ¥ за пару.' },
    { id: 6, sup: 'jj', pid: 'runner', time: '3 дня назад', auto: true, kind: 'new', likes: 147, comments: 22,
      text: 'Новинка: беговые кроссовки на пене EVA, 290 г. Маломерят на полразмера, в карточке есть таблица с длиной стопы.' },
    { id: 7, sup: 'yw', pid: 'bag', time: '3 дня назад', auto: false, kind: 'new', likes: 91, comments: 11,
      text: 'Сумка-портфель из экокожи. Отправляем в пыльнике и коробке, чтобы не помялась в дороге.' },
  ];

  const REVIEWS = {
    clothes: [
      { who: 'Анна, Казань', stars: 5, text: 'Пришло за 21 день. Агент заранее предупредил, что модель маломерит, взяла на размер больше, село идеально.' },
      { who: 'Дмитрий, Екатеринбург', stars: 4, text: 'Ткань плотная, швы ровные. Фото со склада совпало с тем, что пришло.' },
    ],
    shoes: [
      { who: 'Игорь, Новосибирск', stars: 5, text: 'Сверил длину стопы по таблице в карточке, размер подошёл с первого раза.' },
      { who: 'Мария, Самара', stars: 4, text: 'Коробка немного помялась, обувь целая. Доставка 19 дней.' },
    ],
    furniture: [
      { who: 'Олег, Краснодар', stars: 5, text: 'Приехал в обрешётке, ни одной царапины. Итоговая цена совпала с той, что была при заказе.' },
      { who: 'Светлана, Москва', stars: 4, text: 'Цвет чуть темнее, чем на фото. По качеству всё отлично.' },
    ],
    home: [
      { who: 'Ксения, Пермь', stars: 5, text: 'Вилка сразу под нашу розетку, переходник не понадобился.' },
      { who: 'Артём, Тула', stars: 4, text: 'Хорошая лампа за свои деньги. Ехала 24 дня.' },
    ],
    tech: [
      { who: 'Никита, Москва', stars: 5, text: 'Перед отправкой прислали видео проверки, это сразу добавило доверия.' },
      { who: 'Алексей, Уфа', stars: 4, text: 'Звук хороший, шумоподавление среднее, но за эти деньги отлично.' },
    ],
    acc: [
      { who: 'Руслан, Воронеж', stars: 5, text: 'Взяли 30 штук на перепродажу, все целые и в упаковке.' },
      { who: 'Елена, Омск', stars: 4, text: 'Цена с доставкой вышла ровно та, что показали при заказе.' },
    ],
    bags: [
      { who: 'Вика, Челябинск', stars: 5, text: 'Пришла в пыльнике, без запаха. Фурнитура крепкая.' },
      { who: 'Павел, Ростов-на-Дону', stars: 5, text: 'Брал рюкзак сыну, ноутбук влезает спокойно.' },
    ],
  };

  const SIZE_GRID = {
    shoes: [['39', 'RU 38 · 24,5 см'], ['40', 'RU 39 · 25 см'], ['41', 'RU 40 · 25,5 см'], ['42', 'RU 41 · 26,5 см'], ['43', 'RU 42 · 27 см'], ['44', 'RU 43 · 27,5 см'], ['45', 'RU 44 · 28,5 см']],
    clothes: [['S', 'RU 42'], ['M', 'RU 44'], ['L', 'RU 46'], ['XL', 'RU 48'], ['2XL', 'RU 50'], ['3XL', 'RU 52']],
  };

  const DEMO_ORDERS = [
    { num: 'ASTTA-GZ-24117', date: '12 октября', items: ['leather-jacket', 'tee-white'], total: 9850, ship: 'auto', now: 4,
      stages: [
        { t: 'Агент подтвердил заказ', d: '12 окт, 14:20' },
        { t: 'Выкуплен у поставщика', d: '13 окт, 10:05' },
        { t: 'Принят на склад в Гуанчжоу', d: '15 окт, 16:40', photo: 'stage-aisles', note: 'Фото товара на складе' },
        { t: 'Упакован и взвешен: 2,1 кг', d: '16 окт, 09:15', photo: 'stage-box', note: 'Фото упаковки' },
        { t: 'Граница: Маньчжурия → Забайкальск', d: '22 окт, 07:30' },
        { t: 'Склад в Москве', d: 'ожидается 29–31 окт' },
        { t: 'В пункте выдачи', d: 'ожидается 1–3 ноя' },
      ] },
    { num: 'ASTTA-JJ-23980', date: '18 сентября', items: ['runner'], total: 3670, ship: 'auto', now: 6, delivered: true,
      stages: [
        { t: 'Агент подтвердил заказ', d: '18 сен' }, { t: 'Выкуплен у поставщика', d: '19 сен' },
        { t: 'Принят на склад в Цзиньцзяне', d: '21 сен' }, { t: 'Упакован и взвешен: 1,1 кг', d: '22 сен' },
        { t: 'Граница: Маньчжурия → Забайкальск', d: '29 сен' }, { t: 'Склад в Москве', d: '6 окт' }, { t: 'Получен', d: '8 окт' },
      ] },
  ];

  /* ---------- Состояние ---------- */
  const state = {
    mode: 'buyer',
    ship: 'auto',
    carts: { buyer: [], supplier: [] },
    cat: 'all', q: '', sort: 'pop',
    feed: 'all', feedSup: null,
    liked: new Set(), joined: new Set(),
    orders: [],
    myProducts: [],
    factory: { newItems: true, weekly: true, restock: false, perDay: '3' },
  };
  const FOLLOWING = ['gz', 'sz'];

  const store = {
    load() {
      try {
        const raw = localStorage.getItem('astta-demo');
        if (!raw) return;
        const d = JSON.parse(raw);
        if (d.mode === 'buyer' || d.mode === 'supplier') state.mode = d.mode;
        if (d.ship && SHIP[d.ship]) state.ship = d.ship;
        if (d.carts && Array.isArray(d.carts.buyer) && Array.isArray(d.carts.supplier)) {
          state.carts.buyer = d.carts.buyer.filter((i) => byId[i.id]);
          state.carts.supplier = d.carts.supplier.filter((i) => byId[i.id]);
        }
        if (Array.isArray(d.liked)) state.liked = new Set(d.liked);
        if (Array.isArray(d.joined)) state.joined = new Set(d.joined);
      } catch (e) { /* хранилище недоступно: работаем без него */ }
    },
    save() {
      try {
        localStorage.setItem('astta-demo', JSON.stringify({
          mode: state.mode, ship: state.ship, carts: state.carts,
          liked: [...state.liked], joined: [...state.joined],
        }));
      } catch (e) { /* ничего */ }
    },
  };

  /* ---------- Утилиты ---------- */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  const rub = (n) => nf.format(Math.round(n)) + ' ₽';
  const cny = (n) => nf.format(Math.round(n)) + ' ¥';
  const round10 = (n) => Math.round(n / 10) * 10;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const img = (name) => `assets/img/${name}.jpg`;
  const cut = (id) => `assets/img/cut/${id}.webp`;
  const tone = (id) => `--t1:${TONES[id][0]};--t2:${TONES[id][1]}`;
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };
  const isSupplier = () => state.mode === 'supplier';

  /* ---------- Цены ---------- */
  const shipFor = (p, wanted = state.ship) => (p.bulky ? 'cargo' : (wanted === 'cargo' ? 'auto' : wanted));
  const unitCny = (p) => (p.sale ? Math.round(p.cny * (1 - p.sale / 100)) : p.cny);

  // Розница: цена под ключ = товар по курсу + доставка по весу + сервисный сбор
  function retail(p, opts = {}) {
    const ship = SHIP[shipFor(p, opts.ship)];
    const qty = opts.qty || 1;
    const unit = opts.cny != null ? opts.cny : unitCny(p);
    const goods = unit * RATE * qty;
    const delivery = p.kg * ship.perKg * qty;
    const fee = goods * FEE_RETAIL;
    return { unit, goods, delivery, fee, ship, total: round10(goods + delivery + fee), each: round10((goods + delivery + fee) / qty) };
  }
  const retailFull = (p) => retail(p, { cny: p.cny }).total;

  // Опт: цена за штуку зависит от объёма партии
  function tierFor(p, qty) {
    let price = p.tiers[0][1];
    for (const [from, c] of p.tiers) if (qty >= from) price = c;
    return price;
  }
  function nextTier(p, qty) {
    return p.tiers.find(([from]) => from > qty) || null;
  }
  function wholesale(p, qty, wantedShip) {
    const ship = SHIP[shipFor(p, wantedShip)];
    const each = tierFor(p, qty);
    const goodsCny = each * qty;
    const goods = goodsCny * RATE;
    const delivery = p.kg * ship.perKg * qty;
    const fee = goods * FEE_OPT;
    return { each, goodsCny, goods, delivery, fee, ship, total: round10(goods + delivery + fee), landed: round10((goods + delivery + fee) / qty) };
  }
  const daysText = (d) => `${d[0]}–${d[1]}\u00a0дн.`;
  const rateText = RATE.toFixed(2).replace('.', ',');

  /* ---------- Карточки ---------- */
  function cardHTML(p) {
    let price, sub, old = '';
    if (isSupplier()) {
      price = cny(p.tiers[0][1]);
      sub = `за шт · от ${p.tiers[0][0]} шт`;
    } else {
      const r = retail(p);
      price = rub(r.total);
      if (p.sale) old = `<s>${rub(retailFull(p))}</s>`;
      sub = '';
    }
    let badge = '';
    if (p.sale && !isSupplier()) badge = `<span class="badge badge--hot">−${p.sale}%</span>`;
    else if (p.group) badge = '<span class="badge badge--group">Совместный опт</span>';
    else if (p.isNew) badge = '<span class="badge">Новинка</span>';
    const days = SHIP[shipFor(p)].days;
    return `<article class="card">
      <div class="card__media" style="${tone(p.id)}">
        <img class="card__img" src="${cut(p.id)}" alt="" loading="lazy" width="600" height="600">
        ${badge}
        <button class="card__add" type="button" data-add="${p.id}" aria-label="В корзину: ${esc(p.t)}">${icon('plus')}</button>
      </div>
      <div class="card__body">
        <div class="card__price">${price}${old}</div>
        <div class="card__unit">${sub}</div>
        <h3 class="card__title"><button class="card__hit" type="button" data-open="${p.id}">${esc(p.t)}</button></h3>
        <div class="card__meta"><span>${icon('star', 'ic--fill')}${nf1.format(p.rating)}</span><span>${daysText(days)}</span></div>
      </div>
    </article>`;
  }

  function groupHTML(p) {
    const g = p.group;
    const joined = state.joined.has(p.id);
    const have = g.have + (joined ? (isSupplier() ? 10 : 1) : 0);
    const pct = Math.min(100, Math.round((have / g.need) * 100));
    const left = Math.max(0, g.need - have);
    const price = isSupplier()
      ? `<b>${cny(g.cny)}</b> за шт <s>${cny(p.tiers[0][1])}</s>`
      : `<b>${rub(retail(p, { cny: g.cny }).total)}</b> под ключ <s>${rub(retail(p).total)}</s>`;
    return `<article class="group">
      <div class="group__thumb" style="${tone(p.id)}"><img src="${cut(p.id)}" alt="" loading="lazy" width="200" height="200"></div>
      <div class="group__body">
        <h3 class="group__title"><button type="button" data-open="${p.id}">${esc(p.t)}</button></h3>
        <div class="group__price">${price}</div>
        <div class="bar" role="progressbar" aria-label="Собрано штук" aria-valuemin="0" aria-valuemax="${g.need}" aria-valuenow="${have}"><i style="width:${pct}%"></i></div>
        <div class="group__row">
          <span>${left ? `Собрано ${have} из ${g.need} шт · ${g.days} ${plural(g.days, 'день', 'дня', 'дней')}` : 'Партия собрана, цена открыта'}</span>
          <button class="btn ${joined ? 'btn--line' : 'btn--accent'}" type="button" data-join="${p.id}" aria-pressed="${joined}">${joined ? 'Вы участвуете' : 'Участвовать'}</button>
        </div>
      </div>
    </article>`;
  }

  function postHTML(post) {
    const s = SUPPLIERS[post.sup];
    const p = byId[post.pid];
    const liked = state.liked.has(post.id);
    const price = isSupplier() ? `${cny(p.tiers[0][1])} · от ${p.tiers[0][0]} шт` : `${rub(retail(p).total)} под ключ`;
    const photo = post.photo || img(p.id);
    return `<article class="post">
      <header class="post__head">
        <span class="ava" aria-hidden="true">${s.short}</span>
        <div class="post__who"><b>${esc(s.name)}</b><span>${esc(post.time)} · ${esc(s.about)}</span></div>
        ${post.auto ? `<span class="tag" title="Пост собран контент-заводом из карточки товара">${icon('spark')}Автопост</span>` : ''}
      </header>
      <p class="post__text">${esc(post.text)}</p>
      <img class="post__img" src="${esc(photo)}" alt="${esc(p.t)}" loading="lazy" width="720" height="540">
      <div class="post__product">
        <img src="${img(p.id)}" alt="" loading="lazy" width="46" height="46">
        <div><button class="link" type="button" data-open="${p.id}"><b>${esc(p.t)}</b></button><span>${price}</span></div>
        <button class="roundbtn" type="button" data-add="${p.id}" aria-label="В корзину: ${esc(p.t)}">${icon('plus')}</button>
      </div>
      <div class="post__actions">
        <button type="button" data-like="${post.id}" aria-pressed="${liked}" aria-label="Нравится">${icon('heart')}<span>${post.likes + (liked ? 1 : 0)}</span></button>
        <button type="button" data-open="${p.id}" aria-label="Отзывы и вопросы">${icon('chat')}<span>${post.comments}</span></button>
        <button class="push" type="button" data-open-chat="${post.sup}">Спросить поставщика</button>
      </div>
    </article>`;
  }

  /* ---------- Главная ---------- */
  const TILES = [
    { title: 'Акции дня', img: 'tile-sale', filter: 'sale' },
    { title: 'До 1\u00a0000\u00a0₽', img: 'tile-discount', filter: 'budget' },
    { title: 'Новинки', img: 'tile-new', filter: 'new' },
    { title: 'Хиты', img: 'tile-hits', filter: 'all', sort: 'pop' },
    { title: 'Совместный опт', img: 'tile-group', filter: 'group' },
    { title: 'Опт от поставщиков', img: 'tile-opt', filter: 'all', mode: 'supplier' },
  ];

  function tileHTML(tile, i) {
    const n = filterProducts(tile.filter, '').length;
    const maxSale = Math.max(...PRODUCTS.map((p) => p.sale || 0));
    return `<button class="tile" type="button" data-tile="${i}">
      <img src="${img(tile.img)}" alt="" loading="lazy" width="900" height="1000">
      ${tile.filter === 'sale' ? `<span class="tile__badge">до −${maxSale}%</span>` : ''}
      <span class="roundbtn" aria-hidden="true">${icon('arrow-ur')}</span>
      <span class="tile__body"><span class="tile__text"><span class="tile__title">${tile.title}</span><span class="tile__sub">${n} ${plural(n, 'товар', 'товара', 'товаров')}</span></span></span>
    </button>`;
  }

  function renderHome() {
    $('#tiles').innerHTML = TILES.map(tileHTML).join('');
    $('#homeCats').innerHTML = CATS.map((c) => `<button class="cat" type="button" data-cat="${c.id}"><img src="${img(c.img)}" alt="" loading="lazy" width="640" height="800"><span>${c.name}</span></button>`).join('');
    $('#groups').innerHTML = PRODUCTS.filter((p) => p.group).map(groupHTML).join('');
    $('#saleRail').innerHTML = PRODUCTS.filter((p) => p.sale).map(cardHTML).join('');
    $('#popular').innerHTML = [...PRODUCTS].sort((a, b) => b.sold - a.sold).slice(0, 8).map(cardHTML).join('');
    renderHeroSlides();
    const cab = $('#cabinetPreview');
    cab.innerHTML = isSupplier() ? `<a class="cabcard" href="#profile">${icon('box')}<div><b>Кабинет поставщика</b><span>37 заказов за неделю · к выплате 18 240 ¥</span></div>${icon('arrow-ur')}</a>` : '';
    cab.hidden = !isSupplier();
  }

  const PLATFORMS = [[/1688\./i, '1688'], [/taobao\.|tb\.cn/i, 'Taobao'], [/tmall\./i, 'Tmall'], [/poizon|dewu/i, 'Poizon'], [/pinduoduo|yangkeduo/i, 'Pinduoduo']];

  function shipOptionsHTML(name, current, onlyCargo) {
    const keys = onlyCargo ? ['cargo'] : ['auto', 'air'];
    return keys.map((k) => {
      const s = SHIP[k];
      return `<label class="shipopt ${current === k ? 'is-on' : ''}">
        <input type="radio" name="${name}" value="${k}" ${current === k ? 'checked' : ''}>
        ${icon(s.icon)}
        <div><b>${s.name}</b><span>${daysText(s.days)}</span></div>
      </label>`;
    }).join('');
  }

  /* ---------- Каталог ---------- */
  const FILTERS = [{ id: 'all', name: 'Все' }, { id: 'sale', name: 'Акции' }, { id: 'budget', name: 'До 1\u00a0000\u00a0₽' }, { id: 'new', name: 'Новинки' }, { id: 'group', name: 'Совместный опт' }];

  function filterProducts(filter, q) {
    const ql = (q || '').toLowerCase();
    return PRODUCTS.filter((p) => {
      if (filter === 'sale' && !p.sale) return false;
      if (filter === 'new' && !p.isNew) return false;
      if (filter === 'group' && !p.group) return false;
      if (filter === 'budget' && (isSupplier() ? wholesale(p, p.tiers[0][0]).landed : retail(p).total) > 1000) return false;
      if (CATS.some((c) => c.id === filter) && p.cat !== filter) return false;
      if (!ql) return true;
      const catName = (CATS.find((c) => c.id === p.cat) || {}).name || '';
      return (p.t + ' ' + catName + ' ' + SUPPLIERS[p.sup].name).toLowerCase().includes(ql);
    });
  }

  function renderCatalog() {
    $('#catChips').innerHTML = [...FILTERS, ...CATS].map((c) => `<button class="chip" type="button" data-chip="${c.id}" aria-pressed="${state.cat === c.id}">${c.name}</button>`).join('');
    const priceOf = (p) => (isSupplier() ? p.tiers[0][1] : retail(p).total);
    const sorters = {
      pop: (a, b) => b.sold - a.sold,
      cheap: (a, b) => priceOf(a) - priceOf(b),
      fast: (a, b) => SHIP[shipFor(a)].days[0] - SHIP[shipFor(b)].days[0] || b.sold - a.sold,
      rating: (a, b) => b.rating - a.rating,
    };
    const list = filterProducts(state.cat, state.q).sort(sorters[state.sort]);
    $('#catalogGrid').innerHTML = list.map(cardHTML).join('');
    $('#catalogEmpty').hidden = list.length > 0;
  }

  /* ---------- Лента ---------- */
  function renderFeed() {
    $('#stories').innerHTML = Object.entries(SUPPLIERS).map(([id, s]) => `<button class="story" type="button" data-story="${id}" aria-pressed="${state.feedSup === id}">
      <span class="ava" aria-hidden="true">${s.short}</span><span>${esc(s.name.replace('TT · ', ''))}</span></button>`).join('');
    const filters = [['all', 'Все'], ['following', 'Подписки'], ['new', 'Новинки'], ['opt', 'Опт'], ['restock', 'Поступления']];
    $('#feedChips').innerHTML = filters.map(([id, name]) => `<button class="chip" type="button" data-feed="${id}" aria-pressed="${state.feed === id}">${name}</button>`).join('');
    const list = POSTS.filter((p) => {
      if (state.feedSup && p.sup !== state.feedSup) return false;
      if (state.feed === 'following') return FOLLOWING.includes(p.sup);
      if (state.feed === 'all') return true;
      return p.kind === state.feed;
    });
    $('#feedList').innerHTML = list.length ? list.map(postHTML).join('') : '<p class="empty">У этого поставщика пока нет таких постов.</p>';
  }

  /* ---------- Корзина ---------- */
  const cart = () => state.carts[state.mode];
  const cartKey = (i) => i.id + '|' + (i.size || '');

  function addToCart(id, opts = {}) {
    const p = byId[id];
    if (!p) return;
    if (!isSupplier() && p.sizes && !opts.size) {
      openProduct(id, { needSize: true });
      return;
    }
    const min = isSupplier() ? p.tiers[0][0] : 1;
    const qty = Math.max(min, opts.qty || min);
    const item = cart().find((i) => cartKey(i) === cartKey({ id, size: opts.size }));
    if (item) item.qty += isSupplier() ? qty : (opts.qty || 1);
    else cart().push({ id, qty, size: opts.size || null });
    store.save();
    updateCartCount();
    if (currentView === 'cart') renderCart();
    toast(isSupplier() ? `В корзине: ${p.t}, ${qty} шт` : `В корзине: ${p.t}`);
  }

  function updateCartCount() {
    const n = cart().reduce((s, i) => s + (isSupplier() ? 1 : i.qty), 0);
    $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.hidden = n === 0; });
  }

  function cartTotals() {
    let goods = 0, delivery = 0, fee = 0, goodsCny = 0;
    cart().forEach((i) => {
      const p = byId[i.id];
      if (isSupplier()) {
        const w = wholesale(p, i.qty);
        goods += w.goods; delivery += w.delivery; fee += w.fee; goodsCny += w.goodsCny;
      } else {
        const r = retail(p, { qty: i.qty });
        goods += r.goods; delivery += r.delivery; fee += r.fee;
      }
    });
    return { goods, delivery, fee, goodsCny, total: round10(goods + delivery + fee) };
  }

  function renderCart() {
    const root = $('#cart');
    const items = cart();
    if (!items.length) {
      root.innerHTML = `<div class="emptystate">${icon('bag')}<h2>Корзина пустая</h2>
        <p>${isSupplier() ? 'Добавьте товары оптом: минимальная партия подставится сама.' : 'Добавьте товары из каталога или закажите по своей ссылке.'}</p>
        <a class="btn btn--lime" href="#catalog">Открыть каталог</a></div>`;
      return;
    }
    const anyLight = items.some((i) => !byId[i.id].bulky);
    const rows = items.map((i, idx) => {
      const p = byId[i.id];
      const sizeLabel = i.size ? ` · размер CN ${esc(i.size)}` : '';
      let price, hint = '', min = 1;
      if (isSupplier()) {
        const w = wholesale(p, i.qty);
        min = p.tiers[0][0];
        price = `${cny(w.goodsCny)} <span class="citem__meta">· ${cny(w.each)}/шт</span>`;
        const nt = nextTier(p, i.qty);
        if (nt) hint = `<span class="citem__hint">Ещё ${nt[0] - i.qty} шт, и цена станет ${cny(nt[1])}</span>`;
      } else {
        price = rub(retail(p, { qty: i.qty }).total);
      }
      const s = SHIP[shipFor(p)];
      return `<article class="citem">
        <img src="${img(p.id)}" alt="" width="76" height="76" loading="lazy">
        <div class="citem__body">
          <button class="citem__title" type="button" data-open="${p.id}">${esc(p.t)}</button>
          <span class="citem__meta">${esc(SUPPLIERS[p.sup].name)}${sizeLabel} · ${s.name.toLowerCase()} ${daysText(s.days)}</span>
          ${hint}
          <div class="citem__row">
            <span class="citem__price">${price}</span>
            <div class="qty" role="group" aria-label="Количество">
              <button type="button" data-dec="${idx}" aria-label="Меньше" ${i.qty <= min ? 'disabled' : ''}>${icon('minus')}</button>
              <output>${i.qty}</output>
              <button type="button" data-inc="${idx}" aria-label="Больше">${icon('plus')}</button>
            </div>
          </div>
          <button class="linkbtn citem__remove" type="button" data-remove="${idx}">Убрать</button>
        </div>
      </article>`;
    }).join('');
    const t = cartTotals();
    const summary = `<div class="sum">
        <div class="sum__row"><span>Товары${isSupplier() ? ` · ${cny(t.goodsCny)}` : ''}</span><span>${rub(t.goods + t.fee)}</span></div>
        <div class="sum__row"><span>Доставка</span><span>${rub(t.delivery)}</span></div>
        <div class="sum__row sum__row--total"><span>Итого</span><span>${rub(t.total)}</span></div>
        <p class="sum__note">Платите после того, как агент подтвердит заказ.</p>
      </div>`;
    root.innerHTML = `<div class="cart">
      <div class="cartlist">${rows}</div>
      <aside class="panel">
        <h3>Доставка</h3>
        ${anyLight ? `<fieldset class="ship" data-cart-ship><legend class="sr">Способ доставки</legend>${shipOptionsHTML('cartShip', state.ship === 'cargo' ? 'auto' : state.ship, false)}</fieldset>` : ''}
        ${items.some((i) => byId[i.id].bulky) ? `<p class="note">Мебель едет сборным грузом в обрешётке: ${daysText(SHIP.cargo.days)}.</p>` : ''}
        ${summary}
        <button class="btn btn--lime btn--wide" type="button" data-checkout>Оформить ${icon('arrow')}</button>
      </aside>
    </div>`;
  }

  function checkoutHTML() {
    const t = cartTotals();
    return `<div class="stack">
      <h2 class="sheet__title">Оформить</h2>
      <p class="note">Агент проверит наличие и размеры и напишет вам. Платить сейчас не нужно.</p>
      <form class="stack" id="checkoutForm" novalidate>
        <label class="field"><span>Телефон или Telegram</span><input id="ckContact" name="contact" autocomplete="tel" placeholder="+7 … или @username" required></label>
        <div class="sum"><div class="sum__row sum__row--total sum__row--solo"><span>Итого</span><span>${rub(t.total)}</span></div></div>
        <button class="btn btn--lime btn--wide" type="submit">Отправить агенту</button>
      </form>
    </div>`;
  }

  function submitCheckout() {
    const input = $('#ckContact');
    const field = input.closest('.field');
    const bad = !input.value.trim();
    field.classList.toggle('is-error', bad);
    let err = $('.field__err', field);
    if (bad && !err) { err = document.createElement('small'); err.className = 'field__err'; err.textContent = 'Укажите телефон или Telegram'; field.append(err); }
    if (!bad && err) err.remove();
    if (bad) { input.focus(); return; }
    const first = byId[cart()[0].id];
    const num = `ASTTA-${SUPPLIERS[first.sup].short}-${String(24200 + Math.floor(Math.random() * 700))}`;
    const t = cartTotals();
    state.orders.unshift({
      num, date: 'сегодня', items: cart().map((i) => i.id), total: t.total, ship: state.ship, now: 0, fresh: true,
      stages: [
        { t: 'Агент проверяет наличие и размеры', d: 'ответ в течение 15 минут' },
        { t: 'Выкуп у поставщика', d: 'после вашей оплаты' },
        { t: 'Склад в Китае: фото и вес', d: '' },
        { t: 'Отправка в Россию', d: '' },
        { t: 'Пункт выдачи', d: '' },
      ],
    });
    state.carts[state.mode] = [];
    store.save();
    updateCartCount();
    renderCart();
    openSheet(`<div class="success">
      <span class="success__ic">${icon('check')}</span>
      <h2 class="sheet__title">Заказ ${num} у агента</h2>
      <p>Мария из TT Логистики проверит наличие и размеры и напишет в течение 15 минут. Платите после её подтверждения.</p>
      <div class="buyrow"><a class="btn btn--lime" href="#profile" data-close>Мой заказ</a><button class="btn btn--ghost" type="button" data-open-chat>Чат с агентом</button></div>
    </div>`, { narrow: true });
  }

  /* ---------- Профиль: заказы / кабинет ---------- */
  function orderHTML(o) {
    const status = o.delivered ? '<span class="pill">Получен</span>' : (o.fresh ? '<span class="pill pill--go">Ждёт агента</span>' : '<span class="pill pill--go">В пути</span>');
    const stages = o.stages.map((s, i) => {
      const cls = i < o.now || o.delivered ? 'is-done' : (i === o.now ? 'is-now' : '');
      const photo = s.photo ? `<button class="tl__photo" type="button" data-photo="${s.photo}" data-caption="${esc(s.t)}"><img src="${img(s.photo)}" alt="" width="84" height="60" loading="lazy"><span>${esc(s.note)}</span></button>` : '';
      return `<li class="${cls}"><span class="dot">${cls === 'is-done' ? icon('check') : ''}</span><div class="tl__body"><b>${esc(s.t)}</b>${s.d ? `<span>${esc(s.d)}</span>` : ''}${photo}</div></li>`;
    }).join('');
    return `<article class="order">
      <div class="order__head">
        <div>
          <div class="order__num">${o.num}<button type="button" data-copy="${o.num}">Скопировать</button></div>
          <div class="order__sub">от ${o.date} · ${rub(o.total)} · ${SHIP[o.ship] ? SHIP[o.ship].name.toLowerCase() : 'авто'}</div>
        </div>
        ${status}
      </div>
      <div class="thumbs">${o.items.map((id) => `<img src="${img(id)}" alt="${esc(byId[id].t)}" width="52" height="52" loading="lazy">`).join('')}</div>
      <ol class="timeline">${stages}</ol>
      ${o.delivered ? '' : `<button class="btn btn--ghost btn--sm" type="button" data-open-chat style="align-self:flex-start">${icon('chat')}Вопрос по заказу</button>`}
    </article>`;
  }

  function cabinetHTML() {
    const mine = PRODUCTS.filter((p) => p.sup === 'gz');
    const f = state.factory;
    const next = state.myProducts[0] ? state.myProducts[0].t : 'Бомбер oversize';
    const myRows = state.myProducts.map((p) => `<div class="prow">${p.photo ? `<img src="${esc(p.photo)}" alt="" width="48" height="48">` : '<span class="noimg"></span>'}
        <div><b>${esc(p.t)}</b><span>${cny(p.cny)} · от ${p.moq} шт · на модерации</span></div><em>новый</em></div>`).join('');
    const rows = mine.map((p, i) => `<div class="prow"><img src="${img(p.id)}" alt="" width="48" height="48" loading="lazy">
        <div><b>${esc(p.t)}</b><span>${cny(p.tiers[0][1])} от ${p.tiers[0][0]} шт · ${nf.format(1200 + i * 830)} просмотров</span></div>
        <em>${[14, 9, 6, 5, 3][i] || 2} зак.</em></div>`).join('');
    return `<div class="cabinet">
      <div class="stats">
        <div class="stat"><span>Просмотры за 7 дней</span><b>12 480</b><small>+18%</small></div>
        <div class="stat"><span>Заказы за 7 дней</span><b>37</b><small>+6</small></div>
        <div class="stat"><span>К выплате</span><b>18 240 ¥</b><small>≈ ${rub(18240 * RATE)}</small></div>
        <div class="stat"><span>Подписчики</span><b>4 820</b><small>+212</small></div>
      </div>
      <div class="actions">
        <button class="action" type="button" data-cab="add">${icon('plus')}<b>Добавить товар</b><span>Фото, цена в юанях, опт</span></button>
        <button class="action" type="button" data-cab="import">${icon('upload')}<b>Загрузить каталог</b><span>Excel или ссылка на магазин 1688</span></button>
        <button class="action" type="button" data-cab="post">${icon('feed')}<b>Пост в ленту</b><span>Новинка, поступление, подборка</span></button>
      </div>
      <div class="cabinet__grid">
        <section class="panel" aria-labelledby="factoryTitle">
          <h3 id="factoryTitle">Контент-завод</h3>
          <p class="note">Сам собирает посты для ленты из ваших карточек: фото, цена, опт, сроки. Вам остаётся только добавлять товары.</p>
          <div>
            <label class="switchrow"><div><b>Посты о новых товарах</b><span>Сразу после модерации карточки</span></div><input class="switch" type="checkbox" role="switch" id="fNew" data-factory="newItems" ${f.newItems ? 'checked' : ''}></label>
            <label class="switchrow"><div><b>Подборки недели</b><span>По понедельникам, из самых просматриваемых</span></div><input class="switch" type="checkbox" role="switch" id="fWeekly" data-factory="weekly" ${f.weekly ? 'checked' : ''}></label>
            <label class="switchrow"><div><b>Поступления на склад</b><span>Когда товар снова в наличии</span></div><input class="switch" type="checkbox" role="switch" id="fRestock" data-factory="restock" ${f.restock ? 'checked' : ''}></label>
            <label class="switchrow"><div><b>Видеообзоры</b><span>Скоро: ролики из фото товара</span></div><input class="switch" type="checkbox" role="switch" id="fVideo" disabled></label>
            <label class="switchrow"><div><b>Постов в день</b><span>Не больше, чтобы не надоедать подписчикам</span></div>
              <select class="minisel" id="fPerDay" data-factory="perDay">
                ${['1', '3', '5'].map((v) => `<option ${f.perDay === v ? 'selected' : ''}>${v}</option>`).join('')}
              </select></label>
          </div>
          <div class="nextpost">${icon('spark')}<div><b>Следующий автопост сегодня в 18:00</b><span>${esc(next)}</span></div><button class="btn btn--line btn--sm" type="button" data-cab="preview">Показать</button></div>
        </section>
        <section class="panel" aria-labelledby="myTitle">
          <h3 id="myTitle">Мои товары</h3>
          <div class="rows">${myRows}${rows}</div>
          <p class="note">ASTTA удерживает 5% с розничной продажи и 3% с оптовой. Выплата раз в неделю, в юанях или рублях.</p>
        </section>
      </div>
    </div>`;
  }

  function renderProfile() {
    $('#profileBody').innerHTML = isSupplier()
      ? cabinetHTML()
      : `<div class="orders">${[...state.orders, ...DEMO_ORDERS].map(orderHTML).join('')}</div>`;
  }

  /* ---------- Карточка товара ---------- */
  let pdState = null;

  function openProduct(id, opts = {}) {
    const p = byId[id];
    if (!p) return;
    pdState = { id, size: opts.size || null, ship: shipFor(p), qty: isSupplier() ? p.tiers[0][0] : 1, needSize: !!opts.needSize };
    openSheet(productHTML(), { product: true });
    if (opts.needSize) toast('Выберите размер');
  }

  function productHTML() {
    const p = byId[pdState.id];
    const s = SUPPLIERS[p.sup];
    const sup = isSupplier();
    let priceBlock, breakdown;
    if (sup) {
      const w = wholesale(p, pdState.qty, pdState.ship);
      priceBlock = `<div class="pd__price"><b>${cny(w.each)}</b><span class="note">за штуку · партия ${pdState.qty} шт</span></div>`;
      const tierRows = p.tiers.map(([from, c]) => `<tr class="${w.each === c ? 'is-on' : ''}"><td>от ${from} шт</td><td>${cny(c)}</td></tr>`).join('');
      breakdown = `<table class="tiers"><tbody>${tierRows}<tr><td>Розница, 1 шт</td><td>${cny(p.cny)}</td></tr></tbody></table>
        <details class="why"><summary>Итого за партию: ${rub(w.total)}</summary><div class="sum">
          <div class="sum__row"><span>${pdState.qty} шт × ${cny(w.each)}</span><span>${rub(w.goods)}</span></div>
          <div class="sum__row"><span>Доставка, ${nf1.format(p.kg * pdState.qty)} кг</span><span>${rub(w.delivery)}</span></div>
          <div class="sum__row"><span>Сервис ASTTA, 3%</span><span>${rub(w.fee)}</span></div>
          <p class="sum__note">Одна штука в Москве ≈ ${rub(w.landed)}</p>
        </div></details>`;
    } else {
      const r = retail(p, { ship: pdState.ship });
      priceBlock = `<div class="pd__price"><b>${rub(r.total)}</b>${p.sale ? `<s>${rub(retail(p, { ship: pdState.ship, cny: p.cny }).total)}</s>` : ''}</div>`;
      breakdown = `<details class="why"><summary>Из чего цена</summary><div class="sum">
          <div class="sum__row"><span>Товар: ${cny(r.unit)} × ${rateText}</span><span>${rub(r.goods)}</span></div>
          <div class="sum__row"><span>Доставка, ${nf1.format(p.kg)} кг</span><span>${rub(r.delivery)}</span></div>
          <div class="sum__row"><span>Сервис ASTTA, 5%</span><span>${rub(r.fee)}</span></div>
          <p class="sum__note">Доплат после заказа нет.</p>
        </div></details>`;
    }

    const ship = `<fieldset class="ship" data-pd-ship><legend>Доставка</legend>${shipOptionsHTML('pdShip', pdState.ship, p.bulky)}</fieldset>`;

    let group = '';
    if (p.group) {
      const g = p.group;
      const joined = state.joined.has(p.id);
      const have = g.have + (joined ? (sup ? 10 : 1) : 0);
      group = `<div class="groupbox">
        <span class="sublabel" style="color:var(--lime)">Совместный опт</span>
        <p>При ${g.need} шт цена для всех станет ${sup ? cny(g.cny) + ' за штуку' : rub(retail(p, { cny: g.cny, ship: pdState.ship }).total)}. Собрано ${have}.</p>
        <div class="bar"><i style="width:${Math.min(100, Math.round((have / g.need) * 100))}%"></i></div>
        <button class="btn ${joined ? 'btn--line' : 'btn--lime'} btn--sm" type="button" data-join="${p.id}" aria-pressed="${joined}" style="align-self:flex-start">${joined ? 'Вы участвуете' : 'Участвовать'}</button>
      </div>`;
    }

    const optNote = !sup ? `<div class="optnote"><span>Опт от ${p.tiers[0][0]} шт: <b>${cny(p.tiers[0][1])}</b></span><button class="linkbtn" type="button" data-switch-mode="supplier">Раздел для поставщиков</button></div>` : '';

    const minQty = sup ? p.tiers[0][0] : 1;
    const qty = `<div class="qty" role="group" aria-label="Количество">
        <button type="button" data-pd-qty="-1" aria-label="Меньше" ${pdState.qty <= minQty ? 'disabled' : ''}>${icon('minus')}</button>
        <output>${pdState.qty}</output>
        <button type="button" data-pd-qty="1" aria-label="Больше">${icon('plus')}</button>
      </div>`;
    const nt = sup ? nextTier(p, pdState.qty) : null;

    const reviews = (REVIEWS[p.cat] || []).map((r) => `<div class="review">
        <div class="review__head"><b>${esc(r.who)}</b><span class="stars" aria-label="${r.stars} из 5">${[1, 2, 3, 4, 5].map((n) => icon('star', 'ic--fill' + (n > r.stars ? ' is-off' : ''))).join('')}</span></div>
        <p>${esc(r.text)}</p></div>`).join('');

    const sizeCircles = (!sup && p.sizes) ? `<div class="pd__sizes">
        <span class="sublabel">Выберите размер</span>
        <div class="circles" role="group" aria-label="Размер">${SIZE_GRID[p.sizes].map(([cn, ru]) => `<button class="circle" type="button" data-size="${cn}" aria-pressed="${pdState.size === cn}" title="${ru}"><b>${cn}</b></button>`).join('')}</div>
        <span class="note">${pdState.size ? `CN ${pdState.size} = ${SIZE_GRID[p.sizes].find(([cn]) => cn === pdState.size)[1]}` : 'Китайский размер, рядом наш'}</span>
      </div>` : '';

    return `<div class="pd" data-id="${p.id}" style="${tone(p.id)}">
      <div class="pd__stage">
        <div class="pd__head">
          <button class="supchip" type="button" data-goto-sup="${p.sup}"><span class="ava" aria-hidden="true">${s.short}</span>${esc(s.name)}</button>
          <h2>${esc(p.t)}</h2>
          <div class="pd__rating"><span>${icon('star', 'ic--fill')}<b>${nf1.format(p.rating)}</b></span><span>${p.reviews} ${plural(p.reviews, 'отзыв', 'отзыва', 'отзывов')}</span></div>
          <p class="pd__lead">${esc(p.desc)}</p>
        </div>
        <div class="pd__float">${floatHTML(p, 'eager')}</div>
        <div class="pd__side">
          ${priceBlock}
          ${sizeCircles}
          <div class="buyrow">
            ${qty}
            <button class="btn btn--lime" type="button" data-pd-add>${sup ? 'Добавить партию' : 'В корзину'}</button>
          </div>
          ${nt ? `<p class="note">Ещё ${nt[0] - pdState.qty} шт, и цена станет ${cny(nt[1])}</p>` : ''}
        </div>
      </div>
      <div class="pd__more">
        <div class="stack">
          ${ship}
          ${breakdown}
          ${group}
        </div>
        <div class="stack">
          <p class="note">Доставка ${s.fact[0]}–${s.fact[1]} дней по последним заказам этого поставщика.</p>
          ${optNote}
          <button class="btn btn--ghost" type="button" data-open-chat="${p.sup}">${icon('chat')}Спросить агента</button>
          <div class="reviews">${reviews}</div>
        </div>
      </div>
    </div>`;
  }

  // Парящий товар: картинка без фона качается, тень под ней дышит в такт
  function floatHTML(p, loading = 'lazy') {
    return `<div class="float"><div class="float__in"><img class="float__img" src="${cut(p.id)}" alt="${esc(p.t)}" width="900" height="900" loading="${loading}"></div><span class="float__shadow" aria-hidden="true"></span></div>`;
  }

  // Перерисовываем всё, кроме парящего товара, чтобы он не дёргался при выборе размера
  function rerenderProduct() {
    if (!pdState) return;
    const body = $('#sheetBody');
    const top = body.scrollTop;
    const old = $('.pd', body);
    const tmp = document.createElement('div');
    tmp.innerHTML = productHTML();
    if (old && old.dataset.id === pdState.id) {
      ['.pd__head', '.pd__side', '.pd__more'].forEach((sel) => $(sel, old).replaceWith($(sel, tmp)));
    } else {
      body.innerHTML = tmp.innerHTML;
    }
    body.scrollTop = top;
  }

  /* ---------- Чат с агентом ---------- */
  function openChat(supId) {
    const s = supId && SUPPLIERS[supId];
    openSheet(`<div class="chat">
      <div class="chat__agent"><span class="ava" aria-hidden="true">МК</span><div><b>Мария, агент TT Логистики</b><span>онлайн · отвечает за 15 минут</span></div></div>
      <div class="msgs" id="msgs">
        <div class="msg">Здравствуйте! Помогу с заказом${s ? ` у поставщика ${esc(s.name)}` : ''}: проверю наличие, размер и продавца, пришлю фото.</div>
      </div>
      <div class="quick">
        <button class="chip" type="button" data-quick="Есть ли в наличии мой размер?">Есть мой размер?</button>
        <button class="chip" type="button" data-quick="Можно фото товара со склада?">Фото со склада</button>
        <button class="chip" type="button" data-quick="Сколько будет стоить доставка авиа?">Цена авиа</button>
      </div>
      <form class="chat__form" id="chatForm"><input id="chatInput" name="msg" autocomplete="off" placeholder="Сообщение агенту" aria-label="Сообщение агенту"><button class="roundbtn" type="submit" aria-label="Отправить">${icon('arrow')}</button></form>
    </div>`, { narrow: true });
  }
  function sendChat(text, reply) {
    const t = text.trim();
    if (!t) return;
    const box = $('#msgs');
    box.insertAdjacentHTML('beforeend', `<div class="msg msg--me">${esc(t)}</div><div class="msg msg--typing">Мария печатает…</div>`);
    const typing = box.lastElementChild;
    setTimeout(() => {
      typing.classList.remove('msg--typing');
      typing.textContent = reply || 'Приняла. Уточню у поставщика и вернусь с ответом и фото в течение 15 минут.';
    }, 1200);
  }

  /* ---------- Действия кабинета ---------- */
  function cabAction(kind) {
    if (kind === 'add') {
      openSheet(`<div class="stack">
        <h2 class="sheet__title">Новый товар</h2>
        <form class="form" id="addForm" novalidate>
          <label class="field field--full"><span>Название</span><input id="apName" required placeholder="Худи oversize, футер 380 г/м²"></label>
          <label class="field"><span>Категория</span><select id="apCat">${CATS.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}</select></label>
          <label class="field"><span>Цена за шт, ¥</span><input id="apCny" type="number" min="1" required value="96"></label>
          <label class="field"><span>Опт от, шт</span><input id="apMoq" type="number" min="1" required value="10"></label>
          <label class="field"><span>Вес, кг</span><input id="apKg" type="number" min="0.1" step="0.1" value="0.8"></label>
          <label class="field field--full"><span>Фото</span><input id="apPhoto" type="file" accept="image/*"></label>
          <p class="note field--full">Контент-завод сам подготовит пост для ленты, когда карточку проверят.</p>
          <button class="btn btn--accent btn--wide field--full" type="submit">Отправить на модерацию</button>
        </form></div>`, { narrow: true });
    } else if (kind === 'import') {
      openSheet(`<div class="stack">
        <h2 class="sheet__title">Загрузка каталога</h2>
        <p class="note">Excel или CSV по шаблону, либо ссылка на ваш магазин на 1688. Контент-завод разберёт фото и описания и сделает карточки на русском.</p>
        <form class="form" id="importForm" novalidate>
          <label class="field field--full"><span>Файл каталога</span><input id="imFile" type="file" accept=".xlsx,.xls,.csv"></label>
          <label class="field field--full"><span>Или ссылка на магазин</span><input id="imUrl" type="url" placeholder="https://shop123456.1688.com"></label>
          <button class="btn btn--accent btn--wide field--full" type="submit">Загрузить</button>
        </form></div>`, { narrow: true });
    } else if (kind === 'post') {
      const mine = PRODUCTS.filter((p) => p.sup === 'gz');
      openSheet(`<div class="stack">
        <h2 class="sheet__title">Пост в ленту</h2>
        <form class="form" id="postForm" novalidate>
          <label class="field field--full"><span>Товар</span><select id="poProduct">${mine.map((p) => `<option value="${p.id}">${esc(p.t)}</option>`).join('')}</select></label>
          <label class="field field--full"><span>Тип</span><select id="poKind"><option value="new">Новинка</option><option value="restock">Поступление</option><option value="opt">Оптовое предложение</option></select></label>
          <label class="field field--full"><span>Текст</span><textarea id="poText" required>Свежая партия уже на складе в Гуанчжоу. Опт от 5 штук, фото с проверки пришлём в заказ.</textarea></label>
          <button class="btn btn--accent btn--wide field--full" type="submit">Опубликовать</button>
        </form></div>`, { narrow: true });
    } else if (kind === 'preview') {
      const src = state.myProducts[0];
      const p = byId.bomber;
      const post = src
        ? { id: 999, sup: 'gz', pid: 'bomber', time: 'сегодня в 18:00', auto: true, likes: 0, comments: 0, photo: src.photo || img('bomber'),
            text: `Новинка от TT · Гуанчжоу: ${src.t}. ${src.cny} ¥ за штуку при партии от ${src.moq} шт. Фото с проверки на складе пришлём в заказ.` }
        : { id: 999, sup: 'gz', pid: 'bomber', time: 'сегодня в 18:00', auto: true, likes: 0, comments: 0,
            text: `Бомбер oversize из плотной плащёвки, утеплитель 80 г/м². Опт от ${p.tiers[0][0]} шт по ${p.tiers[0][1]} ¥, от ${p.tiers[1][0]} шт по ${p.tiers[1][1]} ¥. До Москвы ${daysText(SHIP.auto.days)}.` };
      openSheet(`<div class="stack"><h2 class="sheet__title">Так увидят пост подписчики</h2>${postHTML(post)}</div>`, { narrow: true });
    }
  }

  /* ---------- Шторка, меню, уведомления ---------- */
  let lastFocus = null;
  function openSheet(html, opts = {}) {
    const sheet = $('#sheet');
    const panel = $('.sheet__panel', sheet);
    if (sheet.hidden) lastFocus = document.activeElement;
    if (!opts.keepProduct) pdState = html.includes('class="pd"') ? pdState : null;
    panel.classList.toggle('is-narrow', !!opts.narrow);
    panel.classList.toggle('is-product', !!opts.product);
    $('#toast').hidden = true;
    $('#sheetBody').innerHTML = html;
    $('#sheetBody').scrollTop = 0;
    sheet.hidden = false;
    document.documentElement.classList.add('is-locked');
    panel.focus({ preventScroll: true });
  }
  function closeSheet() {
    const sheet = $('#sheet');
    if (sheet.hidden) return;
    sheet.hidden = true;
    pdState = null;
    if ($('#menu').hidden) document.documentElement.classList.remove('is-locked');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function openMenu() {
    $('#menu').hidden = false;
    $('#menuBtn').setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('is-locked');
    $('#menu .drawer__panel a, #menu .drawer__panel button').focus();
  }
  function closeMenu() {
    if ($('#menu').hidden) return;
    $('#menu').hidden = true;
    $('#menuBtn').setAttribute('aria-expanded', 'false');
    if ($('#sheet').hidden) document.documentElement.classList.remove('is-locked');
  }
  let toastTimer;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  /* ---------- Режим ---------- */
  function setMode(mode, silent) {
    if (mode !== 'buyer' && mode !== 'supplier') return;
    state.mode = mode;
    document.documentElement.dataset.mode = mode;
    $$('[data-mode-switch] [data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
    $$('[data-mode-text]').forEach((el) => {
      const [a, b] = el.dataset.modeText.split('|');
      el.textContent = mode === 'supplier' ? b : a;
    });
    store.save();
    renderAll();
    if (pdState) {
      const p = byId[pdState.id];
      pdState.qty = mode === 'supplier' ? Math.max(p.tiers[0][0], pdState.qty) : 1;
      rerenderProduct();
    }
    if (!silent) toast(mode === 'supplier' ? 'Раздел для поставщиков: цены в юанях и опт' : 'Раздел для покупателей: цены в рублях под ключ');
  }

  /* ---------- Навигация ---------- */
  const VIEWS = ['home', 'catalog', 'feed', 'cart', 'profile'];
  let currentView = 'home';
  function route() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const view = VIEWS.includes(hash) ? hash : 'home';
    const changed = view !== currentView;
    currentView = view;
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $$('[data-nav]').forEach((a) => {
      if (a.dataset.nav === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (view === 'catalog') renderCatalog();
    if (view === 'feed') renderFeed();
    if (view === 'cart') renderCart();
    if (view === 'profile') renderProfile();
    closeMenu();
    closeSheet();
    if (!VIEWS.includes(hash) && hash) {
      const target = document.getElementById(hash);
      if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else if (changed) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  function go(view) {
    if (location.hash === '#' + view) route();
    else location.hash = view;
  }

  function renderAll() {
    renderHome();
    if (currentView === 'catalog') renderCatalog();
    if (currentView === 'feed') renderFeed();
    if (currentView === 'cart') renderCart();
    if (currentView === 'profile') renderProfile();
    updateCartCount();
  }

  /* ---------- Герой: парящий товар на фоне его цвета ---------- */
  const HERO = [
    { pid: 'bomber', h: 'Китай<br>ближе.', p: 'Бомбер oversize от TT · Гуанчжоу. Цена в рублях сразу с доставкой.' },
    { pid: 'sofa', h: 'Дом без<br>переплат.', p: 'Диван из Фошаня едет в обрешётке. Фото со склада до отправки.' },
    { pid: 'bag', h: 'Опт для<br>своих.', p: 'Сумки из Иу от 5 штук. Цены в юанях в разделе для поставщиков.' },
  ];
  let heroIndex = 0;

  function heroSideHTML(p) {
    const price = isSupplier()
      ? `<b>${cny(p.tiers[0][1])}</b><span>за шт · от ${p.tiers[0][0]} шт</span>`
      : `<b>${rub(retail(p).total)}</b>${p.sale ? `<s>${rub(retailFull(p))}</s>` : '<span>под ключ</span>'}`;
    const sizes = p.sizes
      ? `<span class="sublabel">Размер</span><div class="circles">${SIZE_GRID[p.sizes].slice(1, 4).map(([cn, ru]) => `<button class="circle" type="button" data-open="${p.id}" data-open-size="${cn}" title="${ru}"><b>${cn}</b></button>`).join('')}</div>`
      : `<span class="sublabel">Доставка</span><p>${SUPPLIERS[p.sup].fact[0]}–${SUPPLIERS[p.sup].fact[1]} дней</p>`;
    return `<div class="hero__price">${price}</div>${sizes}`;
  }

  function renderHeroSlides() {
    const on = (j) => (j === heroIndex ? ' is-on' : '');
    $('#heroBgs').innerHTML = HERO.map((h, j) => `<span class="${on(j).trim()}" style="${tone(h.pid)}"></span>`).join('');
    $('#heroTexts').innerHTML = HERO.map((h, j) => `<div class="htext${on(j)}">${j === 0 ? `<h1>${h.h}</h1>` : `<h2>${h.h}</h2>`}<p>${esc(h.p)}</p></div>`).join('');
    $('#heroStage').innerHTML = HERO.map((h, j) => `<div class="hero__slide${on(j)}">${floatHTML(byId[h.pid], j === 0 ? 'eager' : 'lazy')}</div>`).join('');
    $('#heroSide').innerHTML = HERO.map((h, j) => `<div class="hero__sideitem${on(j)}">${heroSideHTML(byId[h.pid])}</div>`).join('');
    $('#heroTotal').textContent = String(HERO.length).padStart(2, '0');
    setHeroNext();
  }

  function setHeroNext() {
    const next = HERO[(heroIndex + 1) % HERO.length];
    $('#heroNext').innerHTML = `<img src="${cut(next.pid)}" alt="" width="120" height="120" loading="lazy">`;
  }

  function showHero(k) {
    heroIndex = (k + HERO.length) % HERO.length;
    ['#heroBgs > span', '.htext', '.hero__slide', '.hero__sideitem'].forEach((sel) => {
      $$(sel, $('#hero')).forEach((el, j) => el.classList.toggle('is-on', j === heroIndex));
    });
    $('#heroNum').textContent = String(heroIndex + 1).padStart(2, '0');
    setHeroNext();
  }

  function initHero() {
    const hero = $('#hero');
    let timer = null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => { if (!reduce && !timer) timer = setInterval(() => showHero(heroIndex + 1), 7000); };
    hero.addEventListener('click', (e) => {
      const step = e.target.closest('[data-hero-step]');
      if (step) { stop(); showHero(heroIndex + Number(step.dataset.heroStep)); }
      if (e.target.closest('[data-hero-open]')) openProduct(HERO[heroIndex].pid);
    });
    let x0 = null;
    hero.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    hero.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) { stop(); showHero(heroIndex + (dx < 0 ? 1 : -1)); }
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  }

  /* ---------- События ---------- */
  function onClick(e) {
    const t = e.target.closest('button, a, [data-close], [data-close-menu]');
    if (!t) return;
    const d = t.dataset;

    if (d.close !== undefined) { if (t.tagName !== 'A') e.preventDefault(); closeSheet(); if (t.tagName !== 'A') return; }
    if (d.closeMenu !== undefined) { closeMenu(); if (t.tagName !== 'A' && d.openChat === undefined) return; }

    if (d.filter) {
      state.cat = d.filter; state.q = ''; $('#q').value = '';
      if (location.hash === '#catalog') { e.preventDefault(); renderCatalog(); window.scrollTo({ top: 0, behavior: 'instant' }); }
      else if (t.tagName !== 'A') go('catalog');
      return;
    }
    if (d.tile !== undefined) {
      const tile = TILES[Number(d.tile)];
      state.cat = tile.filter; state.q = ''; $('#q').value = '';
      if (tile.sort) { state.sort = tile.sort; $('#sort').value = tile.sort; }
      if (tile.mode && tile.mode !== state.mode) setMode(tile.mode, true);
      go('catalog');
      return;
    }
    if (t.matches('[data-telegram]')) { toast('Канал откроем к запуску площадки'); return; }

    if (d.mode) { setMode(d.mode); return; }
    if (d.switchMode) { setMode(d.switchMode); return; }
    if (d.open) { openProduct(d.open, { size: d.openSize }); return; }
    if (d.add) { addToCart(d.add); return; }
    if (d.openChat !== undefined) { openChat(d.openChat); return; }
    if (d.cat) { state.cat = d.cat; state.q = ''; $('#q').value = ''; if (location.hash === '#catalog') { e.preventDefault(); renderCatalog(); } else go('catalog'); return; }
    if (d.chip) { state.cat = d.chip; renderCatalog(); return; }
    if (d.feed) { state.feed = d.feed; renderFeed(); return; }
    if (d.story) { state.feedSup = state.feedSup === d.story ? null : d.story; renderFeed(); return; }
    if (d.gotoSup) { state.feedSup = d.gotoSup; state.feed = 'all'; go('feed'); return; }
    if (d.like) {
      const id = Number(d.like);
      if (state.liked.has(id)) state.liked.delete(id); else state.liked.add(id);
      store.save();
      const post = POSTS.find((p) => p.id === id);
      $$(`[data-like="${id}"]`).forEach((b) => {
        b.setAttribute('aria-pressed', String(state.liked.has(id)));
        $('span', b).textContent = post.likes + (state.liked.has(id) ? 1 : 0);
      });
      return;
    }
    if (d.join) {
      const id = d.join;
      const was = state.joined.has(id);
      if (was) state.joined.delete(id); else state.joined.add(id);
      store.save();
      renderHome();
      if (pdState) rerenderProduct();
      toast(was ? 'Вы вышли из совместной закупки' : 'Вы в закупке. Напишем, когда партия соберётся');
      return;
    }
    if (d.inc || d.dec) {
      const idx = Number(d.inc || d.dec);
      const item = cart()[idx];
      if (!item) return;
      const p = byId[item.id];
      const step = 1;
      const min = isSupplier() ? p.tiers[0][0] : 1;
      item.qty = Math.max(min, item.qty + (d.inc ? step : -step));
      store.save(); updateCartCount(); renderCart();
      return;
    }
    if (d.remove) { cart().splice(Number(d.remove), 1); store.save(); updateCartCount(); renderCart(); return; }
    if (t.matches('[data-checkout]')) { openSheet(checkoutHTML(), { narrow: true }); return; }
    if (d.size) { pdState.size = d.size; pdState.needSize = false; rerenderProduct(); return; }
    if (d.pdQty) {
      const p = byId[pdState.id];
      const min = isSupplier() ? p.tiers[0][0] : 1;
      pdState.qty = Math.max(min, pdState.qty + Number(d.pdQty));
      rerenderProduct();
      return;
    }
    if (t.matches('[data-pd-add]')) {
      const p = byId[pdState.id];
      if (!isSupplier() && p.sizes && !pdState.size) { toast('Выберите размер'); $('.circles button', $('#sheetBody')).focus(); return; }
      const prevShip = state.ship;
      if (!p.bulky) state.ship = pdState.ship;
      const id = pdState.id, size = pdState.size, qty = pdState.qty;
      closeSheet();
      addToCart(id, { size, qty });
      if (state.ship !== prevShip) store.save();
      return;
    }
    if (d.photo) {
      openSheet(`<div class="stack lightbox"><h2 class="sheet__title">${esc(d.caption || 'Фото со склада')}</h2><img src="${img(d.photo)}" alt="${esc(d.caption || '')}"><p class="note">Фото делает сотрудник склада TT Логистики до отправки. Если что-то не так, агент заменит товар до того, как он уедет в Россию.</p></div>`, { narrow: true });
      return;
    }
    if (d.copy) {
      const text = d.copy;
      const done = () => toast('Номер скопирован');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => selectText(t.parentElement));
      } else selectText(t.parentElement);
      return;
    }
    if (d.cab) { cabAction(d.cab); return; }
    if (t.tagName === 'A' && t.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
  }
  function selectText(el) {
    const range = document.createRange();
    range.selectNodeContents(el.firstChild);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    toast('Выделили номер, скопируйте его');
  }

  function onChange(e) {
    const t = e.target;
    if (t.type === 'radio' && t.closest('.ship')) {
      $$('.shipopt', t.closest('.ship')).forEach((l) => l.classList.toggle('is-on', $('input', l).checked));
    }
    if (t.name === 'cartShip') { state.ship = t.value; store.save(); renderCart(); renderHome(); return; }
    if (t.name === 'pdShip') { pdState.ship = t.value; rerenderProduct(); return; }
    if (t.id === 'sort') { state.sort = t.value; renderCatalog(); return; }
    if (t.dataset.factory) {
      const key = t.dataset.factory;
      state.factory[key] = t.type === 'checkbox' ? t.checked : t.value;
      toast('Настройки контент-завода сохранены');
    }
  }

  function onInput(e) {
    const t = e.target;
    if (t.id === 'q') { state.q = t.value; renderCatalog(); }
  }

  function onSubmit(e) {
    const f = e.target;
    e.preventDefault();
    if (f.id === 'linkForm') {
      const input = $('#linkInput');
      const link = input.value.trim();
      if (!link) { toast('Вставьте ссылку на товар'); input.focus(); return; }
      const found = PLATFORMS.find(([re]) => re.test(link));
      input.value = '';
      openChat();
      sendChat(`Посчитайте цену${found ? ` с ${found[1]}` : ''}: ${link}`, 'Приняла ссылку. Проверю продавца и пришлю цену в рублях с доставкой в течение 15 минут.');
      return;
    }
    if (f.id === 'checkoutForm') { submitCheckout(); return; }
    if (f.id === 'chatForm') { const i = $('#chatInput'); sendChat(i.value); i.value = ''; return; }
    if (f.id === 'addForm') {
      const name = $('#apName').value.trim();
      if (!name) { $('#apName').closest('.field').classList.add('is-error'); $('#apName').focus(); return; }
      const file = $('#apPhoto').files[0];
      state.myProducts.unshift({
        t: name, cny: Math.max(1, Number($('#apCny').value) || 1), moq: Math.max(1, Number($('#apMoq').value) || 1),
        photo: file ? URL.createObjectURL(file) : null,
      });
      closeSheet();
      renderProfile();
      toast('Товар отправлен на модерацию. Пост выйдет в 18:00');
      return;
    }
    if (f.id === 'importForm') {
      const hasFile = $('#imFile').files.length > 0;
      const url = $('#imUrl').value.trim();
      if (!hasFile && !url) { toast('Выберите файл или вставьте ссылку на магазин'); return; }
      openSheet(`<div class="success">
        <span class="success__ic">${icon('upload')}</span>
        <h2 class="sheet__title">Каталог в обработке</h2>
        <p>Контент-завод переводит названия, чистит фото и раскладывает товары по категориям. Обычно это занимает до часа, мы пришлём уведомление.</p>
        <button class="btn btn--dark" type="button" data-close>Понятно</button>
      </div>`, { narrow: true });
      return;
    }
    if (f.id === 'postForm') {
      const text = $('#poText').value.trim();
      if (!text) { $('#poText').closest('.field').classList.add('is-error'); return; }
      POSTS.unshift({ id: Date.now(), sup: 'gz', pid: $('#poProduct').value, time: 'только что', auto: false, kind: $('#poKind').value, likes: 0, comments: 0, text });
      closeSheet();
      renderHome();
      toast('Пост опубликован в ленте');
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') { closeSheet(); closeMenu(); }
  }

  /* ---------- Заставка ---------- */
  function initSplash() {
    const el = $('#splash');
    if (!el) return;
    const root = document.documentElement;
    root.classList.add('is-splash');
    let gone = false;
    const finish = () => {
      if (gone) return;
      gone = true;
      root.classList.remove('is-splash');
      el.remove();
    };
    // Анимация сама прячет заставку примерно через 3 с (CSS); касание пропускает её
    el.addEventListener('click', () => { el.classList.add('is-done'); setTimeout(finish, 500); });
    el.addEventListener('animationend', (e) => { if (e.target === el && e.animationName === 'splashOut') finish(); });
    setTimeout(finish, 4800);
  }

  /* ---------- Старт ---------- */
  function init() {
    initSplash();
    store.load();
    $$('[data-rate]').forEach((el) => { el.textContent = rateText; });
    $('#menuCats').innerHTML = CATS.map((c) => `<a href="#catalog" data-cat="${c.id}" data-close-menu>${c.name}</a>`).join('');
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKey);
    $('#menuBtn').addEventListener('click', openMenu);
    $('#searchBtn').addEventListener('click', () => {
      go('catalog');
      requestAnimationFrame(() => $('#q').focus());
    });
    window.addEventListener('hashchange', route);
    setMode(state.mode, true);
    route();
    initHero();
  }

  init();
})();
