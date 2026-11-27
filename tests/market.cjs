const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {setup}=require('./storefront.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try {
  const t=await setup(browser,{market:true}),p=t.page;
  await p.waitForSelector('html.is-live');await p.waitForFunction(()=>!document.querySelector('#catalogStatus').textContent);
  await p.locator('#q').fill('Товар 1943');await p.locator('#catalogGrid [data-open="item-1943"]').first().click();
  await p.getByRole('button',{name:'Рассказать о модели',exact:true}).waitFor();
  await p.getByRole('button',{name:'Заказать',exact:true}).click();
  assert.equal(await p.locator('[data-mk-size="40"]').evaluate(e=>e===document.activeElement),true,'order prompts size selection');
  await p.locator('[data-mk-size="42"]').click();
  await p.getByText('Проверяем цену размера 42',{exact:false}).waitFor();
  await p.route('https://t.me/**',route=>route.fulfill({status:204}));
  let orderDraft;
  await p.route('**/api/tg/order-draft',route=>{
   orderDraft=route.request().postDataJSON();
   return route.fulfill({json:{start:'request_aabbccddeeff00112233445566778899'}});
  });
  const [draft]=await Promise.all([p.waitForRequest('https://t.me/**'),
    p.locator('[data-product-telegram]').click()]);
  assert.equal(new URL(draft.url()).searchParams.get('start'),'request_aabbccddeeff00112233445566778899');
  assert.match(orderDraft.text,/Код товара: item-1943\nРазмер: 42/);

  await p.evaluate(()=> {
   window.telegramLinks=[];
   window.Telegram={WebApp:{initData:'mock-mini-app',openTelegramLink:url=>window.telegramLinks.push(url)}};
  });
  await p.locator('[data-product-telegram]').click();
  await p.getByRole('link',{name:'Открыть чат ASTTA',exact:true}).waitFor();
  const telegramUrl=await p.getByRole('link',{name:'Открыть чат ASTTA',exact:true}).getAttribute('href');
  assert.deepEqual(await p.evaluate(()=>window.telegramLinks),[telegramUrl]);
  await p.getByRole('link',{name:'Открыть чат ASTTA',exact:true}).click();
  assert.deepEqual(await p.evaluate(()=>window.telegramLinks),[telegramUrl,telegramUrl]);
  await p.evaluate(()=>delete window.Telegram);
  await p.keyboard.press('Escape');
  await p.locator('#catalogGrid [data-open="item-1943"]').first().click();

  assert.equal(await p.getByText('Указать цену и заказать',{exact:true}).count(),0);
  await p.locator('[data-mk-size="40"]').click();await p.locator('[data-mk-size="42"]').click();
  await p.getByRole('button',{name:'Оформить заказ',exact:true}).waitFor();
  assert.match(await p.locator('.mkprice').innerText(),/12 687/,'only current size quote appears');
  await p.locator('[data-mk-order]').click();
  assert.equal(await p.locator('#lcPrice').isVisible(),false,'no manual price input in automatic flow');
  await p.locator('#lcQty').fill('2');
  assert.equal(await p.locator('#lcActions [data-act="order"]').count(),0,'changing quantity invalidates quote immediately');
  await p.locator('#lcActions [data-act="order"]').waitFor();
  assert.equal(await p.locator('#lcQty').inputValue(),'2');
  await p.locator('#lcContact').fill('@buyer');await p.locator('#lcConsent').check();
  await p.locator('#lcActions [data-act="order"]').click();await p.locator('.success').waitFor();
  assert.match(t.posts.at(-1),/name="quote_id"/,'server quote accompanies order');
  assert.match(t.posts.at(-1),/name="size"\r?\n\r?\n42/);
  await p.keyboard.press('Escape');await p.goto('http://astta.test/#link');await p.waitForSelector('html.is-live');
  await p.locator('#linkInput').fill('https://fast.dewu.com/page/productDetail?spuId=1234567');await p.locator('#linkForm button[type=submit]').click();
  await p.locator('#lcSizes [data-lc-size="42"]').waitFor();
  await p.locator('.market-photos img').first().waitFor();
  assert(await p.locator('.market-photos img').first().evaluate(e=>e.complete&&e.naturalWidth>0),'photos load on our origin');
  await p.locator('[data-lc-size="42"]').click();await p.locator('#lcActions [data-act="order"]').waitFor();
  await p.locator('[data-lc-size="43"]').click();await p.getByText('Цену размера не удалось подтвердить.',{exact:false}).waitFor();
  assert.equal(await p.locator('#lcActions [data-act="order"]').count(),0,'never substitute floor price for unavailable size');
  assert.equal(await p.locator('#lcPrice').inputValue(),'');
  for(const theme of ['dark','light','bimbo']) {
   await p.evaluate(theme=>document.documentElement.setAttribute('data-ui',theme),theme);
   await p.setViewportSize({width:390,height:844});
   assert(await p.locator('.market-photos').evaluate(e=>e.getBoundingClientRect().right<=innerWidth));
  }
  await p.keyboard.press('Escape');await p.locator('[data-ai-open]').first().click();
  await p.locator('#aiChatInput').fill('Покажи фото и цену размера 42 https://fast.dewu.com/page/productDetail?spuId=1234567');
  await p.locator('#aiChatForm button[type=submit]').click();
  await p.locator('#aiMsgs .market-photos img').first().waitFor();
  await p.locator('[data-ai-order]').waitFor();
  await p.locator('[data-ai-market-size][data-size-value="40"]').last().click();
  await p.waitForFunction(()=>[...document.querySelectorAll('[data-ai-order]')].at(-1)?.textContent.includes('8 787'));
  await p.locator('[data-ai-order]').last().click();assert.equal(await p.locator('#lcSize').inputValue(),'40');
  assert.equal(await p.locator('#lcPrice').isVisible(),false);
  await p.keyboard.press('Escape');await p.goto('http://astta.test/#catalog');
  await p.locator('#q').fill('Товар 1943');await p.locator('#catalogGrid [data-open="item-1943"]').first().click();
  await p.locator('[data-mk-size="43"]').click();
  await p.getByText('Цену размера не удалось подтвердить.',{exact:false}).waitFor();
  await p.getByRole('button',{name:'Заказать',exact:true}).click();
  assert.equal(await p.locator('#lcSize').inputValue(),'43','unavailable quote still allows order flow without invented price');
  await p.keyboard.press('Escape');
  await p.locator('#catalogGrid [data-open="item-1943"]').first().click();
  await p.getByRole('button',{name:'Рассказать о модели',exact:true}).click();
  await p.locator('#aiMsgs .msg--me').last().waitFor();
  assert.match(await p.locator('#aiMsgs .msg--me').last().innerText(),/Расскажи коротко про Товар 1943/);
  assert.deepEqual(t.errors,[]);await t.context.close();
  console.log('Marketplace checks passed: async size quotes, stale result isolation, photos, link ordering, unavailable size and AI.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
