(() => {
  'use strict';

  /* ---------- Настройки (в рабочей версии приходят с сервера) ---------- */
  const RATE = 11.4;          // ₽ за 1 ¥, демо-значение
  const EUR = 95;             // ₽ за 1 €, демо-значение для бюджета в евро
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
    orders: [],
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
          state.carts.buyer = d.carts.buyer.filter((i) => byId[i.id]);
          state.carts.supplier = d.carts.supplier.filter((i) => byId[i.id]);
        }
        if (Array.isArray(d.liked)) state.liked = new Set(d.liked);
        if (Array.isArray(d.joined)) state.joined = new Set(d.joined);
        if (d.measures && typeof d.measures === 'object') state.measures = d.measures;
        if (d.family && Array.isArray(d.family.items)) state.family = d.family;
        if (Array.isArray(d.pools)) state.pools = d.pools.filter((g) => byId[g.pid]);
      } catch (e) { /* хранилище недоступно: работаем без него */ }
    },
    save() {
      try {
        localStorage.setItem('astta-demo', JSON.stringify({
          mode: state.mode, ship: state.ship, carts: state.carts,
          liked: [...state.liked], joined: [...state.joined],
          measures: state.measures, family: state.family, pools: state.pools,
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
      <div class="card__media">
        <img class="card__img" src="${img(p.id)}" alt="" loading="lazy" width="720" height="720">
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
      <img src="${img(p.id)}" alt="" loading="lazy" width="92" height="92">
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
    $('#reelRail').innerHTML = TRENDS.map(reelThumbHTML).join('');
    $('#tiles').innerHTML = TILES.map(tileHTML).join('');
    $('#homeCats').innerHTML = CATS.map((c) => `<button class="cat" type="button" data-cat="${c.id}"><img src="${img(c.img)}" alt="" loading="lazy" width="640" height="800"><span>${c.name}</span></button>`).join('');
    $('#groups').innerHTML = PRODUCTS.filter((p) => p.group).map(groupHTML).join('');
    $('#saleRail').innerHTML = PRODUCTS.filter((p) => p.sale).map(cardHTML).join('');
    $('#popular').innerHTML = [...PRODUCTS].sort((a, b) => b.sold - a.sold).slice(0, 8).map(cardHTML).join('');
    $('#feedPreview').innerHTML = POSTS.slice(0, 3).map(postHTML).join('');
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
    if (item) { item.qty += isSupplier() ? qty : (opts.qty || 1); if (opts.proof) item.proof = true; }
    else cart().push({ id, qty, size: opts.size || null, proof: !!opts.proof });
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
      const sizeLabel = (i.size === '?' ? ' · размер подберёт агент' : (i.size ? ` · размер CN ${esc(i.size)}` : '')) + (i.proof ? ' · с проверкой Proof' : '');
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
        ${t.proof ? `<div class="sum__row"><span>ASTTA Proof, проверка</span><span>${rub(t.proof)}</span></div>` : ''}
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
      <div class="thumbs">${o.items.map((id) => `<img src="${img(id)}" alt="${esc(byId[id].t)}" width="52" height="52" loading="lazy">`).join('')}</div>
      <ol class="timeline">${stages}</ol>
      ${o.delivered ? `<div class="rvremind">${icon('star')}<div><b>Review+ через 3 месяца</b><span>8 января напомним рассказать, как кроссовки после 3 месяцев носки</span></div><button class="btn btn--line btn--sm" type="button" data-rv-now>Отзыв сейчас</button></div>` : `<button class="btn btn--ghost btn--sm" type="button" data-open-chat style="align-self:flex-start">${icon('chat')}Вопрос по заказу</button>`}
    </article>`;
  }

  function renderProfile() {
    const tabs = [['orders', 'Заказы'], ['family', 'Семья'], ['gifts', 'Подарки'], ['size', 'Мерки']];
    const body = {
      orders: () => `<div class="orders">${[...state.orders, ...DEMO_ORDERS].map(orderHTML).join('')}</div>`,
      family: familyHTML, gifts: giftsHTML, size: measuresHTML,
    }[state.ptab]();
    $('#profileBody').innerHTML = `<div class="ptabs chips" role="tablist">${tabs.map(([id, name]) => `<button class="chip" type="button" role="tab" data-ptab="${id}" aria-pressed="${state.ptab === id}">${name}</button>`).join('')}</div>${body}`;
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
        <img src="${img(p.id)}" alt="" width="64" height="64" loading="lazy">
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
      <div class="pool__item"><img src="${img(p.id)}" alt="" width="72" height="72"><div><b>${esc(p.t)}</b><span>${rub(poolTotal(g))} с доставкой</span></div></div>
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
        <img src="${img(p.id)}" alt="" width="72" height="72" loading="lazy">
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
      <div class="pool__item"><img src="${img(p.id)}" alt="" width="72" height="72"><div><b>${esc(p.t)}</b><span>${rub(retail(p).total)} с доставкой</span></div></div>
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
    pdState = { id, size: null, ship: shipFor(p), qty: isSupplier() ? p.tiers[0][0] : 1, needSize: !!opts.needSize };
    openSheet(productHTML(), {});
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

    const rec = smartSize(p);
    const smart = !p.sizes ? '' : (rec
      ? `<div class="smartsize">${icon('ruler')}<div><b>Smart Size: вам CN ${esc(rec.size)}</b><span>${esc(rec.why)}${rec.over ? '. Это самый большой размер модели, уточните у агента' : ''}</span></div>${pdState.size === rec.size ? '' : `<button class="btn btn--line btn--sm" type="button" data-size="${esc(rec.size)}">Выбрать</button>`}</div>`
      : (MEAS[p.id] ? `<div class="smartsize">${icon('ruler')}<div><b>Smart Size</b><span>Укажите мерки один раз, и мы подскажем размер по реальным замерам этой модели</span></div><button class="btn btn--line btn--sm" type="button" data-measures>Указать</button></div>` : ''));
    const sizes = (!sup && p.sizes) ? `<div class="stack" style="gap:10px">
        <span class="sublabel">Размер · китайский и наш</span>
        <div class="sizes" role="group" aria-label="Размер">${SIZE_GRID[p.sizes].map(([cn, ru]) => `<button class="size${rec && rec.size === cn ? ' size--rec' : ''}" type="button" data-size="${cn}" aria-pressed="${pdState.size === cn}"><b>CN ${cn}</b><span>${rec && rec.size === cn ? 'ваш размер' : ru}</span></button>`).join('')}</div>
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

    const optNote = !sup ? `<div class="optnote"><span>Опт от ${p.tiers[0][0]} шт: <b>${cny(p.tiers[0][1])}</b></span><button class="linkbtn" type="button" data-switch-mode="supplier">Раздел для поставщиков</button></div>` : '';

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
        : `<img src="${img(p.id)}" alt="${esc(p.t)}" width="720" height="720">`}</div>
      <div class="pd__info">
        <button class="supchip" type="button" data-goto-sup="${p.sup}"><span class="ava" aria-hidden="true">${s.short}</span>${esc(s.name)}</button>
        <h2>${esc(p.t)}</h2>
        <div class="pd__rating"><span>${icon('star', 'ic--fill')}<b>${nf1.format(p.rating)}</b></span><span>${p.reviews} ${plural(p.reviews, 'отзыв', 'отзыва', 'отзывов')}</span><span>Доставка ${s.fact[0]}–${s.fact[1]} дней</span></div>
        ${priceBlock}
        ${sizes}
        ${ship}
        ${breakdown}
        ${group}
        <div class="buyrow">
          ${qty}
          <button class="btn btn--lime" type="button" data-pd-add>${sup ? 'Добавить партию' : 'В корзину'}</button>
        </div>
        ${nt ? `<p class="note" style="color:var(--lime)">Ещё ${nt[0] - pdState.qty} шт, и цена станет ${cny(nt[1])}</p>` : ''}
        ${optNote}
        ${sup ? '' : `<button class="proofbox${pdState.proof ? ' is-on' : ''}" type="button" data-proof aria-pressed="${!!pdState.proof}">
          <span class="proofbox__check">${icon('check')}</span>
          <span class="proofbox__body"><b>ASTTA Proof · +${rub(proofOf(p).price)}</b><span>Проверим именно ваш экземпляр на складе до отправки: ${proofOf(p).list.slice(0, 3).join(', ').toLowerCase()}. Отчёт с фото и видео придёт в заказ.</span></span>
        </button>`}
        ${DIMS[p.id] ? `<button class="btn btn--line" type="button" data-room="${p.id}">${icon('ruler')}Примерить в комнату · ${DIMS[p.id].w}×${DIMS[p.id].d} см</button>` : ''}
        ${sup ? '' : `<div class="pdextra"><button class="btn btn--ghost btn--sm" type="button" data-pool-new="${p.id}">${icon('users')}Скинуться на подарок</button><button class="btn btn--ghost btn--sm" type="button" data-family-add="${p.id}">${icon('home')}В семейный список</button></div>`}
        <p class="pd__desc">${esc(p.desc)}</p>
        <button class="btn btn--ghost" type="button" data-open-chat="${p.sup}">${icon('chat')}Спросить агента</button>
        ${reviews}
      </div>
    </div>`;
  }

  function reviewsHTML(p) {
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
    if (old && old.dataset.id === pdState.id) $('.pd__info', old).replaceWith($('.pd__info', tmp));
    else body.innerHTML = tmp.innerHTML;
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
      wholesale: `от ${p.tiers[0][0]} шт по ${p.tiers[0][1]} ¥`, delivery_days: SHIP[shipFor(p)].days.join('–'),
      sizes: p.sizes ? SIZE_GRID[p.sizes].map(([cn]) => cn).join(',') : null, about: p.desc,
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
    const cat = m.cat || [];
    const custom = m.custom || [];
    if (!cat.length && !custom.length) return '';
    const catTotal = cat.reduce((sum, c) => sum + retail(byId[c.id]).total, 0);
    const customTotal = custom.reduce((sum, c) => sum + (c.est_cny ? aiCustomRub(c) : 0), 0);
    const cards = cat.map((c) => {
      const p = byId[c.id];
      return `<article class="aicard">
        <button class="aicard__img" type="button" data-open="${c.id}" aria-label="${esc(p.t)}"><img src="${img(c.id)}" alt="" width="160" height="160" loading="lazy"></button>
        <div class="aicard__body">
          ${c.role ? `<span class="aicard__role">${esc(c.role)}</span>` : ''}
          <b>${esc(p.t)}</b>
          <span class="aicard__price">${rub(retail(p).total)}</span>
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
      <div class="aicards">${cards}</div>
      ${compat}
      <div class="aitotal">
        <div><span>${custom.length ? 'Итого, оценка' : 'Готовая корзина'}</span><b>${custom.length ? '≈ ' : ''}${rub(total)}</b></div>
        <div class="aitotal__btns">
          ${cat.length ? `<button class="btn btn--lime btn--sm" type="button" data-ai-add="${idx}">${custom.length ? 'Из каталога в корзину' : 'Добавить всё'}</button>` : ''}
          ${custom.length ? `<button class="btn ${cat.length ? 'btn--line' : 'btn--lime'} btn--sm" type="button" data-ai-custom="${idx}">Индивидуальный заказ</button>` : ''}
        </div>
      </div>
      ${custom.length ? '<p class="note">Цены под заказ оценочные, точную цену и наличие агент подтвердит до оплаты.</p>' : ''}
      <div class="quick"><button class="chip" type="button" data-ai-more="cheaper" data-ai-idx="${idx}">Дешевле</button><button class="chip" type="button" data-ai-more="other" data-ai-idx="${idx}">Другой вариант</button></div>
    </div>`;
  }

  const AI_STAGES = ['Разбираю запрос…', 'Ищу в каталоге ASTTA…', 'Подбираю под заказ из Китая…', 'Проверяю совместимость и бюджет…', 'Собираю корзину…'];

  function aiRender() {
    const box = $('#aiMsgs');
    if (!box) return;
    box.innerHTML = ai.log.map((m, idx) => {
      if (m.me) return `<div class="msg msg--me">${m.thumb ? `<img class="msg__img" src="${esc(m.thumb)}" alt="">` : ''}${esc(m.text)}</div>`;
      if (m.typing) return `<div class="msg msg--typing"><span id="aiStage">${AI_STAGES[ai.stage % AI_STAGES.length]}</span>${ai.ctl ? ' <button class="linkbtn" type="button" data-ai-stop>Стоп</button>' : ''}</div>`;
      let html = `<div class="msg msg--ai">${esc(m.reply || m.text)}</div>`;
      html += aiResultHTML(m, idx);
      if (m.questions && m.questions.length) html += `<div class="quick">${m.questions.map((q) => `<button class="chip chip--q" type="button" data-ai-fill="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
      if (m.toAgent) html += '<button class="btn btn--ghost btn--sm" type="button" data-open-chat="sz" style="align-self:flex-start">Передать агенту</button>';
      return html;
    }).join('');
    const head = $('#aiMode');
    if (head) head.textContent = ai.mode === 'claude' ? 'работает на Claude · подбирает из каталога и под заказ' : (ai.mode === 'demo' ? 'демо-режим: сценарии по каталогу' : 'подбирает товары под задачу и бюджет');
    box.lastElementChild && box.lastElementChild.scrollIntoView({ block: 'end' });
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
      <form class="chat__form" id="aiChatForm"><input id="aiChatInput" autocomplete="off" placeholder="Что подобрать?" aria-label="Запрос для ASTTA AI"><button class="roundbtn" type="submit" aria-label="Отправить">${icon('arrow')}</button></form>
    </div>`, { narrow: true });
    if (!ai.log.length) ai.log.push({ reply: 'Привет! Напишите задачу и бюджет. Подберу из каталога ASTTA, а чего нет — найду под заказ в Китае и проверю, что всё подходит друг к другу.' });
    aiRender();
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
    aiRender();
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
        <button class="reelchip__open" type="button" data-open="${id}"><img src="${img(id)}" alt="" width="44" height="44" loading="lazy"><span><b>${esc(p.t)}</b><em>${price}</em></span></button>
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
  const VIEWS = ['home', 'catalog', 'trends', 'feed', 'cart', 'profile'];
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
    document.documentElement.classList.toggle('is-trends', view === 'trends');
    if (view === 'trends') enterTrends(); else leaveTrends();
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
    if (currentView === 'trends') renderTrends(true);
    updateCartCount();
  }

  /* ---------- Герой ---------- */
  const HERO_TAGS = ['Новинки', 'Фото со склада', 'Опт'];
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
      if (!isSupplier() && p.sizes && !pdState.size) { toast('Выберите размер'); $('.sizes button', $('#sheetBody')).focus(); return; }
      const prevShip = state.ship;
      if (!p.bulky) state.ship = pdState.ship;
      const id = pdState.id, size = pdState.size, qty = pdState.qty, proof = pdState.proof;
      closeSheet();
      addToCart(id, { size, qty, proof });
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
    if (d.aiAdd !== undefined) {
      const m = ai.log[Number(d.aiAdd)];
      if (!m || !m.cat || !m.cat.length) return;
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
    if (t.type === 'radio' && t.closest('.ship')) {
      $$('.shipopt', t.closest('.ship')).forEach((l) => l.classList.toggle('is-on', $('input', l).checked));
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
    if (t.id === 'q') { state.q = t.value; renderCatalog(); }
    if (t.id === 'buildRange') buildOut();
    if (t.id === 'plPeople') updatePoolShare();
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
    if (f.id === 'measForm') {
      const num = (id) => { const v = parseFloat(String($(id).value).replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null; };
      state.measures = { height: num('#msHeight'), chest: num('#msChest'), waist: num('#msWaist'), hips: num('#msHips'), foot: num('#msFoot') };
      store.save(); toast('Мерки сохранены');
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
      const found = PLATFORMS.find(([re]) => re.test(link));
      input.value = '';
      openChat();
      sendChat(`Посчитайте цену${found ? ` с ${found[1]}` : ''}: ${link}`, 'Приняла ссылку. Проверю продавца и пришлю цену в рублях с доставкой в течение 15 минут.');
      return;
    }
    if (f.id === 'checkoutForm') { submitCheckout(); return; }
    if (f.id === 'chatForm') { const i = $('#chatInput'); sendChat(i.value); i.value = ''; return; }
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
    buildOut();
    $('#trendsScroll').addEventListener('dblclick', (e) => {
      const reel = e.target.closest('.reel');
      if (reel && !e.target.closest('.reel__side, .reel__info')) likeReel(Number(reel.dataset.reel), true);
    });
    setMode(state.mode, true);
    route();
    initHero();
  }

  init();
})();
