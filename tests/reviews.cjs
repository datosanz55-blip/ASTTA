const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {setup}=require('./storefront.cjs');
const fixture=n=>({id:n,author:n===1?'<img src=x onerror=alert(1)>':'Покупатель '+n,rating:n===1?1:5,
 text:n===1?'<script>alert(1)</script> Заказ задержался.\nАгент помог разобраться.':'Заказ доставили, всё хорошо.',created_at:'2026-11-18T10:00:00Z'});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const t=await setup(browser,{telegramAccount:true}),p=t.page;let failSubmit=true,failLoad=true,received=[];
  await p.route('**/api/reviews?*',async route=>{
   if(failLoad){failLoad=false;return route.fulfill({status:503,json:{detail:'retry'}});}
   const page=Number(new URL(route.request().url()).searchParams.get('page'));
   return route.fulfill({json:{items:page===1?Array.from({length:6},(_,i)=>fixture(i+1)):[fixture(7)],total:7,average:4.4,page,has_more:page===1}});
  });
  await p.route('**/api/reviews',async route=>{
   received.push(route.request().postDataJSON());
   assert.equal(route.request().headers()['x-csrftoken'],'test');
   if(failSubmit){failSubmit=false;return route.fulfill({status:503,json:{detail:'Сервис временно недоступен'}});}
   return route.fulfill({status:201,json:{id:8,status:'pending',message:'Спасибо! Отзыв отправлен на проверку перед публикацией.'}});
  });
  await p.reload();await p.waitForSelector('html.is-live');await p.goto('http://astta.test/#homeReviews');
  await p.locator('[data-reviews-retry]').click();await p.locator('.customer-review').first().waitFor();
  assert.equal(await p.locator('.customer-review').count(),6);
  assert.equal(await p.locator('.customer-review img,.customer-review script').count(),0,'review text and author are escaped');
  assert.match(await p.locator('.customer-review').first().innerText(),/Заказ задержался/,'negative reviews are displayed');
  for(const theme of ['dark','light','bimbo']){
   await p.evaluate(theme=>document.documentElement.dataset.ui=theme,theme);
   for(const width of [320,390,1280]){
    await p.setViewportSize({width,height:900});
    assert(await p.locator('.customer-reviews__grid').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'review grid fits viewport');
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
   }
  }
  await p.locator('#reviewsMore').click();await p.waitForFunction(()=>document.querySelectorAll('.customer-review').length===7);
  assert(await p.locator('#reviewsMore').isHidden());
  await p.locator('[data-review-write]').click();
  await p.locator('#customerReviewForm input[value="4"]').check();
  await p.locator('#customerReviewForm textarea').fill('Спасибо за доставку моего заказа!');
  await p.locator('#customerReviewForm button[type=submit]').click();assert.equal(received.length,0,'publication consent required');
  await p.locator('#customerReviewForm input[name=consent]').check();
  await p.locator('#customerReviewForm button[type=submit]').click();await p.locator('#reviewFormError:visible').waitFor();
  assert.equal(await p.locator('#customerReviewForm textarea').inputValue(),'Спасибо за доставку моего заказа!','retry retains text');
  await p.locator('#customerReviewForm button[type=submit]').click();await p.getByText('Спасибо за отзыв!',{exact:true}).waitFor();
  assert.deepEqual(received[1],{rating:4,text:'Спасибо за доставку моего заказа!',consent:true});
  await p.getByRole('button',{name:'Готово',exact:true}).click();
  assert.equal(await p.locator('.customer-review').count(),7,'pending submission is not presented as published');
  if(process.env.ASTTA_SCREENSHOTS) await p.screenshot({path:process.env.ASTTA_SCREENSHOTS,fullPage:false});
  assert.deepEqual(t.errors,[]);await t.context.close();
  const guest=await setup(browser);await guest.page.waitForSelector('html.is-live');
  await guest.page.goto('http://astta.test/#homeReviews');await guest.page.locator('[data-review-write]').click();
  await guest.page.getByRole('button',{name:'Войти',exact:true}).waitFor();
  assert.equal(await guest.page.locator('#customerReviewForm').count(),0);
  await guest.context.close();console.log('Review checks passed: pagination, moderation state, safe text, consent, retries, mobile layouts and guest login.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
