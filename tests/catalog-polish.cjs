const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {setup}=require('./storefront.cjs');
const raw='加大码（可调节57-62）';
const item=(slug,brand,extra={})=>({slug,title:'Модель '+slug,brand,category:'shoes',supplier:'Фабрика',supplier_code:'factory',
 price_cny:'100',unit_price_cny:'100',weight_kg:'1',size_grid:'shoes',sold_count:10,tiers:[],retail_rub:'2300',
 fee_retail:'.05',fee_wholesale:'.03',image:'/assets/img/runner.webp',sizes:['42'],colors:[],...extra});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const items=[item('originals','Adidas Originals'),item('neo','Adidas Neo'),item('terrex','Adidas TERREX'),item('base','Adidas'),
   item('nike','Nike SB'),item('missing','Nike',{image:null,market:{source:'taobao'}}),
   item('broken','Nike',{image:'/assets/img/missing-photo.webp',market:{source:'taobao'}}),
   item('variants','Nike',{market:{source:'poizon',url:'https://fast.dewu.com/page/productDetail?spuId=1234567',sizes:[{size:raw}]}})];
  const t=await setup(browser,{items,market:true,marketSizes:[raw,'体重100斤','一对装','未知规格']}),p=t.page,lookups=[];
  p.on('request',req=>{if(req.url().endsWith('/api/link/market-jobs'))lookups.push(req.postDataJSON());});
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForSelector('html.is-live');await p.waitForFunction(()=>!document.documentElement.classList.contains('is-splash'));
  await p.waitForFunction(()=>!document.querySelector('#catalogGrid [data-open="broken"]'));
  assert.equal(await p.locator('#catalogGrid [data-open="missing"]').count(),0,'missing image is not replaced with a fake product photo');
  await p.locator('[data-facet-values=brand]').evaluate(e=>e.closest('details').open=true);
  const brands=p.locator('[data-facet-values=brand] .filter-check');
  assert.equal(await brands.count(),2,'Adidas lines share one facet; Nike lines share one facet');
  assert.match(await brands.filter({hasText:'Adidas'}).innerText(),/4/);
  await brands.filter({hasText:'Adidas'}).locator('input').check();
  assert.equal(await p.locator('#catalogGrid .card').count(),4);
  await p.locator('[data-facet=brand][value=adidas]').uncheck();
  assert.equal(await p.locator('#homePopular,#popular,[href="#homePopular"]').count(),0,'hits section and home navigation entry removed');
  await p.locator('#catalogGrid [data-open="variants"]').first().click();
  assert.equal(await p.locator(`[data-mk-size="${raw}"] b`).innerText(),'Большой размер (регулируется 57–62)');
  assert.equal(await p.locator('[data-mk-size="体重100斤"] b').innerText(),'Вес 50 кг');
  assert.equal(await p.locator('[data-mk-size="一对装"] b').innerText(),'Пара');
  assert.match(await p.locator('[data-mk-size="未知规格"] b').innerText(),/уточните у агента/);
  for(const theme of ['dark','light','bimbo']){
   await p.evaluate(theme=>document.documentElement.dataset.ui=theme,theme);
   for(const width of [320,390,1280]){
    await p.setViewportSize({width,height:900});
    assert(await p.locator('.mksizes').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'translated variants fit narrow screens');
   }
  }
  await p.locator(`[data-mk-size="${raw}"]`).click();await p.getByRole('button',{name:'Оформить заказ',exact:true}).waitFor();
  assert.equal(lookups.at(-1).size,raw,'quote uses original supplier size');
  await p.getByRole('button',{name:'Оформить заказ',exact:true}).click();
  assert.equal(await p.locator('#lcSize').inputValue(),'Большой размер (регулируется 57–62)','checkout displays Russian label');
  await p.locator('#lcQty').fill('2');await p.locator('#lcActions [data-act=order]').waitFor();
  assert.equal(lookups.at(-1).size,raw,'quantity change preserves raw variant ID');
  await p.locator('#lcContact').fill('@buyer');await p.locator('#lcConsent').check();
  await p.locator('#lcActions [data-act=order]').click();await p.locator('.success').waitFor();
  assert(t.posts.at(-1).includes(raw),'order keeps original supplier value');
  await p.keyboard.press('Escape');await p.goto('http://astta.test/#home');
  await p.waitForFunction(()=>!document.querySelector('[data-view=home]').hidden);
  const images=await p.locator('.hero__media img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src')));
  assert.deepEqual(images,['assets/img/hero-street.webp','assets/img/hero-essentials.webp','assets/img/hero-studio.webp']);
  await p.locator('.hero__media img').first().scrollIntoViewIfNeeded();
  assert(await p.locator('.hero__media img').first().evaluate(e=>e.complete&&e.naturalWidth>0));
  assert.deepEqual(t.errors,[]);await t.context.close();
  console.log('Catalog polish checks passed: grouped brands, hidden bad photos, translated variants, raw quote/order binding, hero images and removed hits.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
