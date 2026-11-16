// Run: node tests/storefront.cjs (requires Playwright and a Chromium executable).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const total = 1944;
const product = (n) => ({slug: `item-${n}`, title: n === 1944 ? 'Последний товар' : `Товар ${n}`, category: 'shoes', supplier: 'Фабрика', supplier_code: 'factory', price_cny: '100', unit_price_cny:'100', weight_kg:'1', size_grid:'shoes', sold_count:total - n, tiers:[], retail_rub:'1620', fee_retail:'.05', fee_wholesale:'.03', image:'/assets/img/runner.webp'});
const site = {rate:'11.4',retail_fee:'.05',wholesale_fee:'.03',link_rate:'13',link_delivery_rub:'1000', shipping:[{code:'auto',name:'Авто',rub_per_kg:'420',days_min:18,days_max:25,is_default:true,for_bulky_only:false}],telegram_bot:'astta_shop_bot',chat:false,market:false};
async function setup(browser, {offline = false, saved = false, failPage = null, rateMissing = false} = {}) {
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await context.newPage(); const errors=[],posts=[],requests=[];
 let active=0, maxActive=0, failures=failPage ? 1 : 0;
 page.on('pageerror',e=>errors.push(e.message));
 if(saved) await context.addInitScript(()=>{ if (!localStorage.getItem('fixture-seeded')) { localStorage.setItem('fixture-seeded','1');localStorage.setItem('astta-demo',JSON.stringify({carts:{buyer:[{id:'item-1944',qty:2,size:'42',color:'белый'}],supplier:[]}}));} });
 await page.route('**/*', async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  if(p.startsWith('/api/')) {
   if(offline) return route.fulfill({status:503,json:{detail:'offline'}});
   let data;
   if(p==='/api/site') data={...site,rate:rateMissing ? null : site.rate};
   else if(p==='/api/suppliers') data=[{code:'factory',name:'Фабрика',fact_days:[18,25]}];
   else if(p==='/api/categories') data=[{slug:'shoes',name_ru:'Обувь'}];
   else if(p==='/api/feed') data={items:[],total:0};
   else if(p==='/api/products') {
    const n=Number(url.searchParams.get('page')||1); requests.push(n); active++;maxActive=Math.max(active,maxActive);
    await new Promise(r=>setTimeout(r,10));active--;
    if(n===failPage && failures > 0 && failures--) return route.fulfill({status:503,json:{detail:'retry'}});
    data={items:Array.from({length:Math.min(60,total-(n-1)*60)},(_,i)=>product((n-1)*60+i+1)),total,page:n,page_size:60};
   } else if(p.startsWith('/api/products/')) data={...product(Number(p.split('-').at(-1))), description:'Описание',sizes:['41','42'],colors:['белый','чёрный'],images:[]};
   else if(p==='/api/auth/csrf') data={csrf:'test'};
   else if(p==='/api/orders' && req.method()==='POST') { posts.push(JSON.parse(req.postData()));data={number:'A-000123',token:'test-order',total_rub:'1620.00'}; }
   else if(p==='/api/link/support') {posts.push(JSON.parse(req.postData()));data={id:123};}
   else data={};
   return route.fulfill({status: req.method()==='POST' ? 201 : 200,json:data});
  }
  try {const file=path.join(root,decodeURIComponent(p==='/'?'/index.html':p));const body=await fs.readFile(file);const ext=path.extname(file);return route.fulfill({body,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff2':'font/woff2'})[ext]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''})}
 });
 await page.goto('http://astta.test/#catalog');
 return {page,context,errors,posts,requests,maxActive:()=>maxActive};
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox']});
 try {
  {
   const t=await setup(browser,{saved:true,failPage:25}),p=t.page;
   await p.waitForSelector('#catalogRetry:visible');
   await p.locator('#catalogRetry').click();
   await p.waitForFunction(()=>!document.querySelector('#catalogStatus').textContent);
   assert(t.requests.includes(33),'catalog beyond 1200 must load');
   assert(t.maxActive()<=3,'background catalog concurrency is bounded');
   assert.equal(await p.locator('#catalogGrid .card').count(),60);
   await p.locator('#q').fill('Последний');
   await p.waitForSelector('#catalogGrid [data-open="item-1944"]');
   await p.goto('http://astta.test/#cart'); // reload also checks saved cart survives loading
   await p.waitForSelector('.citem');
   await p.locator('[data-inc="0"]').click();
   assert.equal(await p.locator('.citem output').innerText(),'3');
   await p.locator('[data-remove="0"]').click();
   assert.equal(await p.locator('.citem').count(),0);
   // Current catalog loading must not resurrect the removed item.
   await p.waitForFunction(()=>!document.querySelector('#catalogStatus').textContent);
   await p.reload();await p.waitForSelector('html.is-live');
   assert.equal(await p.locator('.citem').count(),0);
   await p.goto('http://astta.test/#catalog');await p.waitForSelector('html.is-live');
   await p.locator('#catalogGrid [data-open="item-1"]').click();
   await p.waitForSelector('[data-color="чёрный"]');
   await p.locator('[data-size="42"]').click();await p.locator('[data-color="чёрный"]').click();
   await p.locator('[data-pd-add]').click();
   await p.goto('http://astta.test/#cart');await p.waitForSelector('.citem');
   await p.locator('[data-checkout]').click();await p.locator('#ckContact').fill('@buyer');await p.locator('#ckConsent').check();
   await p.locator('#checkoutForm button[type=submit]').click();
   await p.waitForSelector('.success');
   assert.equal(t.posts.at(-1).items[0].color,'чёрный');assert.equal(t.posts.at(-1).items[0].size,'42');
   await p.goto('http://astta.test/#support');await p.waitForSelector('#supportForm');
   await p.locator('#supportForm [name=contact]').fill('@buyer');await p.locator('#supportForm [name=message]').fill('Помогите с заказом');await p.locator('#supportConsent').check();
   await p.locator('#supportForm button[type=submit]').click();await p.getByRole('heading',{name:'Обращение №123 принято'}).waitFor();
   assert.equal(t.posts.at(-1).message,'Помогите с заказом');
   await p.keyboard.press('Escape');
   await p.locator('[data-mode="supplier"]').first().click();
   await p.goto('http://astta.test/#catalog');
   assert.equal(await p.locator('#catalogGrid .card').count(),0,'no invented wholesale tiers');
   await p.locator('[data-ai-open]').first().click();
   await p.locator('#aiChatInput').fill('Подбери подарок');
   await p.locator('#aiChatForm button[type=submit]').click();
   await p.getByText('Этот режим ИИ сейчас недоступен.',{exact:false}).waitFor();
   assert.equal(await p.locator('.aicard').count(),0,'disabled AI must not invent a demo answer');
   await p.keyboard.press('Escape');
   await p.locator('[data-theme-toggle]').first().click();
   assert.equal(await p.locator('[data-theme]').count(),3);
   await p.locator('[data-theme="bimbo"]').click();
   assert.equal(await p.locator('html').getAttribute('data-ui'),'bimbo');
   assert.equal(await p.evaluate(()=>localStorage.getItem('astta-theme')),'bimbo');
   assert.equal(await p.locator('meta[name="theme-color"]').getAttribute('content'),'#fff8fc');
   await p.reload();await p.waitForSelector('html.is-live');
   assert.equal(await p.locator('html').getAttribute('data-ui'),'bimbo','theme survives application boot');
   await p.goto('http://astta.test/#home');
   for(const width of [320,390,768,900,1024]) {
    await p.setViewportSize({width,height:844});
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`theme must not overflow at ${width}px`);
   }
   await p.setViewportSize({width:390,height:844});
   await p.locator('#menuBtn').click();
   await p.locator('.drawer__theme').click();
   await p.locator('[data-theme="light"]').click();
   assert.equal(await p.locator('html').getAttribute('data-ui'),'light');
   await p.locator('#menuBtn').click();await p.locator('.drawer__theme').click();
   await p.locator('[data-theme="bimbo"]').click();
   for(const doc of ['privacy.html','consent.html']) {
    await p.goto(`http://astta.test/${doc}`);
    assert.equal(await p.locator('html').getAttribute('data-ui'),'bimbo');
    assert.equal(await p.locator('main').isVisible(),true);
   }
   assert.deepEqual(t.errors,[]);await t.context.close();
  }
  {
   const t=await setup(browser,{offline:true});await t.page.waitForSelector('#siteError:visible');
   assert.equal(await t.page.locator('#app').isVisible(),false,'API failure must hide demo');
   await t.page.locator('[data-site-retry]').click();await t.page.waitForSelector('#siteError:visible');
   for (const doc of ['privacy.html','consent.html']) {
    await t.page.goto(`http://astta.test/${doc}`);
    assert.equal(await t.page.locator('main').isVisible(),true,'documents must not wait for store API');
   }
   assert.deepEqual(t.errors,[]);await t.context.close();
  }
  {
   const t=await setup(browser),p=t.page;
   await p.waitForSelector('html.is-live');
   await p.emulateMedia({reducedMotion:'reduce'});
   await p.goto('http://astta.test/#home');await p.waitForSelector('html.is-live');
   await p.evaluate(()=>document.fonts.ready);
   await p.addStyleTag({content:'*,*::before,*::after { transition: none !important; animation: none !important; }'});
   for(const theme of ['dark','light','bimbo']) {
    await p.evaluate(theme=>document.documentElement.setAttribute('data-ui',theme),theme);
    for(const width of [320,390,768,900,1024,1280,1440,1920]) {
     await p.setViewportSize({width,height:900});
     await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     for(let slide=0;slide<3;slide++) {
      await p.locator('.hero__dots button').nth(slide).dispatchEvent('click');
      const layout=await p.evaluate(()=>{
       const hero=document.querySelector('.hero'),copy=document.querySelector('.hero__copy').getBoundingClientRect(),visual=document.querySelector('.hero__visual'),photo=visual.getBoundingClientRect();
       const title=document.querySelector('.htext.is-on :is(h1,h2)'),range=document.createRange();range.selectNodeContents(title);
       const text=range.getBoundingClientRect();
       const assertClip=getComputedStyle(visual).overflow==='hidden';
       return {clipped:assertClip && hero.scrollLeft===0,separate:copy.right<=photo.left+1 || copy.top>=photo.bottom-1,contained:text.right<=copy.right+1 && text.left>=copy.left-1,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert(layout.clipped && layout.separate && layout.contained && !layout.overflow,`${theme}, ${width}px, slide ${slide+1}: ${JSON.stringify(layout)}`);
     }
     if(width>=900) {assert(await p.locator('.rate').isVisible(),'desktop exchange rate visible');assert.match(await p.locator('.rate').innerText(),/11,40/);}
    }
   }
   await p.setViewportSize({width:1440,height:900});
   assert(await p.locator('#homeSectionNav').isVisible());
   assert.equal(await p.locator('#homeSectionNav a[href="#homePoizon"]').isVisible(),false,'empty sections omitted');
   await p.locator('#homeSectionNav a[href="#faq"]').click();
   await p.waitForFunction(()=>document.querySelector('#homeSectionNav a[href="#faq"]').getAttribute('aria-current')==='location');
   await p.goto('http://astta.test/#catalog');await p.waitForSelector('html.is-live');
   assert.equal(await p.locator('#homeSectionNav').isVisible(),false,'rail only on home');
   assert.deepEqual(t.errors,[]);await t.context.close();
  }
  {
   const t=await setup(browser,{rateMissing:true});await t.page.waitForSelector('html.is-live');
   assert.equal(await t.page.locator('.rate').isVisible(),false,'missing rate must not show demo value');
   await t.context.close();
  }
  console.log('Storefront checks passed: catalog, cart, support, API outage, hero layouts, home navigation, desktop rate.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
