/* Кабинет поставщика (中文 / RU) и панель модерации ASTTA. Прототип: данные демонстрационные и хранятся
   в этом браузере. На сервере то же самое делает админка Django (backend/), здесь показан целевой интерфейс. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const imgSrc = (id) => (/^(data:|https?:|\/)/.test(id || '') ? id : `assets/img/${id}.jpg`);
  const nf = new Intl.NumberFormat('ru-RU');
  const cny = (n) => `${nf.format(Math.round(n))} ¥`;
  const rub = (n) => `${nf.format(Math.round(n))} ₽`;
  const round10 = (n) => Math.round(n / 10) * 10;

  /* ---------- Переводы кабинета поставщика ---------- */
  const I18N = {
    'top.title': ['卖家中心', 'Кабинет поставщика'],
    'top.demo': ['预览版 · 演示数据', 'Превью · демо-данные'],
    'nav.overview': ['概览', 'Обзор'],
    'nav.products': ['商品管理', 'Товары'],
    'nav.orders': ['订单', 'Заказы'],
    'nav.payouts': ['结算', 'Выплаты'],
    'nav.shop': ['店铺设置', 'Магазин'],
    'nav.factory': ['内容工厂', 'Контент-завод'],
    'fac.sub': ['根据您的商品自动生成动态，买家在 ASTTA“供应商动态”中看到。您只需要上传商品。', 'Сам делает посты для ленты поставщиков на ASTTA из ваших карточек. Вам остаётся только добавлять товары.'],
    'fac.auto': ['自动发帖', 'Автопосты'],
    'fac.newItems': ['新品上架', 'Новые товары'],
    'fac.newItemsHint': ['商品审核通过后立即发帖', 'Сразу после модерации карточки'],
    'fac.weekly': ['每周精选', 'Подборка недели'],
    'fac.weeklyHint': ['每周一，选浏览量最高的商品', 'По понедельникам, из самых просматриваемых'],
    'fac.restock': ['到货通知', 'Поступления'],
    'fac.restockHint': ['商品重新有货时', 'Когда товар снова в наличии'],
    'fac.video': ['视频（即将推出）', 'Видео (скоро)'],
    'fac.videoHint': ['用商品图片自动生成短视频', 'Короткие ролики из фото товара'],
    'fac.perDay': ['每天最多发布', 'Постов в день, не больше'],
    'fac.next': ['下一条自动动态：今天 18:00', 'Следующий автопост: сегодня в 18:00'],
    'fac.ruNote': ['买家看到的是俄语动态，我们会自动翻译。', 'Покупатели видят пост на русском, переводим сами.'],
    'fac.post': ['发布动态', 'Пост в ленту'],
    'fac.product': ['商品', 'Товар'],
    'fac.kind': ['类型', 'Тип'],
    'fac.kind.new': ['新品', 'Новинка'],
    'fac.kind.restock': ['到货', 'Поступление'],
    'fac.kind.opt': ['批发优惠', 'Оптовое предложение'],
    'fac.text': ['内容（可以用中文写，发布前会翻译成俄语）', 'Текст (можно по-китайски, переведём перед публикацией)'],
    'fac.send': ['提交', 'Отправить'],
    'fac.sent': ['已提交，审核后发布', 'Отправлено, опубликуем после проверки'],
    'fac.mine': ['我的动态', 'Мои посты'],
    'fac.none': ['还没有手动发布的动态', 'Своих постов пока нет'],
    'fac.saved': ['设置已保存', 'Настройки сохранены'],
    'hello': ['您好，{name}', 'Здравствуйте, {name}'],
    'hello.sub': ['这里是您在 ASTTA 的店铺：上传商品、处理订单、查看结算。', 'Здесь ваш магазин на ASTTA: товары, заказы и выплаты.'],
    'kpi.new': ['今日新订单', 'Новых заказов сегодня'],
    'kpi.todo': ['待处理订单', 'Заказы ждут действий'],
    'kpi.review': ['审核中商品', 'Товары на модерации'],
    'kpi.balance': ['待结算', 'К выплате'],
    'todo.title': ['待办事项', 'Что сделать'],
    'todo.confirm': ['{n} 个订单待确认库存', 'Подтвердите наличие: {n} зак.'],
    'todo.ship': ['{n} 个订单待发往 TT 仓库', 'Отправьте на склад TT: {n} зак.'],
    'todo.rejected': ['{n} 个商品被驳回，请修改', 'Отклонено товаров: {n}, исправьте'],
    'todo.none': ['暂无待办，做得好！', 'Всё сделано'],
    'chart.title': ['近 7 天订单', 'Заказы за 7 дней'],
    'tips.title': ['如何更快通过审核', 'Как быстрее пройти модерацию'],
    'tips.1': ['使用白底或纯色背景图片，不要带其他店铺的水印', 'Фото на белом или однотонном фоне, без водяных знаков других магазинов'],
    'tips.2': ['填写包装后重量，运费按重量计算', 'Укажите вес в упаковке: по нему считается доставка'],
    'tips.3': ['俄语名称可以不填，审核员会帮您翻译', 'Русское название можно не писать, модератор переведёт'],
    'tips.4': ['禁止上传仿牌、电池、药品等禁售商品', 'Нельзя загружать копии брендов, батареи, лекарства'],
    'products.add': ['添加商品', 'Добавить товар'],
    'products.import': ['Excel 批量上传', 'Загрузить из Excel'],
    'products.sub': ['新商品和修改过的商品需要审核，通常 24 小时内完成。', 'Новые и изменённые товары проходят модерацию, обычно до 24 часов.'],
    'filter.all': ['全部', 'Все'],
    'status.published': ['已上架', 'Опубликован'],
    'status.moderation': ['审核中', 'На модерации'],
    'status.rejected': ['已驳回', 'Отклонён'],
    'col.product': ['商品', 'Товар'],
    'col.price': ['零售价', 'Цена'],
    'col.tiers': ['批发价', 'Опт'],
    'col.weight': ['重量', 'Вес'],
    'col.status': ['状态', 'Статус'],
    'col.stats': ['浏览 · 订单', 'Просмотры · заказы'],
    'act.edit': ['编辑', 'Изменить'],
    'empty.products': ['暂无商品', 'Товаров нет'],
    'form.add': ['添加商品', 'Новый товар'],
    'form.edit': ['编辑商品', 'Изменить товар'],
    'form.zh': ['商品名称（中文）', 'Название (кит.)'],
    'form.ru': ['俄语名称（可不填）', 'Название (рус., можно не заполнять)'],
    'form.cat': ['类目', 'Категория'],
    'form.price': ['零售价（元）', 'Цена в рознице, ¥'],
    'form.sale': ['折扣（%）', 'Скидка, %'],
    'form.tiers': ['批发价（起批量 · 单价）', 'Опт (от шт. · цена за шт.)'],
    'form.tierQty': ['起批量（件）', 'От, шт.'],
    'form.tierPrice': ['单价（元）', 'Цена, ¥'],
    'form.addTier': ['+ 添加价格档', '+ Ещё ступень'],
    'form.weight': ['包装后重量（公斤）', 'Вес в упаковке, кг'],
    'form.bulky': ['大件（家具等，只能走集运）', 'Крупногабарит (мебель, едет сборным грузом)'],
    'form.photo': ['商品图片', 'Фото товара'],
    'form.desc': ['商品描述（中文）', 'Описание (кит.)'],
    'form.submit': ['提交审核', 'Отправить на модерацию'],
    'form.cancel': ['取消', 'Отмена'],
    'form.note': ['修改后商品需要重新审核。', 'После изменения товар снова проходит модерацию.'],
    'form.buyer': ['买家看到的到手价（含运费和服务费）', 'Цена для покупателя под ключ (с доставкой и сбором)'],
    'err.required': ['必填', 'Обязательно'],
    'err.positive': ['必须大于 0', 'Должно быть больше 0'],
    'err.tiers': ['至少填写一个批发价档', 'Нужна хотя бы одна оптовая ступень'],
    'toast.submitted': ['已提交审核', 'Отправлено на модерацию'],
    'import.title': ['Excel 批量上传', 'Загрузка из Excel'],
    'import.s1': ['下载模板，每行填写一个商品。', 'Скачайте шаблон, одна строка — один товар.'],
    'import.s2': ['上传文件。如有错误，整个文件不会上传，并显示出错的行。', 'Загрузите файл. Если есть ошибка, не загрузится ничего, и вы увидите строку с ошибкой.'],
    'import.s3': ['新商品进入审核，通常 24 小时内完成。', 'Новые товары уходят на модерацию, обычно до 24 часов.'],
    'import.cols': ['模板列', 'Колонки шаблона'],
    'import.template': ['下载模板', 'Скачать шаблон'],
    'import.file': ['点击选择 .xlsx 文件', 'Нажмите, чтобы выбрать файл .xlsx'],
    'import.demo': ['预览版：文件不会真正上传，将添加 2 个示例商品。', 'Превью: файл не уходит на сервер, добавятся 2 товара-примера.'],
    'import.done': ['已上传 {n} 个商品，已提交审核', 'Загружено товаров: {n}, отправлены на модерацию'],
    'import.noDownload': ['预览版不能下载文件。正式版会下载双语 Excel 模板。', 'В превью скачивание отключено. В рабочей версии скачается двуязычный шаблон Excel.'],
    'ost.confirm': ['待确认库存', 'Подтвердите наличие'],
    'ost.ship': ['待发货', 'Отправьте на склад'],
    'ost.shipped': ['已发货', 'Отправлено'],
    'ost.received': ['仓库已签收', 'Принято складом'],
    'ost.cancelled': ['已取消', 'Отменён'],
    'order.retail': ['零售', 'Розница'],
    'order.wholesale': ['批发', 'Опт'],
    'order.deadline': ['请在 24 小时内确认', 'Подтвердите в течение 24 часов'],
    'order.inStock': ['有货，确认', 'Есть в наличии'],
    'order.outOfStock': ['缺货', 'Нет в наличии'],
    'order.whTitle': ['请发货至 TT 广州集货仓', 'Отправьте на склад TT в Гуанчжоу'],
    'order.whAddr': ['仓库地址和收件人请看 TT 经理微信。包裹上请写订单号。', 'Адрес склада и получателя даст менеджер TT в WeChat. Напишите номер заказа на коробке.'],
    'order.tracking': ['快递单号', 'Трек-номер'],
    'order.markShipped': ['确认已发货', 'Отправлено'],
    'order.waitWh': ['等待仓库签收 · 快递单号 {t}', 'Ждём приёмку на складе · трек {t}'],
    'order.received': ['仓库已签收，已计入本周结算', 'Склад принял, попадёт в выплату этой недели'],
    'order.cancelled': ['已通知买家，订单已取消', 'Покупатель уведомлён, заказ отменён'],
    'order.total': ['合计', 'Итого'],
    'order.size': ['尺码', 'Размер'],
    'order.empty': ['该状态下暂无订单', 'Заказов с таким статусом нет'],
    'toast.confirmed': ['已确认，请尽快发货到仓库', 'Подтверждено, отправьте на склад'],
    'toast.cancelled': ['已标记缺货，订单已取消', 'Отмечено «нет в наличии», заказ отменён'],
    'toast.shipped': ['已标记为已发货', 'Отмечено как отправленное'],
    'err.tracking': ['请填写快递单号', 'Укажите трек-номер'],
    'pay.pending': ['待结算', 'К выплате'],
    'pay.next': ['下次结算', 'Следующая выплата'],
    'pay.nextDate': ['下周一', 'в понедельник'],
    'pay.total': ['累计已结算', 'Выплачено всего'],
    'pay.rule': ['我们按您的报价全额结算（人民币）。平台服务费和运费由买家支付。每周一结算上周仓库已签收的订单。', 'Выплачиваем вашу цену полностью, в юанях. Сбор площадки и доставку оплачивает покупатель. Каждый понедельник платим за заказы, принятые складом на прошлой неделе.'],
    'pay.method': ['收款方式', 'Способ получения'],
    'pay.methodValue': ['支付宝或银行卡（通过 TT 支付代理），在店铺设置中修改', 'Alipay или карта (через платёжного агента TT), меняется в настройках магазина'],
    'pay.history': ['结算记录', 'История выплат'],
    'col.date': ['日期', 'Дата'],
    'col.period': ['周期', 'Период'],
    'col.orders': ['订单数', 'Заказов'],
    'col.amount': ['金额', 'Сумма'],
    'pay.paid': ['已支付', 'Выплачено'],
    'shop.name': ['店铺名称', 'Название магазина'],
    'shop.city': ['城市', 'Город'],
    'shop.about': ['店铺简介（买家可见）', 'О магазине (видят покупатели)'],
    'shop.wechat': ['微信', 'WeChat'],
    'shop.phone': ['联系电话', 'Телефон'],
    'shop.payout': ['收款方式', 'Способ получения выплат'],
    'shop.fact': ['实际时效（买家可见）', 'Фактический срок (видят покупатели)'],
    'shop.factNote': ['根据最近 40 个订单自动计算', 'Считается по последним 40 заказам'],
    'shop.lang': ['界面语言', 'Язык кабинета'],
    'shop.save': ['保存', 'Сохранить'],
    'toast.saved': ['已保存', 'Сохранено'],
    'days': ['天', 'дн.'],
    'pcs': ['件', 'шт.'],
    'kg': ['公斤', 'кг'],
    'from': ['{n} 件起', 'от {n} шт.'],
    'login.title': ['登录卖家中心', 'Вход в кабинет поставщика'],
    'login.user': ['用户名', 'Логин'],
    'login.pass': ['密码', 'Пароль'],
    'login.submit': ['登录', 'Войти'],
    'login.hint': ['账号由 TT 经理提供。忘记密码请联系经理。', 'Логин и пароль выдаёт менеджер TT. Если забыли пароль, напишите ему.'],
    'logout': ['退出', 'Выйти'],
    'err.network': ['网络错误，请重试', 'Ошибка сети, попробуйте ещё раз'],
    'err.save': ['保存失败：{e}', 'Не сохранилось: {e}'],
    'import.errors': ['文件未上传，请修改以下错误：', 'Файл не загружен. Исправьте ошибки:'],
    'import.uploading': ['正在上传…', 'Загружаю…'],
    'import.upload': ['上传', 'Загрузить'],
    'shop.payout': ['收款信息（支付宝、银行卡）', 'Реквизиты для выплат (Alipay, карта)'],
    'shop.nameNote': ['俄语店铺名称由审核员修改', 'Русское название меняет модератор'],
    'loading': ['加载中…', 'Загрузка…'],
  };
  const MOD_REASONS = {
    watermark: ['图片带有其他店铺的水印', 'Фото с водяным знаком другого магазина'],
    no_weight: ['未填写包装后重量', 'Не указан вес в упаковке'],
    no_photo: ['没有商品图片', 'Нет фото товара'],
    brand: ['疑似仿冒品牌，平台禁售', 'Похоже на копию бренда, такие товары запрещены'],
    banned: ['禁售商品（电池、药品等）', 'Запрещённый товар (батареи, лекарства и т. п.)'],
    blurry: ['图片不清晰，请重新上传', 'Фото нечёткие, загрузите заново'],
  };

  /* ---------- Демо-данные ---------- */
  const CATS = {
    clothes: ['服装', 'Одежда'], shoes: ['鞋类', 'Обувь'], furniture: ['家具', 'Мебель'], home: ['家居', 'Дом'],
    tech: ['电子产品', 'Электроника'], acc: ['配饰', 'Аксессуары'], bags: ['箱包', 'Сумки'],
  };
  const SEED_SUPPLIERS = [
    { code: 'gz', ru: 'TT · Гуанчжоу', zh: 'TT · 广州', cityRu: 'Гуанчжоу', cityZh: '广州', about: '服装批发，白马市场', wechat: 'tt_gz_baima', phone: '+86 138 0000 0001', fact: [17, 22], active: true, base: 16150, week: [3, 5, 4, 6, 4, 7, 5] },
    { code: 'jj', ru: 'TT · Цзиньцзян', zh: 'TT · 晋江', cityRu: 'Цзиньцзян', cityZh: '晋江', about: '福建鞋厂直供', wechat: 'tt_jinjiang', phone: '+86 138 0000 0002', fact: [16, 21], active: true, base: 9800, week: [2, 3, 2, 4, 3, 3, 4] },
    { code: 'fs', ru: 'TT · Фошань', zh: 'TT · 佛山', cityRu: 'Фошань', cityZh: '佛山', about: '乐从家具市场', wechat: 'tt_foshan', phone: '+86 138 0000 0003', fact: [27, 33], active: true, base: 21400, week: [1, 0, 1, 2, 1, 1, 2] },
    { code: 'sz', ru: 'TT · Шэньчжэнь', zh: 'TT · 深圳', cityRu: 'Шэньчжэнь', cityZh: '深圳', about: '华强北电子产品', wechat: 'tt_shenzhen', phone: '+86 138 0000 0004', fact: [15, 20], active: true, base: 7300, week: [2, 2, 3, 2, 4, 3, 2] },
    { code: 'yw', ru: 'TT · Иу', zh: 'TT · 义乌', cityRu: 'Иу', cityZh: '义乌', about: '福田市场配饰和箱包', wechat: 'tt_yiwu', phone: '+86 138 0000 0005', fact: [18, 23], active: true, base: 5600, week: [3, 2, 4, 3, 3, 5, 4] },
  ];
  // id, поставщик, категория, кит., рус., ¥, кг, опт, скидка, крупногабарит, просмотры, заказы
  const RAW = [
    ['runner', 'jj', 'shoes', '轻便跑步鞋 Cloud', 'Кроссовки беговые Cloud', 268, 1.1, [[6, 198], [30, 176]], 0, false, 9840, 41],
    ['loafers', 'jj', 'shoes', '麂皮乐福鞋', 'Лоферы замшевые', 210, 1, [[5, 165], [20, 148]], 15, false, 3120, 12],
    ['leather-jacket', 'gz', 'clothes', '真皮机车夹克', 'Косуха из натуральной кожи', 520, 1.6, [[3, 430], [10, 395]], 0, false, 6410, 18],
    ['bomber', 'gz', 'clothes', '宽松飞行员夹克', 'Бомбер oversize', 189, 0.9, [[5, 142], [30, 128]], 20, false, 5230, 22],
    ['tee-white', 'gz', 'clothes', '基础款纯棉T恤 240克', 'Футболка базовая, 240 г/м²', 39, 0.3, [[20, 26], [100, 22]], 0, false, 4870, 35],
    ['sweatshirt', 'gz', 'clothes', '三线毛圈卫衣', 'Свитшот, футер трёхнитка', 79, 0.6, [[10, 58], [50, 51]], 0, false, 2960, 14],
    ['tee-black', 'gz', 'clothes', '印花T恤', 'Футболка с принтом', 45, 0.3, [[20, 31], [100, 27]], 10, false, 3780, 19],
    ['sofa', 'fs', 'furniture', '三人位丝绒沙发', 'Диван трёхместный, велюр', 2980, 48, [[2, 2690], [5, 2480]], 0, true, 2140, 4],
    ['lounge-chair', 'fs', 'furniture', '旋转休闲椅', 'Кресло на поворотной опоре', 1150, 16, [[2, 990], [6, 920]], 0, true, 1580, 3],
    ['stool', 'fs', 'furniture', '白蜡木吧台凳', 'Табурет барный, ясень', 160, 4.5, [[4, 128], [20, 112]], 12, false, 1230, 6],
    ['lamp', 'fs', 'home', '可调灯头落地灯', 'Торшер с поворотным плафоном', 230, 5, [[4, 185], [20, 166]], 0, false, 1890, 7],
    ['headphones', 'sz', 'tech', '头戴式蓝牙耳机 5.3', 'Наушники накладные, Bluetooth 5.3', 159, 0.5, [[10, 118], [50, 104]], 0, false, 5410, 26],
    ['headphones-anc', 'sz', 'tech', '主动降噪耳机', 'Наушники с шумоподавлением', 299, 0.7, [[5, 236], [30, 214]], 0, false, 4120, 15],
    ['watch', 'yw', 'acc', '石英手表 40毫米表盘', 'Часы кварцевые, корпус 40 мм', 129, 0.3, [[10, 92], [50, 81]], 18, false, 3350, 17],
    ['sunglasses', 'yw', 'acc', '太阳镜 UV400', 'Очки солнцезащитные, UV400', 58, 0.15, [[20, 34], [100, 28]], 0, false, 2780, 21],
    ['bag', 'yw', 'bags', '环保皮革公文包', 'Сумка-портфель, экокожа', 245, 0.9, [[5, 188], [20, 170]], 0, false, 2210, 9],
    ['backpack', 'yw', 'bags', '城市双肩包 20升', 'Рюкзак городской, 20 л', 139, 0.8, [[10, 104], [40, 95]], 0, false, 2650, 13],
    ['armchair', 'fs', 'furniture', '拉扣单人沙发椅', 'Кресло с каретной стяжкой', 690, 11, [[2, 590], [6, 545]], 0, true, 1440, 5],
  ];
  const SEED_PRODUCTS = [
    ...RAW.map(([id, sup, cat, zh, ru, price, kg, tiers, sale, bulky, views, orders]) => ({
      id, sup, cat, zh, ru, price, kg, tiers, sale, bulky, views, orders, img: id, desc: '', status: 'published', reason: '',
    })),
    { id: 'hoodie-380', sup: 'gz', cat: 'clothes', zh: '加绒连帽卫衣 380克', ru: '', price: 96, kg: 0.8, tiers: [[10, 72], [50, 64]], sale: 0, bulky: false, views: 0, orders: 0, img: 'banner-hoodie', desc: '380克毛圈面料，宽松版型，男女同款', status: 'moderation', reason: '' },
    { id: 'denim-jacket', sup: 'gz', cat: 'clothes', zh: '水洗牛仔夹克', ru: 'Джинсовая куртка, варёная', price: 135, kg: 0.9, tiers: [[5, 105], [30, 96]], sale: 0, bulky: false, views: 0, orders: 0, img: 'hero-denim', desc: '', status: 'rejected', reason: 'watermark' },
    { id: 'eva-slides', sup: 'jj', cat: 'shoes', zh: 'EVA 拖鞋', ru: '', price: 25, kg: 0.4, tiers: [[20, 16], [100, 13]], sale: 0, bulky: false, views: 0, orders: 0, img: '', desc: '轻便防滑，36–45码', status: 'moderation', reason: '' },
    { id: 'logo-waist-bag', sup: 'yw', cat: 'bags', zh: '老花腰包 大牌同款', ru: '', price: 68, kg: 0.3, tiers: [[10, 45]], sale: 0, bulky: false, views: 0, orders: 0, img: 'bag', desc: '经典老花图案', status: 'moderation', reason: '' },
  ];
  // Перевод для кнопки «Перевести», когда модель недоступна (вне claude.ai).
  const DEMO_TRANSLATIONS = {
    '加绒连帽卫衣 380克': 'Худи с начёсом, 380 г/м²',
    'EVA 拖鞋': 'Шлёпанцы из EVA',
    '老花腰包 大牌同款': 'Поясная сумка с монограммой «как у бренда»',
    '水洗牛仔夹克': 'Джинсовая куртка, варёная',
    '迷你斜挎包': 'Мини-сумка через плечо',
    '冰丝阔腿裤': 'Широкие брюки из вискозы',
  };
  const IMPORT_SAMPLES = [
    { cat: 'bags', zh: '迷你斜挎包', price: 52, kg: 0.35, tiers: [[10, 38], [50, 33]], img: 'bag' },
    { cat: 'clothes', zh: '冰丝阔腿裤', price: 69, kg: 0.4, tiers: [[10, 49], [50, 43]], img: '' },
  ];
  // Заказ-закупка: ASTTA через агента выкупает товар у поставщика.
  const SEED_ORDERS = [
    { num: 'A-000131', sup: 'gz', date: '27.10 10:42', mode: 'retail', buyer: '@ivan_k', items: [['bomber', 'L', 1]], status: 'confirm' },
    { num: 'A-000129', sup: 'gz', date: '27.10 09:15', mode: 'wholesale', buyer: '+7 916 ***-**-21', items: [['tee-white', '', 50], ['tee-black', '', 30]], status: 'confirm' },
    { num: 'A-000124', sup: 'gz', date: '26.10 18:03', mode: 'retail', buyer: '@marina.shop', items: [['leather-jacket', 'M', 1]], status: 'ship' },
    { num: 'A-000117', sup: 'gz', date: '25.10 12:30', mode: 'wholesale', buyer: '@opt_wb_store', items: [['sweatshirt', '', 20]], status: 'shipped', tracking: 'YT7425581123' },
    { num: 'A-000108', sup: 'gz', date: '23.10 16:47', mode: 'retail', buyer: '@d.petrov', items: [['tee-black', 'XL', 2]], status: 'received' },
    { num: 'A-000130', sup: 'jj', date: '27.10 10:05', mode: 'retail', buyer: '@alex_run', items: [['runner', '42', 1]], status: 'confirm' },
    { num: 'A-000121', sup: 'jj', date: '26.10 11:20', mode: 'wholesale', buyer: '@shoes_kzn', items: [['loafers', '', 5]], status: 'ship' },
    { num: 'A-000127', sup: 'yw', date: '27.10 08:51', mode: 'wholesale', buyer: '@optika_msk', items: [['sunglasses', '', 20]], status: 'confirm' },
    { num: 'A-000120', sup: 'fs', date: '26.10 09:40', mode: 'retail', buyer: '+7 903 ***-**-08', items: [['sofa', '', 1]], status: 'shipped', tracking: 'SF1302948871' },
    { num: 'A-000126', sup: 'sz', date: '26.10 21:12', mode: 'retail', buyer: '@sound_lab', items: [['headphones-anc', '', 1]], status: 'received' },
  ];
  const PAYOUTS = [['20.10', '13–19.10', 14, 15420], ['13.10', '06–12.10', 11, 12960], ['06.10', '29.09–05.10', 9, 9875]];
  const BUYER_STATUS = [
    ['new', 'Новый: агент проверяет наличие'], ['confirmed', 'Подтверждён: ждёт оплаты'], ['paid', 'Оплачен'],
    ['purchased', 'Выкуплен у поставщика'], ['at_warehouse', 'На складе в Китае'], ['shipped', 'Отправлен в Россию'],
    ['border', 'На границе'], ['in_russia', 'В России'], ['ready', 'В пункте выдачи'], ['delivered', 'Получен'], ['cancelled', 'Отменён'],
  ];
  const SUPPLIER_TO_BUYER = { confirm: 'new', ship: 'paid', shipped: 'purchased', received: 'at_warehouse', cancelled: 'cancelled' };
  const SEED_PRICING = {
    rate: 11.4, rateDate: '27.10.2026', markup: 0, retailFee: 5, optFee: 3,
    ship: [
      { code: 'auto', name: 'Авто', perKg: 420, days: [18, 25], bulky: false },
      { code: 'air', name: 'Авиа', perKg: 980, days: [8, 12], bulky: false },
      { code: 'cargo', name: 'Сборный груз', perKg: 190, days: [25, 35], bulky: true },
    ],
  };

  /* ---------- Состояние ---------- */
  // Если страницу отдаёт сервер (/seller/), в body есть data-api: работаем с настоящими данными.
  const API = document.body.dataset.api || '';
  const LIVE = !!API;
  const KEY = 'astta-seller-v1';
  const clone = (x) => JSON.parse(JSON.stringify(x));
  function fresh() {
    return {
      role: 'supplier', lang: 'zh', acting: null, view: { supplier: 'overview', moderator: 'moderation' },
      pfilter: 'all', ofilter: 'confirm', mfilter: { sup: '', status: '', q: '' },
      products: clone(SEED_PRODUCTS), orders: clone(SEED_ORDERS), suppliers: clone(SEED_SUPPLIERS),
      pricing: clone(SEED_PRICING), buyerStatus: {}, imported: 0, factory: {}, posts: [],
    };
  }
  let S;
  if (LIVE) {
    S = { ...fresh(), products: [], orders: [], suppliers: [], posts: [], factory: {}, me: null, live: {} };
  } else {
    try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  }
  // Каталоги поставщиков загружает команда ASTTA: на сервере она работает в кабинете за поставщика,
  // пишет по-русски и публикует сразу, без модерации.
  const team = () => LIVE && !!(S.me && S.me.can_act);
  function save() {
    if (LIVE) return;
    try {
      // Фото, загруженные в превью, не сохраняем: они большие и только для показа.
      const light = { ...S, products: S.products.map((p) => (p.img && p.img.startsWith('data:') ? { ...p, img: '' } : p)) };
      localStorage.setItem(KEY, JSON.stringify(light));
    } catch (e) { /* хранилище недоступно: работаем без сохранения */ }
  }

  const DEFAULT_SUP = 'gz';
  const isMod = () => S.role === 'moderator';
  const supCode = () => (LIVE ? S.acting || (S.me && S.me.supplier && S.me.supplier.code) : S.acting || DEFAULT_SUP);
  const supplier = (code = supCode()) => S.suppliers.find((s) => s.code === code);
  const product = (id) => S.products.find((p) => p.id === id);
  // Модератор, открывший кабинет поставщика, видит его по-русски.
  const L = () => (S.role === 'supplier' && !S.acting ? S.lang : 'ru');
  const li = () => (L() === 'zh' ? 0 : 1);
  function t(key, vars = {}) {
    const pair = I18N[key];
    let s = pair ? pair[li()] : key;
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  }
  const catName = (c) => (CATS[c] ? CATS[c][li()] : c);
  const supName = (s) => (L() === 'zh' ? s.zh : s.ru);
  const pName = (p) => (L() === 'zh' && p.zh ? p.zh : (p.ru || p.zh));

  /* ---------- Цена (как на сервере: backend/pricing/services.py) ---------- */
  const unitCny = (p) => (p.sale ? Math.round(p.price * (1 - p.sale / 100)) : p.price);
  function tierFor(p, qty) {
    let price = p.tiers[0] ? p.tiers[0][1] : p.price;
    for (const [from, c] of p.tiers) if (qty >= from) price = c;
    return price;
  }
  const lineCny = (p, qty, mode) => (mode === 'wholesale' ? tierFor(p, qty) : unitCny(p)) * qty;
  function buyerRub(p, qty = 1, mode = 'retail') {
    const pr = S.pricing;
    const rate = pr.rate * (1 + pr.markup / 100);
    const method = pr.ship.find((m) => (p.bulky ? m.bulky : m.code === 'auto')) || pr.ship[0];
    const goods = lineCny(p, qty, mode) * rate;
    const fee = goods * (mode === 'wholesale' ? pr.optFee : pr.retailFee) / 100;
    return round10(goods + p.kg * method.perKg * qty + fee);
  }
  const orderCny = (o) => o.items.reduce((sum, [id, , qty, unit]) => sum + (unit ?? lineCny(product(id), qty, o.mode) / qty) * qty, 0);
  const orderRub = (o) => o.items.reduce((sum, [id, , qty]) => sum + buyerRub(product(id), qty, o.mode), 0);

  /* ---------- Общие куски ---------- */
  function thumb(p, size = '') {
    return p.img ? `<img class="thumb ${size}" src="${esc(imgSrc(p.img))}" alt="" width="48" height="48" loading="lazy">`
      : `<span class="thumb thumb--empty ${size}">${L() === 'zh' ? '无图' : 'нет фото'}</span>`;
  }
  const PST = { published: 'st--ok', moderation: 'st--wait', rejected: 'st--bad' };
  const OST = { confirm: 'st--wait', ship: 'st--go', shipped: 'st--go', received: 'st--ok', cancelled: 'st--bad' };
  const pStatus = (p) => `<span class="st ${PST[p.status] || ''}">${t(`status.${p.status}`)}</span>`;
  const reasonText = (p) => (p.reason ? (MOD_REASONS[p.reason] ? MOD_REASONS[p.reason][li()] : p.reason) : '');
  const tiersText = (p) => p.tiers.map(([q, c]) => `${q}+ · ${cny(c)}`).join('<br>');

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  /* ---------- Каркас ---------- */
  const SUP_NAV = [['overview', 'home'], ['products', 'box'], ['orders', 'truck'], ['factory', 'spark'], ['payouts', 'tag'], ['shop', 'user']];
  const MOD_NAV = [['moderation', 'check', 'Модерация'], ['catalog', 'grid', 'Все товары'], ['suppliers', 'users', 'Поставщики'],
    ['orders', 'truck', 'Заказы'], ['pricing', 'tag', 'Цены и доставка']];

  function render() {
    document.documentElement.lang = L() === 'zh' ? 'zh-Hans' : 'ru';
    $('#topTitle').textContent = isMod() ? 'Модерация' : t('top.title');
    $('#topDemo').textContent = isMod() ? 'Превью · демо-данные' : t('top.demo');
    document.title = isMod() ? 'ASTTA · Модерация' : `ASTTA ${t('top.title')}`;
    for (const b of document.querySelectorAll('[data-role]')) b.setAttribute('aria-checked', String(b.dataset.role === (S.acting ? 'moderator' : S.role)));
    $('#langSwitch').hidden = S.role !== 'supplier' || !!S.acting;
    for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-checked', String(b.dataset.lang === S.lang));
    if (LIVE) renderLiveTop();

    const banner = $('#banner');
    banner.hidden = !S.acting || (LIVE && !supplier());
    if (!banner.hidden) {
      banner.innerHTML = `<span>Вы в кабинете поставщика «${esc(supplier().ru)}» как модератор: видите и меняете всё, что видит он.</span>
        ${LIVE ? '<a class="btn btn--sm" href="/admin/">Вернуться в админку</a>' : '<button class="btn btn--sm" type="button" data-act="stop-acting">Вернуться к модерации</button>'}`;
    }
    if (LIVE && (!S.me || S.loading || !supplier())) {
      $('#side').innerHTML = '';
      $('#main').innerHTML = !S.me ? vLogin() : `<div class="empty">${S.loadError ? esc(S.loadError) : t('loading')}</div>`;
      return;
    }

    const view = S.view[S.role];
    let nav;
    if (S.role === 'supplier') {
      const counts = supplierCounts();
      nav = SUP_NAV.map(([id, ic]) => navBtn(id, ic, t(`nav.${id}`), id === 'orders' ? counts.todo : (id === 'products' ? counts.rejected : 0)));
    } else {
      const queue = S.products.filter((p) => p.status === 'moderation').length;
      nav = MOD_NAV.map(([id, ic, name]) => navBtn(id, ic, name, id === 'moderation' ? queue : 0));
    }
    $('#side').innerHTML = nav.join('');
    const views = S.role === 'supplier'
      ? { overview: vOverview, products: vProducts, orders: vOrders, factory: vFactory, payouts: vPayouts, shop: vShop }
      : { moderation: vModeration, catalog: vCatalog, suppliers: vSuppliers, orders: vModOrders, pricing: vPricing };
    $('#main').innerHTML = (views[view] || Object.values(views)[0])();
  }
  const navBtn = (id, ic, name, badge) => `<button type="button" data-nav="${id}" ${S.view[S.role] === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(name)}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;

  function supplierCounts(code = supCode()) {
    const orders = S.orders.filter((o) => o.sup === code);
    const products = S.products.filter((p) => p.sup === code);
    return {
      confirm: orders.filter((o) => o.status === 'confirm').length,
      ship: orders.filter((o) => o.status === 'ship').length,
      todo: orders.filter((o) => o.status === 'confirm' || o.status === 'ship').length,
      review: products.filter((p) => p.status === 'moderation').length,
      rejected: products.filter((p) => p.status === 'rejected').length,
      today: LIVE ? S.live.today : orders.filter((o) => o.date.startsWith('27.10')).length,
      pending: LIVE ? S.live.pending : supplier(code).base + orders.filter((o) => o.status === 'received').reduce((s, o) => s + orderCny(o), 0),
    };
  }

  /* ---------- Поставщик: обзор ---------- */
  function vOverview() {
    const s = supplier();
    const c = supplierCounts();
    const todo = [
      c.confirm && `<button type="button" data-goto="orders" data-ofilter="confirm"><span class="dot dot--warn"></span>${t('todo.confirm', { n: c.confirm })}${icon('arrow-ur')}</button>`,
      c.ship && `<button type="button" data-goto="orders" data-ofilter="ship"><span class="dot"></span>${t('todo.ship', { n: c.ship })}${icon('arrow-ur')}</button>`,
      c.rejected && `<button type="button" data-goto="products" data-pfilter="rejected"><span class="dot dot--bad"></span>${t('todo.rejected', { n: c.rejected })}${icon('arrow-ur')}</button>`,
    ].filter(Boolean);
    const max = Math.max(...s.week, 1);
    const days = LIVE ? S.live.weekLabels : (L() === 'zh' ? ['一', '二', '三', '四', '五', '六', '日'] : ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']);
    return `
      <div class="pagehead"><div><h1>${t('hello', { name: esc(supName(s)) })}</h1><p>${t('hello.sub')}</p></div>
        <div class="pagehead__actions"><button class="btn btn--lime" type="button" data-act="add-product">${icon('plus')}${t('products.add')}</button></div></div>
      <div class="kpis">
        <button class="kpi" type="button" data-goto="orders" data-ofilter="confirm"><span>${t('kpi.new')}</span><b>${c.today}</b></button>
        <button class="kpi kpi--hot" type="button" data-goto="orders" data-ofilter="confirm"><span>${t('kpi.todo')}</span><b>${c.todo}</b></button>
        <button class="kpi" type="button" data-goto="products" data-pfilter="moderation"><span>${t('kpi.review')}</span><b>${c.review}</b></button>
        <button class="kpi" type="button" data-goto="payouts"><span>${t('kpi.balance')}</span><b>${cny(c.pending)}</b></button>
      </div>
      <div class="grid2">
        <section class="panel"><h2>${t('todo.title')}</h2>
          <div class="todo">${todo.join('') || `<p class="muted">${t('todo.none')}</p>`}</div>
          <h2>${t('chart.title')}</h2>
          <div class="bars">${s.week.map((n, i) => `<div><b>${n}</b><i style="height:${(n / max) * 100}%"></i><span>${days[i]}</span></div>`).join('')}</div>
        </section>
        <section class="panel"><h2>${t('tips.title')}</h2>
          <ol class="tips"><li>${t('tips.1')}</li><li>${t('tips.2')}</li><li>${t('tips.3')}</li><li>${t('tips.4')}</li></ol>
        </section>
      </div>`;
  }

  /* ---------- Поставщик: товары ---------- */
  function vProducts() {
    const mine = S.products.filter((p) => p.sup === supCode());
    const count = (st) => mine.filter((p) => p.status === st).length;
    const list = S.pfilter === 'all' ? mine : mine.filter((p) => p.status === S.pfilter);
    const chips = [['all', mine.length], ['published', count('published')], ['moderation', count('moderation')], ['rejected', count('rejected')]]
      .map(([id, n]) => `<button class="chip" type="button" data-pfilter="${id}" aria-pressed="${S.pfilter === id}">${id === 'all' ? t('filter.all') : t(`status.${id}`)}<em>${n}</em></button>`).join('');
    const rows = list.map((p) => `<tr>
        <td><div class="pcell">${thumb(p)}${team()
          ? `<div><b>${esc(p.ru)}</b><span>${esc([p.sku, catName(p.cat)].filter(Boolean).join(' · '))}</span></div>`
          : `<div><b>${esc(p.zh)}</b><span>${esc(p.ru || '—')} · ${esc(catName(p.cat))}</span></div>`}</div></td>
        <td class="num">${cny(p.price)}${p.sale ? `<br><span class="muted">−${p.sale}%</span>` : ''}</td>
        <td class="num">${tiersText(p)}</td>
        <td class="num">${p.kg} ${t('kg')}</td>
        <td>${pStatus(p)}${p.status === 'rejected' ? `<span class="reason">${esc(reasonText(p))}</span>` : ''}</td>
        <td class="num">${nf.format(p.views)} · ${p.orders}</td>
        <td><button class="btn btn--sm" type="button" data-act="edit-product" data-id="${p.id}">${t('act.edit')}</button></td>
      </tr>`).join('');
    return `
      <div class="pagehead"><div><h1>${t('nav.products')}</h1><p>${team() ? 'Каталог поставщика на сайте. Что вы сохраняете здесь, сразу видят покупатели.' : t('products.sub')}</p></div>
        <div class="pagehead__actions">
          <button class="btn" type="button" data-act="import">${icon('upload')}${team() ? 'Загрузить каталог' : t('products.import')}</button>
          <button class="btn btn--lime" type="button" data-act="add-product">${icon('plus')}${t('products.add')}</button>
        </div></div>
      <div class="filters">${chips}</div>
      ${list.length ? `<div class="tablewrap"><table class="tbl"><thead><tr>
        <th>${t('col.product')}</th><th class="num">${t('col.price')}</th><th class="num">${t('col.tiers')}</th><th class="num">${t('col.weight')}</th>
        <th>${t('col.status')}</th><th class="num">${t('col.stats')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<div class="empty">${t('empty.products')}</div>`}`;
  }

  /* ---------- Форма товара (поставщик и модератор) ---------- */
  let draft = null;
  let draftFile = null;
  function openProductForm(id) {
    const p = id ? product(id) : null;
    draftFile = null;
    draft = p ? clone(p) : { id: '', sup: supCode(), cat: Object.keys(CATS)[0], zh: '', ru: '', sku: '', src: '', price: '', kg: '', tiers: team() ? [] : [[10, '']], sale: 0, bulky: false, views: 0, orders: 0, img: '', desc: '', status: 'moderation', reason: '' };
    openDrawer(p ? t('form.edit') : t('form.add'), productFormHTML());
  }
  function productFormHTML(errors = {}) {
    const d = draft;
    const err = (k) => (errors[k] ? `<span class="err">${errors[k]}</span>` : '');
    const cls = (k) => (errors[k] ? 'field is-error' : 'field');
    const tiers = d.tiers.map(([q, c], i) => `<div class="tier">
        <input type="number" min="1" step="1" inputmode="numeric" aria-label="${t('form.tierQty')}" placeholder="${t('form.tierQty')}" value="${esc(q)}" data-tier="${i}" data-k="0">
        <input type="number" min="0.01" step="0.01" inputmode="decimal" aria-label="${t('form.tierPrice')}" placeholder="${t('form.tierPrice')}" value="${esc(c)}" data-tier="${i}" data-k="1">
        <button class="iconbtn" type="button" data-act="del-tier" data-i="${i}" aria-label="×" ${d.tiers.length < 2 && !team() ? 'disabled' : ''}>${icon('close')}</button></div>`).join('');
    if (team()) return teamFormHTML(d, errors, err, cls, tiers);
    const mod = isMod() && !S.acting;
    const modFields = mod ? `
      <label class="field"><span>Поставщик</span><select id="fSup">${S.suppliers.map((s) => `<option value="${s.code}" ${s.code === d.sup ? 'selected' : ''}>${esc(s.ru)}</option>`).join('')}</select></label>
      <label class="field"><span>Статус</span><select id="fStatus">${['published', 'moderation', 'rejected'].map((st) => `<option value="${st}" ${st === d.status ? 'selected' : ''}>${t(`status.${st}`)}</option>`).join('')}</select></label>
      <label class="field field--full"><span>Причина отклонения (видит поставщик)</span><select id="fReason"><option value="">—</option>${Object.entries(MOD_REASONS).map(([k, v]) => `<option value="${k}" ${d.reason === k ? 'selected' : ''}>${v[1]}</option>`).join('')}</select></label>` : '';
    const priceOk = Number(d.price) > 0 && Number(d.kg) > 0;
    return `<form class="form" id="productForm" novalidate>
      <label class="${cls('zh')} field--full"><span>${t('form.zh')}</span><input id="fZh" value="${esc(d.zh)}" required>${err('zh')}</label>
      <label class="${cls('ru')} field--full"><span>${mod ? 'Название (рус.), обязательно для публикации' : t('form.ru')}</span>
        <input id="fRu" value="${esc(d.ru)}">${err('ru')}</label>
      ${mod ? `<div class="field--full"><button class="linkbtn" type="button" data-act="translate-form">Перевести с китайского</button></div>` : ''}
      <label class="field"><span>${t('form.cat')}</span><select id="fCat">${Object.keys(CATS).map((c) => `<option value="${c}" ${c === d.cat ? 'selected' : ''}>${catName(c)}</option>`).join('')}</select></label>
      <label class="${cls('price')}"><span>${t('form.price')}</span><input id="fPrice" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(d.price)}">${err('price')}</label>
      <label class="field"><span>${t('form.sale')}</span><input id="fSale" type="number" min="0" max="90" step="1" inputmode="numeric" value="${esc(d.sale)}"></label>
      <label class="${cls('kg')}"><span>${t('form.weight')}</span><input id="fKg" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(d.kg)}">${err('kg')}</label>
      <div class="${cls('tiers')} field--full"><span>${t('form.tiers')}</span><div class="tiers">${tiers}</div>
        <button class="linkbtn" type="button" data-act="add-tier" style="align-self:flex-start">${t('form.addTier')}</button>${err('tiers')}</div>
      <label class="check field--full"><input id="fBulky" type="checkbox" ${d.bulky ? 'checked' : ''}>${t('form.bulky')}</label>
      <label class="field field--full"><span>${t('form.photo')}</span><input id="fPhoto" type="file" accept="image/*"></label>
      ${d.img ? `<div class="preview field--full"><img src="${esc(imgSrc(d.img))}" alt=""><span class="muted">${esc(d.zh)}</span></div>` : ''}
      <label class="field field--full"><span>${t('form.desc')}</span><textarea id="fDesc">${esc(d.desc)}</textarea></label>
      ${modFields}
      ${priceOk && d.tiers[0] && Number(d.tiers[0][1]) > 0 ? `<div class="price-hint field--full">${t('form.buyer')}: <b>${rub(buyerRub(normalize(d)))}</b></div>` : ''}
      ${!mod ? `<p class="note field--full">${t('form.note')}</p>` : ''}
      <div class="form__actions">
        <button class="btn" type="button" data-act="close-drawer">${t('form.cancel')}</button>
        <button class="btn btn--lime" type="submit">${mod ? 'Сохранить' : t('form.submit')}</button>
      </div></form>`;
  }
  function teamFormHTML(d, errors, err, cls, tiers) {
    const priceOk = Number(d.price) > 0 && Number(d.kg) > 0;
    const more = d.photos > 1 ? `<p class="note field--full">У товара фото: ${d.photos}. Остальные фото загружайте архивом в «Загрузке каталога».</p>` : '';
    return `<form class="form" id="productForm" novalidate>
      <label class="${cls('ru')} field--full"><span>Название для покупателей</span><input id="fRu" value="${esc(d.ru)}" required>${err('ru')}</label>
      <label class="${cls('sku')}"><span>Артикул поставщика</span><input id="fSku" value="${esc(d.sku)}" maxlength="64">${err('sku')}</label>
      <label class="field"><span>Категория</span><select id="fCat">${Object.keys(CATS).map((c) => `<option value="${c}" ${c === d.cat ? 'selected' : ''}>${esc(CATS[c][1])}</option>`).join('')}</select></label>
      <label class="${cls('price')}"><span>Цена у поставщика, ¥</span><input id="fPrice" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(d.price)}">${err('price')}</label>
      <label class="field"><span>Скидка, %</span><input id="fSale" type="number" min="0" max="90" step="1" inputmode="numeric" value="${esc(d.sale)}"></label>
      <label class="${cls('kg')}"><span>Вес в упаковке, кг</span><input id="fKg" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(d.kg)}">${err('kg')}</label>
      <div class="field field--full"><span>Опт: от скольки штук и цена за штуку. Можно не заполнять, тогда товар только в розницу</span><div class="tiers">${tiers}</div>
        <button class="linkbtn" type="button" data-act="add-tier" style="align-self:flex-start">+ Оптовая ступень</button></div>
      <label class="check field--full"><input id="fBulky" type="checkbox" ${d.bulky ? 'checked' : ''}>Крупногабарит (мебель, едет сборным грузом)</label>
      <label class="field field--full"><span>Главное фото</span><input id="fPhoto" type="file" accept="image/*"></label>
      ${d.img ? `<div class="preview field--full"><img src="${esc(imgSrc(d.img))}" alt=""><span class="muted">${esc(d.ru)}</span></div>` : ''}
      ${more}
      <label class="field field--full"><span>Описание</span><textarea id="fDesc">${esc(d.desc)}</textarea></label>
      <label class="${cls('src')} field--full"><span>Ссылка у поставщика (1688, Taobao, Poizon)</span><input id="fSrc" type="url" inputmode="url" value="${esc(d.src)}" placeholder="https://">${err('src')}</label>
      <label class="field field--full"><span>Название на китайском (для заказа у поставщика, можно пусто)</span><input id="fZh" value="${esc(d.zh)}"></label>
      ${priceOk ? `<div class="price-hint field--full">Цена для покупателя под ключ: <b>${rub(buyerRub(normalize(d)))}</b></div>` : ''}
      <p class="note field--full">После сохранения товар сразу появится на сайте.</p>
      <div class="form__actions">
        <button class="btn" type="button" data-act="close-drawer">Отмена</button>
        <button class="btn btn--lime" type="submit">Сохранить и опубликовать</button>
      </div></form>`;
  }
  function normalize(d) {
    return { ...d, price: Number(d.price), kg: Number(d.kg), sale: Number(d.sale) || 0, tiers: d.tiers.map(([q, c]) => [Number(q), Number(c)]).filter(([q, c]) => q > 0 && c > 0).sort((a, b) => a[0] - b[0]) };
  }
  function readForm() {
    draft.zh = $('#fZh').value.trim();
    draft.ru = $('#fRu').value.trim();
    draft.cat = $('#fCat').value;
    draft.price = $('#fPrice').value;
    draft.sale = $('#fSale').value;
    draft.kg = $('#fKg').value;
    draft.bulky = $('#fBulky').checked;
    draft.desc = $('#fDesc').value.trim();
    if ($('#fSku')) {
      draft.sku = $('#fSku').value.trim();
      draft.src = $('#fSrc').value.trim();
    }
    if ($('#fSup')) {
      draft.sup = $('#fSup').value;
      draft.status = $('#fStatus').value;
      draft.reason = $('#fReason').value;
    }
  }
  function submitProduct() {
    readForm();
    const mod = isMod() && !S.acting;
    const n = normalize(draft);
    const errors = {};
    if (team()) {
      if (!n.ru) errors.ru = 'Обязательно';
      if (n.src && !/^https?:\/\/\S+$/i.test(n.src)) errors.src = 'Нужна ссылка вида https://…';
    } else {
      if (!n.zh) errors.zh = t('err.required');
      if (!n.tiers.length) errors.tiers = t('err.tiers');
    }
    if (!(n.price > 0)) errors.price = t('err.positive');
    if (!(n.kg > 0)) errors.kg = t('err.positive');
    if (mod && n.status === 'published' && !n.ru) errors.ru = 'Для публикации нужно русское название';
    if (Object.keys(errors).length) {
      $('#drawerBody').innerHTML = productFormHTML(errors);
      return;
    }
    if (LIVE) { liveSaveProduct(n); return; }
    if (!mod) {
      n.status = 'moderation';
      n.reason = '';
    }
    if (!n.id) {
      n.id = `p${Date.now().toString(36)}`;
      S.products.unshift(n);
    } else {
      S.products[S.products.findIndex((p) => p.id === n.id)] = n;
    }
    save();
    closeDrawer();
    toast(mod ? 'Сохранено' : t('toast.submitted'));
    render();
  }

  // Двойной клик по «Сохранить» не должен создавать два одинаковых товара.
  let saving = false;
  async function liveSaveProduct(n) {
    if (saving) return;
    saving = true;
    try {
      const body = { zh: n.zh, ru: n.ru, sku: n.sku || '', src: n.src || '', cat: n.cat, price: n.price, sale: n.sale, kg: n.kg, bulky: n.bulky, tiers: n.tiers, desc: n.desc };
      let saved;
      try {
        saved = await api(n.id ? `/products/${n.id}` : '/products', { method: n.id ? 'PUT' : 'POST', body });
      } catch (e) {
        // Повтор артикула показываем у поля, остальные ошибки сервера — всплывающим сообщением.
        if (/'sku': 'duplicate'/.test(e.message)) { $('#drawerBody').innerHTML = productFormHTML({ sku: 'Такой артикул уже есть у этого поставщика' }); return; }
        toast(t('err.save', { e: e.message }));
        return;
      }
      // Если фото не загрузится, шторка остаётся открытой, а повторное сохранение обновит этот же товар.
      draft.id = String(saved.id);
      upsert(S.products, mapProduct(supCode())(saved));
      if (draftFile) {
        const form = new FormData();
        form.append('file', draftFile);
        const withImage = await liveTry(() => api(`/products/${saved.id}/image`, { method: 'POST', form }));
        if (!withImage) return;
        upsert(S.products, mapProduct(supCode())(withImage));
      }
      closeDrawer();
      toast(team() ? 'Сохранено, товар на сайте' : t('toast.submitted'));
      render();
    } finally {
      saving = false;
    }
  }

  /* ---------- Загрузка из Excel ---------- */
  function openImport() {
    const tm = team();
    const cols = tm
      ? ['Артикул', 'Название', 'Категория', 'Цена у поставщика, ¥', 'Вес, кг', 'Опт (можно пусто)', 'Крупногабарит', 'Описание', 'Ссылка у поставщика', 'Название на китайском']
      : L() === 'zh'
        ? ['货号', '商品名称（中文）', '俄语名称', '类目', '零售价（元）', '包装后重量（公斤）', '批发价 起批量:单价', '大件', '描述']
        : ['Артикул', 'Название (кит.)', 'Название (рус.)', 'Категория', 'Цена, ¥', 'Вес, кг', 'Опт от шт.:цена', 'Крупногабарит', 'Описание'];
    const steps = tm
      ? ['Скачайте шаблон и перенесите туда каталог поставщика: одна строка — один товар.',
        'Фото сложите в ZIP: имя файла начинается с артикула (A-101.jpg, A-101_2.jpg) или фото лежат в папке с артикулом. Новые фото заменяют старые. Если товары уже есть, можно загрузить только архив.',
        'Если в файле или архиве ошибка, не загрузится ничего, и вы увидите, что исправить.']
      : [t('import.s1'), t('import.s2'), t('import.s3')];
    openDrawer(tm ? 'Загрузка каталога' : t('import.title'), `
      <ol class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
      <div><p class="note">${t('import.cols')}</p><div class="cols">${cols.map((c) => `<span>${esc(c)}</span>`).join('')}</div></div>
      <button class="btn" type="button" data-act="template" style="align-self:flex-start">${icon('upload')}${t('import.template')}</button>
      <form class="form" id="importForm" novalidate style="grid-template-columns:minmax(0,1fr)">
        <label class="drop">${icon('upload')}<b>${t('import.file')}</b><input type="file" id="importFile" accept=".xlsx"></label>
        ${tm ? `<label class="drop">${icon('upload')}<b>Архив с фото .zip (необязательно)</b><input type="file" id="importPhotos" accept=".zip,application/zip"></label>
        <label class="check"><input id="importPublish" type="checkbox" checked>Сразу опубликовать на сайте</label>` : ''}
        <div class="form__actions"><button class="btn btn--lime" type="submit">${icon('upload')}${t('import.upload')}</button></div>
      </form>
      ${LIVE ? '' : `<p class="note">${t('import.demo')}</p>`}
      <div id="importResult"></div>`);
  }
  let importing = false;
  async function doImport() {
    const file = $('#importFile').files[0];
    const photos = $('#importPhotos') ? $('#importPhotos').files[0] : null;
    if (!file && !photos) { toast(team() ? 'Выберите файл Excel или архив с фото' : t('import.file')); return; }
    if (LIVE) {
      if (importing) return;
      importing = true;
      const out = $('#importResult');
      out.innerHTML = `<p class="note">${t('import.uploading')}${photos ? ' Фото уменьшаем и сохраняем, на большой архив уходит пара минут.' : ''}</p>`;
      const form = new FormData();
      if (file) form.append('file', file);
      if (photos) form.append('photos', photos);
      const publish = !!($('#importPublish') && $('#importPublish').checked);
      if ($('#importPublish')) form.append('publish', publish ? 'true' : 'false');
      let res;
      try {
        res = await liveTry(() => api('/import', { method: 'POST', form }));
      } finally {
        importing = false;
      }
      if (!res) { out.innerHTML = ''; return; }
      const warnings = (res.warnings || []).length
        ? `<div class="panel" style="border-color:var(--warn)"><ul class="tips">${res.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
      if (!res.ok) {
        out.innerHTML = `<div class="panel" style="border-color:var(--bad)"><b>${t('import.errors')}</b><ul class="tips">${res.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>${warnings}`;
        return;
      }
      S.products = (await api('/products')).map(mapProduct(supCode()));
      const done = team()
        ? `Готово: новых ${res.created}, обновлено ${res.updated}, фото ${res.photos}. ${publish ? 'Товары уже на сайте.' : 'Товары ушли на модерацию.'}`
        : t('import.done', { n: res.created + res.updated });
      out.innerHTML = `<div class="result">${done}</div>${warnings}`;
      render();
      return;
    }
    const added = IMPORT_SAMPLES.map((s, i) => ({
      id: `imp${Date.now().toString(36)}${i}`, sup: supCode(), ru: '', sale: 0, bulky: false, views: 0, orders: 0, desc: '', status: 'moderation', reason: '', ...clone(s),
    }));
    S.products.unshift(...added);
    save();
    $('#importResult').innerHTML = `<div class="result">${t('import.done', { n: added.length })}</div>`;
    render();
  }

  /* ---------- Поставщик: заказы ---------- */
  function vOrders() {
    const mine = S.orders.filter((o) => o.sup === supCode());
    const chips = ['confirm', 'ship', 'shipped', 'received', 'cancelled'].map((st) => {
      const n = mine.filter((o) => o.status === st).length;
      return `<button class="chip" type="button" data-ofilter="${st}" aria-pressed="${S.ofilter === st}">${t(`ost.${st}`)}<em>${n}</em></button>`;
    }).join('');
    const list = mine.filter((o) => o.status === S.ofilter);
    return `
      <div class="pagehead"><div><h1>${t('nav.orders')}</h1></div></div>
      <div class="filters">${chips}</div>
      <div class="orders">${list.map(orderCard).join('') || `<div class="empty">${t('order.empty')}</div>`}</div>`;
  }
  function orderCard(o) {
    const items = o.items.map(([id, size, qty, fixedUnit, info]) => {
      // В боевом режиме цена и название берутся из заказа: они зафиксированы в момент покупки.
      const p = product(id) || info;
      const unit = fixedUnit ?? (o.mode === 'wholesale' ? tierFor(p, qty) : unitCny(p));
      return `<div class="oitem">${thumb(p)}<div><b>${esc(pName(p))}</b><span>${size ? `${t('order.size')} ${esc(size)} · ` : ''}${qty} ${t('pcs')} × ${cny(unit)}</span></div><div class="num">${cny(unit * qty)}</div></div>`;
    }).join('');
    let actions = '';
    let extra = '';
    if (o.status === 'confirm') {
      actions = `<span class="deadline">${t('order.deadline')}</span>
        <button class="btn btn--sm btn--bad" type="button" data-act="out-of-stock" data-num="${o.num}">${t('order.outOfStock')}</button>
        <button class="btn btn--sm btn--lime" type="button" data-act="confirm-order" data-num="${o.num}">${icon('check')}${t('order.inStock')}</button>`;
    } else if (o.status === 'ship') {
      extra = `<div class="ocard__wh"><b>${t('order.whTitle')}</b><span class="muted">${t('order.whAddr')}</span>
        <form data-ship-form="${o.num}" novalidate><label class="sr" for="tr-${o.num}">${t('order.tracking')}</label>
          <input id="tr-${o.num}" placeholder="${t('order.tracking')}" autocomplete="off">
          <button class="btn btn--lime" type="submit">${icon('truck')}${t('order.markShipped')}</button></form></div>`;
    } else if (o.status === 'shipped') {
      actions = `<span class="muted">${t('order.waitWh', { t: esc(o.tracking) })}</span>`;
    } else if (o.status === 'received') {
      actions = `<span class="muted">${t('order.received')}</span>`;
    } else {
      actions = `<span class="muted">${t('order.cancelled')}</span>`;
    }
    return `<article class="ocard">
      <div class="ocard__head"><span class="ocard__num">${o.num}</span><span class="muted">${esc(o.date)} · ${t(`order.${o.mode}`)}</span>
        <span class="st ${OST[o.status]}">${t(`ost.${o.status}`)}</span></div>
      <div class="oitems">${items}</div>${extra}
      <div class="ocard__foot"><span class="ocard__total">${t('order.total')}: ${cny(orderCny(o))}</span><div class="ocard__actions">${actions}</div></div>
    </article>`;
  }

  /* ---------- Поставщик: выплаты и магазин ---------- */
  function vPayouts() {
    const c = supplierCounts();
    const k = supCode() === DEFAULT_SUP ? 1 : 0.6;
    const history = LIVE ? S.live.payouts : PAYOUTS.map(([date, period, n, amount]) => ({ date, period, orders: Math.round(n * k), amount: amount * k, status: 'paid' }));
    const rows = history.map((p) => `<tr><td>${esc(p.date)}</td><td>${esc(p.period || '—')}</td><td class="num">${p.orders}</td><td class="num">${cny(p.amount)}</td><td><span class="st ${p.status === 'paid' ? 'st--ok' : 'st--wait'}">${p.status === 'paid' ? t('pay.paid') : t('pay.pending')}</span></td></tr>`).join('') || `<tr><td colspan="5" class="muted">—</td></tr>`;
    const paidTotal = LIVE ? S.live.paidTotal : 38255 * k;
    const method = LIVE ? (supplier().payout || '—') : t('pay.methodValue');
    return `
      <div class="pagehead"><div><h1>${t('nav.payouts')}</h1><p>${t('pay.rule')}</p></div></div>
      <div class="kpis">
        <div class="kpi kpi--hot"><span>${t('pay.pending')}</span><b>${cny(c.pending)}</b></div>
        <div class="kpi"><span>${t('pay.next')}</span><b>${t('pay.nextDate')}</b></div>
        <div class="kpi"><span>${t('pay.total')}</span><b>${cny(paidTotal)}</b></div>
        <div class="kpi"><span>${t('pay.method')}</span><b style="font-size:16px;line-height:1.3">${esc(method)}</b></div>
      </div>
      <section class="panel"><h2>${t('pay.history')}</h2>
        <div class="tablewrap"><table class="tbl" style="min-width:520px"><thead><tr><th>${t('col.date')}</th><th>${t('col.period')}</th><th class="num">${t('col.orders')}</th><th class="num">${t('col.amount')}</th><th>${t('col.status')}</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>`;
  }
  function vShop() {
    const s = supplier();
    return `
      <div class="pagehead"><div><h1>${t('nav.shop')}</h1></div></div>
      <section class="panel">
        <form class="form" id="shopForm" novalidate>
          <label class="field"><span>${t('shop.name')}</span><input id="sName" value="${esc(L() === 'zh' ? s.zh : s.ru)}" ${LIVE && L() !== 'zh' ? `readonly title="${t('shop.nameNote')}"` : ''}></label>
          <label class="field"><span>${t('shop.city')}</span><input id="sCity" value="${esc(L() === 'zh' ? s.cityZh : s.cityRu)}"></label>
          <label class="field field--full"><span>${t('shop.about')}</span><textarea id="sAbout">${esc(s.about)}</textarea></label>
          <label class="field"><span>${t('shop.wechat')}</span><input id="sWechat" value="${esc(s.wechat)}"></label>
          <label class="field"><span>${t('shop.phone')}</span><input id="sPhone" value="${esc(s.phone)}" inputmode="tel"></label>
          <label class="field field--full"><span>${t('shop.payout')}</span><input id="sPayout" value="${esc(s.payout || '')}"></label>
          <label class="field"><span>${t('shop.fact')}</span><input value="${s.fact ? `${s.fact[0]}–${s.fact[1]} ${t('days')}` : '—'}" readonly></label>
          <label class="field"><span>${t('shop.lang')}</span><select id="sLang"><option value="zh" ${S.lang === 'zh' ? 'selected' : ''}>中文</option><option value="ru" ${S.lang === 'ru' ? 'selected' : ''}>Русский</option></select></label>
          <p class="note field--full">${t('shop.factNote')}</p>
          <div class="form__actions"><button class="btn btn--lime" type="submit">${t('shop.save')}</button></div>
        </form>
      </section>`;
  }

  /* ---------- Поставщик: контент-завод ---------- */
  const FACTORY_DEFAULT = { newItems: true, weekly: true, restock: false, perDay: '3' };
  const factory = () => (S.factory[supCode()] = S.factory[supCode()] || { ...FACTORY_DEFAULT });
  function vTeamPosts() {
    const mine = S.products.filter((p) => p.status === 'published');
    const posts = S.posts.filter((x) => x.sup === supCode());
    const card = (x) => {
      const p = x.pid ? product(x.pid) : null;
      return `<article class="postcard">
        ${x.images.length ? `<div class="postthumbs">${x.images.slice(0, 4).map((src) => `<img src="${esc(src)}" alt="" loading="lazy">`).join('')}${x.images.length > 4 ? `<span class="more">+${x.images.length - 4}</span>` : ''}</div>` : ''}
        ${x.text ? `<p>${esc(x.text)}</p>` : ''}
        <div class="postcard__meta"><span class="muted">${esc(x.date || '')}${p ? ` · ${esc(pName(p))}` : ''} · ${t(`fac.kind.${x.kind}`)}</span>
          <span class="st ${PST[x.status] || ''}">${t(`status.${x.status}`)}</span>
          <button class="btn btn--sm btn--bad" type="button" data-act="del-post" data-id="${x.id}">Удалить</button></div>
      </article>`;
    };
    return `
      <div class="pagehead"><div><h1>Посты в ленту</h1><p>Пост с фото сразу появляется в ленте поставщиков на сайте. Видео сделаем следующим этапом контент-завода.</p></div></div>
      <div class="grid2">
        <section class="panel"><h2>Новый пост</h2>
          <form class="form" id="postForm" novalidate>
            <label class="field field--full"><span>Текст для покупателей</span><textarea id="poText" placeholder="Например: новая партия худи, плотный хлопок, 6 цветов"></textarea></label>
            <label class="field field--full"><span>Фото, до 10 штук</span><input id="poImages" type="file" accept="image/*" multiple></label>
            <div class="postthumbs field--full" id="poPreview"></div>
            <label class="field"><span>Товар (можно без него)</span><select id="poProduct"><option value="">Без товара</option>${mine.map((p) => `<option value="${p.id}">${esc(pName(p))}</option>`).join('')}</select></label>
            <label class="field"><span>Тип</span><select id="poKind">${['new', 'restock', 'opt'].map((k) => `<option value="${k}">${t(`fac.kind.${k}`)}</option>`).join('')}</select></label>
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
    if (!box) return;
    box.innerHTML = postFiles.slice(0, 10).map((f) => `<img src="${URL.createObjectURL(f)}" alt="">`).join('')
      + (postFiles.length > 10 ? '<span class="err">Больше 10 фото: оставьте до 10</span>' : '');
  }
  let posting = false;
  async function teamPost() {
    const text = $('#poText').value.trim();
    if (!text && !postFiles.length) { toast('Добавьте текст или фото'); $('#poText').focus(); return; }
    if (postFiles.length > 10) { toast('Не больше 10 фото в посте'); return; }
    if (posting) return;
    posting = true;
    const form = new FormData();
    form.append('text', text);
    form.append('kind', $('#poKind').value);
    if ($('#poProduct').value) form.append('product', $('#poProduct').value);
    for (const f of postFiles) form.append('images', f);
    let res;
    try {
      res = await liveTry(() => api('/posts', { method: 'POST', form }));
    } finally {
      posting = false;
    }
    if (!res) return;
    postFiles = [];
    S.posts.unshift(mapPost(supCode())(res));
    render(); toast('Опубликовано');
  }
  function vFactory() {
    if (team()) return vTeamPosts();
    const f = factory();
    const mine = S.products.filter((p) => p.sup === supCode() && p.status === 'published');
    const next = mine[0];
    const sw = (key, hint, disabled = false) => `<label class="switchrow"><div><b>${t(`fac.${key}`)}</b><span>${t(hint)}</span></div>
      <input class="switch" type="checkbox" role="switch" data-factory="${key}" ${f[key] ? 'checked' : ''} ${disabled ? 'disabled' : ''}></label>`;
    const posts = S.posts.filter((x) => x.sup === supCode());
    return `
      <div class="pagehead"><div><h1>${t('nav.factory')}</h1><p>${t('fac.sub')}</p></div></div>
      <div class="grid2">
        <section class="panel"><h2>${t('fac.auto')}</h2>
          <div>${sw('newItems', 'fac.newItemsHint')}${sw('weekly', 'fac.weeklyHint')}${sw('restock', 'fac.restockHint')}${sw('video', 'fac.videoHint', true)}
            <label class="switchrow"><div><b>${t('fac.perDay')}</b></div>
              <select class="select" data-factory="perDay" aria-label="${t('fac.perDay')}">${['1', '3', '5'].map((v) => `<option ${f.perDay === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
          ${next ? `<div class="preview">${thumb(next)}<div><b>${t('fac.next')}</b><br><span class="muted">Новинка от ${esc(supplier().ru)}: ${esc(next.ru || next.zh)}. ${next.tiers[0] ? `${next.tiers[0][1]} ¥ за штуку при партии от ${next.tiers[0][0]} шт.` : `${next.price} ¥ за штуку.`} Фото с проверки на складе пришлём в заказ.</span></div></div>
            <p class="note">${t('fac.ruNote')}</p>` : ''}
        </section>
        <section class="panel"><h2>${t('fac.post')}</h2>
          <form class="form" id="postForm" novalidate>
            <label class="field field--full"><span>${t('fac.product')}</span><select id="poProduct">${mine.map((p) => `<option value="${p.id}">${esc(pName(p))}</option>`).join('')}</select></label>
            <label class="field field--full"><span>${t('fac.kind')}</span><select id="poKind">${['new', 'restock', 'opt'].map((k) => `<option value="${k}">${t(`fac.kind.${k}`)}</option>`).join('')}</select></label>
            <label class="field field--full"><span>${t('fac.text')}</span><textarea id="poText"></textarea></label>
            <div class="form__actions"><button class="btn btn--lime" type="submit">${t('fac.send')}</button></div>
          </form>
          <h2>${t('fac.mine')}</h2>
          ${posts.length ? posts.filter((x) => product(x.pid)).map((x) => `<div class="preview">${thumb(product(x.pid))}<div><b>${t(`fac.kind.${x.kind}`)} · ${esc(pName(product(x.pid)))}</b><br><span class="muted">${esc(x.text)}</span></div><span class="st ${PST[x.status || 'moderation'] || ''}" style="margin-left:auto">${t(`status.${x.status || 'moderation'}`)}</span></div>`).join('')
            : `<p class="muted">${t('fac.none')}</p>`}
        </section>
      </div>`;
  }

  /* ---------- Модератор: очередь ---------- */
  function vModeration() {
    const queue = S.products.filter((p) => p.status === 'moderation');
    const cards = queue.map((p) => {
      const s = supplier(p.sup);
      const flags = [!p.img && 'нет фото', /大牌|同款|仿/.test(p.zh) && 'похоже на копию бренда'].filter(Boolean);
      return `<article class="mcard">
        ${p.img ? `<img class="thumb" src="${esc(imgSrc(p.img))}" alt="" width="96" height="96" loading="lazy">` : '<span class="thumb thumb--empty">нет фото</span>'}
        <div class="mcard__body">
          <div class="mcard__zh">${esc(p.zh)}</div>
          <div class="mcard__ru"><label class="sr" for="ru-${p.id}">Название на русском</label>
            <input id="ru-${p.id}" value="${esc(p.ru)}" placeholder="Название на русском" data-ru="${p.id}">
            <button class="btn btn--sm" type="button" data-act="translate" data-id="${p.id}">Перевести</button></div>
          <div class="mcard__meta"><span>Поставщик <b>${esc(s.ru)}</b></span><span>${esc(CATS[p.cat][1])}</span>
            <span>Цена <b>${cny(p.price)}</b></span><span>Опт <b>${p.tiers.map(([q, c]) => `${q}+ · ${c} ¥`).join(', ')}</b></span>
            <span>Вес <b>${p.kg} кг</b></span><span>Покупатель увидит <b>${rub(buyerRub(p))}</b></span></div>
          ${p.desc ? `<p class="note">${esc(p.desc)}</p>` : ''}
          ${flags.length ? `<span class="flag">Проверьте: ${flags.join(', ')}</span>` : ''}
        </div>
        <div class="mcard__actions">
          <button class="btn btn--sm btn--lime" type="button" data-act="publish" data-id="${p.id}">${icon('check')}Опубликовать</button>
          <label class="sr" for="rs-${p.id}">Причина отклонения</label>
          <select class="select" id="rs-${p.id}" data-reason="${p.id}"><option value="">Причина отклонения…</option>${Object.entries(MOD_REASONS).map(([k, v]) => `<option value="${k}">${v[1]}</option>`).join('')}</select>
          <button class="btn btn--sm btn--bad" type="button" data-act="reject" data-id="${p.id}">Отклонить</button>
          <button class="btn btn--sm" type="button" data-act="edit-product" data-id="${p.id}">Изменить всё</button>
        </div></article>`;
    }).join('');
    return `
      <div class="pagehead"><div><h1>Модерация</h1>
        <p>Товары от поставщиков ждут проверки. Перед публикацией нужно русское название; поставщик увидит причину отклонения на китайском.</p></div></div>
      ${queue.length ? `<div class="mcards">${cards}</div>` : '<div class="empty">Очередь пуста: все товары проверены</div>'}`;
  }

  /* ---------- Модератор: все товары ---------- */
  function vCatalog() {
    const f = S.mfilter;
    const q = f.q.trim().toLowerCase();
    const list = S.products.filter((p) => (!f.sup || p.sup === f.sup) && (!f.status || p.status === f.status)
      && (!q || p.zh.toLowerCase().includes(q) || p.ru.toLowerCase().includes(q)));
    const rows = list.map((p) => `<tr>
        <td><div class="pcell">${thumb(p)}<div><b>${esc(p.ru || p.zh)}</b><span>${esc(p.zh)}</span></div></div></td>
        <td>${esc(supplier(p.sup).ru)}</td>
        <td class="num">${cny(p.price)}</td>
        <td class="num">${rub(buyerRub(p))}</td>
        <td>${pStatus(p)}</td>
        <td><button class="btn btn--sm" type="button" data-act="edit-product" data-id="${p.id}">Изменить</button></td></tr>`).join('');
    return `
      <div class="pagehead"><div><h1>Все товары</h1><p>Модератор может изменить любой товар любого поставщика: название, цену, вес, опт, статус.</p></div>
        <div class="pagehead__actions"><button class="btn btn--lime" type="button" data-act="add-product">${icon('plus')}Добавить товар</button></div></div>
      <div class="filters">
        <label class="sr" for="mq">Поиск</label><input class="search" id="mq" type="search" placeholder="Поиск по названию" value="${esc(f.q)}" data-mf="q">
        <label class="sr" for="msup">Поставщик</label><select class="select" id="msup" data-mf="sup"><option value="">Все поставщики</option>${S.suppliers.map((s) => `<option value="${s.code}" ${f.sup === s.code ? 'selected' : ''}>${esc(s.ru)}</option>`).join('')}</select>
        <label class="sr" for="mst">Статус</label><select class="select" id="mst" data-mf="status"><option value="">Все статусы</option>${['published', 'moderation', 'rejected'].map((st) => `<option value="${st}" ${f.status === st ? 'selected' : ''}>${I18N[`status.${st}`][1]}</option>`).join('')}</select>
      </div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Товар</th><th>Поставщик</th><th class="num">Цена, ¥</th><th class="num">Под ключ</th><th>Статус</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="muted">Ничего не найдено</td></tr>'}</tbody></table></div>`;
  }

  /* ---------- Модератор: поставщики ---------- */
  function vSuppliers() {
    const rows = S.suppliers.map((s) => {
      const c = supplierCounts(s.code);
      const total = S.products.filter((p) => p.sup === s.code).length;
      return `<tr>
        <td><b>${esc(s.ru)}</b><br><span class="muted">${esc(s.zh)} · ${esc(s.cityRu)}</span></td>
        <td class="num">${total}</td><td class="num">${c.review}</td><td class="num">${c.todo}</td>
        <td class="num">${s.fact[0]}–${s.fact[1]} дн.</td>
        <td><span class="st ${s.active ? 'st--ok' : 'st--bad'}">${s.active ? 'Активен' : 'Заблокирован'}</span></td>
        <td><div class="filters" style="flex-wrap:nowrap">
          <button class="btn btn--sm btn--lime" type="button" data-act="act-as" data-code="${s.code}">Открыть кабинет</button>
          <button class="btn btn--sm" type="button" data-act="toggle-sup" data-code="${s.code}">${s.active ? 'Заблокировать' : 'Включить'}</button></div></td></tr>`;
    }).join('');
    return `
      <div class="pagehead"><div><h1>Поставщики</h1><p>«Открыть кабинет» показывает кабинет поставщика так, как видит его он сам, и позволяет всё в нём поменять.</p></div>
        <div class="pagehead__actions"><button class="btn btn--lime" type="button" data-act="invite">${icon('plus')}Пригласить поставщика</button></div></div>
      <div class="tablewrap"><table class="tbl" style="min-width:860px"><thead><tr><th>Поставщик</th><th class="num">Товаров</th><th class="num">На модерации</th><th class="num">Заказы ждут</th><th class="num">Факт. срок</th><th>Статус</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function openInvite() {
    openDrawer('Новый поставщик', `<form class="form" id="inviteForm" novalidate>
      <label class="field"><span>Название по-русски</span><input id="iRu" placeholder="TT · Ханчжоу" required></label>
      <label class="field"><span>Название по-китайски</span><input id="iZh" placeholder="TT · 杭州"></label>
      <label class="field"><span>Город</span><input id="iCity" placeholder="Ханчжоу"></label>
      <label class="field"><span>WeChat для входа</span><input id="iWechat" placeholder="wechat_id"></label>
      <p class="note field--full">В рабочей версии поставщик получит логин и временный пароль в WeChat, а кабинет откроется на китайском.</p>
      <div class="form__actions"><button class="btn" type="button" data-act="close-drawer">Отмена</button><button class="btn btn--lime" type="submit">Создать</button></div></form>`);
  }

  /* ---------- Модератор: заказы ---------- */
  function vModOrders() {
    const rows = S.orders.map((o) => {
      const s = supplier(o.sup);
      const bs = S.buyerStatus[o.num] || SUPPLIER_TO_BUYER[o.status];
      return `<tr>
        <td><b>${o.num}</b><br><span class="muted">${esc(o.date)}</span></td>
        <td>${esc(o.buyer)}<br><span class="muted">${o.mode === 'wholesale' ? 'Опт' : 'Розница'}</span></td>
        <td>${o.items.map(([id, size, qty]) => `${esc(product(id).ru || product(id).zh)}${size ? ` (${esc(size)})` : ''} × ${qty}`).join('<br>')}</td>
        <td>${esc(s.ru)}<br><span class="st ${OST[o.status]}">${I18N[`ost.${o.status}`][1]}</span>${o.tracking ? `<br><span class="muted">трек ${esc(o.tracking)}</span>` : ''}</td>
        <td class="num">${rub(orderRub(o))}<br><span class="muted">${cny(orderCny(o))}</span></td>
        <td><label class="sr" for="bs-${o.num}">Статус для покупателя</label><select class="select" id="bs-${o.num}" data-bstatus="${o.num}">${BUYER_STATUS.map(([k, v]) => `<option value="${k}" ${k === bs ? 'selected' : ''}>${v}</option>`).join('')}</select></td></tr>`;
    }).join('');
    return `
      <div class="pagehead"><div><h1>Заказы</h1><p>Слева то, что сделал поставщик, справа статус, который видит покупатель в трекинге. Фото со склада и вес агенты добавляют в админке на сервере.</p></div></div>
      <div class="tablewrap"><table class="tbl" style="min-width:980px"><thead><tr><th>Заказ</th><th>Покупатель</th><th>Товары</th><th>Поставщик</th><th class="num">Сумма</th><th>Статус для покупателя</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /* ---------- Модератор: цены ---------- */
  function vPricing() {
    const pr = S.pricing;
    const sample = product('runner');
    const ship = pr.ship.map((m, i) => `<tr><td><b>${esc(m.name)}</b>${m.bulky ? '<br><span class="muted">только крупногабарит</span>' : ''}</td>
      <td><input class="select" style="width:110px" type="number" min="1" step="1" value="${m.perKg}" data-ship="${i}" data-k="perKg" aria-label="${esc(m.name)}, ₽/кг"></td>
      <td><input class="select" style="width:70px" type="number" min="1" value="${m.days[0]}" data-ship="${i}" data-k="d0" aria-label="${esc(m.name)}, срок от"> –
        <input class="select" style="width:70px" type="number" min="1" value="${m.days[1]}" data-ship="${i}" data-k="d1" aria-label="${esc(m.name)}, срок до"></td></tr>`).join('');
    return `
      <div class="pagehead"><div><h1>Цены и доставка</h1><p>Всё, из чего складывается цена под ключ. Изменения сразу пересчитывают цены в каталоге.</p></div></div>
      <div class="grid2">
        <section class="panel"><h2>Курс и сборы</h2>
          <form class="form" id="pricingForm" novalidate>
            <label class="field"><span>Курс ЦБ, ₽ за 1 ¥ (на ${esc(pr.rateDate)})</span><input value="${pr.rate.toFixed(2).replace('.', ',')}" readonly></label>
            <label class="field"><span>Надбавка к курсу, %</span><input id="prMarkup" type="number" min="0" max="20" step="0.1" value="${pr.markup}"></label>
            <label class="field"><span>Сбор ASTTA, розница, %</span><input id="prRetail" type="number" min="0" max="50" step="0.5" value="${pr.retailFee}"></label>
            <label class="field"><span>Сбор ASTTA, опт, %</span><input id="prOpt" type="number" min="0" max="50" step="0.5" value="${pr.optFee}"></label>
            <p class="note field--full">Курс ЦБ сервер загружает сам каждые 3 часа. Надбавка закрывает колебания курса между оплатой и выкупом.</p>
            <div class="form__actions"><button class="btn btn--lime" type="submit">Сохранить</button></div>
          </form>
        </section>
        <section class="panel"><h2>Проверка на примере</h2>
          <div class="kv"><span>${esc(sample.ru)}</span><b>${cny(unitCny(sample))}</b>
            <span>Покупатель платит (розница, авто)</span><b>${rub(buyerRub(sample))}</b>
            <span>Опт, ${sample.tiers[1][0]} шт.</span><b>${rub(buyerRub(sample, sample.tiers[1][0], 'wholesale'))}</b></div>
        </section>
      </div>
      <section class="panel"><h2>Тарифы доставки</h2>
        <div class="tablewrap"><table class="tbl" style="min-width:520px"><thead><tr><th>Способ</th><th>₽ за кг</th><th>Срок, дней</th></tr></thead><tbody>${ship}</tbody></table></div>
        <p class="note">Реальные тарифы и сроки должна дать TT Логистика, сейчас стоят демо-значения из прототипа.</p>
      </section>`;
  }

  /* ---------- Перевод названия ---------- */
  let samplePromise;
  async function translate(zh) {
    if (DEMO_TRANSLATIONS[zh]) return DEMO_TRANSLATIONS[zh];
    try {
      samplePromise = samplePromise || (window.claude && window.claude.use ? window.claude.use('sample') : Promise.resolve(null));
      const sample = await samplePromise;
      if (!sample) return null;
      const res = await sample(`Переведи название товара с китайского на русский для карточки маркетплейса. Коротко, без кавычек и пояснений.\n\n${zh}`, { modelTier: 'quick' });
      return (res.text || '').trim().split('\n')[0] || null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- Боевой режим: данные с сервера ---------- */
  function cookie(name) {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : '';
  }
  async function api(path, { method = 'GET', body, form } = {}) {
    const headers = { 'X-CSRFToken': cookie('csrftoken') };
    if (S.acting) headers['X-Act-As'] = S.acting;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: payload, credentials: 'same-origin' });
    } catch (e) {
      throw new Error(t('err.network'));
    }
    if (res.status === 401 && path !== '/login') { S.me = null; render(); throw new Error(t('login.title')); }
    const isJson = (res.headers.get('content-type') || '').includes('json');
    const data = isJson ? await res.json() : res;
    if (!res.ok) {
      const detail = isJson && data.detail;
      throw new Error(typeof detail === 'string' ? detail : res.statusText || String(res.status));
    }
    return data;
  }
  const num = (v) => Number(v);
  const mapProduct = (code) => (p) => ({
    id: String(p.id), sup: code, cat: p.cat, zh: p.zh, ru: p.ru, sku: p.sku || '', src: p.src || '', price: num(p.price), kg: num(p.kg), sale: p.sale,
    bulky: p.bulky, tiers: p.tiers.map(([q, c]) => [q, num(c)]), views: 0, orders: p.orders, img: p.img || '', photos: p.photos || 0,
    desc: p.desc, status: p.status, reason: p.reason,
  });
  const mapPost = (code) => (x) => ({
    id: x.id, sup: code, pid: x.product ? String(x.product) : '', kind: x.kind, text: x.text, status: x.status,
    images: x.images || [], date: x.date || '',
  });
  const mapOrder = (code) => (o) => ({
    id: o.id, num: o.num, sup: code, date: o.date, mode: o.mode, status: o.status, tracking: o.tracking,
    items: o.items.map((i) => [String(i.product), i.size, i.qty, num(i.unit), { zh: i.zh, ru: i.ru, img: i.img || '' }]),
  });
  function upsert(list, item, key = 'id') {
    const i = list.findIndex((x) => x[key] === item[key]);
    if (i >= 0) list[i] = item; else list.unshift(item);
  }
  async function loadAll() {
    const [products, orders, overview, payouts, shop, fac, posts] = await Promise.all(
      ['/products', '/orders', '/overview', '/payouts', '/shop', '/factory', '/posts'].map((path) => api(path)));
    // Категории берём с сервера: их список ведёт модератор.
    const cats = await fetch(API.replace(/\/seller$/, '/categories'), { credentials: 'same-origin' }).then((r) => r.json());
    for (const key of Object.keys(CATS)) delete CATS[key];
    for (const c of cats) CATS[c.slug] = [c.name_zh || c.name_ru, c.name_ru];
    const code = shop.code;
    S.suppliers = [{
      code, ru: shop.name, zh: shop.name_zh || shop.name, cityRu: shop.city, cityZh: shop.city, about: shop.about,
      wechat: shop.wechat, phone: shop.phone, payout: shop.payout_details, fact: shop.fact, active: true, base: 0, week: overview.week,
    }];
    S.products = products.map(mapProduct(code));
    S.orders = orders.map(mapOrder(code));
    S.posts = posts.map(mapPost(code));
    S.factory[code] = { newItems: fac.new_items, weekly: fac.weekly, restock: fac.restock, perDay: String(fac.per_day) };
    S.live = {
      pending: num(overview.pending_cny), today: overview.today, weekLabels: overview.week_labels,
      paidTotal: num(payouts.paid_total_cny),
      payouts: payouts.items.map((x) => ({ date: x.date, orders: x.orders, amount: num(x.amount), status: x.status })),
    };
  }
  async function startSession() {
    S.role = 'supplier';
    S.lang = S.me.language === 'zh-hans' ? 'zh' : 'ru';
    if (S.me.can_act) {
      const wanted = new URLSearchParams(location.search).get('act');
      const codes = S.me.suppliers.map((x) => x.code);
      S.acting = codes.includes(wanted) ? wanted : (codes.includes(S.acting) ? S.acting : codes[0] || null);
    } else {
      S.acting = null;
    }
    S.loading = true;
    S.loadError = '';
    render();
    try {
      await loadAll();
    } catch (e) {
      S.loadError = e.message;
    }
    S.loading = false;
    render();
  }
  function vLogin() {
    return `<section class="panel" style="max-width:420px;margin:24px auto;width:100%">
      <h2>${t('login.title')}</h2>
      <form class="form" id="loginForm" novalidate style="grid-template-columns:minmax(0,1fr)">
        <label class="field"><span>${t('login.user')}</span><input id="lUser" autocomplete="username" required></label>
        <label class="field"><span>${t('login.pass')}</span><input id="lPass" type="password" autocomplete="current-password" required></label>
        <p class="reason" id="loginErr" hidden></p>
        <button class="btn btn--lime" type="submit">${t('login.submit')}</button>
        <p class="note">${t('login.hint')}</p>
      </form></section>`;
  }
  function renderLiveTop() {
    $('#roleSwitch').hidden = true;
    $('#topDemo').hidden = true;
    let tools = $('#liveTools');
    if (!tools) {
      tools = document.createElement('div');
      tools.id = 'liveTools';
      tools.className = 'top__right';
      tools.style.marginLeft = '0';
      $('.top__right').prepend(tools);
    }
    if (!S.me) { tools.innerHTML = ''; return; }
    const picker = S.me.can_act ? `<label class="sr" for="actAs">Поставщик</label>
      <select class="select" id="actAs" data-act-as>${S.me.suppliers.map((x) => `<option value="${esc(x.code)}" ${x.code === S.acting ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : '';
    tools.innerHTML = `${picker}<button class="btn btn--sm" type="button" data-act="logout">${t('logout')}</button>`;
  }
  async function liveTry(fn) {
    try {
      return await fn();
    } catch (e) {
      toast(t('err.save', { e: e.message }));
      return null;
    }
  }

  /* ---------- Шторка ---------- */
  let lastFocus = null;
  function openDrawer(title, html) {
    lastFocus = document.activeElement;
    $('#drawerTitle').textContent = title;
    $('#drawerBody').innerHTML = html;
    $('#drawer').hidden = false;
    $('.drawer__panel').focus({ preventScroll: true });
  }
  function closeDrawer() {
    $('#drawer').hidden = true;
    draft = null;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  /* ---------- События ---------- */
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('button, [data-act]');
    if (!el) return;
    const d = el.dataset;
    if (d.role) {
      S.acting = null;
      S.role = d.role;
      save();
      render();
      return;
    }
    if (d.lang) {
      S.lang = d.lang; save(); render();
      if (LIVE && S.me && !S.acting) liveTry(() => api('/me/language', { method: 'PUT', body: { language: d.lang === 'zh' ? 'zh-hans' : 'ru' } }));
      return;
    }
    if (d.nav) { S.view[S.role] = d.nav; save(); render(); $('#main').focus({ preventScroll: true }); window.scrollTo(0, 0); return; }
    if (d.goto) {
      S.view[S.role] = d.goto;
      if (d.ofilter) S.ofilter = d.ofilter;
      if (d.pfilter) S.pfilter = d.pfilter;
      save(); render(); window.scrollTo(0, 0);
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
      case 'translate-form': {
        readForm();
        const ru = await translate(draft.zh);
        if (ru) { draft.ru = ru; $('#drawerBody').innerHTML = productFormHTML(); } else toast('Перевод доступен в превью на claude.ai, впишите название вручную');
        break;
      }
      case 'import': openImport(); break;
      case 'del-post': {
        if (!window.confirm('Удалить пост из ленты?')) break;
        if (await liveTry(() => api(`/posts/${d.id}`, { method: 'DELETE' }))) {
          S.posts = S.posts.filter((x) => String(x.id) !== d.id);
          render(); toast('Пост удалён');
        }
        break;
      }
      case 'template': {
        if (!LIVE) { toast(t('import.noDownload')); break; }
        const res = await liveTry(() => api('/template'));
        if (!res) break;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(await res.blob());
        a.download = 'astta-catalog-template.xlsx';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        break;
      }
      case 'confirm-order':
        if (LIVE ? await liveOrder(d.num, 'confirm') : (setOrder(d.num, 'ship'), true)) toast(t('toast.confirmed'));
        break;
      case 'out-of-stock':
        if (LIVE ? await liveOrder(d.num, 'cancel') : (setOrder(d.num, 'cancelled'), true)) toast(t('toast.cancelled'));
        break;
      case 'logout':
        await liveTry(() => api('/logout', { method: 'POST' }));
        S.me = null; S.acting = null;
        render();
        break;
      case 'translate': {
        const p = product(d.id);
        el.disabled = true;
        const ru = await translate(p.zh);
        el.disabled = false;
        if (ru) { p.ru = ru; save(); render(); } else toast('Перевод доступен в превью на claude.ai, впишите название вручную');
        break;
      }
      case 'publish': {
        const p = product(d.id);
        const input = $(`[data-ru="${d.id}"]`);
        if (input) p.ru = input.value.trim();
        if (!p.ru) { toast('Сначала впишите русское название'); input && input.focus(); break; }
        p.status = 'published'; p.reason = '';
        save(); render(); toast(`Опубликовано: ${p.ru}`);
        break;
      }
      case 'reject': {
        const reason = $(`[data-reason="${d.id}"]`).value;
        if (!reason) { toast('Выберите причину: поставщик увидит её на китайском'); $(`[data-reason="${d.id}"]`).focus(); break; }
        const p = product(d.id);
        p.status = 'rejected'; p.reason = reason;
        save(); render(); toast('Отклонено, поставщик увидит причину');
        break;
      }
      case 'act-as':
        S.acting = d.code; S.role = 'supplier'; S.view.supplier = 'overview';
        save(); render(); window.scrollTo(0, 0);
        break;
      case 'stop-acting':
        S.acting = null; S.role = 'moderator'; S.view.moderator = 'suppliers';
        save(); render();
        break;
      case 'toggle-sup': {
        const s = supplier(d.code);
        s.active = !s.active;
        save(); render(); toast(s.active ? `${s.ru}: включён` : `${s.ru}: заблокирован, товары скрыты с витрины`);
        break;
      }
      case 'invite': openInvite(); break;
      default: break;
    }
  });

  async function liveOrder(num, action, body) {
    const o = S.orders.find((x) => x.num === num);
    const res = await liveTry(() => api(`/orders/${o.id}/${action}`, { method: 'POST', body }));
    if (!res) return false;
    upsert(S.orders, mapOrder(supCode())(res));
    render();
    return true;
  }

  function setOrder(num, status) {
    const o = S.orders.find((x) => x.num === num);
    o.status = status;
    delete S.buyerStatus[num];
    save();
    render();
  }

  document.addEventListener('submit', async (e) => {
    const form = e.target;
    e.preventDefault();
    if (form.id === 'productForm') { submitProduct(); return; }
    if (form.id === 'importForm') { doImport(); return; }
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
      await startSession();
      return;
    }
    if (form.dataset.shipForm) {
      const input = form.querySelector('input');
      if (!input.value.trim()) { toast(t('err.tracking')); input.focus(); return; }
      if (LIVE) {
        if (await liveOrder(form.dataset.shipForm, 'ship', { tracking: input.value.trim() })) toast(t('toast.shipped'));
        return;
      }
      const o = S.orders.find((x) => x.num === form.dataset.shipForm);
      o.tracking = input.value.trim();
      setOrder(o.num, 'shipped');
      toast(t('toast.shipped'));
      return;
    }
    if (form.id === 'postForm') {
      if (team()) { teamPost(); return; }
      const text = $('#poText').value.trim();
      if (!text) { toast(t('err.required')); $('#poText').focus(); return; }
      if (LIVE) {
        const fd = new FormData();
        fd.append('product', $('#poProduct').value);
        fd.append('kind', $('#poKind').value);
        fd.append('text', text);
        const res = await liveTry(() => api('/posts', { method: 'POST', form: fd }));
        if (!res) return;
        S.posts.unshift(mapPost(supCode())(res));
        render(); toast(t('fac.sent'));
        return;
      }
      S.posts.unshift({ sup: supCode(), pid: $('#poProduct').value, kind: $('#poKind').value, text });
      save(); render(); toast(t('fac.sent'));
      return;
    }
    if (form.id === 'shopForm') {
      const s = supplier();
      if (LIVE) {
        const body = {
          name_zh: L() === 'zh' ? $('#sName').value.trim() : s.zh, city: $('#sCity').value.trim(), about: $('#sAbout').value.trim(),
          wechat: $('#sWechat').value.trim(), phone: $('#sPhone').value.trim(), payout_details: $('#sPayout').value.trim(),
        };
        const res = await liveTry(() => api('/shop', { method: 'PUT', body }));
        if (!res) return;
        Object.assign(s, { zh: res.name_zh || res.name, cityRu: res.city, cityZh: res.city, about: res.about, wechat: res.wechat, phone: res.phone, payout: res.payout_details });
        if (!S.acting && $('#sLang').value !== S.lang) {
          S.lang = $('#sLang').value;
          await liveTry(() => api('/me/language', { method: 'PUT', body: { language: S.lang === 'zh' ? 'zh-hans' : 'ru' } }));
        }
        render(); toast(t('toast.saved'));
        return;
      }
      if (L() === 'zh') { s.zh = $('#sName').value.trim() || s.zh; s.cityZh = $('#sCity').value.trim(); } else { s.ru = $('#sName').value.trim() || s.ru; s.cityRu = $('#sCity').value.trim(); }
      s.about = $('#sAbout').value.trim();
      s.payout = $('#sPayout').value.trim();
      s.wechat = $('#sWechat').value.trim();
      s.phone = $('#sPhone').value.trim();
      if (!S.acting) S.lang = $('#sLang').value;
      save(); render(); toast(t('toast.saved'));
      return;
    }
    if (form.id === 'pricingForm') {
      const pr = S.pricing;
      pr.markup = Math.max(0, Number($('#prMarkup').value) || 0);
      pr.retailFee = Math.max(0, Number($('#prRetail').value) || 0);
      pr.optFee = Math.max(0, Number($('#prOpt').value) || 0);
      save(); render(); toast('Сохранено, цены пересчитаны');
      return;
    }
    if (form.id === 'inviteForm') {
      const ru = $('#iRu').value.trim();
      if (!ru) { toast('Впишите название'); $('#iRu').focus(); return; }
      const code = `s${Date.now().toString(36)}`;
      S.suppliers.push({ code, ru, zh: $('#iZh').value.trim() || ru, cityRu: $('#iCity').value.trim(), cityZh: '', about: '', wechat: $('#iWechat').value.trim(), phone: '', fact: [18, 25], active: true, base: 0, week: [0, 0, 0, 0, 0, 0, 0] });
      save(); closeDrawer(); render(); toast(`Поставщик «${ru}» создан`);
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'fPhoto' && el.files[0]) {
      readForm();
      draftFile = el.files[0];
      const reader = new FileReader();
      reader.onload = () => { draft.img = reader.result; $('#drawerBody').innerHTML = productFormHTML(); };
      reader.readAsDataURL(el.files[0]);
      return;
    }
    if ((el.id === 'importFile' || el.id === 'importPhotos') && el.files[0]) { el.closest('.drop').querySelector('b').textContent = el.files[0].name; return; }
    if (el.id === 'poImages') { postPreview(el.files); return; }
    if (el.dataset.actAs !== undefined) { S.acting = el.value; startSession(); return; }
    if (el.dataset.tier !== undefined) { draft.tiers[Number(el.dataset.tier)][Number(el.dataset.k)] = el.value; return; }
    if (el.dataset.factory) {
      const f = factory();
      f[el.dataset.factory] = el.type === 'checkbox' ? el.checked : el.value;
      if (LIVE) {
        liveTry(() => api('/factory', { method: 'PUT', body: { new_items: !!f.newItems, weekly: !!f.weekly, restock: !!f.restock, per_day: Number(f.perDay) } }))
          .then((res) => res && toast(t('fac.saved')));
        return;
      }
      save(); toast(t('fac.saved'));
      return;
    }
    if (el.dataset.mf) { S.mfilter[el.dataset.mf] = el.value; save(); render(); return; }
    if (el.dataset.bstatus) {
      S.buyerStatus[el.dataset.bstatus] = el.value;
      save(); toast('Статус для покупателя обновлён');
      return;
    }
    if (el.dataset.ru) { product(el.dataset.ru).ru = el.value.trim(); save(); return; }
    if (el.dataset.ship) {
      const m = S.pricing.ship[Number(el.dataset.ship)];
      const v = Math.max(1, Number(el.value) || 1);
      if (el.dataset.k === 'perKg') m.perKg = v; else m.days[el.dataset.k === 'd0' ? 0 : 1] = v;
      save(); render();
    }
  });

  // Поиск по товарам у модератора: пересчитываем после паузы, чтобы не терять фокус на каждой букве.
  let qTimer;
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'mq') return;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      S.mfilter.q = e.target.value;
      save(); render();
      const q = $('#mq');
      q.focus(); q.setSelectionRange(q.value.length, q.value.length);
    }, 300);
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });

  if (LIVE) {
    render();
    api('/me').then((me) => { S.me = me; return startSession(); }).catch(() => { S.me = null; render(); });
  } else {
    // Ссылка вида seller.html#moderator сразу открывает панель модерации.
    if (location.hash === '#moderator') { S.role = 'moderator'; S.acting = null; }
    if (location.hash === '#supplier') { S.role = 'supplier'; S.acting = null; }
    render();
  }
})();
