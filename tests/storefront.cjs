// Run: node tests/storefront.cjs (requires Playwright and a Chromium executable).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const total = 1944;
const product = (n) => ({slug: `item-${n}`, title: n === 1944 ? 'Последний товар' : `Товар ${n}`, category: 'shoes', supplier: 'Фабрика', supplier_code: 'factory', price_cny: '100', unit_price_cny:'100', weight_kg:'1', size_grid:'shoes', sold_count:total - n, tiers:[], retail_rub:'1620', fee_retail:'.05', fee_wholesale:'.03', image:'/assets/img/runner.webp'});
const site = {rate:'11.4',retail_fee:'.05',wholesale_fee:'.03',link_rate:'13',link_delivery_rub:'1000', shipping:[{code:'auto',name:'Авто',rub_per_kg:'420',days_min:18,days_max:25,is_default:true,for_bulky_only:false}],telegram_bot:'astta_shop_bot',chat:false,market:false};
async function setup(browser, {offline = false, saved = false, failPage = null} = {}) {
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
   if(p==='/api/site') data=site;
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
  console.log('Storefront checks passed: 1944 products, retry, cart persistence, variants, support, API outage.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
