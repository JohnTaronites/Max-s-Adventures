const {chromium}=require('playwright');
const fs=require('fs');
fs.mkdirSync('artifacts', {recursive:true});
(async()=>{
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || undefined});
try {
const page=await browser.newPage({viewport:{width:1100,height:760}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/game.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync('game.js','utf8')+`\nwindow.__test={step(n){for(let i=0;i<n;i++){window.testTime+=1000/60;animate();}},state(){return {lives,score,oreoCount,turbo,turboRemaining,currentLane,isPaused,isStarted,isGameOver,speed:gameSpeed,pools:Object.fromEntries(Object.entries(objectPools).map(([k,v])=>[k,v.length]))}},collision(){const g=makeBarrelGroup();g.position.set(playerGroup.position.x,0,PLAYER_Z);scene.add(g);obstacles.push(g);},coin(){const g=makeCoinGroup();g.position.set(playerGroup.position.x,1,PLAYER_Z);scene.add(g);collectibles.push(g);},render(){renderer.render(scene,camera)},suppressRender(){renderer.render=()=>{}},pool(){for(let i=0;i<200;i++){const g=makeCoinGroup();releaseObject(g);}return objectPools.coin.length;}};` }));
await page.addInitScript(()=>{window.testTime=100;performance.now=()=>window.testTime;window.requestAnimationFrame=()=>0;});
await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.__test);
const assert=(v,m)=>{if(!v)throw Error(m)};
const state=()=>page.evaluate(()=>window.__test.state());const step=n=>page.evaluate(n=>window.__test.step(n),n);
await page.locator('[data-vehicle="rally"]').click();await page.locator('#start-btn').click();await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await step(20);
assert((await state()).currentLane===1,'lane');assert((await state()).turboRemaining>0,'turbo');
await page.screenshot({path:'artifacts/game-desktop.png'});
await page.evaluate(()=>window.__test.suppressRender());
await page.keyboard.press('KeyP');const paused=await state();await step(120);assert((await state()).turboRemaining===paused.turboRemaining,'pause timer');
await page.keyboard.press('ArrowLeft');assert((await state()).currentLane===1,'paused steering');await page.keyboard.press('Escape');
await page.evaluate(()=>window.__test.coin());await step(1);assert((await state()).score===100,'boost score');
await step(180);assert((await state()).turboRemaining===0,'rally duration');await step(490);assert((await state()).turbo===100,'recharge');
await page.evaluate(()=>window.returnToGarage());assert(!(await state()).isStarted,'garage reset');
await page.locator('[data-vehicle="buggy"]').click();await page.locator('#start-btn').click();await page.keyboard.press('Space');await step(240);assert((await state()).turboRemaining>0,'buggy duration');
await page.evaluate(()=>window.returnToGarage());await page.locator('#start-btn').click();
for(let i=0;i<5;i++){await page.evaluate(()=>window.__test.collision());await step(1);}
assert((await state()).isGameOver,'game over');assert(await page.locator('#game-over').isVisible(),'game over UI');
await page.locator('#game-over button').click();assert((await state()).lives===5,'restart lives');
assert(await page.evaluate(()=>window.__test.pool())<=12,'bounded pool');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/garage-mobile.png'});
await page.locator('#start-btn').click();await page.locator('#btn-left').dispatchEvent('pointerdown');await step(1);assert((await state()).currentLane===-1,'touch steering');
await page.locator('#turbo-btn').click();await step(1);assert((await state()).turboRemaining>0,'touch turbo');
const pause=await page.locator('#pause-btn').boundingBox(),stats=await page.locator('#stats-panel').boundingBox();assert(pause.y>=stats.y+stats.height,'mobile HUD overlap');
assert(!errors.length,JSON.stringify(errors));console.log('PASS: vehicle selection, steering, turbo duration/recharge, boosted score, pause, collision/game over, restart, bounded pools, mobile controls and HUD; no runtime errors.');
}finally{await browser.close();}
})();
