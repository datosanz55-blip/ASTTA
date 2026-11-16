const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {setup}=require('./storefront.cjs');
const variant=(id,diameter,width,pcd,offset,price)=>({
 slug:id,title:`Колёсный диск RUEIZU R117 R${diameter} ${diameter}x${width} PCD ${pcd} ET${offset}`,
 category:'shoes',supplier:'Фабрика',supplier_code:'factory',brand:'RUEIZU',sizes:[`${diameter}x${width}`],colors:[],
 price_cny:String(price),unit_price_cny:String(price),weight_kg:'12',size_grid:'',sold_count:100,tiers:[],
 retail_rub:'30000',fee_retail:'.05',fee_wholesale:'.03',image:'/assets/img/runner.webp',
 wheel:{key:'factory|wheels|rueizu-r117',model:'Колёсный диск RUEIZU R117',diameter:String(diameter),width:String(width),size:`${diameter}x${width}`,pcd,offset:String(offset)}
});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox']});
 try {
  const items=[variant('rim19',19,8.5,'5×112',30,1950),variant('rim19-et43',19,8.5,'5×112',43,1960),variant('rim20',20,9,'5×108',40,2080)];
  const t=await setup(browser,{items}),p=t.page;
  await p.waitForSelector('html.is-live');await p.waitForFunction(()=>!document.querySelector('#catalogStatus').textContent);
  assert.equal(await p.locator('#catalogGrid .card').count(),1,'one card per wheel model');
  assert.match(await p.locator('#catalogGrid .card__title').innerText(),/^Колёсный диск RUEIZU R117$/);
  assert.match(await p.locator('#catalogGrid .card__price').innerText(),/^от /);
  assert.match(await p.locator('#catalogCount').innerText(),/1 товар/);
  // Filters operate on SKU prices and specifications before the model is collapsed.
  await p.locator('[data-facet="size"][value="20x9"]').check();
  assert.equal(await p.locator('#catalogGrid .card').count(),1);
  assert.equal(await p.locator('#catalogGrid [data-open]').getAttribute('data-open'),'rim20');
  const price20card=await p.locator('#catalogGrid .card__price').innerText();
  await p.locator('[data-facet="size"][value="20x9"]').uncheck();
  assert.notEqual(await p.locator('#catalogGrid .card__price').innerText(),price20card);
  await p.locator('[data-mode="supplier"]').first().click();
  assert.equal(await p.locator('#catalogGrid .card').count(),0,'no invented wholesale options');
  await p.locator('[data-mode="buyer"]').first().click();
  await p.locator('#catalogGrid [data-open]').click();await p.locator('[data-wheel-diameter="20"]').waitFor();
  await p.locator('[data-pd-add]').click();
  assert.equal(await p.locator('.pd').count(),1,'choosing full wheel specification is required');
  await p.locator('[data-wheel-diameter="19"]').click();
  assert.equal(await p.locator('[data-wheel-variant]').count(),2,'same diameter retains different offsets');
  await p.locator('[data-wheel-variant="rim19"]').click();await p.locator('[data-pd-add]:enabled').waitFor();
  const price19=await p.locator('.pd__price b').innerText();
  for(const theme of ['dark','light','bimbo']) {
   await p.evaluate(theme=>document.documentElement.setAttribute('data-ui',theme),theme);
   for(const width of [320,390,1280]) {
    await p.setViewportSize({width,height:900});
    assert(await p.locator('[data-wheel-variant="rim19"]').isVisible());
    assert(await p.evaluate(()=>{const e=document.querySelector('.wheel-configs'),r=e.getBoundingClientRect();return r.width>0 && r.right<=innerWidth+1 && r.left>=0 && e.scrollWidth<=e.clientWidth+1;}),'wheel controls fit the screen');
   }
  }
  await p.locator('[data-wheel-diameter="20"]').click();
  assert.equal(await p.locator('[data-wheel-variant]').count(),1);
  assert.equal(await p.locator('.pd__price').count(),0,'no stale quote after changing diameter');
  await p.locator('[data-wheel-variant="rim20"]').click();await p.locator('[data-pd-add]:enabled').waitFor();
  assert.notEqual(await p.locator('.pd__price b').innerText(),price19,'selected variant updates price');
  for(let n=0;n<3;n++) await p.locator('[data-pd-qty="1"]').click();
  await p.locator('[data-pd-add]').click();
  await p.goto('http://astta.test/#cart');await p.locator('.citem').waitFor();
  assert.equal(await p.locator('.citem output').innerText(),'4');
  assert.match(await p.locator('.citem').innerText(),/20x9/);
  assert.match(await p.locator('.citem').innerText(),/5×108/);
  await p.locator('[data-checkout]').click();await p.locator('#ckContact').fill('@wheelbuyer');await p.locator('#ckConsent').check();
  await p.locator('#checkoutForm button[type=submit]').click();await p.locator('.success').waitFor();
  assert.deepEqual(t.posts.at(-1).items.map(v=>({product:v.product,size:v.size,qty:v.qty})),[{product:'rim20',size:'20x9',qty:4}]);
  assert.deepEqual(t.errors,[]);await t.context.close();
  console.log('Wheel checks passed: grouping, complete specifications, price, mobile themes, cart and exact order SKU.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1;});
