const {chromium}=require('playwright');const assert=require('node:assert/strict');
const {setup}=require('./storefront.cjs');
const card=n=>({slug:'look-'+n,title:'Товар подборки '+n,category:'shoes',supplier:'Фабрика',supplier_code:'factory',
 price_cny:'100',unit_price_cny:'100',weight_kg:'1',size_grid:'shoes',sold_count:100,tiers:[],
 retail_rub:'2300',fee_retail:'.05',fee_wholesale:'.03',image:'/assets/img/runner.webp',sizes:['42'],colors:[],gender:'unisex',
 ...(n===8?{title:'Nike Air Force 1 Low',market:{source:'poizon',article:'SKU-8',poizon_rub_min:15000,price_cny_max:899,url:'https://fast.dewu.com/page/productDetail?spuId=1234567',sizes:[{size:'42',ru:'41'}]},images:Array.from({length:8},(_,i)=>'/assets/img/runner.webp?image='+i)}:{})});
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const t=await setup(b,{items:Array.from({length:8},(_,i)=>card(i+1)),market:true,usability:true,touch:true}),p=t.page;
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForSelector('html.is-live');
  await p.locator('[data-ai-open]').first().click();
  await p.locator('#aiChatInput').fill('Собери образ для парня 20 лет');await p.locator('#aiChatForm button[type=submit]').click();
  await p.locator('.aicards .aicard').last().waitFor();
  assert.equal(await p.locator('.msg--ai strong').first().innerText(),'Подборка для парня.');
  assert.equal(await p.locator('.msg--ai img').count(),0,'model text remains escaped');
  for(const theme of ['dark','light','bimbo']) {
   await p.evaluate(theme=>document.documentElement.setAttribute('data-ui',theme),theme);
   for(const width of [320,390,1280]){
    await p.setViewportSize({width,height:844});
    const rail=p.locator('.aicards').first();
    assert(await rail.evaluate(e=>e.clientWidth>0 && e.clientWidth<e.scrollWidth && e.getBoundingClientRect().right<=innerWidth+1),'strip stays inside sheet');
    await rail.focus();await p.keyboard.press('Home');
    await p.waitForFunction(()=>document.querySelector('.aicards').scrollLeft<=2);
    await rail.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    for(let i=0;i<12&&!await p.locator('[data-ai-scroll][data-step="1"]').first().isDisabled();i++){
     const old=await rail.evaluate(e=>e.scrollLeft);await p.locator('[data-ai-scroll][data-step="1"]').first().click();
     await p.waitForFunction(old=>document.querySelector('.aicards').scrollLeft>old,old);
     await rail.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    }
    assert(await rail.evaluate(e=>e.scrollLeft+e.clientWidth>=e.scrollWidth-3),'last item reachable by mouse controls');
    await p.locator('[data-ai-scroll][data-step="-1"]').first().click();
    await rail.focus();await p.keyboard.press('End');
    await rail.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert(await rail.evaluate(e=>e.scrollLeft+e.clientWidth>=e.scrollWidth-3),'last item reachable by keyboard');
   }
  }
  // A real horizontal touch gesture must scroll the strip independently of the sheet.
  await p.setViewportSize({width:390,height:844});
  const rail=p.locator('.aicards').first();await rail.focus();await p.keyboard.press('Home');
  await rail.scrollIntoViewIfNeeded();
  const box=await rail.boundingBox(),cdp=await p.context().newCDPSession(p);
  const y=box.y+Math.min(box.height/2,100),start=box.x+box.width*.85;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});
  for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start-box.width*.65*i/8,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await p.waitForFunction(()=>document.querySelector('.aicards').scrollLeft>20);
  // Background AI results must not reset a strip the buyer has already scrolled.
  await rail.focus();await p.keyboard.press('End');
  await p.locator('[data-ai-order]').waitFor();
  assert(await rail.evaluate(e=>e.scrollLeft+e.clientWidth>=e.scrollWidth-3));
  assert.match(await p.locator('.aitotal').innerText(),/ориентир от/,'floor prices are not sold as a fixed ready cart');
  await p.locator('.aicards [data-open="look-8"]').click();await p.locator('[data-gal-step="1"]').waitFor();
  assert.equal(await p.locator('.mkcompare,.mkauth,.pd__rating').count(),0,'main product view is simplified');
  assert.equal(await p.locator('.pd__details').getAttribute('open'),null);
  for(const width of [390,1280]){
   await p.setViewportSize({width,height:844});
   await p.locator('[data-gal-go="0"]').click();
   await p.waitForFunction(()=>document.querySelector('[data-gal-count]').textContent==='1 / 8');
   for(let i=2;i<=8;i++){
    await p.locator('[data-gal-step="1"]').click();
    await p.waitForFunction(i=>document.querySelector('[data-gal-count]').textContent===i+' / 8',i);
   }
   assert(await p.locator('[data-gal-step="1"]').isDisabled());
   await p.locator('[data-gal-step="-1"]').click();
   await p.waitForFunction(()=>document.querySelector('[data-gal-count]').textContent==='7 / 8');
   assert(await p.locator('.pd__info h2').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)<=36));
  }
  await p.locator('.pd__details summary').click();await p.getByText('SKU-8',{exact:true}).waitFor();
  assert.deepEqual(t.errors,[]);await t.context.close();console.log('Usability checks passed: all AI items, keyboard controls, eight photos, clean product view and safe bold text.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
