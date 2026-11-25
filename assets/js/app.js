(() => {
  'use strict';

  /* ---------- Настройки (в рабочей версии приходят с сервера) ---------- */
  let RATE = 11.4;          // ₽ за 1 ¥, демо-значение
  const EUR = 95;             // ₽ за 1 €, демо-значение для бюджета в евро
  let FEE_RETAIL = 0.05;    // сервисный сбор ASTTA с розничной продажи
  let FEE_OPT = 0.03;       // сервисный сбор ASTTA с оптовой продажи
  // Заказ по ссылке или фото: цена с площадки по своему курсу плюс логистика за штуку (в админке меняются).
  let LINK_FEE = 0;
  let LINK_RATE = 13;       // ₽ за 1 ¥
  let LINK_DELIVERY = 1000; // ₽ за штуку
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

  // Парящий товар без фона: только для вещей с чёткой формой, на одежде выглядит плохо
  const FLOATING = {
    "headphones": ["#757575", "#2b2b2b"],
    "headphones-anc": ["#757575", "#2b2b2b"],
    "watch": ["#757575", "#2b2b2b"],
    "sunglasses": ["#6c7d75", "#282e2b"],
    "bag": ["#b14639", "#3f1b17"],
    "backpack": ["#5a6c8f", "#222834"],
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

  // Review+: как товар ведёт себя через 3 и 6 месяцев
  const REVIEWS_LONG = {
    clothes: { m3: [{ who: 'Анна, Казань', stars: 5, state: 'Как новая', text: '15 стирок при 30 °C: цвет не ушёл, швы целые, не села.' }],
      m6: [{ who: 'Дмитрий, Екатеринбург', stars: 4, state: 'Лёгкий износ', text: 'Носил всю осень и зиму. На манжетах появились катышки, остальное держится.' }],
      ok: 86, issue: 'катышки на манжетах после 4–5 месяцев' },
    shoes: { m3: [{ who: 'Игорь, Новосибирск', stars: 5, state: 'Как новые', text: 'Около 250 км пробега, подошва почти не стёрлась, сетка целая.' }],
      m6: [{ who: 'Мария, Самара', stars: 4, state: 'Лёгкий износ', text: 'Полгода каждый день. Пятка внутри протёрлась, амортизация на месте.' }],
      ok: 81, issue: 'протирается задник внутри при ежедневной носке' },
    furniture: { m3: [{ who: 'Олег, Краснодар', stars: 5, state: 'Как новый', text: 'Ткань не скаталась, кот пока не победил, каркас не скрипит.' }],
      m6: [{ who: 'Светлана, Москва', stars: 5, state: 'Как новый', text: 'Полгода без изменений, наполнитель не просел.' }],
      ok: 93, issue: 'жалоб на износ почти нет' },
    home: { m3: [{ who: 'Ксения, Пермь', stars: 5, state: 'Работает', text: 'Лампа светит каждый вечер, крепление плафона не разболталось.' }],
      m6: [{ who: 'Артём, Тула', stars: 4, state: 'Работает', text: 'Поменял лампочку на тёплую, сам торшер без нареканий.' }],
      ok: 90, issue: 'шарнир плафона иногда приходится подтягивать' },
    tech: { m3: [{ who: 'Никита, Москва', stars: 5, state: 'Работают', text: 'Батарея держит так же, как в первый день: около 30 часов.' }],
      m6: [{ who: 'Алексей, Уфа', stars: 4, state: 'Лёгкий износ', text: 'Амбушюры чуть потёрлись, звук и шумодав без изменений. Новые амбушюры есть под заказ.' }],
      ok: 84, issue: 'изнашиваются амбушюры, их можно заказать отдельно' },
    acc: { m3: [{ who: 'Руслан, Воронеж', stars: 5, state: 'Как новые', text: 'Ремешок не потрескался, стекло без царапин.' }],
      m6: [{ who: 'Елена, Омск', stars: 4, state: 'Лёгкий износ', text: 'Сменила батарейку в часах, по корпусу пара мелких царапин.' }],
      ok: 85, issue: 'мелкие царапины на корпусе' },
    bags: { m3: [{ who: 'Вика, Челябинск', stars: 5, state: 'Как новая', text: 'Экокожа не потрескалась, фурнитура не облезла.' }],
      m6: [{ who: 'Павел, Ростов-на-Дону', stars: 4, state: 'Лёгкий износ', text: 'Рюкзак полгода в школу каждый день. Лямки целы, дно немного затёрлось.' }],
      ok: 88, issue: 'затирается дно при ежедневной носке' },
  };

  // Smart Size: реальные замеры изделий каждой модели (обхват груди изделия, см; длина стельки, см)
  const MEAS = {
    'leather-jacket': { fit: 'slim', chest: [96, 100, 104, 108, 112, 116] },
    bomber: { fit: 'oversize', chest: [110, 114, 118, 122, 126, 130] },
    'tee-white': { fit: 'regular', chest: [98, 102, 106, 110, 114, 118] },
    sweatshirt: { fit: 'regular', chest: [104, 108, 112, 116, 120, 124] },
    'tee-black': { fit: 'regular', chest: [98, 102, 106, 110, 114, 118] },
    runner: { insole: [24, 24.5, 25, 25.5, 26, 26.5, 27.5] },
    loafers: { insole: [24.5, 25, 25.5, 26.5, 27, 27.5, 28.5] },
  };
  const FIT = { slim: { ease: 4, name: 'по фигуре' }, regular: { ease: 8, name: 'свободная посадка' }, oversize: { ease: 14, name: 'оверсайз' } };

  function smartSize(p) {
    const m = MEAS[p.id];
    const me = state.measures;
    if (!m || !me || !p.sizes) return null;
    const grid = SIZE_GRID[p.sizes];
    if (m.insole && me.foot) {
      const need = me.foot + 0.5;
      let k = m.insole.findIndex((x) => x >= need);
      const over = k === -1; if (over) k = m.insole.length - 1;
      return { size: grid[k][0], why: `стелька ${nf1.format(m.insole[k])} см при вашей стопе ${nf1.format(me.foot)} см`, over };
    }
    if (m.chest && me.chest) {
      const f = FIT[m.fit];
      const need = me.chest + f.ease;
      let k = m.chest.findIndex((x) => x >= need);
      const over = k === -1; if (over) k = m.chest.length - 1;
      return { size: grid[k][0], why: `грудь изделия ${m.chest[k]} см при ваших ${me.chest} см, ${f.name}`, over };
    }
    return null;
  }

  // UsagePreview: габариты мебели в см (ширина × глубина; openD — глубина в разложенном виде)
  const DIMS = {
    sofa: { w: 210, d: 92, openD: 150, name: 'Диван' },
    armchair: { w: 70, d: 72, name: 'Кресло' },
    'lounge-chair': { w: 62, d: 68, name: 'Кресло' },
    stool: { w: 40, d: 40, name: 'Табурет' },
  };

  // ASTTA Proof: проверка конкретного экземпляра на складе в Китае
  const PROOF = {
    tech: { price: 290, list: ['Включается и заряжается', 'Подключение по Bluetooth', 'Шумоподавление и микрофон', 'Корпус без царапин и сколов', 'Видео проверки 30–60 сек'] },
    furniture: { price: 490, list: ['Замеры совпадают с карточкой', 'Каркас не шатается', 'Обивка без пятен и затяжек', 'Комплект фурнитуры полный', 'Фото со всех сторон и упаковки'] },
    clothes: { price: 190, list: ['Замеры совпадают с таблицей', 'Швы ровные, без пропусков', 'Молнии и кнопки работают', 'Без пятен и запаха', 'Фото на вешалке и бирки'] },
    other: { price: 190, list: ['Соответствует фото в карточке', 'Без дефектов и следов носки', 'Комплектация полная', 'Фото со всех сторон'] },
  };
  const proofOf = (p) => PROOF[p.cat] || PROOF.other;

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
        { t: 'ASTTA Proof: проверка пройдена', d: '15 окт, 18:10', proof: true },
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
    favs: new Set(), viewed: [], // избранное и недавно смотрели (гость и демо — в браузере)
    orders: [],
    tg: null, // покупатель, вошедший через Telegram: { name, username }
    ptab: 'orders',
    measures: null,
    family: {
      budget: 30000,
      members: [{ id: 'me', name: 'Вы' }, { id: 'mom', name: 'Мама' }, { id: 'dad', name: 'Папа' }, { id: 'anya', name: 'Аня' }],
      items: [
        { id: 'f1', pid: 'sweatshirt', by: 'anya', status: 'pending', payer: 'me' },
        { id: 'f2', pid: 'lamp', by: 'mom', status: 'approved', payer: 'mom' },
        { id: 'f3', pid: 'headphones', by: 'dad', status: 'approved', payer: 'dad' },
        { id: 'f4', pid: 'headphones-anc', by: 'anya', status: 'pending', payer: 'me' },
        { id: 'f5', pid: 'sweatshirt', by: 'mom', status: 'pending', payer: 'mom' },
      ],
    },
    pools: [{
      id: 'g1', pid: 'headphones-anc', who: 'Дима', occasion: 'День рождения', date: '2026-11-14', people: 5,
      paid: [{ name: 'Вы', wish: 'С днём рождения! Теперь в метро только музыка.' }, { name: 'Саша', wish: 'Расти большой и громкий' }, { name: 'Катя', wish: '' }],
    }],
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
          // Сохранённую корзину сверяем с каталогом, когда он загрузится: на сервере товары другие, чем в демо.
          state.savedCarts = { buyer: d.carts.buyer.filter((i) => i && typeof i.id === 'string'), supplier: d.carts.supplier.filter((i) => i && typeof i.id === 'string') };
          state.carts.buyer = state.savedCarts.buyer.filter((i) => byId[i.id]);
          state.carts.supplier = state.savedCarts.supplier.filter((i) => byId[i.id]);
        }
        if (Array.isArray(d.liked)) state.liked = new Set(d.liked);
        if (Array.isArray(d.joined)) state.joined = new Set(d.joined);
        if (Array.isArray(d.favs)) state.favs = new Set(d.favs.filter((x) => typeof x === 'string'));
        if (Array.isArray(d.viewed)) state.viewed = d.viewed.filter((x) => typeof x === 'string').slice(0, 40);
        if (d.measures && typeof d.measures === 'object') state.measures = d.measures;
        if (d.family && Array.isArray(d.family.items)) state.family = d.family;
        if (Array.isArray(d.pools)) state.pools = d.pools.filter((g) => byId[g.pid]);
        if (d.tg && typeof d.tg.username === 'string') state.tg = { name: String(d.tg.name || ''), username: d.tg.username };
      } catch (e) { /* хранилище недоступно: работаем без него */ }
    },
    save() {
      if (state.savedCarts) {
        ['buyer', 'supplier'].forEach((mode) => {
          state.savedCarts[mode] = [...state.carts[mode], ...state.savedCarts[mode].filter((i) => !byId[i.id])];
        });
      }
      try {
        localStorage.setItem('astta-demo', JSON.stringify({
          mode: state.mode, ship: state.ship, carts: state.savedCarts || state.carts,
          liked: [...state.liked], joined: [...state.joined], favs: [...state.favs], viewed: state.viewed,
          measures: state.measures, family: state.family, pools: state.pools, tg: state.tg,
        }));
      } catch (e) { /* ничего */ }
    },
  };

  /* ---------- Утилиты ---------- */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat('ru-RU');
  const rub = (n) => nf.format(Math.round(n)) + ' ₽';
  const cny = (n) => nf.format(Math.round(n)) + ' ¥';
  const round10 = (n) => Math.round(n / 10) * 10;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const img = (name) => `assets/img/${name}.webp`;
  // Уменьшенные копии для телефонов (assets/img/<имя>-<ширина>.webp): так грузится в 2–3 раза меньше.
  const SMALL = { 'tile-opt': 420, 'tile-new': 420, 'tile-hits': 420, 'tile-discount': 420, 'tile-group': 420,
    'cat-clothes': 400, 'cat-furniture': 400, 'cat-home': 400, 'cat-shoes': 400, 'cat-tech': 400 };
  const imgSet = (name, full, sizes) => (SMALL[name] ? ` srcset="${img(`${name}-${SMALL[name]}`)} ${SMALL[name]}w, ${img(name)} ${full}w" sizes="${sizes}"` : '');
  // Фото товара: с сервера (загружено в админке) или из демо-набора по id.
  const pimg = (p) => (p && p.image) || img(p ? p.id : 'bag');
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

  // Сбор свой у товара (правило поставщика или категории на сервере), иначе общий.
  const feeR = (p) => (p.feeR != null ? p.feeR : FEE_RETAIL);
  const feeW = (p) => (p.feeW != null ? p.feeW : FEE_OPT);
  const pct = (x) => `${nf1.format(Math.round(x * 1000) / 10)}%`;

  // Розница: цена под ключ = товар по курсу + доставка по весу + сервисный сбор
  function retail(p, opts = {}) {
    const ship = SHIP[shipFor(p, opts.ship)];
    const qty = opts.qty || 1;
    const unit = opts.cny != null ? opts.cny : unitCny(p);
    const goods = unit * RATE * qty;
    const delivery = p.kg * ship.perKg * qty;
    const fee = goods * feeR(p);
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
    const fee = goods * feeW(p);
    return { each, goodsCny, goods, delivery, fee, ship, total: round10(goods + delivery + fee), landed: round10((goods + delivery + fee) / qty) };
  }
  const daysText = (d) => `${d[0]}–${d[1]}\u00a0дн.`;
  let rateText = RATE.toFixed(2).replace('.', ',');

  /* ---------- Карточки ---------- */
  /* ---------- Товары с Poizon и Taobao ----------
     Цена размера на площадке разная: показываем «от» и «до», заказ — по цене размера, которую называет покупатель
     (форма «Цена по ссылке»). Цены считает сервер той же формулой, что заказ по ссылке. */
  const MARKET_NAME = { poizon: 'Poizon', taobao: 'Taobao' };
  const isStorefrontVisible = (p) => !(p?.market?.source === 'taobao' && (p.photoFailed || (p.live && !p.image)));
  const isMarket = (p) => !!(p && p.market);
  const hasWholesale = (p) => !isMarket(p) && !!p.tiers.length;
  const marketFrom = (p) => (p.retailRub != null ? p.retailRub : linkTotal(p.cny));
  const marketTo = (p) => {
    const m = p.market || {};
    if (m.retail_max_rub != null) return Number(m.retail_max_rub);
    return m.price_cny_max ? linkTotal(Number(m.price_cny_max)) : null;
  };
  function marketCardHTML(p) {
    if (!isStorefrontVisible(p)) return '';
    const src = p.market.source;
    const days = SHIP.auto.days;
    const sold = [50, 20, 10].find((threshold) => p.sold >= threshold);
    return `<article class="card card--market">
      <div class="card__media">
        <img class="card__img" data-product-photo="${esc(p.id)}" src="${esc(pimg(p))}" alt="" loading="lazy" width="720" height="720">
        <span class="mkbadge mkbadge--${esc(src)}">${esc(MARKET_NAME[src] || src)}</span>
        ${favBtnHTML(p, 'card__fav')}
        <button class="card__add" type="button" data-open="${esc(p.id)}" aria-label="Подробнее: ${esc(p.t)}">${icon('arrow')}</button>
      </div>
      <div class="card__body">
        <div class="card__price"><small class="card__from">от</small>${rub(marketFrom(p))}</div>
        <div class="card__unit">${src === 'poizon' ? `${icon('check')}Оригинал` : 'Цена зависит от варианта'}</div>
        <h3 class="card__title"><button class="card__hit" type="button" data-open="${esc(p.id)}">${esc(p.t)}</button></h3>
        <div class="card__meta"><span>${daysText(days)} после отправки</span>${src === 'poizon' && sold ? `<span>${sold}+ продаж на Poizon</span>` : ''}</div>
      </div>
    </article>`;
  }

  // Keep original SKU objects for carts and orders; collapse only displayed lists.
  const wheelVariants = new Map();
  const productModelKey = (p) => p.wheel ? 'wheel:' + p.wheel.key : 'sku:' + p.id;
  function groupWheelProducts(items) {
    const groups = new Map();
    items.filter((p) => !isSupplier() || hasWholesale(p)).forEach((p) => {
      const key = productModelKey(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    return [...groups.values()].map((variants) => {
      if (!variants[0].wheel) return variants[0];
      const cheapest = variants.reduce((a, b) => catalogPrice(a) <= catalogPrice(b) ? a : b);
      const diameters = [...new Set(variants.map((p) => p.wheel.diameter))].sort((a,b) => Number(a)-Number(b));
      return { ...cheapest, t: cheapest.wheel.model, wheelDiameters: diameters };
    });
  }

  function cardHTML(p) {
    if (isSupplier() && !hasWholesale(p)) return '';
    if (isMarket(p)) return marketCardHTML(p);
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
    if (p.wheel) {
      price = 'от ' + price;
      sub = [(p.wheelDiameters || [p.wheel.diameter]).map((d) => 'R' + d).join(' · '), sub].filter(Boolean).join(' · ');
      old = '';
    }
    let badge = '';
    if (p.sale && !isSupplier()) badge = `<span class="badge badge--hot">−${p.sale}%</span>`;
    else if (p.group) badge = '<span class="badge badge--group">Совместный опт</span>';
    else if (p.isNew) badge = '<span class="badge">Новинка</span>';
    const days = SHIP[shipFor(p)].days;
    return `<article class="card">
      <div class="card__media">
        <img class="card__img" data-product-photo="${esc(p.id)}" src="${esc(pimg(p))}" alt="" loading="lazy" width="720" height="720">
        ${badge}
        ${favBtnHTML(p, 'card__fav')}
        <button class="card__add" type="button" data-add="${p.id}" aria-label="В корзину: ${esc(p.t)}">${icon('plus')}</button>
      </div>
      <div class="card__body">
        <div class="card__price">${price}${old}</div>
        <div class="card__unit">${sub}</div>
        <h3 class="card__title"><button class="card__hit" type="button" data-open="${p.id}">${esc(p.t)}</button></h3>
        <div class="card__meta">${p.rating ? `<span>${icon('star', 'ic--fill')}${nf1.format(p.rating)}</span>` : ''}<span>${daysText(days)} после отправки</span></div>
      </div>
    </article>`;
  }

  /* ---------- Избранное и недавно смотрели ----------
     Гость и демо хранят их в браузере, вошедший покупатель — на сервере (/api/me/favorites, /api/me/viewed).
     После входа собранное в браузере переносится в аккаунт. */
  function favBtnHTML(p, cls) {
    const on = state.favs.has(p.id);
    return `<button class="${cls}${on ? ' is-on' : ''}" type="button" data-fav="${esc(p.id)}" aria-pressed="${on}" aria-label="${on ? 'Убрать из избранного' : 'В избранное'}: ${esc(p.t)}">${icon('heart')}</button>`;
  }
  function syncFavButtons(id) {
    const on = state.favs.has(id);
    $$('[data-fav]').filter((b) => b.dataset.fav === id).forEach((b) => {
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
      if (on) { b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); }
    });
  }
  const onServer = (id) => live.on && live.me && byId[id] && byId[id].live;
  async function toggleFav(id) {
    if (!byId[id]) return;
    const on = !state.favs.has(id);
    if (on) state.favs.add(id); else state.favs.delete(id);
    store.save();
    syncFavButtons(id);
    toast(on ? 'Добавили в избранное' : 'Убрали из избранного');
    if (onServer(id)) {
      try {
        await api(`/api/me/favorites/${encodeURIComponent(id)}`, { method: on ? 'PUT' : 'DELETE' });
        prof.favs = null;
      } catch (e) {
        if (on) state.favs.delete(id); else state.favs.add(id);
        store.save(); syncFavButtons(id); toast(e.message);
      }
    }
    if (currentView === 'profile') renderProfile();
  }
  function trackView(id) {
    state.viewed = [id, ...state.viewed.filter((x) => x !== id)].slice(0, 40);
    store.save();
    if (onServer(id)) { prof.viewed = null; api(`/api/me/viewed/${encodeURIComponent(id)}`, { method: 'POST' }).catch(() => {}); }
  }
  // «Для вас» без сервера: любимые категории из избранного и просмотров, сначала то, что ещё не смотрели.
  function localRecommended(limit = 12) {
    const weight = {};
    [...state.favs].forEach((id) => { if (byId[id]) weight[byId[id].cat] = (weight[byId[id].cat] || 0) + 3; });
    state.viewed.forEach((id) => { if (byId[id]) weight[byId[id].cat] = (weight[byId[id].cat] || 0) + 1; });
    const score = (p) => (weight[p.cat] || 0) * 10 - (state.viewed.includes(p.id) ? 5 : 0) + (p.rating || 0) + Math.min(5, (p.sold || p.reviews || 0) / 100);
    return PRODUCTS.filter((p) => !state.favs.has(p.id)).sort((a, b) => score(b) - score(a)).slice(0, limit);
  }

  function postHTML(post) {
    const s = SUPPLIERS[post.sup] || { name: post.supName || 'Поставщик', about: '', short: '··' };
    const p = byId[post.pid];
    const liked = state.liked.has(post.id);
    const price = !p ? '' : (isSupplier() && hasWholesale(p) ? `${cny(p.tiers[0][1])} · от ${p.tiers[0][0]} шт` : `${rub(isMarket(p) ? marketFrom(p) : retail(p).total)} под ключ`);
    const photo = post.photo || (p ? pimg(p) : '');
    const product = p ? `<div class="post__product">
        <img src="${pimg(p)}" alt="" loading="lazy" width="46" height="46">
        <div><button class="link" type="button" data-open="${p.id}"><b>${esc(p.t)}</b></button><span>${price}</span></div>
        <button class="roundbtn" type="button" data-add="${p.id}" aria-label="В корзину: ${esc(p.t)}">${icon('plus')}</button>
      </div>` : '';
    // Лайки и комментарии в ленте пока только в демо: на сервере их нет, нули не показываем.
    const actions = live.on ? `<div class="post__actions">
        ${p ? `<button type="button" data-open="${p.id}">${icon('bag')}<span>Смотреть товар</span></button>` : ''}
        <button class="push" type="button" data-open-chat="${esc(post.sup)}">Спросить поставщика</button>
      </div>` : `<div class="post__actions">
        <button type="button" data-like="${post.id}" aria-pressed="${liked}" aria-label="Нравится">${icon('heart')}<span>${post.likes + (liked ? 1 : 0)}</span></button>
        <button type="button" data-open="${p.id}" aria-label="Отзывы и вопросы">${icon('chat')}<span>${post.comments}</span></button>
        <button class="push" type="button" data-open-chat="${esc(post.sup)}">Спросить поставщика</button>
      </div>`;
    return `<article class="post">
      <header class="post__head">
        <span class="ava" aria-hidden="true">${esc(s.short)}</span>
        <div class="post__who"><b>${esc(s.name)}</b><span>${esc(post.time)}${s.about ? ` · ${esc(s.about)}` : ''}</span></div>
        ${post.auto ? `<span class="tag" title="Пост собран контент-заводом из карточки товара">${icon('spark')}Автопост</span>` : ''}
      </header>
      <p class="post__text">${esc(post.text)}</p>
      ${photo ? `<img class="post__img" src="${esc(photo)}" alt="${p ? esc(p.t) : ''}" loading="lazy" width="720" height="540">` : ''}
      ${product}
      ${actions}
    </article>`;
  }

  /* ---------- Главная ---------- */
  function renderHome() {
    $('#reelRail').innerHTML = TRENDS.map(reelThumbHTML).join('');
    // Пустые подборки и разделы на главной прячем: на боевом сайте нет роликов и совместного опта.
    $('#homeCats').innerHTML = CATS.map((c) => `<button class="cat" type="button" data-cat="${esc(c.id)}"><img src="${esc(c.src || img(c.img))}"${c.src ? '' : imgSet(c.img, 640, '(max-width: 760px) 40vw, 15vw')} alt="" loading="lazy" width="640" height="800"><span>${esc(c.name)}</span></button>`).join('');
    // «Хиты» временно убраны с главной, включая старую HTML-версию из кеша.
    const popular = $('#popular'); if (popular) { popular.innerHTML = ''; popular.closest('section').hidden = true; }
    // Блока может не быть, если сервер отдал старый index.html к новому app.js: тогда просто пропускаем его.
    const poizonGrid = $('#poizonGrid');
    if (poizonGrid) poizonGrid.innerHTML = PRODUCTS.filter(isPoizon).sort((a, b) => b.sold - a.sold).slice(0, 8).map(cardHTML).join('');
    $('#feedPreview').innerHTML = POSTS.slice(0, 3).map(postHTML).join('');
    ['#reelRail', '#popular', '#poizonGrid', '#feedPreview', '#homeCats'].forEach((sel) => {
      const box = $(sel);
      if (box) box.closest('section').hidden = !box.innerHTML.trim();
    });
    const empty = $('#liveEmpty');
    if (empty) empty.hidden = !(live.on && !PRODUCTS.length);
    syncHomeNav();
  }

  const PLATFORMS = [[/1688\./i, '1688'], [/taobao\.|tb\.cn/i, 'Taobao'], [/tmall\./i, 'Tmall'], [/poizon|dewu|dw4\.co/i, 'Poizon'], [/pinduoduo|yangkeduo/i, 'Pinduoduo']];

  function shipOptionsHTML(name, current, onlyCargo) {
    const keys = (onlyCargo ? ['cargo'] : ['auto', 'air']).filter((k) => SHIP[k]);
    return keys.map((k) => {
      const s = SHIP[k];
      return `<label class="shipopt ${current === k ? 'is-on' : ''}">
        <input type="radio" name="${name}" value="${k}" ${current === k ? 'checked' : ''}>
        ${icon(s.icon)}
        <div><b>${esc(s.name)}</b><span>${daysText(s.days)}</span></div>
      </label>`;
    }).join('');
  }

  /* ---------- Каталог ---------- */
  const FILTERS = [{ id: 'all', name: 'Все' }, { id: 'poizon', name: 'Оригиналы Poizon' }, { id: 'budget', name: 'До 1\u00a0000\u00a0₽' }, { id: 'new', name: 'Новинки' }];
  const isPoizon = (p) => !!(p.market && p.market.source === 'poizon');

  function filterProducts(filter, q) {
    const ql = (q || '').toLowerCase();
    return PRODUCTS.filter((p) => {
      if (!isStorefrontVisible(p)) return false;
      if (isSupplier() && !hasWholesale(p)) return false;
      if (filter === 'new' && !p.isNew) return false;
      if (filter === 'group' && !p.group) return false;
      if (filter === 'poizon' && !isPoizon(p)) return false;
      if (filter === 'budget' && (isMarket(p) ? marketFrom(p) : (isSupplier() ? wholesale(p, p.tiers[0][0]).landed : retail(p).total)) > 1000) return false;
      if (CATS.some((c) => c.id === filter) && p.cat !== filter) return false;
      if (!ql) return true;
      const catName = (CATS.find((c) => c.id === p.cat) || {}).name || '';
      return (p.t + ' ' + (p.brand || p.market?.brand || '') + ' ' + catName + ' ' + SUPPLIERS[p.sup].name).toLowerCase().includes(ql);
    });
  }

  // Внутри одной характеристики — ИЛИ, между характеристиками — И.
  const catalogFilters = { min: '', max: '', sale: false, fresh: false,
    brand: new Set(), color: new Set(), size: new Set(), source: new Set(), supplier: new Set() };
  const FACETS = ['brand', 'color', 'size', 'source'];
  const filterKey = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const COLOR_GROUPS = [
    ['Чёрный', '#202020', 'черный', 'черная', 'черные', 'black'],
    ['Белый', '#ffffff', 'белый', 'белая', 'белые', 'white'],
    ['Серый', '#85858a', 'серый', 'серая', 'серые', 'grey', 'gray'],
    ['Бежевый', '#d9c5a1', 'бежевый', 'бежевая', 'бежевые', 'beige'],
    ['Коричневый', '#85593c', 'коричневый', 'коричневая', 'коричневые', 'brown'],
    ['Красный', '#c72e3b', 'красный', 'красная', 'красные', 'red'],
    ['Розовый', '#e78cb7', 'розовый', 'розовая', 'розовые', 'pink'],
    ['Синий', '#315aaa', 'синий', 'синяя', 'синие', 'blue'],
    ['Голубой', '#86bfe1', 'голубой', 'голубая', 'голубые', 'light blue'],
    ['Зелёный', '#39845b', 'зеленый', 'зеленая', 'зеленые', 'green'],
    ['Жёлтый', '#e9c746', 'желтый', 'желтая', 'желтые', 'yellow'],
    ['Оранжевый', '#df8735', 'оранжевый', 'оранжевая', 'оранжевые', 'orange'],
    ['Фиолетовый', '#8e60a8', 'фиолетовый', 'фиолетовая', 'фиолетовые', 'purple'],
    ['Разноцветный', '', 'разноцветный', 'разноцветная', 'разноцветные', 'multicolor'],
  ];
  function colorValue(value) {
    const key = filterKey(value);
    const group = COLOR_GROUPS.find((g) => g.slice(2).includes(key));
    return group ? { key: filterKey(group[0]), label: group[0], swatch: group[1] } : { key, label: String(value).trim(), swatch: '' };
  }
  const catalogPrice = (p) => isSupplier() ? p.tiers[0][1] : isMarket(p) ? marketFrom(p) : retail(p).total;
  const priceBounds = () => ({ min: catalogFilters.min === '' ? null : Number(catalogFilters.min), max: catalogFilters.max === '' ? null : Number(catalogFilters.max) });
  function priceError() {
    const { min, max } = priceBounds();
    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0))) return 'Цена должна быть неотрицательным числом';
    return min !== null && max !== null && min > max ? 'Цена «от» не может быть больше цены «до»' : '';
  }
  function brandFamily(value) {
    const text = String(value || '').trim(), key = filterKey(text).replace(/[®™]/g, '');
    const groups = { adidas: 'Adidas', 'adidas neo': 'Adidas', 'adidas originals': 'Adidas', 'adidas terrex': 'Adidas', 'adidas performance': 'Adidas', 'adidas sportswear': 'Adidas', 'adidas neo label': 'Adidas', '阿迪达斯': 'Adidas', nike: 'Nike', 'nike acg': 'Nike', 'nike sb': 'Nike', 'nike sportswear': 'Nike', 'nike running': 'Nike', '耐克': 'Nike', 'new balance': 'New Balance', newbalance: 'New Balance' };
    return groups[key] || text;
  }
  function variantLabel(value, index = 0) {
    let text = String(value || '').trim();
    text = text.replace(/(\d+(?:\.\d+)?)\s*[-–~至]\s*(\d+(?:\.\d+)?)\s*斤/g, (_, a, b) => `${Number(a) / 2}–${Number(b) / 2} кг`).replace(/(\d+(?:\.\d+)?)\s*斤/g, (_, a) => `${Number(a) / 2} кг`);
    const words = [['一对装', 'Пара'], ['一双装', 'Пара'], ['均码', 'Единый размер'], ['通用码', 'Единый размер'], ['特大码', 'Очень большой размер'], ['加大码', 'Большой размер'], ['大码', 'Большой размер'], ['小码', 'Маленький размер'], ['中码', 'Средний размер'], ['不可调节', 'не регулируется'], ['可调节', 'регулируется'], ['体重', 'Вес '], ['适合', 'для '], ['建议', 'рекомендуется '], ['身高', 'Рост '], ['厘米', ' см'], ['公斤', ' кг'], ['千克', ' кг']];
    words.sort((a, b) => b[0].length - a[0].length).forEach(([original, translated]) => { text = text.replaceAll(original, translated); });
    text = text.replace(/(регулируется)(?=\d)/g, '$1 ');
    if (/[\u3400-\u9fff]/.test(text)) return `Вариант ${index + 1} · уточните у агента`;
    return text.replace(/(\d)\s*[-~]\s*(\d)/g, '$1–$2').replaceAll('（', ' (').replaceAll('）', ')').replace(/\s+/g, ' ').trim();
  }
  function facetValues(p, facet) {
    let values;
    if (facet === 'brand') values = [p.brandGroup || brandFamily(p.brand || p.market?.brand || '')];
    else if (facet === 'color') return [...new Map((p.filterColors?.length ? p.filterColors : p.colors || []).map((v) => { const c = colorValue(v); return [c.key, c]; })).values()].filter((v) => v.key);
    else if (facet === 'size') values = p.filterSizeOptions?.length ? p.filterSizeOptions.map((v) => v.value) : p.market?.sizes?.length ? p.market.sizes.map((v) => v.size) : p.filterSizes?.length ? p.filterSizes : p.grid?.length ? p.grid.map((v) => v[0]) : (p.market?.sizes || []).map((v) => v.size);
    else if (facet === 'source') values = [p.market?.source || 'direct'];
    else if (facet === 'supplier') values = [p.sup];
    return [...new Set((values || []).map((v) => String(v).trim()).filter(Boolean))].map((v, i) => ({
      key: filterKey(v), label: facet === 'source' ? (v === 'direct' ? 'Прямые поставщики' : MARKET_NAME[v] || v) : facet === 'supplier' ? SUPPLIERS[v]?.name || v : facet === 'size' ? (p.filterSizeOptions?.find((x) => x.value === v)?.label || variantLabel(v, i)) : v,
    }));
  }
  function matchesCatalogFilters(p, omit) {
    if (priceError()) return false;
    const { min, max } = priceBounds(), price = catalogPrice(p);
    if ((min !== null && price < min) || (max !== null && price > max)) return false;
    if (catalogFilters.sale && !p.sale) return false;
    if (catalogFilters.fresh && !p.isNew) return false;
    return FACETS.every((facet) => facet === omit || !catalogFilters[facet].size || facetValues(p, facet).some((v) => catalogFilters[facet].has(v.key)));
  }
  function catalogFilterState() {
    return JSON.stringify([catalogFilters.min, catalogFilters.max, catalogFilters.sale, catalogFilters.fresh, ...FACETS.map((f) => [...catalogFilters[f]].sort())]);
  }
  function applyFacetSearch(facet) {
    const input = $(`[data-facet-search="${facet}"]`);
    if (!input) return;
    const q = filterKey(input.value), box = $(`[data-facet-values="${facet}"]`);
    let visible = 0;
    $$('.filter-check', box).forEach((label) => { label.hidden = !filterKey(label.textContent).includes(q); if (!label.hidden) visible++; });
    const empty = $('[data-facet-no-match]', box);
    if (empty) empty.hidden = visible > 0;
  }
  function renderCatalogFilters(base, list) {
    const active = document.activeElement;
    const focus = active?.dataset.facet ? { facet: active.dataset.facet, value: active.value } : null;
    const currency = isSupplier() ? '¥' : '₽';
    $('#priceFilterTitle').textContent = `Цена, ${currency}`;
    $('#priceFilterHint').textContent = isSupplier() ? 'Цена за штуку для минимальной оптовой партии.' : 'Цена карточки с доставкой. У товаров с площадок — цена «от»; цена размера может отличаться.';
    for (const [id, key] of [['priceMin', 'min'], ['priceMax', 'max']]) if (document.activeElement !== $('#' + id)) $('#' + id).value = catalogFilters[key];
    const error = priceError();
    $('#priceFilterError').textContent = error; $('#priceFilterError').hidden = !error;
    ['#priceMin', '#priceMax'].forEach((id) => $(id).setAttribute('aria-invalid', String(!!error)));
    $$('[data-filter-flag]').forEach((el) => { el.checked = catalogFilters[el.dataset.filterFlag]; });
    const selected = [];
    if (catalogFilters.min !== '' || catalogFilters.max !== '') selected.push({ facet: 'price', value: '', label: `${catalogFilters.min !== '' ? 'От ' + catalogFilters.min : ''}${catalogFilters.max !== '' ? ' до ' + catalogFilters.max : ''} ${currency}` });
    if (catalogFilters.sale) selected.push({ facet: 'sale', value: '', label: 'Со скидкой' });
    if (catalogFilters.fresh) selected.push({ facet: 'fresh', value: '', label: 'Новинки' });
    FACETS.forEach((facet) => {
      const options = new Map();
      base.forEach((p) => facetValues(p, facet).forEach((v) => { if (!options.has(v.key)) options.set(v.key, { ...v, count: 0, models: new Set() }); }));
      base.filter((p) => matchesCatalogFilters(p, facet)).forEach((p) => facetValues(p, facet).forEach((v) => { if (options.has(v.key)) { const option = options.get(v.key); option.models.add(productModelKey(p)); option.count = option.models.size; } }));
      catalogFilters[facet].forEach((key) => { if (!options.has(key)) {
        const known = PRODUCTS.flatMap((p) => facetValues(p, facet)).find((v) => v.key === key);
        options.set(key, { ...(known || { key, label: key }), count: 0 });
      } });
      const sizes = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', '5xl'];
      const values = [...options.values()].sort((a, b) => {
        if (facet === 'size' && sizes.includes(a.key) && sizes.includes(b.key)) return sizes.indexOf(a.key) - sizes.indexOf(b.key);
        return a.label.localeCompare(b.label, 'ru', { numeric: true });
      });
      const box = $(`[data-facet-values="${facet}"]`);
      box.innerHTML = values.map((v) => {
        const checked = catalogFilters[facet].has(v.key);
        if (checked) selected.push({ facet, value: v.key, label: v.label });
        return `<label class="filter-check${!v.count && !checked ? ' is-disabled' : ''}"><input type="checkbox" data-facet="${facet}" value="${esc(v.key)}" ${checked ? 'checked' : ''} ${!v.count && !checked ? 'disabled' : ''}>${facet === 'color' ? `<i class="filter-swatch" aria-hidden="true"${v.swatch ? ` style="background:${v.swatch}"` : ''}></i>` : ''}<span>${esc(v.label)}</span><small>${v.count}</small></label>`;
      }).join('') + `<p class="note" data-facet-no-match ${values.length ? 'hidden' : ''}>${values.length ? 'Ничего не найдено' : 'Характеристика не заполнена у этих товаров'}</p>`;
      applyFacetSearch(facet);
    });
    if (focus) $$('input[data-facet]').find((el) => el.dataset.facet === focus.facet && el.value === focus.value)?.focus({ preventScroll: true });
    $('#selectedFilters').innerHTML = selected.map((v) => `<button class="chip" type="button" data-remove-filter="${v.facet}" data-value="${esc(v.value)}" aria-label="Убрать фильтр: ${esc(v.label)}">${esc(v.label)} <span aria-hidden="true">×</span></button>`).join('');
    $('#selectedFilters').hidden = !selected.length;
    $('#filterCount').textContent = selected.length; $('#filterCount').hidden = !selected.length;
    $('.catalog-results [data-filter-reset]').hidden = !selected.length && state.cat === 'all' && !state.q;
    $('#catalogCount').textContent = `Найдено ${list.length} ${plural(list.length, 'товар', 'товара', 'товаров')}${catalogLoad.running || catalogLoad.failed.length ? ' в загруженной части каталога' : ''}`;
    $('[data-filter-apply]').textContent = `Показать ${list.length} ${plural(list.length, 'товар', 'товара', 'товаров')}`;
  }
  function resetCatalogFilters() {
    catalogFilters.min = ''; catalogFilters.max = ''; catalogFilters.sale = false; catalogFilters.fresh = false;
    FACETS.forEach((key) => catalogFilters[key].clear());
    state.cat = 'all'; state.q = ''; $('#q').value = '';
    $$('[data-facet-search]').forEach((el) => { el.value = ''; });
    renderCatalog();
  }

  const catalogView = { key: '', limit: 60 };
  const catalogLoad = { running: false, total: 0, failed: [] };

  function catalogStatus() {
    const el = $('#catalogStatus');
    if (!el) return;
    el.textContent = catalogLoad.running ? `Загружаем каталог: ${PRODUCTS.length} из ${catalogLoad.total}. Результаты поиска дополняются.`
      : catalogLoad.failed.length ? 'Часть каталога не загрузилась. Повторите загрузку, чтобы искать по всем товарам.' : '';
    $('#catalogRetry').hidden = catalogLoad.running || !catalogLoad.failed.length;
  }

  function renderCatalog() {
    $('#catChips').innerHTML = [...FILTERS.filter((f) => f.id !== 'poizon' || PRODUCTS.some(isPoizon)), ...CATS].map((c) => `<button class="chip" type="button" data-chip="${esc(c.id)}" aria-pressed="${state.cat === c.id}">${esc(c.name)}</button>`).join('');
    const priceOf = catalogPrice;
    const sorters = {
      pop: (a, b) => b.sold - a.sold,
      cheap: (a, b) => priceOf(a) - priceOf(b),
      expensive: (a, b) => priceOf(b) - priceOf(a),
      fast: (a, b) => SHIP[shipFor(a)].days[0] - SHIP[shipFor(b)].days[0] || b.sold - a.sold,
      rating: (a, b) => b.rating - a.rating,
    };
    const base = filterProducts(state.cat, state.q);
    const list = groupWheelProducts(base.filter((p) => matchesCatalogFilters(p))).sort(sorters[state.sort]);
    renderCatalogFilters(base, list);
    const key = [state.mode, state.cat, state.q, state.sort, catalogFilterState()].join('|');
    if (catalogView.key !== key) { catalogView.key = key; catalogView.limit = 60; }
    $('#catalogGrid').innerHTML = list.slice(0, catalogView.limit).map(cardHTML).join('');
    $('#catalogEmpty').hidden = list.length > 0 || catalogLoad.running || catalogLoad.failed.length > 0;
    const more = $('#catalogMore');
    more.hidden = list.length <= catalogView.limit;
    more.textContent = `Показать ещё · осталось ${Math.max(0, list.length - catalogView.limit)}`;
    catalogStatus();
  }

  /* ---------- Лента ---------- */
  function renderFeed() {
    const filters = [['all', 'Все'], ['new', 'Новинки'], ['restock', 'Поступления']];
    $('#feedChips').innerHTML = filters.map(([id, name]) => `<button class="chip" type="button" data-feed="${id}" aria-pressed="${state.feed === id}">${name}</button>`).join('');
    const list = POSTS.filter((p) => {
      if (state.feed === 'following') return FOLLOWING.includes(p.sup);
      if (state.feed === 'all') return true;
      return p.kind === state.feed;
    });
    $('#feedList').innerHTML = list.length ? list.map(postHTML).join('') : '<p class="empty">В этом разделе пока нет публикаций.</p>';
  }

  /* ---------- Корзина ---------- */
  const cart = () => state.carts[state.mode];
  const cartKey = (i) => JSON.stringify([i.id, i.size || '', i.color || '']);

  function addToCart(id, opts = {}) {
    const p = byId[id];
    if (!p) return;
    if (isMarket(p)) { openProduct(id); return; }
    if (isSupplier() && !hasWholesale(p)) { toast('Этот товар доступен только в розницу'); return; }
    if (live.on && ((p.wheel && !opts.size) || !p.detail || ((p.grid || []).length && (!opts.size || opts.size === '?')) || ((p.colors || []).length && !opts.color))) {
      openProduct(id, { needSize: true }); return;
    }
    if (!isSupplier() && p.sizes && !opts.size) {
      openProduct(id, { needSize: true });
      return;
    }
    const min = isSupplier() ? p.tiers[0][0] : 1;
    const qty = Math.max(min, opts.qty || min);
    const item = cart().find((i) => cartKey(i) === cartKey({ id, size: opts.size, color: opts.color }));
    if (item) { item.qty += isSupplier() ? qty : (opts.qty || 1); if (opts.proof) item.proof = true; }
    else cart().push({ id, qty, size: opts.size || null, color: opts.color || '', proof: !!opts.proof });
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
    let goods = 0, delivery = 0, fee = 0, goodsCny = 0, proof = 0;
    cart().forEach((i) => {
      const p = byId[i.id];
      if (i.proof && !isSupplier()) proof += proofOf(p).price * i.qty;
      if (isSupplier()) {
        const w = wholesale(p, i.qty);
        goods += w.goods; delivery += w.delivery; fee += w.fee; goodsCny += w.goodsCny;
      } else {
        const r = retail(p, { qty: i.qty });
        goods += r.goods; delivery += r.delivery; fee += r.fee;
      }
    });
    return { goods, delivery, fee, goodsCny, proof, total: round10(goods + delivery + fee + proof) };
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
      const sizeLabel = (i.size === '?' ? ' · размер подберёт агент' : (i.size ? ` · размер CN ${esc(i.size)}` : '')) + (i.color ? ` · ${esc(i.color)}` : '') + (i.proof ? ' · с проверкой Proof' : '');
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
        <img src="${pimg(p)}" alt="" width="76" height="76" loading="lazy">
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
        ${t.proof ? `<div class="sum__row"><span>ASTTA Proof, проверка</span><span>${rub(t.proof)}</span></div>` : ''}
        <div class="sum__row sum__row--total"><span>Итого</span><span>${rub(t.total)}</span></div>
        <p class="sum__note">${live.on ? 'Менеджер подтвердит наличие, итоговую цену и оплату.' : 'Оплата сразу при заказе.'} Нет товара у поставщика — вернём деньги за него.</p>
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
      <p class="note">Передадим корзину менеджеру. Он проверит наличие, согласует итоговую цену и подскажет, как оплатить.</p>
      <p class="note">При наличии товар обычно доезжает до склада в Китае за 2–7 дней. Стандартная отправка со склада до Москвы занимает около 20 дней. Срок до вашего города уточнит менеджер.</p>
      <form class="stack" id="checkoutForm" novalidate>
        <label class="field"><span>Телефон, Telegram или почта</span><input id="ckContact" name="contact" autocomplete="tel" placeholder="+7 …, @username или почта" value="${esc(tgContact())}" required></label>
        ${consentHTML('ckConsent')}
        <div class="sum"><div class="sum__row sum__row--total sum__row--solo"><span>Итого</span><span>${rub(t.total)}</span></div></div>
        <button class="btn btn--lime btn--wide" type="submit">${live.on ? 'Передать заказ менеджеру' : 'Перейти к оплате'}</button>
      </form>
    </div>`;
  }

  // Номер как на сервере: A-000123.
  const orderNum = () => `A-${String(1200 + Math.floor(Math.random() * 8000)).padStart(6, '0')}`;

  function submitCheckout() {
    const input = $('#ckContact');
    const field = input.closest('.field');
    const bad = !input.value.trim();
    field.classList.toggle('is-error', bad);
    let err = $('.field__err', field);
    if (bad && !err) { err = document.createElement('small'); err.className = 'field__err'; err.textContent = 'Укажите телефон, Telegram или почту'; field.append(err); }
    if (!bad && err) err.remove();
    if (bad) { input.focus(); return; }
    if (!consentOk('ckConsent')) return;
    if (live.on) { checkoutLive(input.value.trim(), $('#checkoutForm button[type=submit]')); return; }
    const num = orderNum();
    const t = cartTotals();
    state.orders.unshift({
      num, date: 'сегодня', items: cart().map((i) => i.id), total: t.total, ship: state.ship, now: 0, fresh: true, unpaid: true,
      stages: [
        { t: 'Ждёт оплаты', d: 'цена держится 24 часа' },
        { t: 'Заказываем у поставщика', d: 'нет товара — вернём деньги за него' },
        { t: 'Склад в Китае: фото и вес', d: '' },
        { t: 'Отправка в Россию', d: '' },
        { t: 'Пункт выдачи', d: '' },
      ],
    });
    state.carts[state.mode] = [];
    store.save();
    updateCartCount();
    renderCart();
    openPaySheet(num, `<div class="sum__row"><span>Товары и доставка</span><span>${rub(t.total)}</span></div>`, t.total);
  }

  /* ---------- Профиль: заказы / кабинет ---------- */
  function orderHTML(o) {
    const status = o.delivered ? '<span class="pill">Получен</span>' : (o.unpaid ? '<span class="pill pill--go">Ждёт оплаты</span>' : (o.fresh ? '<span class="pill pill--go">Выкупаем</span>' : '<span class="pill pill--go">В пути</span>'));
    const stages = o.stages.map((s, i) => {
      const cls = i < o.now || o.delivered ? 'is-done' : (i === o.now ? 'is-now' : '');
      const photo = s.photo ? `<button class="tl__photo" type="button" data-photo="${s.photo}" data-caption="${esc(s.t)}"><img src="${img(s.photo)}" alt="" width="84" height="60" loading="lazy"><span>${esc(s.note)}</span></button>` : '';
      const proofBtn = s.proof ? `<button class="tl__photo" type="button" data-proof-report="${o.num}"><span class="tl__proof">${icon('check')}</span><span>Отчёт о проверке вашего экземпляра</span></button>` : '';
      return `<li class="${cls}"><span class="dot">${cls === 'is-done' ? icon('check') : ''}</span><div class="tl__body"><b>${esc(s.t)}</b>${s.d ? `<span>${esc(s.d)}</span>` : ''}${photo}${proofBtn}</div></li>`;
    }).join('');
    return `<article class="order">
      <div class="order__head">
        <div>
          <div class="order__num">${o.num}<button type="button" data-copy="${o.num}">Скопировать</button></div>
          <div class="order__sub">от ${o.date} · ${rub(o.total)} · ${SHIP[o.ship] ? SHIP[o.ship].name.toLowerCase() : 'авто'}</div>
        </div>
        ${status}
      </div>
      ${o.link ? `<p class="order__link">${icon('route')}<span>${esc(o.link.title)}${o.link.url ? ` · <span class="mono">${esc(o.link.url)}</span>` : ''}</span></p>` : `<div class="thumbs">${o.items.map((id) => `<img src="${pimg(byId[id])}" alt="${esc(byId[id].t)}" width="52" height="52" loading="lazy">`).join('')}</div>`}
      ${o.unpaid ? `<button class="btn btn--lime btn--sm" type="button" data-pay-link="${o.num}" style="align-self:flex-start">Оплатить ${rub(o.total)}</button>` : ''}
      <ol class="timeline">${stages}</ol>
      ${o.delivered ? `<div class="rvremind">${icon('star')}<div><b>Review+ через 3 месяца</b><span>8 января напомним рассказать, как кроссовки после 3 месяцев носки</span></div><button class="btn btn--line btn--sm" type="button" data-rv-now>Отзыв сейчас</button></div>` : `<button class="btn btn--ghost btn--sm" type="button" data-open-chat style="align-self:flex-start">${icon('chat')}Вопрос по заказу</button>`}
    </article>`;
  }

  /* ---------- Профиль: заказы, избранное, «Для вас», недавно смотрели, чат с ИИ, траты, данные, мерки ----------
     Вошедший покупатель берёт всё с сервера (/api/me/…), гость и демо — из браузера. */
  const prof = { favs: null, viewed: null, rec: null, chat: null, loading: new Set(), ofilter: 'all' };
  const PROFILE_TABS = {
    orders: ['Заказы', 'box'], favs: ['Избранное', 'heart'], rec: ['Для вас', 'spark'], viewed: ['Смотрели', 'clock'],
    chat: ['Чат с ИИ', 'chat'], spend: ['Траты', 'tag'], data: ['Данные и оплата', 'card'], size: ['Мерки', 'ruler'],
    family: ['Семья', 'users'], gifts: ['Подарки', 'star'],
  };
  const PROFILE_API = { favs: '/api/me/favorites', rec: '/api/me/recommended', viewed: '/api/me/viewed', chat: '/api/me/ai-history' };
  const ordersList = () => (live.on ? live.orders : [...state.orders, ...DEMO_ORDERS]);
  const resetProfileCache = () => { prof.favs = null; prof.viewed = null; prof.rec = null; prof.chat = null; };

  function profileTabIds() {
    if (!live.on) return ['orders', 'favs', 'rec', 'viewed', 'chat', 'size', 'family', 'gifts'];
    return live.me ? ['orders', 'favs', 'rec', 'viewed', 'chat', 'spend', 'data', 'size'] : ['orders', 'favs', 'rec', 'viewed', 'size'];
  }

  function renderProfile() {
    if (live.on && !live.me && live.sessionState !== 'ready') {
      $('#profileBody').innerHTML = live.sessionState === 'error'
        ? '<p class="note">Не удалось загрузить профиль. <button class="linkbtn" type="button" data-retry-session>Повторить</button></p>'
        : '<p class="note" role="status">Загружаем профиль…</p>';
      return;
    }
    const ids = profileTabIds();
    if (!ids.includes(state.ptab)) state.ptab = 'orders';
    const counts = { orders: ordersList().length, favs: state.favs.size };
    const tabs = ids.map((id) => {
      const [name, ic] = PROFILE_TABS[id];
      const n = counts[id];
      return `<button class="ptab" type="button" role="tab" data-ptab="${id}" aria-selected="${state.ptab === id}">${icon(ic)}<span>${name}</span>${n ? `<i>${n}</i>` : ''}</button>`;
    }).join('');
    const body = {
      orders: ordersTabHTML, favs: favsTabHTML, rec: recTabHTML, viewed: viewedTabHTML, chat: chatTabHTML,
      spend: spendingHTML, data: meDataHTML, size: measuresHTML, family: familyHTML, gifts: giftsHTML,
    }[state.ptab]();
    $('#profileBody').innerHTML = `${profileHeadHTML()}<div class="ptabs2" role="tablist" aria-label="Разделы профиля">${tabs}</div><div class="pbody">${body}</div>`;
    const active = $('.ptab[aria-selected="true"]');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });
    loadProfileTab(state.ptab);
  }

  async function loadProfileTab(tab) {
    if (!(live.on && live.me) || !PROFILE_API[tab] || prof[tab] !== null || prof.loading.has(tab)) return;
    prof.loading.add(tab);
    try {
      const data = await api(PROFILE_API[tab]);
      prof[tab] = tab === 'chat' ? data : adoptCards(data);
      if (tab === 'favs') { state.favs = new Set(prof.favs.map((p) => p.id)); store.save(); }
    } catch (e) {
      prof[tab] = [];
      toast(e.message);
    } finally {
      prof.loading.delete(tab);
    }
    if (currentView === 'profile' && state.ptab === tab) renderProfile();
  }
  // Карточки с сервера: товар может быть не из первых страниц каталога — тогда добавляем его в справочник.
  function adoptCards(list) {
    return list.map((c) => {
      if (!byId[c.slug]) byId[c.slug] = liveProduct(c);
      return byId[c.slug];
    });
  }

  /* Шапка: аватар (можно сменить), имя, цифры, текущий заказ */
  function profileHeadHTML() {
    const me = live.on ? live.me : null;
    if ((live.on && !me) || (!live.on && !state.tg)) {
      return `${tgCardHTML()}<p class="note pguest">${icon('heart')}Избранное и просмотры пока хранятся в этом браузере. Войдите — перенесём их в аккаунт и покажем на любом устройстве.</p>`;
    }
    const name = me ? (me.nickname || [me.first_name, me.last_name].filter(Boolean).join(' ') || 'Покупатель') : (state.tg.name || 'Вы');
    const username = me ? me.username : state.tg.username;
    const ava = me && me.photo_url
      ? `<img class="phead__ava" src="${esc(me.photo_url)}" alt="" width="72" height="72" referrerpolicy="no-referrer">`
      : `<span class="phead__ava phead__ava--txt" aria-hidden="true">${esc(name.slice(0, 1).toUpperCase())}</span>`;
    const cam = me ? `<label class="phead__cam" title="Сменить фото" aria-label="Сменить фото профиля">${icon('camera')}<input id="avaInput" type="file" accept="image/*" hidden></label>` : '';
    let since = '';
    if (me) {
      const d = new Date(me.member_since + 'T12:00:00');
      since = `с нами с ${MONTHS_OF[d.getMonth()]} ${d.getFullYear()}`;
    }
    const orders = ordersList();
    let spent, active, delivered;
    if (me) {
      spent = Number(me.stats.spent_rub); active = me.stats.active; delivered = me.stats.delivered;
    } else {
      spent = orders.filter((o) => !o.unpaid).reduce((s, o) => s + (o.total || 0), 0);
      active = orders.filter((o) => !o.delivered && !o.unpaid).length;
      delivered = orders.filter((o) => o.delivered).length;
    }
    return `<div class="phead">
      <div class="phead__avawrap">${ava}${cam}</div>
      <div class="phead__txt"><b>${esc(name)}</b><span>${username ? `@${esc(username)}` : ''}${username && since ? ' · ' : ''}${since}</span>
        ${me ? `<button class="linkbtn" type="button" data-edit-nickname>${me.nickname ? 'Изменить ник' : 'Выбрать ник'}</button>` : ''}
        ${me && me.avatar_url ? `<button class="linkbtn" type="button" data-ava-reset>${me.telegram_id ? 'Вернуть фото из Telegram' : 'Убрать фото'}</button>` : ''}</div>
      ${live.tma ? '' : '<button class="linkbtn" type="button" data-tg-logout>Выйти</button>'}
    </div>
    <div class="pstats">
      <button type="button" data-ptab="spend"${me ? '' : ' disabled'}><b>${rub(spent)}</b><span>потрачено</span></button>
      <button type="button" data-ptab="orders"><b>${active}</b><span>в пути</span></button>
      <button type="button" data-ptab="orders"><b>${delivered}</b><span>получено</span></button>
      <button type="button" data-ptab="favs"><b>${state.favs.size}</b><span>в избранном</span></button>
    </div>
    ${activeOrderHTML()}`;
  }

  // Ближайший заказ в пути — крупно, с полосой прогресса. Касание открывает подробности.
  function activeOrderHTML() {
    const o = ordersList().find((x) => (live.on ? PAID_STEPS.includes(x.status) && x.status !== 'delivered' : !x.delivered && !x.unpaid));
    if (!o) return '';
    const v = orderView(o);
    return `<button class="oactive" type="button" data-order-open="${esc(v.key)}">
      <div class="oactive__top"><span>${icon('truck')}Сейчас в пути</span><b>${esc(v.status)}</b></div>
      <div class="oactive__mid">${v.thumbs.slice(0, 3).map(thumbHTML).join('')}<div><b>${esc(v.title)}</b><span>${esc(v.num)} · ${rub(v.total)}</span></div></div>
      <div class="obar"><i style="width:${v.pct}%"></i></div>
      <div class="oactive__steps"><span>Выкуп</span><span>Склад</span><span>Граница</span><span>У вас</span></div>
    </button>`;
  }

  /* Заказы: карточки с фото, статусом и прогрессом; подробности — в отдельном окне */
  function orderView(o) {
    if (live.on) {
      const step = PAID_STEPS.indexOf(o.status);
      const first = o.items[0] || {};
      return {
        key: o.token, num: o.number, status: o.status_label, total: Number(o.total_rub),
        title: (first.title || 'Заказ') + (o.items.length > 1 ? ` и ещё ${o.items.length - 1}` : ''),
        thumbs: o.items.map((i) => ({ src: i.image || '', alt: i.title })),
        date: o.events.length ? dateTime(o.events[0].created_at) : '',
        pct: o.status === 'cancelled' ? 0 : Math.round(((step + 1) / PAID_STEPS.length) * 100),
        done: o.status === 'delivered', cancelled: o.status === 'cancelled', unpaid: o.status === 'awaiting_payment',
      };
    }
    const items = o.items.map((id) => byId[id]).filter(Boolean);
    return {
      key: `demo:${o.num}`, num: o.num, total: o.total, date: o.date,
      status: o.delivered ? 'Получен' : (o.unpaid ? 'Ждёт оплаты' : (o.fresh ? 'Выкупаем' : 'В пути')),
      title: o.link ? o.link.title : ((items[0] ? items[0].t : 'Заказ') + (items.length > 1 ? ` и ещё ${items.length - 1}` : '')),
      thumbs: o.link ? [{ src: '', alt: o.link.title }] : items.map((p) => ({ src: pimg(p), alt: p.t })),
      pct: o.delivered ? 100 : Math.round(((o.now + 1) / o.stages.length) * 100),
      done: !!o.delivered, cancelled: false, unpaid: !!o.unpaid,
    };
  }
  const thumbHTML = (t) => (t.src
    ? `<img src="${esc(t.src)}" alt="${esc(t.alt || '')}" width="56" height="56" loading="lazy">`
    : `<span class="othumb">${icon('box')}</span>`);

  function ordersTabHTML() {
    if (live.on && !live.loaded) return '<p class="empty">Загружаем заказы…</p>';
    const all = ordersList().map(orderView);
    if (!all.length) {
      return `<div class="emptystate">${icon('box')}<h2>Заказов пока нет</h2><p>Оформленные заказы появятся здесь: фото со склада, вес, где сейчас посылка. Статусы придут и в Telegram.</p><a class="btn btn--lime" href="#catalog">Открыть каталог</a></div>`;
    }
    const filters = [['all', 'Все'], ['active', 'В пути'], ['done', 'Получены'], ['unpaid', 'Ждут оплаты']];
    const list = all.filter((v) => ({
      all: true, active: !v.done && !v.cancelled && !v.unpaid, done: v.done, unpaid: v.unpaid,
    }[prof.ofilter]));
    return `<div class="ofilter" role="group" aria-label="Какие заказы показать">${filters.map(([id, name]) => `<button class="chip" type="button" data-ofilter="${id}" aria-pressed="${prof.ofilter === id}">${name}</button>`).join('')}</div>
      ${list.length ? `<div class="olist">${list.map((v) => `<button class="ocard${v.done ? ' is-done' : ''}${v.cancelled ? ' is-off' : ''}" type="button" data-order-open="${esc(v.key)}">
        <div class="ocard__thumbs">${v.thumbs.slice(0, 4).map(thumbHTML).join('')}${v.thumbs.length > 4 ? `<span class="othumb">+${v.thumbs.length - 4}</span>` : ''}</div>
        <div class="ocard__info"><b>${esc(v.title)}</b><span>${esc(v.num)}${v.date ? ` · ${esc(v.date)}` : ''}</span></div>
        <div class="ocard__side"><span class="pill${v.done || v.cancelled ? '' : ' pill--go'}">${esc(v.status)}</span><b>${rub(v.total)}</b></div>
        ${v.cancelled ? '' : `<div class="obar"><i style="width:${v.pct}%"></i></div>`}
      </button>`).join('')}</div>` : '<p class="empty">Таких заказов нет.</p>'}`;
  }

  function openOrder(key) {
    if (key.startsWith('demo:')) {
      const o = ordersList().find((x) => !live.on && x.num === key.slice(5));
      if (o) openSheet(`<div class="stack"><h2 class="sheet__title">Заказ ${esc(o.num)}</h2>${orderHTML(o)}</div>`, { narrow: true });
      return;
    }
    const o = live.orders.find((x) => x.token === key);
    if (!o) return;
    const items = o.items.map((i) => {
      const inCatalog = i.product_slug && byId[i.product_slug];
      const body = `${thumbHTML({ src: i.image || '', alt: i.title })}<div><b>${esc(i.title)}</b><span>${[i.size, i.color].filter(Boolean).map(esc).join(', ')}${i.size || i.color ? ' · ' : ''}${i.qty} шт · ${rub(Number(i.total_rub))}</span></div>`;
      if (inCatalog) return `<button class="oitem" type="button" data-open="${esc(i.product_slug)}">${body}${icon('arrow')}</button>`;
      if (i.source_url) return `<a class="oitem" href="${esc(i.source_url)}" target="_blank" rel="noopener nofollow">${body}${icon('arrow-ur')}</a>`;
      return `<div class="oitem">${body}</div>`;
    }).join('');
    openSheet(`<div class="stack">
      <h2 class="sheet__title">Заказ ${esc(o.number)}</h2>
      <div class="oitems">${items}</div>
      ${serverOrderHTML(o)}
    </div>`, { narrow: true });
  }

  /* Избранное, «Для вас», недавно смотрели — сетка обычных карточек */
  function productsTabHTML(list, empty) {
    if (list === null) return '<p class="empty">Загружаем…</p>';
    const items = list.filter(Boolean);
    if (!items.length) return empty;
    return `<div class="grid">${groupWheelProducts(items).map(cardHTML).join('')}</div>`;
  }
  function favsTabHTML() {
    const list = live.on && live.me ? prof.favs : [...state.favs].map((id) => byId[id]);
    return `<div class="phint"><b>Избранное</b><span>Нажмите ${icon('heart')} на карточке товара, чтобы отложить его сюда.</span></div>
      ${productsTabHTML(list, `<div class="emptystate">${icon('heart')}<h2>Здесь пока пусто</h2><p>Отмечайте сердечком товары, которые понравились: соберём их здесь, чтобы вернуться и заказать.</p><a class="btn btn--lime" href="#catalog">Выбрать в каталоге</a></div>`)}`;
  }
  function recTabHTML() {
    const list = live.on && live.me ? prof.rec : localRecommended();
    return `<div class="phint"><b>Подобрали для вас</b><span>По избранному, просмотрам и покупкам. Чем чаще заходите, тем точнее.</span></div>
      ${productsTabHTML(list, `<div class="emptystate">${icon('spark')}<h2>Скоро подберём</h2><p>Посмотрите пару товаров или добавьте их в избранное — и здесь появятся похожие.</p></div>`)}`;
  }
  function viewedTabHTML() {
    const list = live.on && live.me ? prof.viewed : state.viewed.map((id) => byId[id]);
    const has = list && list.filter(Boolean).length;
    return `<div class="phint"><b>Недавно смотрели</b><span>Последние 40 товаров.</span>${has ? '<button class="linkbtn" type="button" data-viewed-clear>Очистить</button>' : ''}</div>
      ${productsTabHTML(list, `<div class="emptystate">${icon('clock')}<h2>Вы ещё ничего не смотрели</h2><p>Открытые товары появятся здесь, чтобы не искать их снова.</p><a class="btn btn--lime" href="#catalog">Открыть каталог</a></div>`)}`;
  }
  async function clearViewed() {
    state.viewed = [];
    store.save();
    if (live.on && live.me) {
      try { await api('/api/me/viewed', { method: 'DELETE' }); prof.viewed = []; } catch (e) { toast(e.message); }
    }
    renderProfile();
  }

  /* Чат с ИИ: вопросы и ответы, можно продолжить разговор */
  function chatTabHTML() {
    const fromServer = live.on && live.me;
    let rows;
    if (fromServer) {
      if (prof.chat === null) return '<p class="empty">Загружаем историю…</p>';
      rows = prof.chat.map((r) => ({ q: r.question, a: r.answer, photo: r.photo, at: dateTime(r.at) }));
    } else {
      rows = [];
      for (let i = 0; i < ai.log.length; i += 1) {
        const m = ai.log[i];
        if (m.me) rows.unshift({ q: m.text, a: (ai.log[i + 1] && (ai.log[i + 1].reply || ai.log[i + 1].text)) || '', photo: !!m.thumb, at: 'сегодня' });
      }
    }
    if (!rows.length) {
      return `<div class="emptystate">${icon('spark')}<h2>Вы ещё не спрашивали ASTTA AI</h2><p>ИИ подберёт товары под задачу и бюджет, посчитает цену по ссылке или скриншоту и ответит про доставку.</p><button class="btn btn--lime" type="button" data-ai-open>Спросить ИИ</button></div>`;
    }
    return `<div class="phint"><b>История с ASTTA AI</b><span>${fromServer ? 'Видите только вы.' : 'Сохраняется до закрытия страницы. Войдите, чтобы история не терялась.'}</span>
        ${fromServer ? '<button class="linkbtn" type="button" data-ai-history-clear>Очистить</button>' : ''}</div>
      <div class="chatlog">${rows.map((r, i) => `<article class="chatlog__item">
        <span class="chatlog__time">${esc(r.at)}</span>
        <div class="msg msg--me">${r.photo ? `${icon('camera')} ` : ''}${esc(r.q)}</div>
        ${r.a ? `<div class="msg msg--ai chatlog__a">${esc(r.a.length > 420 ? r.a.slice(0, 420) + '…' : r.a)}</div>` : ''}
      </article>`).join('')}</div>
      <button class="btn btn--lime btn--wide" type="button" data-ai-continue>${icon('chat')}Продолжить в чате</button>`;
  }
  function continueAiChat() {
    if (live.on && live.me && prof.chat && prof.chat.length && !ai.turns.length) {
      // Последние вопросы возвращаем в разговор, чтобы ИИ помнил контекст.
      const recent = prof.chat.slice(0, 5).reverse();
      recent.forEach((r) => {
        ai.turns.push({ role: 'user', content: r.question }, { role: 'assistant', content: r.answer });
        ai.log.push({ me: true, text: r.question }, { reply: r.answer });
      });
    }
    openAI();
  }
  async function clearAiHistory() {
    if (!window.confirm('Очистить историю чата с ИИ? Восстановить её будет нельзя.')) return;
    try { await api('/api/me/ai-history', { method: 'DELETE' }); prof.chat = []; toast('История очищена'); } catch (e) { toast(e.message); }
    renderProfile();
  }

  /* Аватар и способ оплаты */
  async function uploadAvatar(file) {
    if (!file || !live.me) return;
    if (!file.type.startsWith('image/')) { toast('Нужна картинка'); return; }
    const fd = new FormData();
    fd.append('photo', file);
    try {
      live.me = await api('/api/me/avatar', { method: 'POST', body: fd });
      toast('Фото обновили');
    } catch (e) { toast(e.message); }
    renderProfile();
  }
  async function resetAvatar() {
    try { live.me = await api('/api/me/avatar', { method: 'DELETE' }); } catch (e) { toast(e.message); }
    renderProfile();
  }
  function payMethodHTML() {
    const cur = live.me ? live.me.pay_method : '';
    const opts = [['sbp', 'СБП', 'По QR-коду или в приложении банка, без комиссии'], ['card', 'Банковская карта', 'Мир, Visa, Mastercard российских банков']];
    return `<div class="panel">
      <h3>Способ оплаты</h3>
      <p class="note">Укажите удобный способ оплаты. Менеджер согласует оплату после подтверждения заказа.</p>
      <div class="paym">${opts.map(([id, name, sub]) => `<button class="paym__opt${cur === id ? ' is-on' : ''}" type="button" data-pay-method="${id}" aria-pressed="${cur === id}">
        <span class="paym__ic">${icon(id === 'sbp' ? 'send' : 'card')}</span><span><b>${name}</b><small>${sub}</small></span><span class="paym__check">${icon('check')}</span></button>`).join('')}</div>
    </div>`;
  }
  async function setPayMethod(id) {
    if (!live.me) return;
    try { live.me = await api('/api/me', { method: 'PATCH', body: { pay_method: live.me.pay_method === id ? '' : id } }); } catch (e) { toast(e.message); }
    renderProfile();
  }

  // Вход через Telegram. На сайте это официальная кнопка Telegram (/api/auth/telegram), в мини-приложении
  // вход не нужен: Telegram сам передаёт, кто открыл. В прототипе вход демонстрационный.
  const tgContact = () => (live.me && live.me.phone ? live.me.phone : (state.tg && state.tg.username ? `@${state.tg.username}` : (live.me && live.me.email ? live.me.email : '')));
  function tgCardHTML() {
    if (state.tg) {
      return `<div class="tgcard tgcard--in">
        <span class="tgcard__ava" aria-hidden="true">${esc((state.tg.name || state.tg.username || '·').slice(0, 1).toUpperCase())}</span>
        <div class="tgcard__txt"><b>${esc(state.tg.name || 'Вы')}</b><span>${state.tg.username ? `@${esc(state.tg.username)} · ` : ''}статусы заказов пришлёт <a href="https://t.me/astta_shop_bot" target="_blank" rel="noopener">@astta_shop_bot</a></span></div>
        ${live.tma ? '' : '<button class="linkbtn" type="button" data-tg-logout>Выйти</button>'}
      </div>`;
    }
    const email = live.on && live.site && live.site.email_login && !live.tma;
    const telegram = !live.on || (live.site && live.site.telegram_bot);
    return `<div class="tgcard">
      <div class="tgcard__txt"><b>Войдите в ASTTA</b><span>${email ? 'Через Telegram или по коду из письма. Пароль не нужен.' : telegram ? 'Через Telegram, без пароля. Заказы сохранятся в аккаунте.' : 'Вход пока недоступен. Сохранённые в этом браузере заказы останутся здесь.'}</span></div>
      <div class="auth-options">
        ${telegram ? `<button class="tgbtn" type="button" data-tg-login>${TG_ICON}Войти через Telegram</button>` : ''}
        ${email ? '<button class="btn btn--line" type="button" data-email-login>Войти по почте</button>' : ''}
      </div>
    </div>`;
  }

  const emailFlow = { purpose: 'login', email: '', challenge: '', resendAt: 0 };
  let emailTimer = null;
  function openEmailAuth(purpose = 'login') {
    if (!live.site || !live.site.email_login) { toast('Вход по почте пока не подключён'); return; }
    emailFlow.purpose = purpose; emailFlow.email = ''; emailFlow.challenge = '';
    renderEmailAddress();
  }
  function emailError(message) {
    const el = $('#emailError');
    if (el) { el.textContent = message; el.hidden = !message; }
  }
  function renderEmailAddress() {
    clearTimeout(emailTimer);
    const link = emailFlow.purpose === 'link';
    openSheet(`<div class="stack"><h2 class="sheet__title">${link ? 'Привязать почту' : 'Вход по почте'}</h2>
      <p class="note">${link ? 'Подтвердите адрес кодом из письма. Затем сможете входить и через Telegram, и по почте в этот же аккаунт.' : 'Отправим шестизначный код. Если вы уже покупали через Telegram, сначала войдите через Telegram и привяжите почту в профиле, чтобы сохранить все заказы в одном аккаунте.'}</p>
      <form class="stack" id="emailAddressForm">
        <label class="field"><span>Электронная почта</span><input name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required value="${esc(emailFlow.email)}" placeholder="you@example.ru"></label>
        ${consentHTML('emailConsent')}
        <p class="field__err" id="emailError" role="alert" hidden></p>
        <button class="btn btn--lime" type="submit">Получить код</button>
      </form></div>`, { narrow: true });
  }
  function renderEmailCode() {
    openSheet(`<div class="stack"><h2 class="sheet__title">Введите код из письма</h2>
      <p class="note">Отправили код на <b>${esc(emailFlow.email)}</b>. Он действует 10 минут. Проверьте также папку «Спам».</p>
      <form class="stack" id="emailVerifyForm">
        <label class="field"><span>Код из 6 цифр</span><input id="emailCode" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required placeholder="000000"></label>
        <p class="field__err" id="emailError" role="alert" hidden></p>
        <button class="btn btn--lime" type="submit">${emailFlow.purpose === 'link' ? 'Подтвердить почту' : 'Войти'}</button>
      </form>
      <button class="btn btn--line" type="button" data-email-resend disabled>Отправить код ещё раз</button>
      <button class="linkbtn" type="button" data-email-change>Изменить адрес</button></div>`, { narrow: true });
    $('#emailCode').focus();
    updateEmailResend();
  }
  function updateEmailResend() {
    clearTimeout(emailTimer);
    const button = $('[data-email-resend]');
    if (!button || $('#sheet').hidden) return;
    const seconds = Math.max(0, Math.ceil((emailFlow.resendAt - Date.now()) / 1000));
    button.disabled = seconds > 0;
    button.textContent = seconds ? `Отправить ещё раз через ${seconds} с` : 'Отправить код ещё раз';
    if (seconds) emailTimer = setTimeout(updateEmailResend, 1000);
  }
  async function requestEmailCode(button) {
    if (button.disabled) return;
    button.disabled = true; emailError('');
    try {
      const data = await api('/api/auth/email/request', { method: 'POST', body: {
        email: emailFlow.email, purpose: emailFlow.purpose, consent: true,
      } });
      emailFlow.challenge = data.challenge_id;
      emailFlow.resendAt = Date.now() + data.resend_after * 1000;
      renderEmailCode();
    } catch (e) { emailError(e.message); } finally { button.disabled = false; }
  }
  async function verifyEmailCode(form) {
    if (!form.reportValidity()) return;
    const button = $('button[type=submit]', form);
    if (button.disabled) return;
    button.disabled = true; emailError('');
    try {
      live.me = await api('/api/auth/email/verify', { method: 'POST', body: {
        challenge_id: emailFlow.challenge, code: form.elements.code.value.trim(), purpose: emailFlow.purpose,
      } });
      live.csrf = '';
      await loadMe();
      state.ptab = emailFlow.purpose === 'link' ? 'data' : 'orders';
      closeSheet(); go('profile'); renderProfile();
      toast(emailFlow.purpose === 'link' ? 'Почта подтверждена и привязана' : 'Вы вошли в аккаунт');
    } catch (e) { emailError(e.message); } finally { button.disabled = false; }
  }
  function emailAccountHTML() {
    if (!live.me) return '';
    const me = live.me;
    if (me.email_verified) return `<section class="panel"><h3>Вход в аккаунт</h3><p class="note">Почта подтверждена: <b>${esc(me.email)}</b>. ${me.telegram_id ? 'Можно входить через Telegram или по коду из письма.' : 'Для входа используйте код из письма.'}</p></section>`;
    if (!live.site || !live.site.email_login) return '';
    return `<section class="panel"><h3>Вход по почте</h3><p class="note">Привяжите почту, чтобы входить в этот же аккаунт без Telegram. Заказы и избранное сохранятся.</p><button class="btn btn--line" type="button" data-email-link>Привязать почту</button></section>`;
  }
  const TG_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.6 19.9c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L5.9 13.4 1 11.9c-1.1-.3-1.1-1.1.2-1.6L20.6 2.8c.9-.3 1.7.2 1.3 1.5Z"/></svg>';
  function openTgLogin() {
    if (live.on) { openTgLoginLive(); return; }
    openSheet(`<div class="stack">
      <h2 class="sheet__title">Вход через Telegram</h2>
      <p class="note">На сайте откроется окно Telegram: подтвердите вход для ASTTA, и мы узнаем ваше имя и ник. Телефон Telegram не передаёт, пароль не нужен.</p>
      <p class="note">Это демо: введите ник, чтобы посмотреть, как профиль выглядит после входа.</p>
      <form class="stack" id="tgLoginForm" novalidate>
        <label class="field"><span>Имя</span><input id="tgName" autocomplete="given-name" placeholder="Анна"></label>
        <label class="field"><span>Ник в Telegram</span><input id="tgUser" autocomplete="username" placeholder="anna_v"></label>
        ${consentHTML('tgConsent')}
        <button class="tgbtn tgbtn--wide" type="submit">${TG_ICON}Подтвердить вход</button>
      </form>
    </div>`, { narrow: true });
  }
  function submitTgLogin() {
    const user = $('#tgUser').value.trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{3,32}$/.test(user)) { toast('Ник в Telegram: латиница, цифры и _, от 3 символов'); $('#tgUser').focus(); return; }
    if (!consentOk('tgConsent')) return;
    state.tg = { name: $('#tgName').value.trim().slice(0, 40), username: user };
    store.save();
    closeSheet();
    renderProfile();
    toast(`Вы вошли как @${user}`);
  }

  /* ---------- ASTTA Family: общий список, бюджет, согласование, кто платит ---------- */
  const member = (id) => state.family.members.find((m) => m.id === id) || { name: '—' };
  function familyHTML() {
    const f = state.family;
    const priceOf = (it) => retail(byId[it.pid]).total;
    const approved = f.items.filter((it) => it.status === 'approved');
    const spent = approved.reduce((s, it) => s + priceOf(it), 0);
    const pct = Math.min(100, Math.round((spent / f.budget) * 100));
    const byPayer = {};
    approved.forEach((it) => { byPayer[it.payer] = (byPayer[it.payer] || 0) + priceOf(it); });
    const rows = f.items.map((it) => {
      const p = byId[it.pid];
      const status = it.status === 'pending' ? '<span class="pill pill--wait">Ждёт согласования</span>' : (it.status === 'declined' ? '<span class="pill">Отклонено</span>' : '<span class="pill pill--go">Одобрено</span>');
      return `<article class="fitem${it.status === 'declined' ? ' is-off' : ''}">
        <img src="${pimg(p)}" alt="" width="64" height="64" loading="lazy">
        <div class="fitem__body">
          <button class="citem__title" type="button" data-open="${p.id}">${esc(p.t)}</button>
          <span class="citem__meta">Добавил(а): ${esc(member(it.by).name)} · ${rub(priceOf(it))}</span>
          <div class="fitem__row">${status}
            ${it.status === 'pending' ? `<button class="btn btn--lime btn--sm" type="button" data-fam-ok="${it.id}">Одобрить</button><button class="btn btn--line btn--sm" type="button" data-fam-no="${it.id}">Отклонить</button>` : ''}
            ${it.status === 'approved' ? `<label class="fitem__payer">Платит <select class="minisel" data-fam-payer="${it.id}">${f.members.map((m) => `<option value="${m.id}" ${m.id === it.payer ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');
    return `<div class="family">
      <section class="panel">
        <div class="family__head"><h3>Семья</h3><div class="family__avas">${f.members.map((m) => `<span class="ava" title="${esc(m.name)}">${esc(m.name.slice(0, 2).toUpperCase())}</span>`).join('')}</div></div>
        <div class="family__budget">
          <div class="build__row"><span>Бюджет на месяц</span><output>${rub(spent)} из ${rub(f.budget)}</output></div>
          <div class="bar"><i style="width:${pct}%${pct >= 100 ? ';background:var(--hot)' : ''}"></i></div>
          <label class="field"><span>Лимит</span><select id="famBudget">${[15000, 30000, 50000, 100000].map((v) => `<option value="${v}" ${v === f.budget ? 'selected' : ''}>${rub(v)}</option>`).join('')}</select></label>
        </div>
        ${Object.keys(byPayer).length ? `<div class="sum">${Object.entries(byPayer).map(([id, sum]) => `<div class="sum__row"><span>${esc(member(id).name)}</span><span>${rub(sum)}</span></div>`).join('')}</div>` : ''}
      </section>
      <section class="stack">
        <h3 class="sublabel">Общий список</h3>
        ${rows || '<p class="note">Список пуст. Добавляйте товары кнопкой «В семейный список» в карточке товара.</p>'}
        <button class="btn btn--line" type="button" data-fam-ai>${icon('spark')}BuyTogether AI: проверить список</button>
        ${approved.length ? `<button class="btn btn--lime" type="button" data-fam-checkout>Одобренное в корзину · ${rub(spent)}</button>` : ''}
        <p class="note">Дети добавляют товары, взрослые одобряют. Каждый оплачивает свою часть, агент собирает всё в одну посылку.</p>
      </section>
    </div>`;
  }

  /* ---------- ASTTA GiftPool: скинуться на подарок ---------- */
  const poolTotal = (g) => retail(byId[g.pid]).total;
  const poolShare = (g) => Math.ceil(poolTotal(g) / g.people / 10) * 10;
  const dateText = (iso) => { try { return new Date(iso + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); } catch (e) { return iso; } };

  function poolHTML(g) {
    const p = byId[g.pid];
    const share = poolShare(g);
    const got = Math.min(poolTotal(g), g.paid.length * share);
    const pct = Math.min(100, Math.round((g.paid.length / g.people) * 100));
    const left = Math.max(0, g.people - g.paid.length);
    const people = [...g.paid.map((x) => ({ ...x, ok: true })), ...Array.from({ length: left }, () => ({ name: 'Ждём участника', ok: false }))];
    return `<div class="stack pool">
      <span class="ai__badge">${icon('users')}GiftPool</span>
      <h2 class="sheet__title">${esc(g.occasion)}: ${esc(g.who)}</h2>
      <div class="pool__item"><img src="${pimg(p)}" alt="" width="72" height="72"><div><b>${esc(p.t)}</b><span>${rub(poolTotal(g))} с доставкой</span></div></div>
      <div class="pool__sum">
        <div class="build__row"><span>Собрано ${g.paid.length} из ${g.people}</span><output>${rub(got)}</output></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <p class="note">С каждого ${rub(share)}. Доставим ${dateText(g.date)}, адрес именинника спросим у вас, чтобы сюрприз не раскрылся.</p>
      </div>
      <div class="pool__link"><span class="mono">astta.ru/gift/${g.id}</span><button class="btn btn--lime btn--sm" type="button" data-pool-copy="${g.id}">Скопировать ссылку</button></div>
      <ul class="pool__people">${people.map((x) => `<li class="${x.ok ? 'is-ok' : ''}"><span class="dot">${x.ok ? icon('check') : ''}</span><div><b>${esc(x.name)}</b>${x.wish ? `<span>«${esc(x.wish)}»</span>` : (x.ok ? '<span>оплатил(а) свою часть</span>' : '')}</div></li>`).join('')}</ul>
      ${left ? `<button class="btn btn--ghost btn--sm" type="button" data-pool-sim="${g.id}" style="align-self:flex-start">Демо: ещё один друг оплатил</button>` : '<p class="note" style="color:var(--lime)">Вся сумма собрана. Агент выкупит подарок и привезёт его к дате вместе с открыткой из поздравлений.</p>'}
    </div>`;
  }

  function giftsHTML() {
    const list = state.pools.map((g) => {
      const p = byId[g.pid];
      const pct = Math.min(100, Math.round((g.paid.length / g.people) * 100));
      return `<button class="gcard" type="button" data-pool-open="${g.id}">
        <img src="${pimg(p)}" alt="" width="72" height="72" loading="lazy">
        <div><b>${esc(g.occasion)}: ${esc(g.who)}</b><span>${esc(p.t)} · ${dateText(g.date)}</span><div class="bar"><i style="width:${pct}%"></i></div><small>${g.paid.length} из ${g.people} скинулись</small></div>
      </button>`;
    }).join('');
    return `<div class="stack">
      ${list || '<p class="note">Пока нет общих подарков.</p>'}
      <p class="note">Откройте любой товар и нажмите «Скинуться на подарок»: друзья оплачивают свою часть по ссылке, добавляют поздравления, а мы доставляем в выбранную дату.</p>
    </div>`;
  }

  function poolNewHTML(pid) {
    const p = byId[pid];
    const d = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    return `<div class="stack">
      <span class="ai__badge">${icon('users')}GiftPool</span>
      <h2 class="sheet__title">Общий подарок</h2>
      <div class="pool__item"><img src="${pimg(p)}" alt="" width="72" height="72"><div><b>${esc(p.t)}</b><span>${rub(retail(p).total)} с доставкой</span></div></div>
      <form class="form" id="poolForm" data-pid="${pid}" novalidate>
        <label class="field"><span>Кому</span><input id="plWho" required placeholder="Имя"></label>
        <label class="field"><span>Повод</span><select id="plOcc"><option>День рождения</option><option>Новый год</option><option>Свадьба</option><option>Новоселье</option><option>Просто так</option></select></label>
        <label class="field"><span>Дата вручения</span><input id="plDate" type="date" value="${d}" min="${new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)}"></label>
        <label class="field"><span>Сколько человек</span><input id="plPeople" type="number" min="2" max="50" value="6"></label>
        <label class="field field--full"><span>Ваше поздравление</span><textarea id="plWish" placeholder="Попадёт в открытку вместе с подарком"></textarea></label>
        <p class="note field--full" id="plShare"></p>
        <button class="btn btn--lime btn--wide field--full" type="submit">Создать и оплатить свою часть</button>
      </form>
    </div>`;
  }

  /* ---------- Smart Size: мерки ---------- */
  function measuresHTML() {
    const m = state.measures || {};
    const f = (id, label, hint, val, step = 1) => `<label class="field"><span>${label}</span><input id="${id}" type="number" inputmode="decimal" step="${step}" value="${val ?? ''}" placeholder="${hint}"></label>`;
    return `<form class="panel" id="measForm" novalidate>
      <h3>Мои мерки</h3>
      <p class="note">Вводятся один раз. Дальше в карточке одежды и обуви мы подскажем размер по реальным замерам именно этой модели, а не по таблице «S, M, L».</p>
      <div class="form">
        ${f('msHeight', 'Рост, см', '178', m.height)}
        ${f('msChest', 'Обхват груди, см', '100', m.chest)}
        ${f('msWaist', 'Обхват талии, см', '84', m.waist)}
        ${f('msHips', 'Обхват бёдер, см', '98', m.hips)}
        ${f('msFoot', 'Длина стопы, см', '26', m.foot, 0.5)}
      </div>
      <p class="note">Как мерить: грудь по самым выступающим точкам, стопу — от пятки до большого пальца, стоя на листе бумаги.</p>
      <button class="btn btn--lime" type="submit">Сохранить мерки</button>
    </form>`;
  }

  /* ---------- Карточка товара ---------- */
  let pdState = null;

  function openProduct(id, opts = {}) {
    const p = byId[id];
    if (!p) return;
    pdState = { id, size: null, color: null, ship: shipFor(p), qty: isSupplier() && hasWholesale(p) ? p.tiers[0][0] : 1, needSize: !!opts.needSize, wheelDiameter: null, wheelChosen: false };
    openSheet(productHTML(), { keepProduct: true });
    trackView(id);
    if (opts.needSize) toast('Выберите вариант товара');
    loadProductDetail(p);
  }

  async function pollMarketJob(job, update, alive = () => true) {
    const until = Date.now() + 245000;
    while (alive()) {
      update(job);
      if (!['pending', 'working'].includes(job.status)) return job;
      if (Date.now() > until) throw new Error('Проверка затянулась. Попробуйте ещё раз.');
      await new Promise((resolve) => setTimeout(resolve, 1800));
      if (!alive()) return null;
      job = await api(`/api/link/market-jobs/${encodeURIComponent(job.id)}`);
    }
    return null;
  }
  async function lookupMarket(text, size, qty, update, alive) {
    update({ status: 'pending' });
    const job = await api('/api/link/market-jobs', { method: 'POST', body: { text, size, qty } });
    return pollMarketJob(job, update, alive);
  }
  function marketPhotosHTML(images) {
    const urls = (images || []).filter((u) => typeof u === 'string' && (u.startsWith('/api/link/image?token=') || u.startsWith('/media/')));
    return urls.length ? `<div class="market-photos">${urls.slice(0, 6).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="Открыть фото товара"><img src="${esc(u)}" alt="Фото товара с площадки" loading="lazy" width="180" height="180"></a>`).join('')}</div>` : '';
  }
  function marketStatusHTML(result, size) {
    if (!result || ['pending', 'working'].includes(result.status)) return `<p class="note" role="status">${icon('spark')} Проверяем ${size ? 'цену размера ' + esc(variantLabel(size)) : 'товар и фото'}… Обычно это занимает до двух минут.</p>`;
    if (result.quote) return `<div class="sum"><div class="sum__row"><span>Размер ${esc(variantLabel(result.quote.size))} · ${cny(Number(result.quote.price_cny))}</span><b>${rub(Number(result.quote.total_rub))}</b></div><p class="note">Цена проверена на площадке. Действует 5 минут.</p></div>`;
    return `<p class="note" role="status">${esc(result.note || 'Выберите размер, чтобы проверить цену.')}</p>`;
  }
  async function checkMarketSize() {
    const selected = pdState, p = selected && byId[selected.id];
    if (!p?.market || !selected.size) return;
    const size = selected.size, version = (selected.marketVersion || 0) + 1;
    selected.marketVersion = version;
    selected.marketResult = { status: 'pending' }; rerenderProduct();
    const alive = () => pdState === selected && selected.size === size && selected.marketVersion === version;
    try {
      await lookupMarket(p.market.url, size, 1, (result) => {
        if (!alive()) return;
        selected.marketResult = result; rerenderProduct();
      }, alive);
    } catch (e) { if (alive()) { selected.marketResult = { status: 'failed', note: e.message }; rerenderProduct(); } }
  }

  function marketProductHTML(p) {
    const m = p.market, src = m.source, name = MARKET_NAME[src] || src;
    const result = pdState.marketResult, quote = result?.quote;
    const sizes = (m.sizes || []).filter((x) => x && x.size);
    return `<div class="pd pd--market" data-market="1" data-id="${esc(p.id)}">
      <div class="pd__media pd__media--market">${galleryHTML(p)}<span class="mkbadge mkbadge--${esc(src)}">${esc(name)}</span>${favBtnHTML(p, 'pd__fav')}</div>
      <div class="pd__info">
        <h2>${esc(p.t)}</h2>
        <div class="mkprice">
          <div class="mkprice__row">${quote ? '' : '<small>от</small>'}<b>${rub(quote ? Number(quote.total_rub) : marketFrom(p))}</b></div>
          <p>${quote ? 'Вариант: ' + esc(variantLabel(quote.size)) + ' · с доставкой в Россию' : 'С доставкой в Россию. Точная цена — после выбора размера.'}</p>
        </div>
        ${sizes.length ? `<div class="mkpick">
          <span class="sublabel">Выберите размер или вариант</span>
          <div class="mksizes${sizes.some((x, i) => (x.label || variantLabel(x.size, i)).length > 8) ? ' mksizes--variants' : ''}" role="group" aria-label="Размер и вариант">${sizes.map((x, i) => `<button class="mksize" type="button" data-mk-size="${esc(x.size)}" aria-pressed="${pdState.size === x.size}"><b>${esc(x.label || variantLabel(x.size, i))}</b>${x.ru && x.ru !== x.size ? `<span>RU ${esc(x.ru)}</span>` : ''}</button>`).join('')}</div>
        </div>` : ''}
        <button class="btn btn--lime" type="button" data-product-telegram>Заказать в Telegram</button>
        <div class="mksteps" id="mkQuote" aria-live="polite">
          ${quote ? '<p class="note">Цена проверена на площадке. Действует 5 минут.</p>' : pdState.size ? marketStatusHTML(result, pdState.size) : '<p class="note">Проверим цену выбранного размера.</p>'}
          <div class="mkbtns">
            <button class="btn btn--lime" type="button" data-mk-order>${quote ? 'Оформить заказ' : 'Заказать'}</button>
            ${!quote && pdState.size ? `<button class="btn btn--ghost" type="button" data-mk-check ${['pending', 'working'].includes(result?.status) ? 'disabled' : ''}>${['pending', 'working'].includes(result?.status) ? 'Проверяем цену…' : 'Проверить цену'}</button>` : ''}
            <button class="linkbtn" type="button" data-open-chat>Уточнить у агента</button>
          </div>
        </div>
        <button class="btn btn--ghost pd__model-info" type="button" data-mk-ai>${icon('spark')}Рассказать о модели</button>
        <details class="pd__details"><summary>О товаре и доставке</summary><div class="stack">
          ${m.article ? `<p>Артикул: <span class="mono">${esc(m.article)}</span></p>` : ''}
          <p>До склада в Китае обычно 2–7 дней при наличии. После отправки со склада: ${daysText(SHIP.auto.days)}. В расчёт включены товар, доставка и сервис ASTTA.</p>
          ${m.fit_advice ? `<p>${esc(m.fit_advice)}</p>` : ''}
        </div></details>
      </div>
    </div>`;
  }
  // Галерея: фото листаются пальцем (scroll-snap), снизу миниатюры и счётчик.
  function galleryHTML(p) {
    const imgs = (p.images && p.images.length ? p.images : [pimg(p)]).slice(0, 8);
    if (imgs.length < 2) return `<img class="gal__img" src="${esc(imgs[0])}" alt="${esc(p.t)}" width="720" height="720">`;
    return `<div class="gal">
      <div class="gal__track" data-gal-track>${imgs.map((src, i) => `<img class="gal__img" src="${esc(src)}" alt="${esc(p.t)}${i ? `, фото ${i + 1}` : ''}" width="720" height="720"${i ? ' loading="lazy"' : ''}>`).join('')}</div>
      <button class="gal__arrow gal__arrow--prev" type="button" data-gal-step="-1" aria-label="Предыдущее фото" disabled>${icon('arrow')}</button>
      <button class="gal__arrow gal__arrow--next" type="button" data-gal-step="1" aria-label="Следующее фото">${icon('arrow')}</button>
      <span class="gal__count" data-gal-count>1 / ${imgs.length}</span>
      <div class="gal__thumbs">${imgs.map((src, i) => `<button type="button" class="gal__thumb${i ? '' : ' is-on'}" data-gal-go="${i}" aria-label="Фото ${i + 1}"><img src="${esc(src)}" alt="" width="64" height="64" loading="lazy"></button>`).join('')}</div>
    </div>`;
  }
  function galleryGo(i) {
    const track = $('[data-gal-track]');
    if (track) track.scrollTo({ left: track.clientWidth * Math.max(0, Math.min(i, track.children.length - 1)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function galleryScrolled(track) {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const gallery = track.closest('.gal');
    const count = $('[data-gal-count]', gallery);
    $('[data-gal-step="-1"]', gallery).disabled = i <= 0;
    $('[data-gal-step="1"]', gallery).disabled = i >= track.children.length - 1;
    if (count) count.textContent = `${i + 1} / ${track.children.length}`;
    $$('.gal__thumb').forEach((b, n) => b.classList.toggle('is-on', n === i));
  }

  function orderMarketProduct() {
    const p = byId[pdState.id], result = pdState.marketResult;
    if (!pdState.size && p.market.sizes?.length) {
      const first = $('[data-mk-size]');
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' }); first?.focus();
      toast('Выберите размер, чтобы заказать'); return;
    }
    const size = pdState.size, quote = result?.quote, item = result?.item;
    if (!quote) { openLinkCalc(p.market.url, { title: p.t, size }); return; }
    closeSheet();
    openLinkCalc(p.market.url, { title: p.t, size, price: Number(quote.price_cny), quote, item });
  }

  function wheelOptionsHTML(p) {
    const variants = (wheelVariants.get(p.wheel.key) || []).filter((v) => !isSupplier() || hasWholesale(v));
    if (!variants.length) return '<p class="note">Загружаем размеры и параметры…</p>';
    const diameters = [...new Set(variants.map((v) => v.wheel.diameter))].sort((a,b) => Number(a)-Number(b));
    const choices = variants.filter((v) => v.wheel.diameter === pdState.wheelDiameter).sort((a,b) => Number(a.wheel.width)-Number(b.wheel.width) || a.t.localeCompare(b.t));
    return `<fieldset class="wheel-options"><legend>Диаметр диска</legend><div class="sizes">${diameters.map((d) => `<button class="size" type="button" data-wheel-diameter="${esc(d)}" aria-pressed="${pdState.wheelDiameter === d}">R${esc(d)}</button>`).join('')}</div></fieldset>
      ${choices.length ? `<fieldset class="wheel-options"><legend>Ширина · разболтовка · вылет</legend><div class="wheel-configs">${choices.map((v) => `<button class="size" type="button" data-wheel-variant="${esc(v.id)}" aria-pressed="${pdState.wheelChosen && pdState.id === v.id}"><b>${esc(v.wheel.size)} · PCD ${esc(v.wheel.pcd)} · ET${esc(v.wheel.offset)}${v.wheel.range ? ' · диапазон поставщика' : ''}</b><span>${isSupplier() ? cny(catalogPrice(v)) + ' / шт' : rub(catalogPrice(v))}</span></button>`).join('')}</div></fieldset>` : ''}
      <p class="note">Цена за один диск. Сверьте диаметр, ширину, PCD и ET с параметрами автомобиля.</p>
      ${pdState.wheelChosen && p.wheel.range ? '<p class="note">Для этого варианта поставщик указал PCD и ET диапазоном. Точные параметры нужно согласовать с агентом до выкупа.</p>' : ''}`;
  }

  function productHTML() {
    const p = byId[pdState.id];
    if (isMarket(p)) return marketProductHTML(p);
    const s = SUPPLIERS[p.sup];
    const sup = isSupplier() && hasWholesale(p);
    let priceBlock, breakdown;
    if (sup) {
      const w = wholesale(p, pdState.qty, pdState.ship);
      priceBlock = `<div class="pd__price"><b>${cny(w.each)}</b><span class="note">за штуку · партия ${pdState.qty} шт</span></div>`;
      const tierRows = p.tiers.map(([from, c]) => `<tr class="${w.each === c ? 'is-on' : ''}"><td>от ${from} шт</td><td>${cny(c)}</td></tr>`).join('');
      breakdown = `<table class="tiers"><tbody>${tierRows}<tr><td>Розница, 1 шт</td><td>${cny(p.cny)}</td></tr></tbody></table>
        <details class="why"><summary>Итого за партию: ${rub(w.total)}</summary><div class="sum">
          <div class="sum__row"><span>${pdState.qty} шт × ${cny(w.each)}</span><span>${rub(w.goods)}</span></div>
          <div class="sum__row"><span>Доставка, ${nf1.format(p.kg * pdState.qty)} кг</span><span>${rub(w.delivery)}</span></div>
          <div class="sum__row"><span>Сервис ASTTA, ${pct(feeW(p))}</span><span>${rub(w.fee)}</span></div>
          <p class="sum__note">Одна штука в Москве ≈ ${rub(w.landed)}</p>
        </div></details>`;
    } else {
      const r = retail(p, { ship: pdState.ship });
      priceBlock = `<div class="pd__price"><b>${rub(r.total)}</b>${p.sale ? `<s>${rub(retail(p, { ship: pdState.ship, cny: p.cny }).total)}</s>` : ''}</div>`;
      breakdown = `<details class="why"><summary>Из чего цена</summary><div class="sum">
          <div class="sum__row"><span>Товар: ${cny(r.unit)} × ${rateText}</span><span>${rub(r.goods)}</span></div>
          <div class="sum__row"><span>Доставка, ${nf1.format(p.kg)} кг</span><span>${rub(r.delivery)}</span></div>
          <div class="sum__row"><span>Сервис ASTTA, ${pct(feeR(p))}</span><span>${rub(r.fee)}</span></div>
          <p class="sum__note">Доплат после заказа нет.</p>
        </div></details>`;
    }

    if (p.wheel && !pdState.wheelChosen) {
      priceBlock = '<p class="note">Выберите диаметр и параметры — покажем точную цену.</p>';
      breakdown = '';
    }
    const ship = `<fieldset class="ship" data-pd-ship><legend>Доставка</legend>${shipOptionsHTML('pdShip', pdState.ship, p.bulky)}</fieldset>`;

    const rec = smartSize(p);
    const smart = !p.sizes ? '' : (rec
      ? `<div class="smartsize">${icon('ruler')}<div><b>Smart Size: вам CN ${esc(rec.size)}</b><span>${esc(rec.why)}${rec.over ? '. Это самый большой размер модели, уточните у агента' : ''}</span></div>${pdState.size === rec.size ? '' : `<button class="btn btn--line btn--sm" type="button" data-size="${esc(rec.size)}">Выбрать</button>`}</div>`
      : (MEAS[p.id] ? `<div class="smartsize">${icon('ruler')}<div><b>Smart Size</b><span>Укажите мерки один раз, и мы подскажем размер по реальным замерам этой модели</span></div><button class="btn btn--line btn--sm" type="button" data-measures>Указать</button></div>` : ''));
    const sizes = p.wheel ? wheelOptionsHTML(p) : (p.sizes && (!sup || live.on)) ? `<div class="stack" style="gap:10px">
        <span class="sublabel">Размер · китайский и наш</span>
        <div class="sizes" role="group" aria-label="Размер">${(p.grid || SIZE_GRID[p.sizes] || []).map(([cn, ru]) => `<button class="size${rec && rec.size === cn ? ' size--rec' : ''}" type="button" data-size="${esc(cn)}" aria-pressed="${pdState.size === cn}"><b>CN ${esc(cn)}</b><span>${rec && rec.size === cn ? 'ваш размер' : esc(ru)}</span></button>`).join('')}</div>
        ${smart}
      </div>` : '';

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

    const colors = (p.colors || []).length ? `<div class="stack" style="gap:10px"><span class="sublabel">Цвет</span><div class="sizes" role="group" aria-label="Цвет">${p.colors.map((color) => `<button class="size" type="button" data-color="${esc(color)}" aria-pressed="${pdState.color === color}">${esc(color)}</button>`).join('')}</div></div>` : '';

    const minQty = sup ? p.tiers[0][0] : 1;
    const qty = `<div class="qty" role="group" aria-label="Количество">
        <button type="button" data-pd-qty="-1" aria-label="Меньше" ${pdState.qty <= minQty ? 'disabled' : ''}>${icon('minus')}</button>
        <output>${pdState.qty}</output>
        <button type="button" data-pd-qty="1" aria-label="Больше">${icon('plus')}</button>
      </div>`;
    const nt = sup ? nextTier(p, pdState.qty) : null;

    const reviews = reviewsHTML(p);

    return `<div class="pd" data-id="${p.id}">
      <div class="pd__media">${FLOATING[p.id]
        ? `<div class="pd__float" style="--t1:${FLOATING[p.id][0]};--t2:${FLOATING[p.id][1]}"><img src="assets/img/cut/${p.id}.webp" alt="${esc(p.t)}" width="900" height="900"></div>`
        : galleryHTML(p)}${favBtnHTML(p, 'pd__fav')}</div>
      <div class="pd__info">
        <h2>${esc(p.wheel ? p.wheel.model : p.t)}</h2>
        <div class="pd__rating">${p.rating ? `<span>${icon('star', 'ic--fill')}<b>${nf1.format(p.rating)}</b></span>` : ''}${p.reviews ? `<span>${p.reviews} ${plural(p.reviews, 'отзыв', 'отзыва', 'отзывов')}</span>` : ''}<span>Доставка ${s.fact[0]}–${s.fact[1]} дней</span></div>
        ${priceBlock}
        ${sizes}
        ${colors}
        ${ship}
        ${breakdown}
        ${group}
        <div class="buyrow">
          ${qty}
          ${live.on ? `<button class="btn btn--lime" type="button" data-product-telegram ${p.detail ? '' : 'disabled'}>Заказать в Telegram</button>` : ''}
          <button class="btn btn--lime" type="button" data-pd-add ${live.on && !p.detail ? 'disabled' : ''}>${live.on && !p.detail ? 'Загружаем варианты…' : sup ? 'Добавить партию' : 'В корзину'}</button>
        </div>
        ${nt ? `<p class="note" style="color:var(--lime)">Ещё ${nt[0] - pdState.qty} шт, и цена станет ${cny(nt[1])}</p>` : ''}

        ${sup || live.on ? '' : `<button class="proofbox${pdState.proof ? ' is-on' : ''}" type="button" data-proof aria-pressed="${!!pdState.proof}">
          <span class="proofbox__check">${icon('check')}</span>
          <span class="proofbox__body"><b>ASTTA Proof · +${rub(proofOf(p).price)}</b><span>Проверим именно ваш экземпляр на складе до отправки: ${proofOf(p).list.slice(0, 3).join(', ').toLowerCase()}. Отчёт с фото и видео придёт в заказ.</span></span>
        </button>`}
        ${DIMS[p.id] ? `<button class="btn btn--line" type="button" data-room="${p.id}">${icon('ruler')}Примерить в комнату · ${DIMS[p.id].w}×${DIMS[p.id].d} см</button>` : ''}
        ${sup || live.on ? '' : `<div class="pdextra"><button class="btn btn--ghost btn--sm" type="button" data-pool-new="${p.id}">${icon('users')}Скинуться на подарок</button><button class="btn btn--ghost btn--sm" type="button" data-family-add="${p.id}">${icon('home')}В семейный список</button></div>`}
        ${p.desc ? `<p class="pd__desc">${esc(p.desc)}</p>` : ''}
        <button class="btn btn--ghost" type="button" data-open-chat="${esc(p.sup)}">${icon('chat')}Спросить агента</button>
        ${reviews}
      </div>
    </div>`;
  }

  /* ---------- Настоящие отзывы об ASTTA ---------- */
  const customerReviews = { items: [], page: 0, loading: false, more: false };
  function renderCustomerReviews() {
    $('#customerReviews').innerHTML = customerReviews.items.length ? customerReviews.items.map((r) => `<article class="customer-review">
      <div class="customer-review__head"><b>${esc(r.author)}</b><span aria-label="Оценка ${Number(r.rating)} из 5">${'★'.repeat(Math.max(1, Math.min(5, Number(r.rating) || 1)))}</span></div>
      <p>${esc(r.text)}</p><time datetime="${esc(r.created_at)}">${esc(new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }))}</time>
    </article>`).join('') : '<p class="note">Пока нет опубликованных отзывов. Поделитесь своим опытом — ваш отзыв может стать первым.</p>';
    $('#reviewsMore').hidden = !customerReviews.more;
  }
  async function loadCustomerReviews(reset = false) {
    if (customerReviews.loading || !live.on) return;
    customerReviews.loading = true;
    const button = $('#reviewsMore'); button.disabled = true;
    try {
      const page = reset ? 1 : customerReviews.page + 1;
      const data = await api('/api/reviews?page=' + page);
      customerReviews.items = reset ? data.items : [...customerReviews.items, ...data.items];
      customerReviews.page = page; customerReviews.more = data.has_more;
      $('#reviewsSummary').textContent = data.total ? `${nf1.format(data.average)} из 5 · ${data.total} ${plural(data.total, 'отзыв', 'отзыва', 'отзывов')}. Публикуем после проверки, без изменения оценки.` : 'Опыт покупателей: о заказах, доставке и работе сервиса.';
      renderCustomerReviews();
    } catch (e) {
      if (!customerReviews.items.length) $('#customerReviews').innerHTML = '<p class="note">Не удалось загрузить отзывы. <button class="linkbtn" type="button" data-reviews-retry>Попробовать ещё раз</button></p>';
      else toast(e.message);
    } finally { customerReviews.loading = false; button.disabled = false; }
  }
  function openCustomerReviewForm() {
    if (!live.on) { toast('Отзывы доступны на рабочем сайте после входа'); return; }
    if (!live.me) {
      openSheet(`<div class="stack"><h2 class="sheet__title">Оставить отзыв</h2><p>Войдите в аккаунт, чтобы поделиться опытом. Публично покажем только ваше имя, оценку и текст.</p><button class="btn btn--lime" type="button" data-tg-login>Войти</button></div>`, { narrow: true }); return;
    }
    openSheet(`<form class="stack" id="customerReviewForm">
      <h2 class="sheet__title">Ваш отзыв об ASTTA</h2>
      <fieldset class="review-rating"><legend>Оценка сервиса</legend>${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rating" value="${n}" required><span>${n} ★</span></label>`).join('')}</fieldset>
      <label class="field"><span>Как прошёл заказ?</span><textarea name="text" minlength="10" maxlength="2000" rows="5" required placeholder="Расскажите о товаре, доставке и работе сервиса"></textarea></label>
      <label class="consent"><input name="consent" type="checkbox" required><span>Согласен на обработку данных и публикацию моего имени и текста отзыва. <a href="privacy.html" target="_blank" rel="noopener">Политика конфиденциальности</a></span></label>
      <p class="note">Отзыв появится после проверки. Не указывайте телефон, адрес и другие личные данные.</p>
      <p class="note" id="reviewFormError" role="alert" hidden></p>
      <button class="btn btn--lime" type="submit">Отправить отзыв</button>
    </form>`, { narrow: true });
  }
  async function submitCustomerReview(form) {
    if (!form.reportValidity()) return;
    const button = $('button[type=submit]', form), error = $('#reviewFormError');
    button.disabled = true; error.hidden = true;
    try {
      const result = await api('/api/reviews', { method: 'POST', body: { rating: Number(form.elements.rating.value), text: form.elements.text.value.trim(), consent: form.elements.consent.checked } });
      if (!form.isConnected) { toast(result.message); return; }
      openSheet(`<div class="stack"><h2 class="sheet__title">Спасибо за отзыв!</h2><p>${esc(result.message)}</p><button class="btn btn--lime" type="button" data-close>Готово</button></div>`, { narrow: true });
    } catch (e) { if (form.isConnected) { error.textContent = e.message; error.hidden = false; } }
    finally { button.disabled = false; }
  }

  function reviewsHTML(p) {
    if (live.on) return ''; // отзывы в прототипе придуманные, настоящих пока нет
    const tab = pdState.rv || 'first';
    const long = REVIEWS_LONG[p.cat] || { m3: [], m6: [], ok: 0, issue: '' };
    const lists = { first: REVIEWS[p.cat] || [], m3: long.m3, m6: long.m6 };
    const stars = (n) => `<span class="stars" aria-label="${n} из 5">${[1, 2, 3, 4, 5].map((k) => icon('star', 'ic--fill' + (k > n ? ' is-off' : ''))).join('')}</span>`;
    const count = { first: p.reviews, m3: Math.round(p.reviews * 0.34), m6: Math.round(p.reviews * 0.17) };
    const tabs = [['first', 'Первые впечатления'], ['m3', 'Через 3 месяца'], ['m6', 'Через 6 месяцев']];
    return `<section class="rvplus" aria-label="Отзывы">
      <div class="rvplus__head"><span class="sublabel">Отзывы · Review+</span></div>
      <div class="rvplus__tabs" role="tablist">${tabs.map(([id, name]) => `<button type="button" role="tab" data-rv="${id}" aria-selected="${tab === id}">${name}<small>${count[id]}</small></button>`).join('')}</div>
      ${tab !== 'first' && long.ok ? `<div class="rvplus__sum">
        <div class="rvplus__ok"><b>${tab === 'm6' ? long.ok : Math.min(99, long.ok + 6)}%</b><span>довольны спустя ${tab === 'm6' ? 'полгода' : '3 месяца'}</span></div>
        <div class="bar"><i style="width:${tab === 'm6' ? long.ok : Math.min(99, long.ok + 6)}%"></i></div>
        <p class="note">Частое со временем: ${esc(long.issue)}</p>
      </div>` : ''}
      <div class="reviews">${lists[tab].map((r) => `<div class="review">
        <div class="review__head"><b>${esc(r.who)}</b>${stars(r.stars)}</div>
        ${r.state ? `<span class="rvstate">${esc(r.state)} · ${tab === 'm6' ? '6 мес.' : '3 мес.'} использования</span>` : ''}
        <p>${esc(r.text)}</p></div>`).join('')}</div>
      <p class="note">Через 3 и 6 месяцев после покупки ASTTA напоминает дописать отзыв, поэтому здесь видно, что стало с товаром со временем.</p>
    </section>`;
  }

  function rerenderProduct() {
    if (!pdState) return;
    const body = $('#sheetBody');
    const top = body.scrollTop;
    const old = $('.pd', body);
    const tmp = document.createElement('div');
    tmp.innerHTML = productHTML();
    // фото не трогаем, чтобы парящий товар не дёргался при смене доставки или количества
    if (old && old.dataset.id === pdState.id) {
      $('.pd__info', old).replaceWith($('.pd__info', tmp));
      if (pdState.mediaDirty) { $('.pd__media', old).replaceWith($('.pd__media', tmp)); pdState.mediaDirty = false; }
    } else body.innerHTML = tmp.innerHTML;
    body.scrollTop = top;
  }

  /* ---------- Чат с агентом ---------- */
  function openChat(supId) {
    if (live.on) { openAgentLive(supId); return; }
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
    if (live.on) return;
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

  /* ---------- ASTTA AI: помощник, который собирает корзину ----------
     В прототипе это сценарная логика по каталогу. В рабочей версии запрос уходит
     языковой модели, а она выбирает товары из базы и проверяет их совместимость. */
  const AI_INTENTS = [
    { id: 'look', what: 'образ', words: ['образ', 'лук', 'одет', 'одеж', 'гардероб', 'осен', 'стил', 'шмот'],
      slots: [['bomber', 'leather-jacket'], ['sweatshirt', 'tee-white', 'tee-black'], ['runner', 'loafers'], ['sunglasses', 'watch', 'backpack']] },
    { id: 'room', what: 'комплект для комнаты', words: ['комнат', 'спальн', 'офис', 'кабинет', 'квартир', 'интерьер', 'мебел', 'обстав', 'гостин', 'дом'],
      slots: [['sofa', 'armchair', 'lounge-chair'], ['lamp'], ['stool']] },
    { id: 'gift', what: 'подарок', words: ['подар', 'девушк', 'парн', 'друг', 'маме', 'папе', 'брат', 'сестр'],
      slots: [['headphones-anc', 'headphones'], ['watch', 'sunglasses', 'bag']] },
    { id: 'study', what: 'набор на учёбу', words: ['учёб', 'учеб', 'школ', 'универ', 'студент', 'колледж'],
      slots: [['backpack'], ['headphones', 'headphones-anc'], ['tee-white', 'sweatshirt']] },
    { id: 'tech', what: 'наушники', words: ['наушн', 'музык', 'звук'],
      slots: [['headphones-anc', 'headphones']] },
  ];
  const AI_PC = ['компьют', 'пк', 'видеокарт', 'процессор', 'сборк', 'ноутбук', 'монитор'];
  const ai = { log: [], last: null, turns: [], mode: null, busy: false, ctl: null, stage: 0 };

  function aiBudget(text) {
    let best = 0;
    for (const m of text.toLowerCase().matchAll(/(\d[\d\s]*\d|\d)\s*(к|k|тыс[а-я]*)?/g)) {
      let n = parseInt(m[1].replace(/\s/g, ''), 10);
      if (m[2]) n *= 1000;
      if (n >= 50 && n > best) best = n;
    }
    if (best && /€|евро|eur/i.test(text)) best *= EUR;
    return best >= 300 ? best : null;
  }

  function aiPlan(text, opts = {}) {
    const t = text.toLowerCase();
    const budget = opts.budget || aiBudget(text);
    if (AI_PC.some((w) => t.includes(w))) return { kind: 'pc', budget };
    const priceOf = (id) => retail(byId[id]).total;
    const intent = AI_INTENTS.find((i) => i.words.some((w) => t.includes(w)));
    let combos = [];
    if (intent) {
      // перебираем варианты по слотам; слот можно пропустить, если бюджет не пускает
      const walk = (k, picked) => {
        if (k === intent.slots.length) { combos.push(picked.filter(Boolean)); return; }
        for (const id of [...intent.slots[k], null]) walk(k + 1, [...picked, id]);
      };
      walk(0, []);
    } else {
      const stems = t.split(/[^а-яёa-z0-9]+/).filter((w) => w.length > 3).map((w) => w.slice(0, 5));
      const hits = PRODUCTS.filter((p) => stems.some((st) => p.t.toLowerCase().includes(st))).map((p) => p.id);
      if (!hits.length) return { kind: 'none', budget };
      combos = hits.map((id) => [id]);
    }
    const scored = combos.filter((c) => c.length).map((ids) => {
      const total = ids.reduce((sum, id) => sum + priceOf(id), 0);
      const rating = ids.reduce((sum, id) => sum + byId[id].rating, 0) / ids.length;
      return { ids, total, rating };
    }).filter((c) => !budget || c.total <= budget)
      .sort((a, b) => b.ids.length - a.ids.length || (budget ? b.total - a.total : 0) || b.rating - a.rating);
    if (!scored.length) return { kind: 'tight', budget, intent };
    const pick = scored[(opts.variant || 0) % scored.length];
    return { kind: 'cart', intent, budget, ...pick };
  }

  function aiReasons(p, plan) {
    const r = [];
    if (p.rating >= 4.8) r.push(`Рейтинг ${nf1.format(p.rating)}`);
    if (p.sale) r.push(`Скидка −${p.sale}%`);
    if (p.group) r.push('Есть совместный опт');
    if (plan.budget) r.push('Влезает в бюджет');
    r.push(`${daysText(SHIP[shipFor(p)].days)} доставка`);
    return r.slice(0, 2);
  }

  // Ответ демо-режима (без модели): та же разметка, что и у ответа Claude
  function aiDemoAnswer(plan) {
    if (plan.kind === 'pc') {
      return { reply: `Комплектующих для компьютеров в каталоге пока нет. Передам запрос агенту TT · Шэньчжэнь: он соберёт сборку${plan.budget ? ` до ${rub(plan.budget)}` : ''} у поставщиков на рынке Хуацянбэй, проверит совместимость и пришлёт готовую корзину.`, toAgent: true };
    }
    if (plan.kind === 'none') return { reply: 'Не нашёл такого в каталоге. Опишите задачу, например «подарок девушке до 7 000 ₽», или пришлите ссылку на товар, и агент найдёт его у поставщиков.' };
    if (plan.kind === 'tight') return { reply: `В ${rub(plan.budget)} не укладывается даже самый дешёвый вариант. Попробуйте увеличить бюджет или убрать часть вещей.` };
    const sups = [...new Set(plan.ids.map((id) => SUPPLIERS[byId[id].sup].name))];
    const left = plan.budget ? ` из ${rub(plan.budget)}, остаётся ${rub(plan.budget - plan.total)}` : '';
    return {
      reply: `Собрал ${plan.intent ? plan.intent.what : 'варианты'} на ${rub(plan.total)}${left}. ${sups.length > 1 ? 'Поставщики' : 'Поставщик'}: ${sups.join(', ')}. Цены уже с доставкой.`,
      cat: plan.ids.map((id) => ({ id, why: aiReasons(byId[id], plan) })), demoPlan: plan,
    };
  }

  /* --- Настоящая модель: в превью на claude.ai страница спрашивает Claude.
     Модель не ходит в интернет: товары вне каталога она предлагает по своим знаниям
     о китайском рынке, цены в юанях оценочные, точную цену подтверждает агент. --- */
  let aiSamplePromise = null;
  function aiSample() {
    if (!aiSamplePromise) {
      aiSamplePromise = (typeof claude !== 'undefined' && claude && typeof claude.use === 'function')
        ? claude.use('sample').catch(() => null)
        : Promise.resolve(null);
    }
    return aiSamplePromise;
  }

  function aiCatalogJSON() {
    return JSON.stringify(PRODUCTS.map((p) => ({
      id: p.id, title: p.t, category: (CATS.find((c) => c.id === p.cat) || {}).name, supplier: SUPPLIERS[p.sup].name,
      price_rub_delivered: retail(p).total, rating: p.rating, sale_pct: p.sale || 0,
      wholesale: hasWholesale(p) ? `от ${p.tiers[0][0]} шт по ${p.tiers[0][1]} ¥` : 'нет', delivery_days: SHIP[shipFor(p)].days.join('–'),
      sizes: p.sizes ? (p.grid || SIZE_GRID[p.sizes] || []).map(([cn]) => cn).join(',') : null, about: p.desc,
    })));
  }

  function aiRules() {
    return `Ты — ASTTA AI, умный помощник по покупкам маркетплейса ASTTA. ASTTA продаёт товары из Китая от поставщиков TT Логистики с доставкой в Россию, а агенты TT Логистики могут выкупить почти любой товар с 1688, Taobao, Tmall, JD и Poizon под индивидуальный заказ.

Твоя задача: по запросу покупателя собрать готовое решение — корзину, в которой всё подходит друг к другу и укладывается в бюджет.

Правила:
1. Сначала подбирай из каталога ниже. Используй только id из каталога, ничего не выдумывай о его товарах. Цены каталога уже в рублях с доставкой до пункта выдачи.
2. Если в каталоге нужного нет или не хватает части решения — предложи товары под индивидуальный заказ из Китая: конкретные модели, которые реально продаются на китайских площадках, с примерной ценой на китайском рынке в юанях (est_cny) и весом с упаковкой в кг (est_kg). Ты не видишь интернет, поэтому цены оценочные — так и считай их, агент подтвердит точную цену.
3. Сайт сам переведёт est_cny в рубли так: цена_руб ≈ est_cny × ${rateText.replace(',', '.')} × 1,05 + est_kg × ${SHIP.auto.perKg}. Учитывай это, чтобы уложиться в бюджет.
4. Для техники и сборок (компьютеры, комплектующие, электроника) проверь совместимость: сокет и чипсет, тип и частота памяти, мощность и разъёмы блока питания, габариты видеокарты и кулера в корпусе, интерфейсы. Коротко перечисли проверки в compat. Для одежды — сочетаемость и размеры.
5. Если бюджет указан — не превышай его. Если данных мало — всё равно предложи лучший вариант и задай до двух уточняющих вопросов в questions.
6. Пиши по-русски, коротко и по делу, без воды и без markdown.
7. Бюджет в евро переводи по курсу 1 € = ${EUR} ₽.
9. Режим ASTTA Solve (запрос начинается с «ASTTA Solve», к нему приложено фото или кадр из видео): определи, что сломалось и как называется нужная деталь (дай название на русском и для поиска на китайских площадках). В reply коротко объясни поломку и как её исправить. В custom предложи подходящие запчасти и нужный инструмент с оценкой цены; если ремонт сложный, добавь в custom услугу мастера (name начинается с «Услуга:», est_cny 0). В compat перечисли, что измерить или проверить перед заказом (размер, тип крепления). Если по фото непонятно — задай вопросы в questions.
8. Режим ASTTA Build (запрос начинается с «ASTTA Build»): покупатель хочет обустроить пространство или собрать полный комплект. Закрой все основные зоны (например, для игровой комнаты: игровое место, кресло и стол, свет, звук, хранение, атмосфера), чтобы ничего не пришлось докупать. У каждого товара укажи role — зону комплекта, 1–2 слова. В compat отметь, что всё сочетается по размерам, питанию и стилю.

Каталог ASTTA (JSON):
${aiCatalogJSON()}

Отвечай только JSON такого вида:
{"reply":"1–3 предложения: что собрал и почему","catalog":[{"id":"id из каталога","role":"зона комплекта или пусто","why":"чем подходит, до 6 слов"}],"custom":[{"name":"конкретная модель","role":"зона комплекта или пусто","specs":"ключевые характеристики","why":"чем подходит, до 6 слов","est_cny":число,"est_kg":число}],"compat":["одна проверка совместимости"],"questions":["уточняющий вопрос"]}
Пустые массивы допустимы.`;
  }

  const aiCustomRub = (c) => round10(c.est_cny * RATE * (1 + FEE_RETAIL) + c.est_kg * SHIP.auto.perKg);

  function aiNormalize(data) {
    const str = (v, max = 300) => String(v == null ? '' : v).slice(0, max);
    const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
    const out = { reply: str(data && data.reply, 900) || 'Готово.', source: 'claude' };
    out.cat = (Array.isArray(data && data.catalog) ? data.catalog : [])
      .filter((c) => c && byId[c.id]).slice(0, 10).map((c) => ({ id: c.id, role: str(c.role, 30), why: [str(c.why, 60)].filter(Boolean) }));
    out.custom = (Array.isArray(data && data.custom) ? data.custom : [])
      .filter((c) => c && c.name).slice(0, 14)
      .map((c) => ({ role: str(c.role, 30), name: str(c.name, 120), specs: str(c.specs, 200), why: str(c.why, 60), est_cny: num(c.est_cny), est_kg: num(c.est_kg) || 1 }));
    out.compat = (Array.isArray(data && data.compat) ? data.compat : []).slice(0, 8).map((x) => str(x, 200));
    out.questions = (Array.isArray(data && data.questions) ? data.questions : []).slice(0, 2).map((x) => str(x, 200));
    return out;
  }

  function aiResultHTML(m, idx) {
    const cat = (m.cat || []).filter((c) => byId[c.id] && isStorefrontVisible(byId[c.id]));
    const custom = m.custom || [];
    if (!cat.length && !custom.length) return '';
    const catTotal = cat.reduce((sum, c) => sum + (isMarket(byId[c.id]) ? marketFrom(byId[c.id]) : retail(byId[c.id]).total), 0);
    const customTotal = custom.reduce((sum, c) => sum + (c.est_cny ? aiCustomRub(c) : 0), 0);
    const cards = cat.map((c) => {
      const p = byId[c.id];
      return `<article class="aicard">
        <button class="aicard__img" type="button" data-open="${c.id}" aria-label="${esc(p.t)}"><img data-product-photo="${esc(p.id)}" src="${esc(pimg(p))}" alt="" width="160" height="160" loading="lazy"></button>
        <div class="aicard__body">
          ${c.role ? `<span class="aicard__role">${esc(c.role)}</span>` : ''}
          <b>${esc(p.t)}</b>
          <span class="aicard__price">${isMarket(p) ? 'от ' : ''}${rub(isMarket(p) ? marketFrom(p) : retail(p).total)}</span>
          <div class="aicard__why">${c.why.map((r) => `<span>${esc(r)}</span>`).join('')}</div>
        </div>
      </article>`;
    }).join('') + custom.map((c) => `<article class="aicard aicard--custom">
        <div class="aicard__img aicard__ph">${icon('box')}<span>Под заказ из Китая</span></div>
        <div class="aicard__body">
          ${c.role ? `<span class="aicard__role">${esc(c.role)}</span>` : ''}
          <b>${esc(c.name)}</b>
          ${c.specs ? `<small>${esc(c.specs)}</small>` : ''}
          <span class="aicard__price">${c.est_cny ? `≈ ${rub(aiCustomRub(c))}` : 'цену уточнит агент'}</span>
          ${c.why ? `<div class="aicard__why"><span>${esc(c.why)}</span></div>` : ''}
        </div>
      </article>`).join('');
    const compat = (m.compat || []).length ? `<ul class="aicompat">${m.compat.map((x) => `<li>${icon('check')}${esc(x)}</li>`).join('')}</ul>` : '';
    const total = catTotal + customTotal;
    return `<div class="airesult">
      <div class="aicards__head"><span>Товары подборки</span><div data-ai-controls="${idx}">
        <button type="button" class="iconbtn" data-ai-scroll="${idx}" data-step="-1" aria-label="Предыдущие товары" aria-controls="aiCards${idx}" disabled>${icon('arrow')}</button>
        <button type="button" class="iconbtn" data-ai-scroll="${idx}" data-step="1" aria-label="Следующие товары" aria-controls="aiCards${idx}">${icon('arrow')}</button>
      </div></div>
      <div class="aicards" id="aiCards${idx}" data-ai-rail="${idx}" tabindex="0" role="region" aria-label="Товары подборки">${cards}</div>
      ${compat}
      <div class="aitotal">
        <div><span>${custom.length || cat.some((c) => isMarket(byId[c.id])) ? 'Подборка · ориентир от' : 'Итого за подборку'}</span><b>${custom.length ? '≈ ' : ''}${rub(total)}</b></div>
        <div class="aitotal__btns">
          ${cat.length && !live.on ? `<button class="btn btn--lime btn--sm" type="button" data-ai-add="${idx}">${custom.length ? 'Из каталога в корзину' : 'Добавить всё'}</button>` : ''}
          ${custom.length ? `<button class="btn ${cat.length ? 'btn--line' : 'btn--lime'} btn--sm" type="button" data-ai-custom="${idx}">Индивидуальный заказ</button>` : ''}
        </div>
      </div>
      ${cat.length && live.on ? '<p class="note">Откройте карточку товара выше, чтобы выбрать вариант и оформить заказ.</p>' : ''}
      ${custom.length ? '<p class="note">Цены под заказ оценочные, точную цену и наличие агент подтвердит до оплаты.</p>' : ''}
      <div class="quick"><button class="chip" type="button" data-ai-more="cheaper" data-ai-idx="${idx}">Дешевле</button><button class="chip" type="button" data-ai-more="other" data-ai-idx="${idx}">Другой вариант</button></div>
    </div>`;
  }

  const AI_STAGES = ['Разбираю запрос…', 'Ищу в каталоге ASTTA…', 'Подбираю под заказ из Китая…', 'Проверяю совместимость и бюджет…', 'Собираю корзину…'];

  function updateAiRail(rail) {
    const controls = $(`[data-ai-controls="${rail.dataset.aiRail}"]`);
    if (!controls) return;
    controls.hidden = rail.scrollWidth <= rail.clientWidth + 2;
    $('[data-step="-1"]', controls).disabled = rail.scrollLeft <= 2;
    $('[data-step="1"]', controls).disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
  }
  function initAiRails() { $$('.aicards').forEach(updateAiRail); }
  function scrollAiRail(rail, direction) {
    rail.scrollBy({ left: direction * Math.max(180, rail.clientWidth * .8), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function aiRender(forceFollow = false) {
    const box = $('#aiMsgs');
    if (!box) return;
    const body = $('#sheetBody'), top = body.scrollTop;
    const follow = forceFollow || body.scrollHeight - body.scrollTop - body.clientHeight < 100;
    const positions = new Map($$('.aicards', box).map((r) => [r.id, r.scrollLeft]));
    box.innerHTML = ai.log.map((m, idx) => {
      if (m.me) return `<div class="msg msg--me">${m.thumb ? `<img class="msg__img" src="${esc(m.thumb)}" alt="">` : ''}${esc(m.text)}</div>`;
      if (m.typing) return `<div class="msg msg--typing"><span id="aiStage">${AI_STAGES[ai.stage % AI_STAGES.length]}</span>${ai.ctl ? ' <button class="linkbtn" type="button" data-ai-stop>Стоп</button>' : ''}</div>`;
      const reply = esc(m.reply || m.text).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
      let html = `<div class="msg msg--ai">${reply}</div>`;
      html += aiResultHTML(m, idx);
      html += marketPhotosHTML(m.images);
      if (m.marketResults) html += Object.values(m.marketResults).map((r) => marketStatusHTML(r, r.quote?.size || '') + (r.item?.sizes?.length ? `<div class="quick">${r.item.sizes.map((s) => typeof s === 'string' ? s : s.size).filter(Boolean).slice(0, 40).map((size, i) => `<button class="chip" type="button" data-ai-market-size="${idx}" data-size-value="${esc(size)}" data-market-url="${esc(r.url)}">${esc(variantLabel(size, i))}</button>`).join('')}</div>` : '')).join('');
      if (m.questions && m.questions.length) html += `<div class="quick">${m.questions.map((q) => `<button class="chip chip--q" type="button" data-ai-fill="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
      if (m.order) html += `<button class="btn btn--lime btn--sm" type="button" data-ai-order="${idx}" style="align-self:flex-start">Оформить заказ · ${rub(m.order.total_rub)}</button>`;
      if (m.toAgent) html += '<button class="btn btn--ghost btn--sm" type="button" data-open-chat="" style="align-self:flex-start">Написать агенту</button>';
      return html;
    }).join('');
    const head = $('#aiMode');
    if (head) head.textContent = ai.mode === 'server' ? 'ASTTA AI · подбирает из каталога, отвечает по правилам сервиса' : ai.mode === 'claude' ? 'работает на Claude · подбирает из каталога и под заказ' : (ai.mode === 'demo' ? 'демо-режим: сценарии по каталогу' : 'подбирает товары под задачу и бюджет');
    $$('.aicards', box).forEach((r) => { r.scrollLeft = positions.get(r.id) || 0; });
    initAiRails();
    if (follow) box.lastElementChild?.scrollIntoView({ block: 'end' });
    else body.scrollTop = top;
  }

  function openAI() {
    openSheet(`<div class="chat aichat">
      <div class="chat__agent"><span class="ava ava--ai" aria-hidden="true">${icon('spark')}</span><div><b>ASTTA AI</b><span id="aiMode"></span></div></div>
      <div class="msgs" id="aiMsgs"></div>
      ${ai.log.length > 1 ? '' : `<div class="quick" id="aiStart">
        <button class="chip" type="button" data-ai-ask="Собери игровой компьютер за 70 000 ₽">Игровой ПК за 70 000 ₽</button>
        <button class="chip" type="button" data-ai-ask="Собери образ на осень до 15 000 ₽">Образ до 15 000 ₽</button>
        <button class="chip" type="button" data-ai-ask="Подарок девушке до 7 000 ₽">Подарок девушке</button>
      </div>`}
      <form class="chat__form" id="aiChatForm">
        <label class="roundbtn roundbtn--ghost" aria-label="Прикрепить скриншот" title="Прикрепить скриншот">${icon('camera')}<input id="aiPhoto" type="file" accept="image/*" hidden></label>
        <input id="aiChatInput" autocomplete="off" placeholder="Что подобрать? Можно ссылку или скриншот" aria-label="Запрос для ASTTA AI"><button class="roundbtn" type="submit" aria-label="Отправить">${icon('arrow')}</button></form>
    </div>`, { narrow: true });
    if (!ai.log.length) ai.log.push({ reply: 'Привет! Напишите задачу и бюджет. Подберу из каталога ASTTA, а чего нет — найду под заказ в Китае и проверю, что всё подходит друг к другу.' });
    aiRender();
  }

  // Скриншот в чат ИИ: уменьшаем в браузере до 1280 px (JPEG), чтобы отправка была быстрой и лёгкой.
  async function shrinkPhoto(file, max = 1280) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
    c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  }
  async function aiPhotoPicked(file) {
    if (!file) return;
    if (!(live.on && live.site && live.site.chat)) { toast('Фото ИИ читает на сайте с подключённой моделью'); return; }
    let photo;
    try { photo = await shrinkPhoto(file); } catch (e) { toast('Не получилось открыть фото'); return; }
    const input = $('#aiChatInput');
    const text = (input && input.value.trim()) || 'Посчитай цену под ключ по скриншоту';
    if (input) input.value = '';
    aiAsk(text, { photo, thumb: photo, label: input && text !== 'Посчитай цену под ключ по скриншоту' ? text : 'Скриншот товара' });
  }

  async function watchAiMarketJob(id, entry) {
    entry.marketResults = entry.marketResults || {};
    const update = (result) => {
      entry.marketResults[id] = result;
      if (result.item?.images) entry.images = [...new Set([...(entry.images || []), ...result.item.images])];
      if (result.quote) entry.order = { url: result.url, title: result.item?.title || '', size: result.quote.size, qty: result.quote.qty,
        price_cny: Number(result.quote.price_cny), total_rub: Number(result.quote.total_rub), quote: result.quote, item: result.item };
      aiRender();
    };
    try { await pollMarketJob(await api(`/api/link/market-jobs/${encodeURIComponent(id)}`), update, () => ai.log.includes(entry)); }
    catch (e) { update({ status: 'failed', note: e.message }); }
  }

  async function aiAsk(text, opts = {}) {
    const q = text.trim();
    if (!q || ai.busy) return;
    if (!$('#aiMsgs')) openAI();
    const start = $('#aiStart');
    if (start) start.remove();
    ai.busy = true;
    if (!opts.silent) ai.log.push({ me: true, text: opts.label || q, thumb: opts.thumb });
    ai.stage = 0;
    ai.log.push({ typing: true });
    aiRender(true);
    const tick = setInterval(() => { ai.stage += 1; const el = $('#aiStage'); if (el) el.textContent = AI_STAGES[ai.stage % AI_STAGES.length]; }, 4000);
    const finish = (entry) => {
      clearInterval(tick);
      ai.log = ai.log.filter((m) => !m.typing);
      if (entry) ai.log.push(entry);
      ai.busy = false; ai.ctl = null;
      aiRender();
    };
    const demo = () => {
      if (opts.solve) return aiSolveDemo();
      const plan = aiPlan(opts.demoQuery || q, opts);
      ai.last = { q: opts.demoQuery || q, plan, variant: opts.variant || 0 };
      return { ...aiDemoAnswer(plan), source: 'demo' };
    };
    // Боевой сайт с подключённой моделью: спрашиваем ASTTA AI на сервере, он ищет по нашему каталогу.
    if (live.on && live.site && live.site.chat && !opts.images && !opts.solve) {
      try {
        const data = await api('/api/ai/chat', { method: 'POST', body: { messages: [...ai.turns.slice(-10), { role: 'user', content: q }], image: opts.photo || null } });
        ai.mode = 'server';
        // Данные о товаре по ссылке храним в истории первыми: на «а размер 47?» ИИ ответит, не ища заново.
        // Скриншот помечаем в истории: по нему потом можно оформить заказ, сам файл держим в памяти.
        if (opts.photo) ai.lastPhoto = opts.photo;
        ai.turns.push({ role: 'user', content: (opts.photo ? '[скриншот] ' : '') + q }, { role: 'assistant', content: (data.memo ? data.memo + '\n' : '') + data.answer });
        const entry = { reply: data.answer, cat: data.products.filter((slug) => byId[slug]).map((slug) => ({ id: slug, why: [] })),
          toAgent: data.handoff, logId: data.log_id, order: data.order || null, images: data.images || [] };
        finish(entry);
        (data.market_jobs || []).forEach((id) => watchAiMarketJob(id, entry));
      } catch (e) {
        finish({ reply: e.message || 'Связь с ИИ прервалась. Попробуйте ещё раз.' });
      }
      return;
    }
    if (live.on) {
      ai.mode = 'server';
      finish({ reply: 'Этот режим ИИ сейчас недоступен. Напишите агенту через форму — команда поможет с подбором.', toAgent: true });
      return;
    }
    const sample = ai.mode === 'demo' ? null : await aiSample();
    if (!sample) {
      ai.mode = 'demo';
      setTimeout(() => finish(demo()), 900);
      return;
    }
    ai.ctl = new AbortController();
    aiRender();
    const turns = [{ role: 'user', content: aiRules() }, ...ai.turns.slice(-8), { role: 'user', content: q }];
    try {
      const data = await sample.json(turns, { modelTier: 'complex', cache: false, signal: ai.ctl.signal, ...(opts.images ? { images: opts.images } : {}) });
      ai.mode = 'claude';
      ai.turns.push({ role: 'user', content: q }, { role: 'assistant', content: JSON.stringify(data).slice(0, 6000) });
      finish(aiNormalize(data));
    } catch (e) {
      const code = e && e.code;
      if (code === 'images_unavailable' || code === 'image_rejected') {
        finish({ ...aiSolveDemo(), reply: 'Не получилось передать фото модели в этом просмотре. Пример того, как выглядит ответ: ' + aiSolveDemo().reply });
      } else if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) {
        ai.mode = 'demo';
        const d = demo();
        finish({ ...d, reply: 'Модель недоступна в этом просмотре, отвечаю в демо-режиме. ' + d.reply });
      } else if (code === 'cancelled') finish({ reply: 'Остановил. Уточните запрос или спросите заново.' });
      else if (code === 'rate_limited') finish({ reply: 'Слишком много запросов подряд. Попробуйте через минуту.' });
      else if (code === 'invalid_json') finish({ reply: 'Не получилось разобрать ответ. Попробуйте переформулировать запрос.' });
      else if (code === 'refused') finish({ reply: 'С этим запросом помочь не могу. Попробуйте описать задачу иначе.' });
      else finish({ reply: 'Связь с моделью прервалась. Попробуйте ещё раз.' });
    }
  }

  /* ---------- ASTTA Trends: короткие ролики с покупкой прямо из ролика ----------
     В демо ролики собраны из фото с плавным наездом камеры. Видео, загруженное
     через «+», проигрывается по-настоящему. */
  const TRENDS = [
    { id: 't1', author: 'tt.guangzhou', name: 'TT · Гуанчжоу', seller: true, photos: ['cat-clothes', 'leather-jacket', 'hero-leopard'],
      text: 'Косуха из натуральной кожи за 6 900 ₽ с доставкой. В торговом центре такая от 25 тысяч.', tags: ['#косуха', '#осень2026'], likes: 12400, comments: 318, views: '184K', products: ['leather-jacket', 'tee-black'] },
    { id: 't2', author: 'masha.style', name: 'Маша', buyer: true, photos: ['tile-new', 'sweatshirt', 'runner'],
      text: 'Собрала образ на осень за 13 тысяч. Пришло за 19 дней, размеры подобрал агент.', tags: ['#образ', '#распаковка'], likes: 8930, comments: 204, views: '96K', products: ['bomber', 'sweatshirt', 'runner'] },
    { id: 't3', author: 'tt.shenzhen', name: 'TT · Шэньчжэнь', seller: true, photos: ['headphones-anc', 'cat-tech', 'headphones'],
      text: 'Тест шумоподавления в метро. Видео проверки приходит с каждым заказом.', tags: ['#наушники', '#тест'], likes: 15200, comments: 431, views: '230K', products: ['headphones-anc', 'headphones'] },
    { id: 't4', author: 'tt.foshan', name: 'TT · Фошань', seller: true, photos: ['cat-furniture', 'sofa', 'stage-box'],
      text: 'Распаковка дивана из Фошаня: обрешётка, плёнка, ни одной царапины.', tags: ['#интерьер', '#распаковка'], likes: 6100, comments: 97, views: '71K', products: ['sofa', 'lamp'] },
    { id: 't5', author: 'kirill.runs', name: 'Кирилл', buyer: true, photos: ['cat-shoes', 'runner', 'loafers'],
      text: 'Кроссовки за 3 670 ₽ после первых 100 км. Подошва живая, сетка целая.', tags: ['#бег', '#обзор'], likes: 4300, comments: 88, views: '52K', products: ['runner'] },
    { id: 't6', author: 'tt.yiwu', name: 'TT · Иу', seller: true, photos: ['bag', 'tile-discount', 'backpack'],
      text: 'Сумка, про которую спрашивают все. Экокожа, пыльник и коробка в комплекте.', tags: ['#сумка', '#подарок'], likes: 9800, comments: 156, views: '120K', products: ['bag', 'backpack'] },
  ];
  const TREND_COMMENTS = [
    ['lena_krd', 'Заказала такую же, пришла за 20 дней, всё как на видео'],
    ['artem.msk', 'Агент реально прислал фото со склада до отправки'],
    ['vika_style', 'А размеры маломерят? Беру на один больше?'],
  ];
  const tr = { liked: new Set(), saved: new Set(), followed: new Set(), active: -1, photo: 0, timer: null, start: 0, rendered: false, obs: null, muted: true };
  const PHOTO_MS = 3200;
  const trSrc = (src) => (src.startsWith('blob:') ? src : img(src));
  const compact = (n) => (n >= 1000 ? `${nf1.format(Math.round(n / 100) / 10)}K` : String(n));

  function reelThumbHTML(t, i) {
    const cover = t.video ? '' : `<img src="${esc(trSrc(t.photos[0]))}" alt="" loading="lazy" width="270" height="480">`;
    return `<button class="reelthumb" type="button" data-trend="${i}" aria-label="Ролик ${esc(t.name)}">
      ${cover}${t.video ? '<span class="reelthumb__vid">Видео</span>' : ''}
      <span class="reelthumb__views">${icon('play')}${esc(t.views || 'новое')}</span>
      <span class="reelthumb__who">@${esc(t.author)}</span>
    </button>`;
  }

  function reelHTML(t, i) {
    const liked = tr.liked.has(t.id), saved = tr.saved.has(t.id), followed = tr.followed.has(t.author);
    const media = t.video
      ? `<video class="reel__video" src="${esc(t.video)}" muted loop playsinline preload="metadata"></video>`
      : t.photos.map((ph, j) => `<img class="reel__ph kb${j % 3}${j === 0 ? ' is-on' : ''}" src="${esc(trSrc(ph))}" alt="" width="1000" height="1250"${i > 1 || j ? ' loading="lazy"' : ''}>`).join('');
    const bars = t.video ? '' : `<div class="reel__bars">${t.photos.map((_, j) => `<i data-bar="${j}"><b></b></i>`).join('')}</div>`;
    const chips = t.products.map((id) => {
      const p = byId[id];
      const price = isSupplier() ? `${cny(p.tiers[0][1])} от ${p.tiers[0][0]} шт` : rub(retail(p).total);
      return `<div class="reelchip">
        <button class="reelchip__open" type="button" data-open="${id}"><img src="${pimg(p)}" alt="" width="44" height="44" loading="lazy"><span><b>${esc(p.t)}</b><em>${price}</em></span></button>
        <button class="reelchip__buy" type="button" data-add="${id}">Купить</button>
      </div>`;
    }).join('');
    return `<section class="reel" data-reel="${i}" aria-label="Ролик ${i + 1}">
      <div class="reel__media">${media}</div>
      ${bars}
      <div class="reel__shade" aria-hidden="true"></div>
      ${t.video ? '' : `<button class="reel__tap reel__tap--prev" type="button" data-reel-step="-1" aria-label="Предыдущее фото"></button><button class="reel__tap reel__tap--next" type="button" data-reel-step="1" aria-label="Следующее фото"></button>`}
      <div class="reel__side">
        <button class="reel__ava${followed ? ' is-followed' : ''}" type="button" data-follow="${esc(t.author)}" aria-label="${followed ? 'Вы подписаны' : 'Подписаться'}"><span>${esc(t.author.slice(0, 2).toUpperCase())}</span><i>${followed ? icon('check') : icon('plus')}</i></button>
        <button class="reel__act${liked ? ' is-on' : ''}" type="button" data-reel-heart="${i}" aria-pressed="${liked}" aria-label="Нравится">${icon('heart')}<span>${compact(t.likes + (liked ? 1 : 0))}</span></button>
        <button class="reel__act" type="button" data-reel-comments="${i}" aria-label="Комментарии">${icon('chat')}<span>${compact(t.comments)}</span></button>
        <button class="reel__act${saved ? ' is-on' : ''}" type="button" data-reel-save="${i}" aria-pressed="${saved}" aria-label="Сохранить">${icon('bookmark')}<span>${saved ? 'Есть' : 'В избр.'}</span></button>
        <button class="reel__act" type="button" data-reel-share="${i}" aria-label="Поделиться">${icon('share')}<span>Ещё</span></button>
        ${t.video ? `<button class="reel__act" type="button" data-reel-sound aria-label="Звук">${icon(tr.muted ? 'mute' : 'sound')}<span>${tr.muted ? 'Звук' : 'Тише'}</span></button>` : ''}
      </div>
      <div class="reel__info">
        <div class="reel__who"><b>@${esc(t.author)}</b>${t.seller ? '<span class="reel__badge">Продавец</span>' : '<span class="reel__badge reel__badge--buyer">Купил на ASTTA</span>'}</div>
        <p class="reel__text">${esc(t.text)} <span class="reel__tags">${t.tags.map(esc).join(' ')}</span></p>
        <p class="reel__music">${icon('music')}<span>Оригинальный звук · ${esc(t.name)}</span></p>
        <div class="reel__chips">${chips}</div>
      </div>
    </section>`;
  }

  function renderTrends(keepPosition) {
    const box = $('#trendsScroll');
    const top = box.scrollTop;
    box.innerHTML = TRENDS.map(reelHTML).join('');
    tr.rendered = true;
    if (tr.obs) tr.obs.disconnect();
    tr.obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) activateReel(Number(en.target.dataset.reel)); });
    }, { root: box, threshold: 0.6 });
    $$('.reel', box).forEach((el) => tr.obs.observe(el));
    if (keepPosition) box.scrollTop = top;
    tr.active = -1;
  }

  function enterTrends() {
    if (!tr.rendered) renderTrends();
    const box = $('#trendsScroll');
    requestAnimationFrame(() => {
      const el = $(`.reel[data-reel="${tr.start}"]`, box);
      if (el) box.scrollTop = el.offsetTop;
      activateReel(tr.start);
    });
  }

  function leaveTrends() {
    clearTimeout(tr.timer);
    $$('.reel__video').forEach((v) => v.pause());
    $$('.reel.is-active').forEach((el) => el.classList.remove('is-active'));
    tr.active = -1;
  }

  function activateReel(i) {
    if (currentView !== 'trends' || i === tr.active) return;
    tr.active = i; tr.start = i;
    $$('.reel', $('#trendsScroll')).forEach((el) => el.classList.toggle('is-active', Number(el.dataset.reel) === i));
    $$('.reel__video').forEach((v) => { if (Number(v.closest('.reel').dataset.reel) === i) { v.muted = tr.muted; v.play().catch(() => {}); } else v.pause(); });
    showPhoto(0);
  }

  function showPhoto(j) {
    clearTimeout(tr.timer);
    const t = TRENDS[tr.active];
    const reel = $(`.reel[data-reel="${tr.active}"]`);
    if (!t || !reel || t.video) return;
    const n = t.photos.length;
    tr.photo = (j + n) % n;
    $$('.reel__ph', reel).forEach((el, k) => el.classList.toggle('is-on', k === tr.photo));
    $$('.reel__bars i', reel).forEach((el, k) => {
      el.classList.remove('is-now');
      el.classList.toggle('is-done', k < tr.photo);
    });
    const bar = $(`.reel__bars i[data-bar="${tr.photo}"]`, reel);
    if (bar) { void bar.offsetWidth; bar.classList.add('is-now'); }
    tr.timer = setTimeout(() => showPhoto(tr.photo + 1), PHOTO_MS);
  }

  function likeReel(i, burst) {
    const t = TRENDS[i];
    if (burst && tr.liked.has(t.id)) return;
    if (tr.liked.has(t.id)) tr.liked.delete(t.id); else tr.liked.add(t.id);
    const btn = $(`[data-reel-heart="${i}"]`);
    if (btn) {
      const on = tr.liked.has(t.id);
      btn.classList.toggle('is-on', on); btn.setAttribute('aria-pressed', String(on));
      $('span', btn).textContent = compact(t.likes + (on ? 1 : 0));
    }
    if (burst) {
      const media = $(`.reel[data-reel="${i}"] .reel__media`);
      const h = document.createElement('span');
      h.className = 'reel__burst'; h.innerHTML = icon('heart');
      media.append(h);
      setTimeout(() => h.remove(), 900);
    }
  }

  function trendComments(i) {
    const t = TRENDS[i];
    const list = [...(t.myComments || []).map((c) => ['вы', c]), ...TREND_COMMENTS];
    openSheet(`<div class="stack">
      <h2 class="sheet__title">${compact(t.comments + (t.myComments || []).length)} комментариев</h2>
      <div class="tcomments">${list.map(([who, text]) => `<div class="tcomment"><span class="ava" aria-hidden="true">${esc(who.slice(0, 2).toUpperCase())}</span><div><b>${esc(who)}</b><p>${esc(text)}</p></div></div>`).join('')}</div>
      <form class="chat__form" id="tCommentForm" data-reel="${i}"><input id="tCommentInput" autocomplete="off" placeholder="Комментарий" aria-label="Комментарий"><button class="roundbtn" type="submit" aria-label="Отправить">${icon('arrow')}</button></form>
    </div>`, { narrow: true });
  }

  function trendUpload() {
    openSheet(`<div class="stack">
      <h2 class="sheet__title">Новый ролик</h2>
      <p class="note">Видео или фото с товаром. Отметьте товары, и их можно будет купить прямо из ролика.</p>
      <form class="form" id="trendForm" novalidate>
        <label class="field field--full"><span>Видео или фото</span><input id="tfFile" type="file" accept="video/*,image/*" required></label>
        <label class="field field--full"><span>Подпись</span><textarea id="tfText" placeholder="Например: распаковка и примерка">Распаковка и первые впечатления</textarea></label>
        <label class="field field--full"><span>Товар в ролике</span><select id="tfProduct">${PRODUCTS.map((p) => `<option value="${p.id}">${esc(p.t)}</option>`).join('')}</select></label>
        <button class="btn btn--lime btn--wide field--full" type="submit">Опубликовать</button>
      </form>
    </div>`, { narrow: true });
  }

  function updatePoolShare() {
    const f = $('#poolForm');
    if (!f) return;
    const p = byId[f.dataset.pid];
    const n = Math.max(2, parseInt($('#plPeople').value, 10) || 2);
    $('#plShare').textContent = `С каждого ${rub(Math.ceil(retail(p).total / n / 10) * 10)}. Друзья оплачивают по ссылке, вы ничего не собираете вручную.`;
  }

  const build = { cur: 'eur' };
  function buildOut() {
    const v = Number($('#buildRange').value);
    $('#buildOut').textContent = build.cur === 'eur' ? `${nf.format(v)} € ≈ ${rub(v * EUR)}` : rub(v);
  }

  /* ---------- ASTTA Solve: покажи проблему ---------- */
  function aiSolveDemo() {
    return {
      source: 'demo',
      reply: 'Демо-ответ (фото распознаёт только модель на claude.ai). Похоже, у дверцы разболталась или сломалась мебельная петля: дверца проседает и цепляет соседнюю. Петлю можно заменить самому за 10 минут отвёрткой.',
      custom: [
        { role: 'Деталь', name: 'Петля мебельная накладная 35 мм с доводчиком, 2 шт', specs: 'Чашка 35 мм, угол 110°, для двери 16–20 мм', why: 'Стандарт для шкафов', est_cny: 18, est_kg: 0.3 },
        { role: 'Крепёж', name: 'Евровинты 6,3×16 мм, 20 шт', specs: 'Под планку петли', why: 'Старые часто разбиты', est_cny: 5, est_kg: 0.1 },
        { role: 'Ремонт', name: 'Услуга: мастер на замену петель', specs: 'Если не хотите сами', why: 'Под ключ за час', est_cny: 0, est_kg: 0 },
      ],
      compat: ['Измерьте диаметр чашки петли в двери: 35 мм или 26 мм', 'Посмотрите тип: накладная, полунакладная или вкладная'],
      questions: ['Дверца перекошена или вообще отвалилась?'],
    };
  }

  // Видео модели не передать: берём кадр из середины ролика
  function frameFromVideo(file) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.src = URL.createObjectURL(file);
      v.onloadeddata = () => { v.currentTime = Math.min(1.5, (v.duration || 2) / 2); };
      v.onseeked = () => {
        const c = document.createElement('canvas');
        const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
        c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('frame'))), 'image/jpeg', 0.85);
      };
      v.onerror = () => reject(new Error('video'));
    });
  }

  /* ---------- BuyTogether AI: дубли, похожие покупки, бюджет ---------- */
  function familyAnalysis() {
    const f = state.family;
    const live = f.items.filter((it) => it.status !== 'declined');
    const price = (it) => retail(byId[it.pid]).total;
    const remove = new Map();
    const notes = [];
    const groups = {};
    live.forEach((it) => { (groups[it.pid] = groups[it.pid] || []).push(it); });
    Object.values(groups).filter((g) => g.length > 1).forEach((g) => {
      const keep = g.find((x) => x.status === 'approved') || g[0];
      g.filter((x) => x !== keep).forEach((x) => remove.set(x.id, 'дубль'));
      notes.push({ kind: 'dup', text: `Дубль: «${byId[g[0].pid].t}» добавили ${g.map((x) => member(x.by).name).join(' и ')}. Оставим один, у ${member(keep.by).name}.` });
    });
    const similar = [['headphones', 'headphones-anc'], ['armchair', 'lounge-chair'], ['tee-white', 'tee-black']];
    similar.forEach(([a, b]) => {
      const A = live.find((x) => x.pid === a && !remove.has(x.id)), B = live.find((x) => x.pid === b && !remove.has(x.id));
      if (A && B) {
        const drop = A.status === 'approved' && B.status !== 'approved' ? B : (B.status === 'approved' && A.status !== 'approved' ? A : (price(A) > price(B) ? A : B));
        const keep = drop === A ? B : A;
        remove.set(drop.id, 'похожая покупка');
        notes.push({ kind: 'conflict', text: `Похожие покупки: «${byId[A.pid].t}» (${member(A.by).name}) и «${byId[B.pid].t}» (${member(B.by).name}). Предлагаю оставить «${byId[keep.pid].t}».` });
      }
    });
    let set = live.filter((x) => !remove.has(x.id));
    let total = set.reduce((sum, x) => sum + price(x), 0);
    if (total > f.budget) {
      const pend = set.filter((x) => x.status === 'pending').sort((a, b) => price(b) - price(a));
      for (const x of pend) { if (total <= f.budget) break; remove.set(x.id, 'не влезает в бюджет'); total -= price(x); }
      notes.push({ kind: 'budget', text: total <= f.budget ? `Без лишнего всё влезает в бюджет ${rub(f.budget)}.` : `Даже без лишнего выходит ${rub(total)} при лимите ${rub(f.budget)}. Поднимите лимит или уберите что-то из одобренного.` });
    }
    set = live.filter((x) => !remove.has(x.id));
    const before = live.reduce((sum, x) => sum + price(x), 0);
    return { notes, set, remove, total: set.reduce((sum, x) => sum + price(x), 0), saved: before - set.reduce((sum, x) => sum + price(x), 0) };
  }

  function familyAIHTML() {
    const a = familyAnalysis();
    const ic = { dup: 'box', conflict: 'users', budget: 'tag' };
    return `<div class="stack">
      <span class="ai__badge">${icon('spark')}BuyTogether AI</span>
      <h2 class="sheet__title">Проверка общего списка</h2>
      ${a.notes.length ? `<ul class="aicompat">${a.notes.map((n) => `<li>${icon(ic[n.kind])}${esc(n.text)}</li>`).join('')}</ul>` : '<p class="note">Дублей и конфликтов нет, список в порядке.</p>'}
      <div class="sum">
        <div class="sum__row"><span>Оптимальный набор</span><span>${a.set.length} ${plural(a.set.length, 'товар', 'товара', 'товаров')}</span></div>
        ${a.set.map((x) => `<div class="sum__row"><span>${esc(byId[x.pid].t)} · ${esc(member(x.by).name)}</span><span>${rub(retail(byId[x.pid]).total)}</span></div>`).join('')}
        <div class="sum__row sum__row--total"><span>Итого</span><span>${rub(a.total)}</span></div>
        ${a.saved ? `<p class="sum__note">Экономия ${rub(a.saved)} на дублях и лишнем.</p>` : ''}
      </div>
      ${a.remove.size ? '<button class="btn btn--lime btn--wide" type="button" data-fam-apply>Применить: убрать лишнее</button>' : ''}
      <p class="note">Каждый, чья позиция убрана, получит уведомление с объяснением.</p>
    </div>`;
  }

  /* ---------- UsagePreview: сколько места займёт мебель ---------- */
  const room = { pid: null, W: 340, L: 420, x: 20, y: 0, rot: 0, open: false, drag: null };
  function roomFoot() {
    const dm = DIMS[room.pid];
    const depth = room.open && dm.openD ? dm.openD : dm.d;
    const side = room.rot % 180 === 0;
    const w = side ? dm.w : dm.d, h = side ? dm.d : dm.w;
    let fx = room.x, fy = room.y, fw = w, fh = h;
    const extra = depth - dm.d;
    if (extra) {
      if (room.rot === 0) fh += extra;
      if (room.rot === 90) { fw += extra; fx -= extra; }
      if (room.rot === 180) { fh += extra; fy -= extra; }
      if (room.rot === 270) fw += extra;
    }
    return { x: room.x, y: room.y, w, h, fx, fy, fw, fh };
  }
  function roomClamp() {
    const f = roomFoot();
    const dx = f.fx < 0 ? -f.fx : (f.fx + f.fw > room.W ? room.W - (f.fx + f.fw) : 0);
    const dy = f.fy < 0 ? -f.fy : (f.fy + f.fh > room.L ? room.L - (f.fy + f.fh) : 0);
    room.x += dx; room.y += dy;
  }
  function roomRender() {
    const box = $('#roomBox');
    if (!box) return;
    roomClamp();
    const f = roomFoot();
    const gaps = { left: Math.round(f.fx), right: Math.round(room.W - f.fx - f.fw), top: Math.round(f.fy), bottom: Math.round(room.L - f.fy - f.fh) };
    const front = { 0: 'bottom', 90: 'left', 180: 'top', 270: 'right' }[room.rot];
    const pass = gaps[front];
    const door = { x: 30, y: room.L - 85, w: 85, h: 85 };
    const blocksDoor = f.fx < door.x + door.w && f.fx + f.fw > door.x && f.fy + f.fh > door.y;
    const st = blocksDoor ? ['bad', 'Перекрывает дверь'] : (pass >= 70 ? ['ok', `Проход ${pass} см — хватает`] : (pass >= 50 ? ['warn', `Узко: ${pass} см, пройти боком`] : ['bad', `Прохода нет: ${pass} см`]));
    const open = room.open && DIMS[room.pid].openD;
    box.innerHTML = `<svg class="room__svg" id="roomSvg" viewBox="-30 -30 ${room.W + 60} ${room.L + 60}" role="img" aria-label="План комнаты">
      <rect x="0" y="0" width="${room.W}" height="${room.L}" class="room__floor"/>
      <path d="M${door.x} ${room.L} h${door.w}" class="room__doorgap"/>
      <path d="M${door.x} ${room.L} A ${door.w} ${door.w} 0 0 1 ${door.x + door.w} ${room.L - door.w} L ${door.x} ${room.L - door.w} Z" class="room__door"/>
      <text x="${door.x + 6}" y="${room.L - 8}" class="room__lbl">дверь</text>
      <text x="${room.W / 2}" y="-10" class="room__dim" text-anchor="middle">${room.W} см</text>
      <text x="-12" y="${room.L / 2}" class="room__dim" text-anchor="middle" transform="rotate(-90 -12 ${room.L / 2})">${room.L} см</text>
      <g class="room__item room__item--${st[0]}" id="roomItem">
        ${open ? `<rect x="${f.fx}" y="${f.fy}" width="${f.fw}" height="${f.fh}" rx="6" class="room__open"/>` : ''}
        <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="8" class="room__body"/>
        <text x="${f.x + f.w / 2}" y="${f.y + f.h / 2 + 5}" text-anchor="middle" class="room__name">${esc(DIMS[room.pid].name)}</text>
      </g>
    </svg>`;
    $('#roomStatus').className = `room__status room__status--${st[0]}`;
    $('#roomStatus').textContent = st[1];
    $('#roomGaps').textContent = `До стен: слева ${gaps.left} · справа ${gaps.right} · сверху ${gaps.top} · снизу ${gaps.bottom} см`;
    const svg = $('#roomSvg');
    const toCm = (e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
    $('#roomItem').addEventListener('pointerdown', (e) => { const c = toCm(e); room.drag = { dx: c.x - room.x, dy: c.y - room.y }; svg.setPointerCapture(e.pointerId); });
    svg.addEventListener('pointermove', (e) => {
      if (!room.drag) return;
      const c = toCm(e);
      room.x = Math.round((c.x - room.drag.dx) / 5) * 5; room.y = Math.round((c.y - room.drag.dy) / 5) * 5;
      const keep = room.drag; roomRender(); room.drag = keep;
    });
    svg.addEventListener('pointerup', () => { room.drag = null; });
  }
  function openRoom(pid) {
    Object.assign(room, { pid, x: 20, y: 0, rot: 0, open: false, drag: null });
    const dm = DIMS[pid];
    openSheet(`<div class="stack room">
      <span class="ai__badge">${icon('ruler')}UsagePreview</span>
      <h2 class="sheet__title">${esc(byId[pid].t)} в вашей комнате</h2>
      <div class="form">
        <label class="field"><span>Ширина комнаты, см</span><input id="roomW" type="number" min="150" max="1000" step="10" value="${room.W}"></label>
        <label class="field"><span>Длина комнаты, см</span><input id="roomL" type="number" min="150" max="1000" step="10" value="${room.L}"></label>
      </div>
      <div class="room__box" id="roomBox"></div>
      <p class="room__status" id="roomStatus" aria-live="polite"></p>
      <p class="note" id="roomGaps"></p>
      <div class="pdextra">
        <button class="btn btn--line btn--sm" type="button" data-room-rot>Повернуть</button>
        ${dm.openD ? `<button class="btn btn--lime btn--sm" type="button" data-room-open>Разложить · глубина ${dm.openD} см</button>` : ''}
      </div>
      <p class="note">Перетащите ${esc(dm.name.toLowerCase())} по плану. Удобный проход — от 70 см. Размеры ${dm.w}×${dm.d} см${dm.openD ? `, в разложенном виде ${dm.w}×${dm.openD} см` : ''}.</p>
    </div>`, { narrow: true });
    roomRender();
  }

  /* ---------- Заказ по ссылке: площадка, предварительная цена, заявка агенту ---------- */
  // На сервере то же самое делают /api/link/lookup, /api/link/estimate и /api/link/requests.
  // Из сообщения «поделиться» (Taobao, Poizon и др.) берём первую ссылку.
  const extractUrl = (text) => (text.match(/https?:\/\/[^\s<>"'，。、】」）)]+/i) || [text])[0];
  let linkCalc = null;
  // pre — уже известное из чата ИИ: цена, размер, количество, название, скриншот (data URL), если ссылки нет.
  function openLinkCalc(text, pre = {}) {
    const url = text ? extractUrl(text) : '';
    const found = url && PLATFORMS.find(([re]) => re.test(url));
    const automatic = Boolean(pre.quote || (url && !pre.price && live.on && live.site?.market && !['1688', 'Pinduoduo'].includes(found?.[1])));
    linkCalc = { automatic, quote: pre.quote || null, text, url, platform: found ? found[1] : '', title: pre.title || '', photo: pre.photo || '', prefilled: Boolean(pre.price), priced: Boolean(pre.price) };
    openSheet(`<div class="linkcalc">
      <h2 class="sheet__title">${url ? 'Цена по ссылке' : 'Заказ по скриншоту'}</h2>
      ${url ? `<p class="linkcalc__src"><span class="linkcalc__tag">${found ? esc(found[1]) : 'Ссылка'}</span><span class="mono">${esc(url)}</span></p>` : ''}
      ${pre.photo ? `<img class="linkcalc__photo" src="${esc(pre.photo)}" alt="Скриншот товара">` : ''}
      ${pre.title && !url ? `<p><b>${esc(pre.title)}</b></p>` : ''}
      <div id="lcMarket"></div>
      <p class="note" id="lcNote">${pre.quote ? 'Цена размера подтверждена на площадке. Проверьте количество и оформляйте заказ.' : pre.price ? 'Цена и размер подставлены — проверьте и оформляйте. Перед выкупом агент сверит цену и наличие.' : 'Получим фото и доступные размеры с площадки. Выберите размер — проверим цену автоматически.'}</p>
      <form class="stack" id="linkCalcForm" novalidate>
        <div class="grid2">
          <label class="field" ${automatic ? 'hidden' : ''}><span>Цена на ${found ? esc(found[1]) : 'площадке'}, ¥</span><input id="lcPrice" ${automatic ? 'readonly' : ''} type="number" min="1" step="0.01" inputmode="decimal" placeholder="Цена вашего размера, например 635" value="${pre.price ? esc(String(pre.price)) : ''}"></label>
          <label class="field"><span>Количество</span><input id="lcQty" type="number" min="1" max="10000" step="1" inputmode="numeric" value="${Math.max(1, parseInt(pre.qty, 10) || 1)}"></label>
          <label class="field ${automatic ? '' : 'field--full'}"><span>${automatic ? 'Размер или вариант' : 'Размер, цвет или вариант'}</span><input id="lcSize" placeholder="42, чёрный" autocomplete="off" value="${esc(variantLabel(pre.size || ''))}" data-raw-size="${esc(pre.size || '')}" data-size-label="${esc(variantLabel(pre.size || ''))}"></label>
        </div>
        <div class="quick lcsizes" id="lcSizes" hidden></div>
        ${pre.photo || automatic ? '' : '<label class="field"><span>Или скриншот с ценой вашего размера: прочитаем её сами</span><input id="lcPhoto" type="file" accept="image/*"></label>'}
        <img class="linkcalc__photo" id="lcPreview" alt="" hidden>
        <div id="lcQuoteStatus" aria-live="polite"></div>
        <div id="lcSum"></div>
        <label class="field"><span>Телефон, Telegram или почта</span><input id="lcContact" autocomplete="tel" placeholder="+7 …, @username или почта" value="${esc(tgContact())}"></label>
        ${consentHTML('lcConsent')}
        <div class="stack" id="lcActions"></div>
      </form></div>`);
    linkCalcOut();
    if (pre.item) renderMarket(pre.item);
    if (automatic && (!pre.quote || Date.parse(pre.quote.expires_at) <= Date.now())) checkLinkPrice();
    else if (!pre.item && url && !pre.price) loadMarket(text, found ? found[1] : '');
  }
  // Боевой сайт с подключённым Apify: сами смотрим товар на Poizon/Taobao и подставляем цену.
  // Короткие ссылки «поделиться» (dw4.co, m.tb.cn) раскрывает сервер, поэтому спрашиваем его про любую ссылку, кроме 1688 и Pinduoduo.
  async function loadMarket(text, platform) {
    if (linkCalc?.automatic) return checkLinkPrice();
  }
  function renderMarket(item) {
    const box = $('#lcMarket');
    if (!box) return;
    box.innerHTML = `<div class="lcmarket">${marketPhotosHTML((item.images || []).slice(0, 1))}<div><b>${esc(item.title || 'Товар с площадки')}</b><span>${item.price_cny ? 'от ' + cny(item.price_cny) : ''}</span></div></div>${item.images?.length > 1 ? `<details><summary>Ещё фото (${item.images.length - 1})</summary>${marketPhotosHTML(item.images.slice(1))}</details>` : ''}`;
    if (linkCalc) { linkCalc.title = item.title || linkCalc.title; linkCalc.item = item; }
    const chips = $('#lcSizes'), sizes = item.sizes || [];
    if (chips) {
      chips.hidden = !sizes.length;
      chips.innerHTML = sizes.map((x) => typeof x === 'string' ? x : x.size).filter(Boolean).slice(0, 60).map((x, i) => `<button class="chip" type="button" data-lc-size="${esc(x)}" aria-pressed="${linkSizeValue() === x}">${esc(variantLabel(x, i))}</button>`).join('');
    }
  }
  async function checkLinkPrice() {
    const state = linkCalc;
    clearTimeout(state?.checkTimer);
    if (!state || !$('#lcSize') || !state.automatic) return;
    const size = linkSizeValue(), qty = Math.min(10000, Math.max(1, parseInt($('#lcQty').value, 10) || 1));
    const version = (state.version || 0) + 1; state.version = version;
    state.quote = null; state.checking = true; $('#lcPrice').value = ''; linkCalcOut();
    const alive = () => linkCalc === state && state.version === version && !$('#sheet').hidden && !!$('#lcQuoteStatus');
    const update = (result) => {
      if (!alive()) return;
      state.result = result; state.checking = ['pending', 'working'].includes(result.status);
      $('#lcQuoteStatus').innerHTML = (result.quote ? '<p class="note">Цена размера подтверждена на площадке. Действует 5 минут.</p>' : marketStatusHTML(result, size)) + (!state.checking && !result.quote && size ? '<button class="btn btn--line btn--sm" type="button" data-lc-recheck>Проверить ещё раз</button>' : '');
      if (result.item) renderMarket(result.item);
      if (result.url) state.url = result.url;
      if (result.quote) { state.quote = result.quote; $('#lcPrice').value = result.quote.price_cny; }
      linkCalcOut();
    };
    try { await lookupMarket(state.text || state.url, size, qty, update, alive); }
    catch (e) { update({ status: 'failed', note: e.message }); }
  }
  function linkSizeValue() {
    const input = $('#lcSize');
    return input ? (input.dataset.rawSize && input.value === input.dataset.sizeLabel ? input.dataset.rawSize : input.value.trim()) : '';
  }
  function pickLinkSize(size) {
    const input = $('#lcSize'); if (!input) return;
    input.value = variantLabel(size); input.dataset.rawSize = size; input.dataset.sizeLabel = input.value;
    $$('#lcSizes [data-lc-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lcSize === size)));
    if (linkCalc?.automatic) checkLinkPrice();
  }
  // Скриншот из чата хранится как data URL: для отправки заказа превращаем в файл.
  function dataUrlFile(url) {
    const [head, b64] = String(url).split(',');
    const bin = atob(b64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], 'screenshot.jpg', { type: (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg' });
  }
  function linkCalcFile() {
    const input = $('#lcPhoto');
    if (input && input.files[0]) return input.files[0];
    return linkCalc && linkCalc.photo ? dataUrlFile(linkCalc.photo) : undefined;
  }
  function linkCalcOut() {
    const box = $('#lcSum');
    if (!box) return;
    const price = Number($('#lcPrice').value);
    const qty = Math.max(1, Math.min(10000, parseInt($('#lcQty').value, 10) || 1));
    if (linkCalc?.automatic) {
      const quote = linkCalc.quote;
      if (!quote || Date.parse(quote.expires_at) <= Date.now()) {
        box.innerHTML = '<p class="note">' + (linkCalc.checking ? 'Ожидаем подтверждения цены…' : 'Выберите размер и проверьте цену.') + '</p>';
        $('#lcActions').innerHTML = '<button class="btn btn--ghost btn--wide" type="submit" data-act="ask">Уточнить у агента</button>';
        return;
      }
      box.innerHTML = `<div class="sum"><div class="sum__row"><span>Размер ${esc(quote.size)} · ${qty} шт.</span><b>${rub(Number(quote.total_rub))}</b></div></div>`;
      $('#lcActions').innerHTML = `<button class="btn btn--lime btn--wide" type="submit" data-act="order">Передать менеджеру</button>`;
      return;
    }
    $('#lcActions').innerHTML = linkActionsHTML(price, qty);
    if (LINK_RATE === null) { box.innerHTML = '<p class="note">Цену рассчитает менеджер.</p>'; return; }
    if (!(price > 0)) {
      box.innerHTML = '<div class="sum"><div class="sum__note">Впишите цену вашего размера в юанях или пришлите скриншот — здесь появится расчёт.</div></div>';
      return;
    }
    box.innerHTML = linkSumHTML(price, qty);
  }
  // Есть цена — главная кнопка «Заказать», спросить агента можно и без заказа. Нет цены — только к агенту.
  function linkActionsHTML(price, qty = 1) {
    return price > 0 && LINK_RATE !== null
      ? `<button class="btn btn--lime btn--wide" type="submit" data-act="order">${live.on ? 'Передать менеджеру' : 'Заказать за ' + rub(linkTotal(price, qty))}</button>
         <button class="btn btn--ghost btn--wide" type="submit" data-act="ask">Сначала спросить агента</button>`
      : '<button class="btn btn--lime btn--wide" type="submit" data-act="ask">Отправить агенту</button>';
  }
  function linkTotal(price, qty = 1) { return round10(price * qty * LINK_RATE * (1 + LINK_FEE) + LINK_DELIVERY * qty); }
  function linkSumHTML(price, qty = 1) {
    if (LINK_RATE === null) return '<p class="note">Цену рассчитает менеджер.</p>';
    return `<div class="sum">
      <div class="sum__row"><span>Товар · ${cny(price * qty)} по ${LINK_RATE} ₽</span><span>${rub(price * qty * LINK_RATE)}</span></div>
      <div class="sum__row"><span>Логистика · ${rub(LINK_DELIVERY)} за штуку</span><span>${rub(LINK_DELIVERY * qty)}</span></div>
      ${LINK_FEE ? `<div class="sum__row"><span>Сервисный сбор</span><span>${rub(price * qty * LINK_RATE * LINK_FEE)}</span></div>` : ''}
      <div class="sum__row sum__row--total"><span>Примерно</span><span>${rub(linkTotal(price, qty))}</span></div>
      <div class="sum__note">Менеджер проверит наличие и подтвердит итоговую цену до оплаты.</div>
    </div>`;
  }
  // Цена со скриншота. В превью на claude.ai картинку читает Claude, на сервере — Yandex Vision + YandexGPT.
  async function readPricePhoto(file) {
    if (live.on) return readPricePhotoLive(file);
    const sample = await aiSample();
    if (!sample) return null;
    try {
      const limits = await sample.limits();
      if (!limits || !limits.images) return null;
      const data = await sample.json(
        'Это скриншот товара с китайской площадки (Poizon/Dewu, Taobao, 1688, Pinduoduo). Найди цену, которую покупатель платит за товар, '
        + 'в юанях (обычно самая крупная цифра со знаком ¥ или 元; не зачёркнутая и не цена доставки) и коротко назови товар по-русски. '
        + 'Ответь только JSON: {"price_cny": число или null, "title_ru": "название или пустая строка"}. Если цены не видно, price_cny = null.',
        { images: [file], modelTier: 'quick' });
      const price = Number(data && data.price_cny);
      return price > 0 ? { price, title: String(data.title_ru || '') } : null;
    } catch (e) {
      return null; // нет разрешения или ошибка: дальше путь через менеджера
    }
  }
  function sendLinkRequest() {
    const input = $('#lcContact');
    const field = input.closest('.field');
    const bad = !input.value.trim();
    field.classList.toggle('is-error', bad);
    if (bad) { toast('Укажите телефон, Telegram или почту'); input.focus(); return; }
    if (!consentOk('lcConsent')) return;
    const price = Number($('#lcPrice').value);
    const extra = [linkSizeValue(), price > 0 ? `цена ${cny(price)} × ${$('#lcQty').value || 1}` : ''].filter(Boolean).join(', ');
    if (live.on) {
      linkRequestLive({ text: linkCalc.text, price, qty: Math.max(1, parseInt($('#lcQty').value, 10) || 1), size: linkSizeValue(),
        contact: input.value.trim(), file: linkCalcFile() }, $('#lcActions [data-act=ask]'));
      return;
    }
    closeSheet();
    openChat();
    sendChat(`Посчитайте цену${linkCalc.platform ? ` с ${linkCalc.platform}` : ''}: ${linkCalc.url}${extra ? ` (${extra})` : ''}`,
      'Приняла заявку. Проверю продавца и пришлю точную цену в рублях с доставкой в течение 15 минут.');
  }

  // Товар по фото. Видим цену — сразу считаем «¥ × 13 ₽ + 1000 ₽», цены нет — уточняет менеджер.
  // На сервере цену читает Yandex Vision (/api/link/photo), в превью — Claude через sample с картинкой.
  function openPhotoOrder() {
    openSheet(`<div class="linkcalc">
      <h2 class="sheet__title">Товар по фото</h2>
      <p class="note">Пришлите скриншот с Poizon, Taobao, 1688. Если цена видна, покажем предварительный расчёт. Менеджер проверит товар и согласует заказ.</p>
      <form class="stack" id="photoOrderForm" novalidate>
        <label class="field"><span>Фото или скриншот</span><input id="poPhoto" type="file" accept="image/*"></label>
        <img class="linkcalc__photo" id="poPreview" alt="" hidden>
        <p class="note" id="poStatus" hidden></p>
        <label class="field"><span>Цена на скриншоте, ¥</span><input id="poPrice" type="number" min="1" step="0.01" inputmode="decimal" placeholder="Заполним сами, если увидим"></label>
        <div id="poSum"></div>
        <label class="field"><span>Размер, цвет, количество (если важно)</span><input id="poNote" placeholder="42, чёрный, 1 шт." autocomplete="off"></label>
        <label class="field"><span>Телефон, Telegram или почта</span><input id="poContact" autocomplete="tel" placeholder="+7 …, @username или почта" value="${esc(tgContact())}"></label>
        ${consentHTML('poConsent')}
        <div class="stack" id="poActions">${linkActionsHTML(0)}</div>
      </form></div>`, { narrow: true });
  }
  function sendPhotoOrder() {
    const photo = $('#poPhoto').files[0];
    if (!photo) { toast('Добавьте фото товара'); return; }
    const input = $('#poContact');
    const bad = !input.value.trim();
    input.closest('.field').classList.toggle('is-error', bad);
    if (bad) { toast('Укажите телефон, Telegram или почту'); input.focus(); return; }
    if (!consentOk('poConsent')) return;
    const note = $('#poNote').value.trim();
    const price = Number($('#poPrice').value);
    const title = photoTitle;
    if (live.on) {
      linkRequestLive({ text: '', price, qty: 1, contact: input.value.trim(), comment: [title, note].filter(Boolean).join(' · '),
        file: photo }, $('#poActions [data-act=ask]'));
      return;
    }
    closeSheet();
    openChat();
    if (price > 0) {
      sendChat(`Фото товара${title ? `: ${title}` : ''}, ${cny(price)}${note ? ` (${note})` : ''}`,
        `Посчитала: примерно ${rub(linkTotal(price))} с логистикой (${cny(price)} по ${LINK_RATE} ₽ + ${rub(LINK_DELIVERY)}). Проверю продавца и наличие и подтвержу цену.`);
    } else {
      sendChat(`Фото товара${note ? ` (${note})` : ''}`, 'Не увидела цену на фото — уточню у менеджера и пришлю цену в чате.');
    }
  }
  let photoTitle = '';
  function photoSumOut() {
    const price = Number($('#poPrice').value);
    $('#poSum').innerHTML = price > 0 ? linkSumHTML(price) : '';
    $('#poActions').innerHTML = linkActionsHTML(price);
  }

  // Заказ по ссылке или фото: оплата сразу по расчёту. На сервере это /api/link/order —
  // обычный заказ, часть «по ссылке» агент выкупает сам на площадке после оплаты.
  function contactOk(input) {
    const bad = !input.value.trim();
    input.closest('.field').classList.toggle('is-error', bad);
    if (bad) { toast('Укажите телефон, Telegram или почту'); input.focus(); }
    return !bad;
  }
  function placeLinkOrder({ title, url, price, qty, note, contact, file, btn, quoteId }) {
    if (live.on) { linkOrderLive({ title, url, price, qty, note, contact, file, quoteId }, btn); return; }
    const total = linkTotal(price, qty);
    const num = orderNum();
    state.orders.unshift({
      num, date: 'сегодня', items: [], link: { title, url }, total, ship: 'auto', now: 0, fresh: true, unpaid: true,
      stages: [
        { t: 'Ждёт оплаты', d: 'цена держится 24 часа' },
        { t: 'Агент сверяет цену и наличие и выкупает', d: 'дороже — напишем до выкупа, нет товара — вернём деньги' },
        { t: 'Склад в Китае: фото и вес', d: '' },
        { t: 'Отправка в Россию', d: '' },
        { t: 'Пункт выдачи', d: '' },
      ],
    });
    store.save();
    openPaySheet(num, `
        <div class="sum__row"><span>${esc(title)}${note ? ` · ${esc(note)}` : ''}</span><span>${qty} шт</span></div>
        <div class="sum__row"><span>Товар · ${cny(price * qty)} по ${LINK_RATE} ₽</span><span>${rub(price * qty * LINK_RATE)}</span></div>
        <div class="sum__row"><span>Логистика</span><span>${rub(LINK_DELIVERY * qty)}</span></div>`, total,
      'Перед выкупом агент сверит цену и наличие. Окажется дороже — напишем до выкупа, и вы решите: доплатить или вернуть деньги. Нет товара — вернём деньги полностью.');
  }
  function openPaySheet(num, rows, total, note = '') {
    closeSheet();
    openSheet(`<div class="stack">
      <h2 class="sheet__title">Заказ ${num}</h2>
      <div class="sum">${rows}
        <div class="sum__row sum__row--total"><span>К оплате</span><span>${rub(total)}</span></div>
        ${note ? `<div class="sum__note">${note}</div>` : ''}
      </div>
      <button class="btn btn--lime btn--wide" type="button" data-pay-link="${num}">Оплатить ${rub(total)}</button>
      <p class="note">В превью деньги не списываются: оплата картой и СБП появится после подключения эквайринга. Не оплатите сейчас — заказ ждёт в профиле 24 часа.</p>
    </div>`, { narrow: true });
  }
  function payLinkOrder(num) {
    const o = state.orders.find((x) => x.num === num);
    if (o) { o.unpaid = false; o.now = 1; o.stages[0] = { t: 'Оплачен', d: 'сегодня' }; store.save(); }
    openSheet(`<div class="success">
      <span class="success__ic">${icon('check')}</span>
      <h2 class="sheet__title">Заказ ${num} оплачен</h2>
      <p>${o && o.link ? 'Агент сверит цену и наличие на площадке и выкупит товар. Если что-то не так, напишет вам до выкупа.' : 'Уже заказываем у поставщика. Когда товар приедет на склад в Китае, пришлём фото и вес.'}</p>
      <div class="buyrow"><a class="btn btn--lime" href="#profile" data-close>Мой заказ</a><button class="btn btn--ghost" type="button" data-open-chat>Чат с агентом</button></div>
    </div>`, { narrow: true });
  }
  function orderFromLinkCalc() {
    if (linkCalc?.automatic && (!linkCalc.quote || Date.parse(linkCalc.quote.expires_at) <= Date.now())) { checkLinkPrice(); return; }
    const price = Number($('#lcPrice').value);
    if (!(price > 0)) { toast('Впишите цену в юанях'); $('#lcPrice').focus(); return; }
    if (!contactOk($('#lcContact')) || !consentOk('lcConsent')) return;
    const qty = Math.max(1, Math.min(10000, parseInt($('#lcQty').value, 10) || 1));
    placeLinkOrder({ title: (linkCalc.title || (linkCalc.platform ? `Товар с ${linkCalc.platform}` : linkCalc.url ? 'Товар по ссылке' : 'Товар по скриншоту')).slice(0, 200), url: linkCalc.url,
      price, qty, note: linkSizeValue(), contact: $('#lcContact').value.trim(), file: linkCalcFile(),
      quoteId: linkCalc.quote?.id, btn: $('#lcActions [data-act=order]') });
  }
  function orderFromPhoto() {
    if (!$('#poPhoto').files[0]) { toast('Добавьте фото товара'); return; }
    const price = Number($('#poPrice').value);
    if (!(price > 0)) { toast('Впишите цену в юанях'); $('#poPrice').focus(); return; }
    if (!contactOk($('#poContact')) || !consentOk('poConsent')) return;
    placeLinkOrder({ title: photoTitle || 'Товар по фото', url: '', price, qty: 1, note: $('#poNote').value.trim(),
      contact: $('#poContact').value.trim(), file: $('#poPhoto').files[0], btn: $('#poActions [data-act=order]') });
  }
  async function onPricePhoto(file, priceInput, statusEl, after) {
    photoTitle = '';
    if (statusEl) { statusEl.hidden = false; statusEl.textContent = 'Смотрим на цену…'; }
    const found = await readPricePhoto(file);
    if (!document.contains(priceInput)) return;
    if (found) {
      priceInput.value = found.price;
      photoTitle = found.title;
      if (statusEl) statusEl.textContent = `Увидели цену ${cny(found.price)}${found.title ? ` · ${found.title}` : ''}. Если ошиблись, поправьте.`;
    } else if (statusEl) {
      statusEl.textContent = 'Цену не увидели: впишите её сами или отправьте как есть — уточним у менеджера.';
    }
    after();
  }

  /* ---------- Cookie и согласие на обработку персональных данных ---------- */
  // Согласие — отдельная галочка, по умолчанию не отмечена: так требует 152-ФЗ (с 1 сентября 2025 года
  // согласие оформляется отдельно от других документов). Без неё форму не отправить.
  const consentHTML = (id) => `<label class="consent" for="${id}">
      <input type="checkbox" id="${id}">
      <span>Даю <a href="consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a> по <a href="privacy.html" target="_blank" rel="noopener">политике ASTTA</a></span>
    </label>`;
  function consentOk(id) {
    const box = $('#' + id);
    if (!box) return true;
    const bad = !box.checked;
    box.closest('.consent').classList.toggle('is-error', bad);
    if (bad) { toast('Отметьте согласие на обработку персональных данных'); box.focus(); }
    return !bad;
  }
  // Выбор по cookie: 'all' — можно включать аналитику, 'necessary' — только то, без чего сайт не работает.
  const COOKIES_KEY = 'astta-cookies';
  function cookieChoice() {
    try { return localStorage.getItem(COOKIES_KEY); } catch (e) { return null; }
  }
  function initCookies() {
    const box = $('#cookies');
    if (box && !cookieChoice()) box.hidden = false;
  }
  function setCookies(choice) {
    try { localStorage.setItem(COOKIES_KEY, choice); } catch (e) { /* не запомнили — спросим в следующий раз */ }
    $('#cookies').hidden = true;
    toast(choice === 'all' ? 'Спасибо! Аналитику можно будет включить' : 'Только необходимые cookie');
  }
  // Для аналитики на боевом сайте: подключать Яндекс Метрику, только если вернулось true.
  window.asttaAnalyticsAllowed = () => cookieChoice() === 'all';

  /* ---------- Оформление: фирменное, светлое, Бимбо ---------- */
  const THEMES = {
    dark: { name: 'Фирменная', about: 'Тёмный фон и лаймовые акценты', color: '#070b09' },
    light: { name: 'Светлая', about: 'Светлый фон и фирменный лайм', color: '#f3f5ee' },
    bimbo: { name: 'Бимбо', about: 'Фуксия, чёрный, белый и леопард', color: '#fff8fc' },
  };
  function applyTheme(theme) {
    if (!Object.hasOwn(THEMES, theme)) theme = 'dark';
    document.documentElement.setAttribute('data-ui', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEMES[theme].color);
    const label = `Оформление: ${THEMES[theme].name}. Выбрать тему`;
    $$('[data-theme-toggle]').forEach((b) => { b.setAttribute('aria-label', label); b.title = label; });
    $$('[data-theme-label]').forEach((el) => { el.textContent = `Тема: ${THEMES[theme].name}`; });
  }
  function chooseTheme(theme) {
    if (!Object.hasOwn(THEMES, theme)) return;
    try { localStorage.setItem('astta-theme', theme); } catch (e) { /* выбор действует до перезагрузки */ }
    applyTheme(theme);
    closeSheet();
  }
  function openThemePicker() {
    const fromMenu = !$('#menu').hidden;
    closeMenu();
    if (fromMenu) $('#menuBtn').focus();
    const current = document.documentElement.getAttribute('data-ui');
    openSheet(`<div class="stack"><h2 class="sheet__title">Ваше настроение</h2>
      <p class="note">Выберите оформление ASTTA. Выбор сохранится на этом устройстве.</p>
      <div class="theme-options" role="group" aria-label="Оформление">${Object.entries(THEMES).map(([id, theme]) => `
        <button class="theme-option" type="button" data-theme="${id}" aria-pressed="${current === id}">
          <span class="theme-preview theme-preview--${id}" aria-hidden="true"></span>
          <span class="theme-option__copy"><b>${theme.name}</b><small>${theme.about}</small></span>${icon('check')}
        </button>`).join('')}</div></div>`, { narrow: true });
  }

  /* ---------- Шторка, меню, уведомления ---------- */
  let lastFocus = null;
  function openSheet(html, opts = {}) {
    const sheet = $('#sheet');
    const panel = $('.sheet__panel', sheet);
    if (sheet.hidden) lastFocus = document.activeElement;
    if (!opts.keepProduct) pdState = html.includes('class="pd"') ? pdState : null;
    panel.classList.toggle('is-narrow', !!opts.narrow);
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
  /* ---------- Навигация ---------- */
  const VIEWS = ['home', 'catalog', 'trends', 'feed', 'reviews', 'cart', 'profile'];
  let currentView = 'home';
  function syncHomeNav() {
    const nav = $('#homeSectionNav');
    if (!nav) return;
    nav.hidden = currentView !== 'home';
    document.documentElement.classList.toggle('is-home', currentView === 'home');
    let active = null;
    const links = [...nav.querySelectorAll('a')];
    links.forEach((a) => {
      const section = document.getElementById(a.hash.slice(1));
      a.hidden = !section || section.hidden;
      if (!a.hidden && (!active || section.getBoundingClientRect().top <= 140)) active = a;
      a.removeAttribute('aria-current');
    });
    if (currentView === 'home' && scrollY + innerHeight >= document.documentElement.scrollHeight - 2) {
      active = links.filter((a) => !a.hidden).at(-1) || active;
    }
    if (active) active.setAttribute('aria-current', 'location');
  }
  function initHomeNav() {
    let pending = false;
    const update = () => {
      if (pending || currentView !== 'home') return;
      pending = true;
      requestAnimationFrame(() => { pending = false; syncHomeNav(); });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }
  function route() {
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch (e) { hash = ''; }
    if (hash === 'homeReviews') {
      history.replaceState(history.state, '', '#reviews');
      hash = 'reviews';
    }
    const view = VIEWS.includes(hash) ? hash : 'home';
    const changed = view !== currentView;
    currentView = view;
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $$('[data-nav]').forEach((a) => {
      if (a.dataset.nav === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    syncHomeNav();
    if (view === 'catalog') renderCatalog();
    document.documentElement.classList.toggle('is-trends', view === 'trends');
    if (view === 'trends') enterTrends(); else leaveTrends();
    if (view === 'feed') renderFeed();
    if (view === 'cart') renderCart();
    if (view === 'profile') renderProfile();
    closeMenu();
    closeSheet();
    if (hash === 'support' && live.on) { openAgentLive(); return; }
    if (!VIEWS.includes(hash) && hash) {
      const target = document.getElementById(hash);
      if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }));
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
    if (currentView === 'trends') renderTrends(true);
    updateCartCount();
  }

  /* ---------- Герой ---------- */
  const HERO_TAGS = ['Новинки', 'Проверка заказа'];
  function initHero() {
    const hero = $('#hero');
    const imgs = $$('.hero__media img', hero);
    const texts = $$('.htext', hero);
    const dots = $$('.hero__dots button', hero);
    const n = imgs.length;
    let i = 0, timer = null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const show = (k) => {
      i = (k + n) % n;
      imgs.forEach((el, j) => el.classList.toggle('is-on', j === i));
      texts.forEach((el, j) => el.classList.toggle('is-on', j === i));
      dots.forEach((d, j) => d.setAttribute('aria-selected', String(j === i)));
      $('#heroNum').textContent = String(i + 1).padStart(2, '0');
      $('#heroTag').textContent = HERO_TAGS[i];
    };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => { if (!reduce && !timer) timer = setInterval(() => show(i + 1), 6000); };
    dots.forEach((d, j) => d.addEventListener('click', () => { stop(); show(j); }));
    let x0 = null;
    hero.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    hero.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) { stop(); show(i + (dx < 0 ? 1 : -1)); }
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  }

  /* ---------- События ---------- */
  function onClick(e) {
    const t = e.target.closest('button, a, [data-close], [data-close-menu]');
    if (!t) return;
    const d = t.dataset;
    if (!allowDemo && !live.on && d.siteRetry === undefined) { e.preventDefault(); return; }

    if (d.close !== undefined) { if (t.tagName !== 'A') e.preventDefault(); closeSheet(); if (t.tagName !== 'A') return; }
    if (d.closeMenu !== undefined) { closeMenu(); if (t.tagName !== 'A' && d.openChat === undefined) return; }
    if (d.photoOrder !== undefined) { openPhotoOrder(); return; }
    if (d.lcSize !== undefined) { pickLinkSize(d.lcSize); return; }
    if (d.siteRetry !== undefined) { startLive(); return; }
    if (d.catalogRetry !== undefined) { loadRestOfCatalog(catalogLoad.failed); return; }
    if (d.filterReset !== undefined) { resetCatalogFilters(); return; }
    if (d.filterApply !== undefined) { if (window.innerWidth < 900) $('#catalogFilters').open = false; $('#catalogGrid').scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (d.removeFilter !== undefined) {
      const key = d.removeFilter;
      if (key === 'price') { catalogFilters.min = ''; catalogFilters.max = ''; }
      else if (key === 'sale' || key === 'fresh') catalogFilters[key] = false;
      else if (FACETS.includes(key)) catalogFilters[key].delete(d.value);
      renderCatalog(); return;
    }
    if (d.catalogMore !== undefined) { catalogView.limit += 60; renderCatalog(); return; }
    if (d.detailRetry !== undefined && pdState) { loadProductDetail(byId[pdState.id]); return; }
    if (d.color !== undefined && pdState) { pdState.color = d.color; rerenderProduct(); return; }
    if (d.fav !== undefined) { toggleFav(d.fav); return; }
    if (d.gotoChip) { state.cat = d.gotoChip; go('catalog'); renderCatalog(); return; }
    if (d.aiScroll !== undefined) { const rail = document.getElementById('aiCards' + d.aiScroll); if (rail) scrollAiRail(rail, Number(d.step)); return; }
    if (d.galStep !== undefined) {
      const track = $('[data-gal-track]');
      if (track) galleryGo(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) + Number(d.galStep));
      return;
    }
    if (d.aiMarketSize !== undefined) {
      const size = t.dataset.sizeValue, url = t.dataset.marketUrl;
      const entry = { reply: 'Проверяю цену размера ' + size, images: [] };
      ai.log.push(entry); aiRender();
      api('/api/link/market-jobs', { method: 'POST', body: { text: url, size, qty: 1 } })
        .then((job) => watchAiMarketJob(job.id, entry))
        .catch((e) => { entry.reply = e.message; aiRender(); });
      return;
    }
    if (d.retrySession !== undefined) { loadMe(); renderProfile(); return; }
    if (d.editNickname !== undefined && live.me) {
      openSheet(`<form class="stack" id="nicknameForm">
        <h2 class="sheet__title">Ник в ASTTA</h2>
        <label class="field"><span>Ваш ник</span><input name="nickname" required minlength="3" maxlength="24"
          autocomplete="off" value="${esc(live.me.nickname || '')}"></label>
        <p class="note">От 3 до 24 символов. Русские или латинские буквы, цифры, дефис и подчёркивание.</p>
        <p class="note" data-nickname-error role="alert" hidden></p>
        <button class="btn btn--lime" type="submit">Сохранить ник</button>
      </form>`, { narrow: true });
      return;
    }
    if (d.reviewWrite !== undefined) { openCustomerReviewForm(); return; }
    if (d.reviewsMore !== undefined) { loadCustomerReviews(); return; }
    if (d.reviewsRetry !== undefined) { loadCustomerReviews(true); return; }
    if (d.mkSize !== undefined) { pdState.size = d.mkSize; checkMarketSize(); return; }
    if (t.matches('[data-mk-check]')) { checkMarketSize(); return; }
    if (t.matches('[data-mk-link]')) { const p = byId[pdState.id]; openLinkCalc(p.market.url, { title: p.t }); return; }
    if (t.matches('[data-lc-recheck]')) { checkLinkPrice(); return; }
    if (d.productTelegram !== undefined && pdState) {
      const p = byId[pdState.id];
      if (p.wheel && !pdState.wheelChosen) {
        $('[data-wheel-diameter]', $('#sheetBody'))?.focus();
        toast('Выберите диаметр и параметры диска'); return;
      }
      if ((p.market?.sizes?.length || p.grid?.length) && !pdState.size) {
        $('[data-mk-size], [data-size]', $('#sheetBody'))?.focus();
        toast('Выберите размер'); return;
      }
      if (!isMarket(p) && p.colors?.length && !pdState.color) { toast('Выберите цвет'); return; }
      const username = (live.site?.order_manager_telegram || live.site?.telegram_bot || 'astta_shop_bot').trim().replace(/^@/, '');
      if (!/^[A-Za-z0-9_]+$/.test(username)) { toast('Не удалось открыть Telegram'); return; }
      const message = ['Заявка ASTTA', p.t, 'Код товара: ' + p.id,
        pdState.size ? 'Размер: ' + pdState.size : '', pdState.color ? 'Цвет: ' + pdState.color : '',
        'Количество: ' + pdState.qty, p.market?.url || '', 'Подтвердите, пожалуйста, наличие и итоговую цену.', 'Согласен на обработку контактных данных для ответа на заявку.']
        .filter(Boolean).join('\n');
      const url = 'https://t.me/' + username + '?text=' + encodeURIComponent(message);
      if (live.tma && window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
      else location.assign(url);
      return;
    }
    if (d.mkOrder !== undefined) { orderMarketProduct(); return; }
    if (d.galGo !== undefined) { galleryGo(Number(d.galGo)); return; }
    if (d.mkAi !== undefined) { const p = byId[pdState.id]; closeSheet(); aiAsk(`Расскажи коротко про ${p.t}: для кого, плюсы и минусы по обзорам, как садится по размеру`); return; }
    if (d.orderOpen !== undefined) { openOrder(d.orderOpen); return; }
    if (d.ofilter) { prof.ofilter = d.ofilter; renderProfile(); return; }
    if (d.viewedClear !== undefined) { clearViewed(); return; }
    if (d.aiContinue !== undefined) { continueAiChat(); return; }
    if (d.aiHistoryClear !== undefined) { clearAiHistory(); return; }
    if (d.avaReset !== undefined) { resetAvatar(); return; }
    if (d.payMethod) { setPayMethod(d.payMethod); return; }

    if (d.filter) {
      state.cat = d.filter; state.q = ''; $('#q').value = '';
      if (location.hash === '#catalog') { e.preventDefault(); renderCatalog(); window.scrollTo({ top: 0, behavior: 'instant' }); }
      else if (t.tagName !== 'A') go('catalog');
      return;
    }
    if (d.open) { openProduct(d.open); return; }
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
    if (d.inc !== undefined || d.dec !== undefined) {
      const idx = Number(d.inc ?? d.dec);
      const item = cart()[idx];
      if (!item) return;
      const p = byId[item.id];
      const step = 1;
      const min = isSupplier() ? p.tiers[0][0] : 1;
      item.qty = Math.max(min, item.qty + (d.inc !== undefined ? step : -step));
      store.save(); updateCartCount(); renderCart();
      return;
    }
    if (d.remove !== undefined) { cart().splice(Number(d.remove), 1); store.save(); updateCartCount(); renderCart(); return; }
    if (t.matches('[data-pay-link]')) { payLinkOrder(t.dataset.payLink); return; }
    if (t.matches('[data-checkout]')) { openSheet(checkoutHTML(), { narrow: true }); return; }
    if (d.wheelDiameter && pdState) {
      pdState.wheelDiameter = d.wheelDiameter; pdState.wheelChosen = false; pdState.size = null;
      rerenderProduct(); return;
    }
    if (d.wheelVariant && pdState) {
      const current = byId[pdState.id], p = byId[d.wheelVariant];
      if (!p?.wheel || p.wheel.key !== current.wheel?.key || p.wheel.diameter !== pdState.wheelDiameter) return;
      pdState.id = p.id; pdState.wheelChosen = true; pdState.size = p.filterSizes[0] || p.wheel.size; pdState.color = null;
      pdState.ship = shipFor(p); pdState.qty = Math.max(pdState.qty, isSupplier() && hasWholesale(p) ? p.tiers[0][0] : 1);
      rerenderProduct(); loadProductDetail(p); return;
    }
    if (d.size) { pdState.size = d.size; pdState.needSize = false; rerenderProduct(); return; }
    if (d.pdQty) {
      const p = byId[pdState.id];
      const min = isSupplier() && hasWholesale(p) ? p.tiers[0][0] : 1;
      pdState.qty = Math.max(min, pdState.qty + Number(d.pdQty));
      rerenderProduct();
      return;
    }
    if (t.matches('[data-pd-add]')) {
      const p = byId[pdState.id];
      if (p.wheel && !pdState.wheelChosen) { toast('Выберите диаметр и параметры диска'); $('[data-wheel-diameter]', $('#sheetBody'))?.focus(); return; }
      if (((live.on && (p.grid || []).length) || (!live.on && !isSupplier() && p.sizes)) && !pdState.size) { toast('Выберите размер'); $('.sizes button', $('#sheetBody'))?.focus(); return; }
      if ((p.colors || []).length && !pdState.color) { toast('Выберите цвет'); return; }
      const prevShip = state.ship;
      if (!p.bulky) state.ship = pdState.ship;
      const id = pdState.id, size = pdState.size, color = pdState.color, qty = pdState.qty, proof = pdState.proof;
      closeSheet();
      addToCart(id, { size, color, qty, proof });
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
    if (d.quick) { sendChat(d.quick); return; }
    if (d.proof !== undefined && pdState) { pdState.proof = !pdState.proof; rerenderProduct(); return; }
    if (d.room) { openRoom(d.room); return; }
    if (d.roomRot !== undefined) { room.rot = (room.rot + 90) % 360; roomRender(); return; }
    if (d.roomOpen !== undefined) { room.open = !room.open; t.textContent = room.open ? 'Сложить' : `Разложить · глубина ${DIMS[room.pid].openD} см`; roomRender(); return; }
    if (d.proofReport) {
      const pr = PROOF.clothes;
      openSheet(`<div class="stack">
        <span class="ai__badge">${icon('check')}ASTTA Proof</span>
        <h2 class="sheet__title">Отчёт о проверке</h2>
        <p class="note">Заказ ${esc(d.proofReport)} · проверено 15 октября в 18:10 · склад TT Логистики в Гуанчжоу · инспектор Ли Вэй · отчёт PR-${esc(d.proofReport.slice(-5))}</p>
        <ul class="aicompat">${['Замеры совпадают с таблицей: грудь 104 см, длина 66 см (M)', ...pr.list.slice(1)].map((x) => `<li>${icon('check')}${esc(x)}</li>`).join('')}</ul>
        <div class="proofphotos">${['leather-jacket', 'stage-aisles', 'stage-box', 'tee-white'].map((ph) => `<button class="tl__photo" type="button" data-photo="${ph}" data-caption="Фото из отчёта Proof"><img src="${img(ph)}" alt="" width="120" height="90" loading="lazy"></button>`).join('')}</div>
        <p class="note">Это фото и замеры именно вашего экземпляра. Если бы что-то не совпало, агент заменил бы товар до отправки в Россию.</p>
      </div>`, { narrow: true });
      return;
    }
    if (t.matches('[data-fam-ai]')) { openSheet(familyAIHTML(), { narrow: true }); return; }
    if (t.matches('[data-fam-apply]')) {
      const a = familyAnalysis();
      state.family.items.forEach((it) => { if (a.remove.has(it.id)) it.status = 'declined'; });
      store.save(); closeSheet(); renderProfile();
      toast(`Убрали ${a.remove.size} ${plural(a.remove.size, 'позицию', 'позиции', 'позиций')}, экономия ${rub(a.saved)}`);
      return;
    }
    if (d.ptab) { state.ptab = d.ptab; renderProfile(); return; }
    if (t.matches('[data-tg-login]')) { openTgLogin(); return; }
    if (d.emailLogin !== undefined) { openEmailAuth(); return; }
    if (d.emailLink !== undefined) { openEmailAuth('link'); return; }
    if (d.emailChange !== undefined) { renderEmailAddress(); return; }
    if (d.emailResend !== undefined) { requestEmailCode(t); return; }
    if (d.theme) { chooseTheme(d.theme); return; }
    if (t.matches('[data-theme-toggle]')) { openThemePicker(); return; }
    if (t.matches('[data-cookies]')) { setCookies(t.dataset.cookies); return; }
    if (t.matches('[data-cookies-open]')) { $('#cookies').hidden = false; $('#cookies .btn').focus(); return; }
    if (t.matches('[data-tg-logout]')) { if (live.on) { logoutLive(); return; } state.tg = null; store.save(); renderProfile(); toast('Вы вышли'); return; }
    if (d.measures !== undefined) { state.ptab = 'size'; closeSheet(); go('profile'); return; }
    if (d.familyAdd) {
      state.family.items.unshift({ id: 'f' + Date.now(), pid: d.familyAdd, by: 'me', status: 'approved', payer: 'me' });
      store.save(); toast('Добавили в семейный список');
      return;
    }
    if (d.famOk || d.famNo) {
      const it = state.family.items.find((x) => x.id === (d.famOk || d.famNo));
      if (it) it.status = d.famOk ? 'approved' : 'declined';
      store.save(); renderProfile();
      toast(d.famOk ? 'Одобрено' : `Отклонено, ${it ? member(it.by).name : 'автор'} получит уведомление`);
      return;
    }
    if (t.matches('[data-fam-checkout]')) {
      const list = cart();
      state.family.items.filter((x) => x.status === 'approved').forEach((x) => {
        const p = byId[x.pid];
        const size = p.sizes ? '?' : null;
        const ex = list.find((c) => c.id === x.pid && c.size === size);
        if (ex) ex.qty += 1; else list.push({ id: x.pid, qty: 1, size });
      });
      store.save(); updateCartCount(); toast('Одобренные товары в корзине');
      return;
    }
    if (d.poolNew) { openSheet(poolNewHTML(d.poolNew), { narrow: true }); updatePoolShare(); return; }
    if (d.poolOpen) { const g = state.pools.find((x) => x.id === d.poolOpen); if (g) openSheet(poolHTML(g), { narrow: true }); return; }
    if (d.poolCopy) {
      const text = `Скидываемся на подарок в ASTTA: astta.ru/gift/${d.poolCopy}`;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Ссылка скопирована, отправьте её друзьям')).catch(() => toast(text));
      else toast(text);
      return;
    }
    if (d.poolSim) {
      const g = state.pools.find((x) => x.id === d.poolSim);
      const names = ['Лёша', 'Оля', 'Макс', 'Ира', 'Дэн', 'Соня', 'Гоша', 'Лиза'];
      const wishes = ['Счастья и побольше музыки', '', 'Ты лучший!', 'С праздником!', ''];
      if (g && g.paid.length < g.people) {
        g.paid.push({ name: names[g.paid.length % names.length], wish: wishes[g.paid.length % wishes.length] });
        store.save(); openSheet(poolHTML(g), { narrow: true });
        if (currentView === 'profile') renderProfile();
      }
      return;
    }
    if (d.rv) { pdState.rv = d.rv; rerenderProduct(); return; }
    if (t.matches('[data-rv-now]')) { toast('Спасибо! Форма отзыва появится в рабочей версии'); return; }
    if (d.aiTab) {
      $$('[data-ai-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aiTab === d.aiTab)));
      $$('[data-ai-pane]').forEach((el) => { el.hidden = el.dataset.aiPane !== d.aiTab; });
      return;
    }
    if (d.buildGoal) {
      $$('[data-build-goal]').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
      $('#buildGoal').value = d.buildGoal;
      return;
    }
    if (d.buildCur) {
      const toRub = d.buildCur === 'rub';
      if ((build.cur === 'rub') === toRub) return;
      const range = $('#buildRange');
      const val = Number(range.value);
      build.cur = d.buildCur;
      if (toRub) { range.min = 10000; range.max = 500000; range.step = 5000; range.value = Math.round(val * EUR / 5000) * 5000; }
      else { range.min = 100; range.max = 5000; range.step = 50; range.value = Math.round(val / EUR / 50) * 50; }
      $$('[data-build-cur]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.buildCur === d.buildCur)));
      buildOut();
      return;
    }
    if (d.trend !== undefined) { tr.start = Number(d.trend); go('trends'); return; }
    if (d.reelStep) { showPhoto(tr.photo + Number(d.reelStep)); return; }
    if (d.reelHeart !== undefined) { likeReel(Number(d.reelHeart)); return; }
    if (d.reelSave !== undefined) {
      const t = TRENDS[Number(d.reelSave)];
      const on = !tr.saved.has(t.id);
      if (on) tr.saved.add(t.id); else tr.saved.delete(t.id);
      $$(`[data-reel-save="${d.reelSave}"]`).forEach((b) => { b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); $('span', b).textContent = on ? 'Есть' : 'В избр.'; });
      toast(on ? 'Ролик в избранном' : 'Убрали из избранного');
      return;
    }
    if (d.reelComments !== undefined) { trendComments(Number(d.reelComments)); return; }
    if (d.reelShare !== undefined) {
      const t = TRENDS[Number(d.reelShare)];
      const text = `Смотри на ASTTA: @${t.author} — ${t.text}`;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Ссылка на ролик скопирована')).catch(() => toast('Не удалось скопировать'));
      else toast('Не удалось скопировать');
      return;
    }
    if (d.reelSound !== undefined) {
      tr.muted = !tr.muted;
      $$('.reel__video').forEach((v) => { v.muted = tr.muted; });
      $$('[data-reel-sound]').forEach((b) => { b.innerHTML = `${icon(tr.muted ? 'mute' : 'sound')}<span>${tr.muted ? 'Звук' : 'Тише'}</span>`; });
      return;
    }
    if (d.follow) {
      const a = d.follow;
      if (tr.followed.has(a)) tr.followed.delete(a); else tr.followed.add(a);
      const on = tr.followed.has(a);
      $$(`[data-follow="${a}"]`).forEach((b) => { b.classList.toggle('is-followed', on); $('i', b).innerHTML = icon(on ? 'check' : 'plus'); });
      toast(on ? `Вы подписаны на @${a}` : `Вы отписались от @${a}`);
      return;
    }
    if (d.trendUpload !== undefined) { trendUpload(); return; }
    if (d.aiOpen !== undefined) { openAI(); return; }
    if (d.aiAsk) { aiAsk(d.aiAsk); return; }
    if (d.aiStop !== undefined) { if (ai.ctl) ai.ctl.abort(); return; }
    if (d.aiFill) { const i = $('#aiChatInput'); if (i) { i.value = ''; i.placeholder = d.aiFill; i.focus(); } return; }
    if (d.aiMore) {
      const m = ai.log[Number(d.aiIdx)];
      if (m && m.source === 'demo' && m.demoPlan && m.demoPlan.kind === 'cart' && ai.last) {
        const { q, plan, variant } = ai.last;
        if (d.aiMore === 'cheaper') aiAsk(q, { label: 'Дешевле', budget: Math.floor(plan.total * 0.8) });
        else aiAsk(q, { label: 'Другой вариант', budget: plan.budget, variant: variant + 1 });
      } else {
        aiAsk(d.aiMore === 'cheaper' ? 'Сделай дешевле, задача та же' : 'Предложи другой вариант под ту же задачу', { label: d.aiMore === 'cheaper' ? 'Дешевле' : 'Другой вариант' });
      }
      return;
    }
    if (d.aiOrder !== undefined) {
      const o = (ai.log[Number(d.aiOrder)] || {}).order;
      if (!o) return;
      openLinkCalc(o.url || '', { price: o.price_cny, size: o.size, qty: o.qty, title: o.title, quote: o.quote, item: o.item, photo: o.url ? '' : ai.lastPhoto });
      return;
    }
    if (d.aiAdd !== undefined) {
      const m = ai.log[Number(d.aiAdd)];
      if (!m || !m.cat || !m.cat.length) return;
      if (live.on) {
        const first = m.cat.find(({ id }) => byId[id] && !isMarket(byId[id]) && (!isSupplier() || hasWholesale(byId[id])));
        if (first) { openProduct(first.id, { needSize: true }); toast('Выберите варианты товара перед добавлением'); }
        else toast('Откройте карточку товара, чтобы указать цену своего варианта');
        return;
      }
      const list = cart();
      m.cat.forEach(({ id }) => {
        const p = byId[id];
        const qty = isSupplier() ? p.tiers[0][0] : 1;
        const size = !isSupplier() && p.sizes ? '?' : null;
        const item = list.find((x) => x.id === id && x.size === size);
        if (item) item.qty += qty; else list.push({ id, qty, size });
      });
      store.save(); updateCartCount();
      toast(`В корзине ${m.cat.length} ${plural(m.cat.length, 'товар', 'товара', 'товаров')} от ASTTA AI`);
      return;
    }
    if (d.aiCustom !== undefined) {
      const m = ai.log[Number(d.aiCustom)];
      if (!m || !m.custom) return;
      const lines = m.custom.map((c) => `• ${c.name}${c.est_cny ? ` (~${c.est_cny} ¥)` : ''}`).join('\n');
      openChat('sz');
      sendChat(`Индивидуальный заказ от ASTTA AI:\n${lines}`, 'Приняла индивидуальный заказ. Проверю наличие у поставщиков, пришлю фото и точную цену с доставкой в течение часа. Платить сейчас не нужно.');
      return;
    }
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
    if (t.dataset.facet) {
      const values = catalogFilters[t.dataset.facet];
      if (t.checked) values.add(t.value); else values.delete(t.value);
      renderCatalog(); return;
    }
    if (t.dataset.filterFlag) { catalogFilters[t.dataset.filterFlag] = t.checked; renderCatalog(); return; }
    if (t.id === 'aiPhoto') { aiPhotoPicked(t.files[0]); t.value = ''; return; }
    if (t.id === 'avaInput') { uploadAvatar(t.files[0]); t.value = ''; return; }
    if (t.type === 'radio' && t.closest('.ship')) {
      $$('.shipopt', t.closest('.ship')).forEach((l) => l.classList.toggle('is-on', $('input', l).checked));
    }
    if (t.id === 'tgConsent' && live.on) {
      if (t.checked) mountTgWidget(); else { const box = $('#tgWidget'); if (box) box.innerHTML = ''; }
      return;
    }
    if (t.name === 'cartShip') { state.ship = t.value; store.save(); renderCart(); renderHome(); return; }
    if (t.name === 'pdShip') { pdState.ship = t.value; rerenderProduct(); return; }
    if (t.id === 'sort') { state.sort = t.value; renderCatalog(); return; }
    if (t.dataset.famPayer) {
      const it = state.family.items.find((x) => x.id === t.dataset.famPayer);
      if (it) it.payer = t.value;
      store.save(); renderProfile();
      return;
    }
    if (t.id === 'famBudget') { state.family.budget = Number(t.value); store.save(); renderProfile(); return; }
  }

  function onInput(e) {
    const t = e.target;
    if (t.id === 'emailCode') { t.value = t.value.replace(/[^0-9]/g, '').slice(0, 6); return; }
    if (t.dataset.facetSearch) { applyFacetSearch(t.dataset.facetSearch); return; }
    if (t.id === 'priceMin' || t.id === 'priceMax') { catalogFilters[t.id === 'priceMin' ? 'min' : 'max'] = t.value; renderCatalog(); return; }
    if (t.id === 'q') { state.q = t.value; renderCatalog(); }
    if (t.id === 'buildRange') buildOut();
    if (t.id === 'plPeople') updatePoolShare();
    if (linkCalc?.automatic && ['lcSize', 'lcQty'].includes(t.id)) {
      linkCalc.version = (linkCalc.version || 0) + 1; linkCalc.quote = null; $('#lcPrice').value = ''; linkCalcOut();
      clearTimeout(linkCalc.checkTimer);
      const checkingState = linkCalc;
      linkCalc.checkTimer = setTimeout(() => { if (linkCalc === checkingState) checkLinkPrice(); }, 700);
    } else if (t.id === 'lcPrice' || t.id === 'lcQty') linkCalcOut();
    if (t.id === 'poPrice') photoSumOut();
    if (t.id === 'poPhoto') {
      const file = t.files[0];
      const pv = $('#poPreview');
      if (file && file.type.startsWith('image/')) { pv.src = URL.createObjectURL(file); pv.hidden = false; } else pv.hidden = true;
      if (file && file.type.startsWith('image/')) onPricePhoto(file, $('#poPrice'), $('#poStatus'), photoSumOut);
    }
    if (t.id === 'lcPhoto') {
      const file = t.files[0];
      const pv = $('#lcPreview');
      if (file && file.type.startsWith('image/')) { pv.src = URL.createObjectURL(file); pv.hidden = false; } else pv.hidden = true;
      if (file && file.type.startsWith('image/')) onPricePhoto(file, $('#lcPrice'), null, linkCalcOut);
    }
    if (t.id === 'solveFile') {
      const file = t.files[0];
      $('#solveName').textContent = file ? file.name : 'Фото или видео проблемы';
      const pv = $('#solvePreview');
      if (file && file.type.startsWith('image/')) { pv.src = URL.createObjectURL(file); pv.hidden = false; } else pv.hidden = true;
    }
    if (t.id === 'roomW' || t.id === 'roomL') {
      const v = Math.max(150, Math.min(1000, parseInt(t.value, 10) || 0));
      if (t.value && v) { room[t.id === 'roomW' ? 'W' : 'L'] = v; roomRender(); }
    }
  }

  function onSubmit(e) {
    const f = e.target;
    e.preventDefault();
    if (!allowDemo && !live.on) return;
    if (f.id === 'emailAddressForm') {
      if (!f.reportValidity() || !consentOk('emailConsent')) return;
      emailFlow.email = f.elements.email.value.trim();
      requestEmailCode($('button[type=submit]', f)); return;
    }
    if (f.id === 'emailVerifyForm') { verifyEmailCode(f); return; }
    if (f.id === 'customerReviewForm') { submitCustomerReview(f); return; }
    if (f.id === 'supportForm') { submitSupport(f); return; }
    if (f.id === 'solveForm') {
      const file = $('#solveFile').files[0];
      const text = $('#solveText').value.trim();
      if (!file && !text) { toast('Добавьте фото или видео, или опишите проблему'); return; }
      (async () => {
        let blob = null;
        try { blob = file ? (file.type.startsWith('video/') ? await frameFromVideo(file) : file) : null; } catch (err) { blob = null; }
        const thumb = blob ? URL.createObjectURL(blob) : null;
        aiAsk(`ASTTA Solve: ${text || 'что сломалось на фото и что купить, чтобы починить?'}`, { label: text || 'Что тут сломалось?', thumb, images: blob ? [blob] : null, solve: true });
      })();
      return;
    }
    if (f.id === 'nicknameForm') { saveNickname(f); return; }
    if (f.id === 'meForm') {
      saveProfile({ phone: $('#meePhone').value, city: $('#meeCity').value, delivery_address: $('#meeAddr').value },
        $('button[type=submit]', f), 'Данные сохранены');
      return;
    }
    if (f.id === 'measForm') {
      const num = (id) => { const v = parseFloat(String($(id).value).replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null; };
      state.measures = { height: num('#msHeight'), chest: num('#msChest'), waist: num('#msWaist'), hips: num('#msHips'), foot: num('#msFoot') };
      store.save();
      if (live.me) { saveProfile({ measures: state.measures }, $('button[type=submit]', f), 'Мерки сохранены в профиле'); return; }
      toast('Мерки сохранены');
      return;
    }
    if (f.id === 'poolForm') {
      const who = $('#plWho').value.trim();
      if (!who) { $('#plWho').closest('.field').classList.add('is-error'); $('#plWho').focus(); return; }
      const people = Math.max(2, Math.min(50, parseInt($('#plPeople').value, 10) || 2));
      const g = { id: 'g' + String(Date.now()).slice(-6), pid: f.dataset.pid, who, occasion: $('#plOcc').value, date: $('#plDate').value || new Date().toISOString().slice(0, 10), people,
        paid: [{ name: 'Вы', wish: $('#plWish').value.trim() }] };
      state.pools.unshift(g);
      store.save();
      openSheet(poolHTML(g), { narrow: true });
      toast('Подарок создан, ваша часть оплачена');
      return;
    }
    if (f.id === 'buildForm') {
      const goal = $('#buildGoal').value.trim() || 'Игровая комната';
      const val = Number($('#buildRange').value);
      const money = build.cur === 'eur' ? `${nf.format(val)} €` : `${nf.format(val)} ₽`;
      aiAsk(`ASTTA Build: ${goal} за ${money}. Собери полный комплект, чтобы ничего не пришлось докупать.`, { label: `Build: ${goal} за ${money}` });
      return;
    }
    if (f.id === 'tCommentForm') {
      const input = $('#tCommentInput');
      const text = input.value.trim();
      if (!text) return;
      const t = TRENDS[Number(f.dataset.reel)];
      (t.myComments = t.myComments || []).unshift(text);
      trendComments(Number(f.dataset.reel));
      return;
    }
    if (f.id === 'trendForm') {
      const file = $('#tfFile').files[0];
      if (!file) { $('#tfFile').closest('.field').classList.add('is-error'); toast('Выберите видео или фото'); return; }
      const url = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      TRENDS.unshift({ id: 'u' + Date.now(), author: 'вы', name: 'Вы', buyer: true, video: isVideo ? url : null, photos: isVideo ? [] : [url],
        text: $('#tfText').value.trim() || 'Новый ролик', tags: ['#astta'], likes: 0, comments: 0, views: 'новое', products: [$('#tfProduct').value] });
      closeSheet();
      tr.rendered = false; tr.start = 0; tr.active = -1;
      renderHome();
      if (currentView === 'trends') enterTrends(); else go('trends');
      toast('Ролик опубликован');
      return;
    }
    if (f.id === 'aiForm' || f.id === 'aiChatForm') {
      const input = $(f.id === 'aiForm' ? '#aiInput' : '#aiChatInput');
      const q = input.value;
      input.value = '';
      if (!q.trim()) { toast('Напишите, что подобрать'); input.focus(); return; }
      aiAsk(q);
      return;
    }
    if (f.id === 'linkForm') {
      const input = $('#linkInput');
      const link = input.value.trim();
      if (!link) { toast('Вставьте ссылку на товар'); input.focus(); return; }
      input.value = '';
      openLinkCalc(link);
      return;
    }
    const act = e.submitter && e.submitter.dataset.act;
    if (f.id === 'linkCalcForm') { if (act === 'order') orderFromLinkCalc(); else sendLinkRequest(); return; }
    if (f.id === 'photoOrderForm') { if (act === 'order') orderFromPhoto(); else sendPhotoOrder(); return; }
    if (f.id === 'checkoutForm') { submitCheckout(); return; }
    if (f.id === 'tgLoginForm') { submitTgLogin(); return; }
    if (f.id === 'chatForm') { const i = $('#chatInput'); sendChat(i.value); i.value = ''; return; }
  }

  function onKey(e) {
    if (e.target.matches('.aicards') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'Home' || e.key === 'End') e.target.scrollLeft = e.key === 'Home' ? 0 : e.target.scrollWidth;
      else scrollAiRail(e.target, e.key === 'ArrowLeft' ? -1 : 1);
      requestAnimationFrame(() => updateAiRail(e.target));
      return;
    }
    if (e.key === 'Escape') { closeSheet(); closeMenu(); }
  }

  /* ---------- Сервер: каталог, лента, заказы, вход ---------- */
  // В рабочем окружении товары, цены, заказы и вход берём только из /api. Открыт как файл или локально без
  // сервера — работает на демо-данных выше. Отзывы о товарах, ролики и лайки пока только демо: на боевом сайте
  // их не показываем, чтобы не выдавать придуманное за настоящее.
  const live = { on: false, site: null, csrf: '', tma: '', me: null, orders: [], loaded: false };
  const GUEST_KEY = 'astta-orders';

  async function api(path, opts = {}) {
    const headers = { Accept: 'application/json' };
    if (live.tma) headers.Authorization = 'tma ' + live.tma;
    let body = opts.body;
    const method = opts.method || 'GET';
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    if (method !== 'GET' && !live.tma) {
      if (!live.csrf) live.csrf = (await api('/api/auth/csrf')).csrf;
      headers['X-CSRFToken'] = live.csrf;
    }
    const res = await fetch(path, { method, headers, body, credentials: 'same-origin', signal: AbortSignal.timeout(path.includes('/ai/') || path.includes('/link/') ? 180000 : 20000) });
    let data = null;
    try { data = await res.json(); } catch (e) { /* пустой ответ */ }
    if (!res.ok) {
      const d = data && data.detail;
      const err = new Error(typeof d === 'string' ? d : (res.status === 429 ? 'Слишком много запросов, подождите минуту' : 'Не получилось, попробуйте ещё раз'));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const guestTokens = () => { try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]').filter((t) => typeof t === 'string'); } catch (e) { return []; } };
  function rememberOrder(token) {
    try { localStorage.setItem(GUEST_KEY, JSON.stringify([token, ...guestTokens().filter((t) => t !== token)].slice(0, 30))); } catch (e) { /* без хранилища заказ виден в боте */ }
  }

  const relTime = (iso) => {
    const d = new Date(iso);
    const min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 60) return min <= 1 ? 'только что' : `${min} мин назад`;
    if (min < 60 * 24) return `${Math.round(min / 60)} ч назад`;
    if (min < 60 * 48) return 'вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };
  const dateTime = (iso) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function liveProduct(c) {
    const tiers = (c.tiers || []).map((t) => [t.min_qty, Number(t.price_cny)]).sort((a, b) => a[0] - b[0]);
    return {
      wheel: c.wheel || null,
      brandGroup: c.brand_group || brandFamily(c.brand || c.market?.brand || ''), filterSizeOptions: c.size_options || [],
      brand: c.brand || c.market?.brand || '', filterSizes: c.sizes?.length ? c.sizes : (c.market?.sizes || []).map((v) => v.size), filterColors: c.colors || [],
      id: c.slug, t: c.title, cat: c.category, sup: c.supplier_code, supName: c.supplier,
      cny: Number(c.price_cny), kg: Number(c.weight_kg) || 0.5,
      tiers,
      rating: Number(c.rating) || 0, reviews: c.reviews_count || 0, sold: c.sold_count || 0,
      sizes: c.size_grid || null, sale: c.sale_percent || 0, isNew: !!c.is_new, bulky: !!c.bulky,
      desc: '', image: c.image || '',
      feeR: c.fee_retail != null ? Number(c.fee_retail) : null, feeW: c.fee_wholesale != null ? Number(c.fee_wholesale) : null,
      market: c.market || null, retailRub: c.retail_rub != null ? Number(c.retail_rub) : null,
      live: true,
    };
  }

  // Тарифы сервера раскладываем по трём местам сайта: обычная доставка, быстрая и сборный груз для мебели.
  function applyShipping(methods) {
    const regular = methods.filter((m) => !m.for_bulky_only);
    const slots = {
      auto: regular.find((m) => m.is_default) || regular[0],
      air: regular.find((m) => m !== (regular.find((x) => x.is_default) || regular[0])),
      cargo: methods.find((m) => m.for_bulky_only),
    };
    Object.entries(slots).forEach(([key, m]) => {
      if (!m) return;
      SHIP[key] = { name: m.name, perKg: Number(m.rub_per_kg), days: [m.days_min, m.days_max], icon: key === 'air' ? 'plane' : 'truck', code: m.code };
    });
    if (!slots.air) delete SHIP.air;
  }

  function replaceAll(target, items) { target.splice(0, target.length, ...items); }

  async function loadLive() {
    if (!/^https?:$/.test(location.protocol)) return;
    // Сайт показываем по первой странице товаров (60 самых популярных), остальные страницы догружаем в фоне:
    // раньше ждали весь каталог по очереди, и 10+ секунд на экране висела демо-витрина.
    let site, sups, cats, feed, first;
    try {
      site = await api('/api/site');
    } catch (e) {
      if (allowDemo && !live.on) return;
      throw e;
    }
    [sups, cats, feed, first] = await Promise.all([api('/api/suppliers'), api('/api/categories'),
      api('/api/feed?page_size=60'), api('/api/products?sort=popular&page_size=60&page=1')]);
    if (!site.shipping?.some((m) => !m.for_bulky_only && m.is_default)) throw new Error('Не настроена доставка');
    const items = first.items;

    live.on = true; live.site = site;
    catalogLoad.total = first.total;
    $('#siteError').hidden = true;
    if (site.rate) { RATE = Number(site.rate); rateText = RATE.toFixed(2).replace('.', ','); }
    // Курса ещё нет — не показываем демо-курс как настоящий.
    $$('[data-rate]').forEach((el) => { const box = el.closest('.rate'); if (box) box.hidden = !site.rate; });
    FEE_RETAIL = Number(site.retail_fee); FEE_OPT = Number(site.wholesale_fee);
    LINK_RATE = site.link_rate == null ? (site.rate == null ? null : Number(site.rate)) : Number(site.link_rate);
    LINK_FEE = site.link_rate == null ? FEE_RETAIL : 0;
    if (site.link_delivery_rub) LINK_DELIVERY = Number(site.link_delivery_rub);
    applyShipping(site.shipping || []);
    if (!SHIP[state.ship]) state.ship = 'auto';

    Object.keys(SUPPLIERS).forEach((k) => delete SUPPLIERS[k]);
    sups.forEach((s) => {
      SUPPLIERS[s.code] = { name: s.name, about: s.about || s.city || '', short: s.code.slice(0, 2).toUpperCase(), followers: 0,
        fact: s.fact_days || (SHIP.auto ? SHIP.auto.days : [18, 25]) };
    });
    applyLiveProducts(items, cats);
    replaceAll(POSTS, feed.items.map((f) => ({
      id: f.id, sup: f.supplier_code, supName: f.supplier, pid: f.product ? f.product.slug : null, time: relTime(f.created_at),
      auto: false, kind: f.kind, likes: 0, comments: 0, text: f.text, photo: f.images[0] || '',
    })));
    // Демо-содержимое, которое ссылается на демо-товары, на боевом сайте убираем.
    DEMO_ORDERS.length = 0;
    replaceAll(TRENDS, []);
    tr.rendered = false;
    AI_INTENTS.forEach((i) => { i.slots = i.slots.map((sl) => sl.filter((id) => byId[id])).filter((sl) => sl.length); });
    replaceAll(AI_INTENTS, AI_INTENTS.filter((i) => i.slots.length));
    filterCarts();
    state.family.items = state.family.items.filter((it) => byId[it.pid]);
    state.pools = state.pools.filter((g) => byId[g.pid]);
    state.tg = null;

    document.documentElement.classList.add('is-live');
    $$('[data-rate]').forEach((el) => { el.textContent = rateText; });
    $('#menuCats').innerHTML = CATS.map((c) => `<a href="#catalog" data-cat="${esc(c.id)}" data-close-menu>${esc(c.name)}</a>`).join('');
    if (live.tma) state.tg = live.tmaUser;
    renderAll();
    updateCartCount();
    document.documentElement.classList.remove('is-booting');
    loadRestOfCatalog(Array.from({ length: Math.max(0, Math.ceil(first.total / 60) - 1) }, (_, i) => i + 2));
    if (location.hash === '#support') openAgentLive();
    await loadMe();
    loadCustomerReviews(true);
  }

  function applyLiveProducts(items, cats) {
    const products = items.map(liveProduct).filter((p) => SUPPLIERS[p.sup]);
    replaceAll(PRODUCTS, products);
    Object.keys(byId).forEach((k) => delete byId[k]);
    products.forEach((p) => { byId[p.id] = p; });
    const demoCat = Object.fromEntries(CATS.map((c) => [c.id, c.img]));
    replaceAll(CATS, cats.map((c) => {
      if (c.slug.toLowerCase() === 'avtotovari') return { id: c.slug, name: c.name_ru, src: img('cat-wheel') };
      const top = products.find((p) => p.cat === c.slug);
      return { id: c.slug, name: c.name_ru, img: demoCat[c.slug] || 'cat-home', src: demoCat[c.slug] ? '' : (top && top.image) || '' };
    }));
  }
  // Корзина из браузера: только товары, которые есть в каталоге. Сохранённую копию не трогаем —
  // после догрузки остальных страниц вернутся и товары оттуда.
  function filterCarts() {
    const saved = state.savedCarts || state.carts;
    ['buyer', 'supplier'].forEach((m) => { state.carts[m] = (saved[m] || []).filter((i) => byId[i.id] && !isMarket(byId[i.id]) && (m !== 'supplier' || hasWholesale(byId[i.id]))); });
  }
  async function loadRestOfCatalog(pages) {
    if (catalogLoad.running) return;
    catalogLoad.running = true;
    catalogLoad.failed = [];
    catalogStatus();
    // Три страницы одновременно: без ограничения размера каталога и без залпа десятков запросов.
    const queue = [...pages];
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) {
        const page = queue.shift();
        try {
          const data = await api(`/api/products?sort=popular&page_size=60&page=${page}`);
          const known = new Set(PRODUCTS.map((p) => p.id));
          data.items.forEach((c) => { if (!known.has(c.slug) && SUPPLIERS[c.supplier_code]) {
            const p = byId[c.slug] || liveProduct(c); PRODUCTS.push(p); byId[p.id] = p; known.add(p.id);
          } });
          filterCarts();
          updateCartCount();
          renderHome();
          if (currentView === 'catalog') renderCatalog();
          if (currentView === 'cart') renderCart();
        } catch (e) { catalogLoad.failed.push(page); }
        catalogStatus();
      }
    }));
    catalogLoad.running = false;
    if (!catalogLoad.failed.length && state.savedCarts) {
      state.savedCarts = null; store.save();
    }
    catalogStatus();
    if (currentView === 'catalog') renderCatalog();
  }

  // Восстанавливаем профиль по серверной сессии, даже если хранилище браузера пустое.
  async function loadMe() {
    live.sessionState = 'loading';
    try {
      live.me = await api('/api/me?allow_guest=true');
      live.sessionState = 'ready';
      if (!live.me) {
        if (!live.tma) state.tg = null;
      } else {
        state.tg = { name: live.me.first_name, username: live.me.username || '' };
        if (live.me.measures && Object.keys(live.me.measures).length) state.measures = live.me.measures;
        const fromBrowser = [...state.favs].filter((id) => !live.me.favorites.includes(id));
        if (fromBrowser.length) {
          try { live.me.favorites = (await api('/api/me/favorites', { method: 'POST', body: { slugs: fromBrowser } })).favorites; } catch (e) { /* перенесём при следующем входе */ }
        }
        state.favs = new Set(live.me.favorites);
        resetProfileCache();
        store.save();
      }
    } catch (e) {
      if (e.status === 401) {
        live.me = null;
        state.tg = null;
        live.sessionState = 'ready';
      } else {
        live.sessionState = 'error';
      }
    }
    const tokens = [...new Set([...(live.me ? live.me.orders.map((o) => o.token) : []), ...guestTokens()])].slice(0, 20);
    const got = await Promise.all(tokens.map((t) => api(`/api/orders/${encodeURIComponent(t)}`).catch(() => null)));
    live.orders = got.filter(Boolean);
    live.loaded = true;
    if (currentView === 'profile') renderProfile();
  }

  async function loadProductDetail(p) {
    if (!live.on || !p.live || p.detail) return;
    try {
      const d = await api(`/api/products/${encodeURIComponent(p.id)}`);
      if (d.wheel_variants?.length && p.wheel) {
        const variants = adoptCards(d.wheel_variants);
        wheelVariants.set(p.wheel.key, variants);
      }
      p.detail = true;
      p.desc = d.description || '';
      if (d.images && d.images.length) {
        p.image = d.images[0]; p.images = d.images;
        if (pdState && pdState.id === p.id && d.images.length > 1) pdState.mediaDirty = true; // подгрузились все фото — обновить галерею
      }
      p.grid = (d.sizes || []).map((x) => [x, '']);
      p.sizes = p.grid.length ? (p.sizes || 'custom') : null;
      p.colors = d.colors || [];
      if (d.supplier_fact_days && SUPPLIERS[p.sup]) SUPPLIERS[p.sup].fact = d.supplier_fact_days;
      if (pdState && pdState.id === p.id && $('.pd')) rerenderProduct();
    } catch (e) {
      if (pdState && pdState.id === p.id) {
        const btn = $('[data-pd-add]');
        if (btn) { btn.disabled = false; btn.removeAttribute('data-pd-add'); btn.setAttribute('data-detail-retry', ''); btn.textContent = 'Повторить загрузку вариантов'; }
      }
    }
  }

  const PAID_STEPS = ['paid', 'purchased', 'at_warehouse', 'shipped', 'border', 'in_russia', 'ready', 'delivered'];
  function serverOrderHTML(o) {
    const unpaid = o.status === 'awaiting_payment';
    const telegram = unpaid ? orderTelegramLink(o.number) : '';
    const pill = o.status === 'delivered' || o.status === 'cancelled' ? 'pill' : 'pill pill--go';
    const events = [...o.events].reverse().map((e, i) => `<li class="${i === 0 ? 'is-now' : 'is-done'}"><span class="dot">${i === 0 ? '' : icon('check')}</span><div class="tl__body">
        <b>${esc(e.status_label)}</b><span>${esc(dateTime(e.created_at))}${e.weight_kg ? ` · вес ${nf1.format(Number(e.weight_kg))} кг` : ''}</span>
        ${e.note ? `<span>${esc(e.note)}</span>` : ''}
        ${e.photo ? `<a class="tl__photo" href="${esc(e.photo)}" target="_blank" rel="noopener"><img src="${esc(e.photo)}" alt="" width="84" height="60" loading="lazy"><span>Фото со склада</span></a>` : ''}
      </div></li>`).join('');
    return `<article class="order">
      <div class="order__head">
        <div>
          <div class="order__num">${esc(o.number)}<button type="button" data-copy="${esc(o.number)}">Скопировать</button></div>
          <div class="order__sub">${rub(Number(o.total_rub))}${Number(o.refund_rub) ? ` · возврат ${rub(Number(o.refund_rub))}` : ''}</div>
        </div>
        <span class="${pill}">${esc(unpaid ? 'Согласование с менеджером' : o.status_label)}</span>
      </div>
      ${unpaid ? `<p class="note">Менеджер подтвердит наличие и согласует оплату.</p>` : ''}
      ${telegram ? `<a class="btn btn--ghost btn--sm" href="${esc(telegram)}" target="_blank" rel="noopener">Продолжить в Telegram</a>` : ''}
      ${events ? `<ol class="timeline">${events}</ol>` : ''}
      <button class="btn btn--ghost btn--sm" type="button" data-open-chat style="align-self:flex-start">${icon('chat')}Вопрос по заказу</button>
    </article>`;
  }

  function orderTelegramLink(number) {
    const manager = live.site?.order_manager_telegram;
    const username = (manager || live.site?.telegram_bot || 'astta_shop_bot').trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9_]+$/.test(username)) return '';
    const query = manager ? 'text=' + encodeURIComponent('Здравствуйте! Хочу согласовать заказ ' + number)
      : 'start=' + encodeURIComponent('order_' + number);
    return 'https://t.me/' + username + '?' + query;
  }

  function orderPlacedSheet(order) {
    closeSheet();
    const telegram = orderTelegramLink(order.number);
    openSheet(`<div class="success">
      <span class="success__ic">${icon('check')}</span>
      <h2 class="sheet__title">Заказ ${esc(order.number)} принят</h2>
      <div class="sum"><div class="sum__row sum__row--total"><span>Предварительно</span><span>${rub(Number(order.total_rub))}</span></div></div>
      <p>Менеджер проверит наличие, подтвердит итоговую цену и согласует оплату.</p>
      <div class="buyrow">${telegram ? `<a class="btn btn--lime" href="${esc(telegram)}" target="_blank" rel="noopener">Продолжить в Telegram</a>` : ''}
        <a class="btn btn--ghost" href="#profile" data-close>Мой заказ</a></div>
    </div>`, { narrow: true });
  }

  async function withBusy(btn, fn) {
    if (btn) { if (btn.disabled) return; btn.disabled = true; }
    try { await fn(); } catch (e) { toast(e.message || 'Не получилось, попробуйте ещё раз'); } finally { if (btn && document.contains(btn)) btn.disabled = false; }
  }

  async function checkoutLive(contact, btn) {
    const ship = SHIP[state.ship === 'cargo' ? 'auto' : state.ship] || SHIP.auto;
    const lines = cart().map((i) => ({ product: i.id, qty: i.qty, size: i.size && i.size !== '?' ? i.size : '', color: i.color || '' }));
    const askSize = cart().filter((i) => i.size === '?').map((i) => byId[i.id].t);
    await withBusy(btn, async () => {
      const order = await api('/api/orders', { method: 'POST', body: {
        items: lines, contact, mode: isSupplier() ? 'wholesale' : 'retail', shipping: ship && ship.code ? ship.code : null,
        comment: askSize.length ? `Подобрать размер: ${askSize.join(', ')}` : '', consent: true } });
      rememberOrder(order.token);
      live.orders.unshift(order); live.loaded = true;
      state.carts[state.mode] = [];
      store.save(); updateCartCount(); renderCart();
      orderPlacedSheet(order);
    });
  }

  function linkForm(fields, file) {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, String(v)); });
    if (file) fd.append('photo', file);
    return fd;
  }
  async function linkOrderLive({ title, url, price, qty, note, contact, file, quoteId }, btn) {
    await withBusy(btn, async () => {
      const order = await api('/api/link/order', { method: 'POST', body: linkForm({ quote_id: quoteId, text: url, price_cny: price, qty, size: note.slice(0, 32), title, contact, consent: 'true' }, file) });
      rememberOrder(order.token);
      live.orders.unshift(order); live.loaded = true;
      orderPlacedSheet(order);
    });
  }
  async function linkRequestLive({ text, price, qty, size, contact, comment, file }, btn) {
    await withBusy(btn, async () => {
      await api('/api/link/requests', { method: 'POST', body: linkForm({ text, price_cny: price > 0 ? price : '', qty, size: (size || '').slice(0, 32), contact, comment, consent: 'true' }, file) });
      closeSheet();
      openSheet(`<div class="success"><span class="success__ic">${icon('check')}</span>
        <h2 class="sheet__title">Заявка у агента</h2>
        <p>Агент проверит товар и продавца и напишет вам ${esc(contact)} с точной ценой в рублях с доставкой.</p></div>`, { narrow: true });
    });
  }
  async function readPricePhotoLive(file) {
    try {
      const r = await api('/api/link/photo', { method: 'POST', body: linkForm({}, file) });
      return r.price_cny ? { price: Number(r.price_cny), title: r.title_ru || '' } : null;
    } catch (e) { return null; }
  }

  // Вход: на сайте — кнопка Telegram, после подтверждения Telegram возвращает на /?tglogin=1&id=…&hash=…;
  // в мини-приложении Telegram сам передаёт данные в адресе (#tgWebAppData=…), вход не нужен.
  function readTelegramLaunch() {
    const hash = new URLSearchParams(location.hash.slice(1));
    const data = hash.get('tgWebAppData');
    if (data) {
      try { sessionStorage.setItem('astta-tma', data); } catch (e) { /* ничего */ }
      history.replaceState(null, '', location.pathname + location.search);
    }
    try { live.tma = data || sessionStorage.getItem('astta-tma') || ''; } catch (e) { live.tma = data || ''; }
    if (live.tma) {
      try {
        const u = JSON.parse(new URLSearchParams(live.tma).get('user') || '{}');
        live.tmaUser = { name: u.first_name || '', username: u.username || '' };
      } catch (e) { live.tmaUser = null; }
    }
  }
  async function finishWidgetLogin() {
    const q = new URLSearchParams(location.search);
    if (!q.has('tglogin') || !q.has('hash')) return;
    history.replaceState(null, '', location.pathname + '#profile');
    const fields = {};
    ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'].forEach((k) => { if (q.has(k)) fields[k] = q.get(k); });
    fields.id = Number(fields.id); fields.auth_date = Number(fields.auth_date);
    await completeTelegramLogin(fields);
  }
  async function completeTelegramLogin(fields) {
    try {
      await api('/api/auth/telegram', { method: 'POST', body: { ...fields, consent: true } });
      live.csrf = ''; // после входа Django выдаёт новый токен защиты
      await loadMe();
      toast(state.tg && state.tg.username ? `Вы вошли как @${state.tg.username}` : 'Вы вошли');
      closeSheet();
      go('profile');
    } catch (e) { toast(e.message); }
  }
  function openTgLoginLive() {
    const bot = live.site && live.site.telegram_bot;
    if (!bot) { toast('Вход через Telegram скоро заработает'); return; }
    openSheet(`<div class="stack">
      <h2 class="sheet__title">Вход через Telegram</h2>
      <p class="note">Отметьте согласие, затем нажмите кнопку Telegram и подтвердите вход в приложении. Мы узнаем ваше имя и ник, телефон Telegram не передаёт. Пароль не нужен.</p>
      ${consentHTML('tgConsent')}
      <div id="tgWidget" class="tgwidget"></div>
    </div>`, { narrow: true });
  }
  function mountTgWidget() {
    const box = $('#tgWidget');
    if (!box || box.childElementCount) return;
    const sc = document.createElement('script');
    sc.async = true;
    sc.src = 'https://telegram.org/js/telegram-widget.js?22';
    sc.dataset.telegramLogin = live.site.telegram_bot;
    sc.dataset.size = 'large';
    sc.dataset.radius = '12';
    sc.dataset.requestAccess = 'write';
    window.asttaTelegramLogin = async (user) => {
      if (!user?.hash || !$('#tgConsent')?.checked) return;
      await completeTelegramLogin(user);
    };
    sc.dataset.onauth = 'asttaTelegramLogin(user)';
    box.append(sc);
  }
  async function logoutLive() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { toast('Не удалось выйти. Повторите попытку.'); return; }
    live.csrf = ''; live.me = null; state.tg = null;
    state.favs = new Set(); state.viewed = []; resetProfileCache(); store.save();
    live.orders = []; live.loaded = false;
    await loadMe();
    renderProfile();
    toast('Вы вышли');
  }
  function openAgentLive(supId) {
    const supplier = SUPPLIERS[supId];
    const order = new URLSearchParams(location.search).get('order') || '';
    const question = /^A-[0-9]{6,20}$/.test(order) ? `Хочу согласовать заказ ${order}.` : supId ? '' : ([...ai.log].reverse().find((m) => m.me)?.text || '');
    openSheet(`<div class="stack"><h2 class="sheet__title">Написать агенту</h2>
      <p class="note">Сообщение попадёт команде ASTTA. Укажите контакт, по которому вам ответить.</p>
      <form class="stack" id="supportForm">
        <label class="field"><span>Телефон, Telegram или почта</span><input name="contact" maxlength="254" required value="${esc(tgContact())}" placeholder="+7 …, @username или почта"></label>
        <label class="field"><span>Ваш вопрос</span><textarea name="message" required maxlength="2000" rows="5">${esc(supplier ? `Вопрос по поставщику ${supplier.name}: ` : question)}</textarea></label>
        ${consentHTML('supportConsent')}
        <button class="btn btn--lime" type="submit">Отправить агенту</button>
      </form></div>`, { narrow: true });
  }
  async function submitSupport(form) {
    if (!form.reportValidity() || !consentOk('supportConsent')) return;
    await withBusy($('button[type=submit]', form), async () => {
      const data = await api('/api/link/support', { method: 'POST', body: {
        contact: form.elements.contact.value.trim(), message: form.elements.message.value.trim(), consent: true,
      } });
      openSheet(`<div class="stack"><h2 class="sheet__title">Обращение №${data.id} принято</h2><p>Команда увидит его в очереди обращений и ответит по указанному контакту.</p></div>`, { narrow: true });
    });
  }

  /* ---------- Профиль покупателя (боевой сайт) ---------- */
  // Вошёл через Telegram — шапка с аватаром, сколько потратил и вкладки. Гость видит вход и заказы с этого браузера.
  const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MONTHS_OF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const spentOf = (o) => Number(o.total_rub) - Number(o.refund_rub || 0);
  const isPaid = (o) => o.paid_at && o.status !== 'cancelled';

  function spendingHTML() {
    const paid = live.orders.filter(isPaid);
    if (!paid.length) return `<div class="emptystate">${icon('tag')}<h2>Трат пока нет</h2><p>Здесь появятся оплаченные заказы по месяцам.</p></div>`;
    const byMonth = new Map();
    paid.forEach((o) => {
      const d = new Date(o.paid_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      const row = byMonth.get(key) || { label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, sum: 0, n: 0 };
      row.sum += spentOf(o); row.n += 1; byMonth.set(key, row);
    });
    const rows = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([, r]) => r);
    const max = Math.max(...rows.map((r) => r.sum));
    const total = paid.reduce((sum, o) => sum + spentOf(o), 0);
    return `<div class="panel">
      <h3>Траты по месяцам</h3>
      <div class="spend">${rows.map((r) => `<div class="spend__row"><span>${r.label}</span><i style="--w:${Math.max(4, Math.round((r.sum / max) * 100))}%"></i><b>${rub(r.sum)}</b><small>${r.n} ${plural(r.n, 'заказ', 'заказа', 'заказов')}</small></div>`).join('')}</div>
      <div class="sum"><div class="sum__row"><span>Всего</span><span>${rub(total)}</span></div><div class="sum__row"><span>Средний заказ</span><span>${rub(total / paid.length)}</span></div></div>
      <p class="note">Считаем оплаченные заказы за вычетом возвратов. Если в кабинете заказ на этом браузере, а вы не вошли, его здесь не будет.</p>
    </div>`;
  }

  function meDataHTML() {
    const me = live.me;
    return `<form class="panel" id="meForm" novalidate>
      <h3>Мои данные</h3>
      <p class="note">Подставим в заказ, чтобы не вводить каждый раз. Видят только вы и агент, который ведёт заказ.</p>
      <div class="form">
        <label class="field"><span>Телефон</span><input id="meePhone" type="tel" autocomplete="tel" maxlength="32" placeholder="+7 900 000-00-00" value="${esc(me.phone)}"></label>
        <label class="field"><span>Город</span><input id="meeCity" autocomplete="address-level2" maxlength="80" placeholder="Москва" value="${esc(me.city)}"></label>
        <label class="field field--full"><span>Пункт выдачи или адрес</span><input id="meeAddr" autocomplete="street-address" maxlength="300" placeholder="СДЭК, ул. Ленина, 1" value="${esc(me.delivery_address)}"></label>
      </div>
      <button class="btn btn--lime" type="submit">Сохранить</button>
    </form>${emailAccountHTML()}${payMethodHTML()}`;
  }

  async function saveNickname(form) {
    const button = $('button[type=submit]', form);
    const error = $('[data-nickname-error]', form);
    button.disabled = true;
    error.hidden = true;
    try {
      live.me = await api('/api/me', { method: 'PATCH', body: { nickname: form.elements.nickname.value.trim() } });
      if (form.isConnected && !$('#sheet').hidden) closeSheet();
      renderProfile();
      toast('Ник сохранён');
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
    } finally { button.disabled = false; }
  }

  async function saveProfile(fields, btn, done) {
    await withBusy(btn, async () => {
      live.me = await api('/api/me', { method: 'PATCH', body: fields });
      toast(done);
      renderProfile();
    });
  }

  /* ---------- Заставка ---------- */
  function initSplash() {
    const el = $('#splash');
    if (!el) return;
    const root = document.documentElement;
    if (root.classList.contains('no-splash') || root.dataset.ui === 'bimbo') { el.remove(); return; }
    try { sessionStorage.setItem('astta-splash', '1'); } catch (e) { /* без хранилища покажем снова */ }
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
    setTimeout(finish, 2600);
  }

  /* ---------- Старт ---------- */
  const allowDemo = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  let startingLive = false;
  async function startLive() {
    if (startingLive) return;
    startingLive = true;
    if (!allowDemo) document.documentElement.classList.add('is-booting');
    $('#siteError').hidden = true;
    document.documentElement.classList.remove('site-unavailable');
    try { await loadLive(); if (live.on) await finishWidgetLogin(); }
    catch (e) {
      if (!allowDemo || live.on) { $('#siteError').hidden = false; document.documentElement.classList.add('site-unavailable'); }
    } finally { startingLive = false; document.documentElement.classList.remove('is-booting'); }
  }

  function init() {
    initSplash();
    store.load();
    applyTheme(document.documentElement.getAttribute('data-ui'));
    initCookies();
    $('#catalogFilters').open = window.matchMedia('(min-width: 900px)').matches;
    initHomeNav();
    $$('[data-rate]').forEach((el) => { el.textContent = rateText; el.closest('.rate').hidden = !allowDemo; });
    $('#menuCats').innerHTML = CATS.map((c) => `<a href="#catalog" data-cat="${esc(c.id)}" data-close-menu>${esc(c.name)}</a>`).join('');
    document.addEventListener('click', onClick);
    document.addEventListener('error', (e) => {
      const id = e.target.dataset?.productPhoto, p = id && byId[id];
      if (!p || p.market?.source !== 'taobao' || p.photoFailed) return;
      p.photoFailed = true;
      renderHome(); if (currentView === 'catalog') renderCatalog();
      if ($('#aiMsgs')) aiRender();
    }, true);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', (e) => { if (e.target.matches?.('[data-gal-track]')) galleryScrolled(e.target); if (e.target.matches?.('.aicards')) updateAiRail(e.target); }, true);
    $('#menuBtn').addEventListener('click', openMenu);
    $('#searchBtn').addEventListener('click', () => {
      go('catalog');
      requestAnimationFrame(() => $('#q').focus());
    });
    window.addEventListener('hashchange', route);
    buildOut();
    $('#trendsScroll').addEventListener('dblclick', (e) => {
      const reel = e.target.closest('.reel');
      if (reel && !e.target.closest('.reel__side, .reel__info')) likeReel(Number(reel.dataset.reel), true);
    });
    readTelegramLaunch();
    state.mode = 'buyer';
    document.documentElement.dataset.mode = state.mode;
    $$('[data-mode-text]').forEach((el) => { el.textContent = el.dataset.modeText.split('|')[0]; });
    store.save();
    renderAll();
    route();
    initHero();
    startLive();
    window.addEventListener('resize', initAiRails);
  }

  init();
})();
