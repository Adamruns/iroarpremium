// Offline exercise of the manifest's production scripts. All course and instructor records here are fictional.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const path = name => fileURLToPath(new URL(name, import.meta.url));
const manifest = JSON.parse(await readFile(path('../../manifest.json'),'utf8'));
const capture = process.argv.includes('--capture');
const shots = path('./.frames/');
if (capture) await mkdir(shots,{recursive:true});
const base = 'https://regssb.sis.clemson.edu/StudentRegistrationSsb/ssb/';
const dashboard = 'https://sadv.sis.clemson.edu/StudentSelfService/ssb/studentCommonDashboard';
const meeting = (days,start,end,extra={}) => ({meetingTime:{
    ...Object.fromEntries(days.map(d=>[d,true])), beginTime:start,endTime:end,building:'Hall',room:'201',...extra
}});
const mw = ['monday','wednesday'], tt = ['tuesday','thursday'];
const courses = [
    ['BIOL','1010','Life in Motion','Reed, Avery',[meeting(mw,'0900','1015'),meeting(['friday'],'1030','1120')]],
    ['ART','2100','Color and Perception','Lane, Ellis',[meeting(tt,'1100','1215')]],
    ['MATH','1080','Patterns and Proof','Rivera, Quinn',[meeting(mw,'0945','1035')]],
    ['ENG','2020','Stories of Place','Blake, Rowan',[meeting(tt,'1400','1515')]],
    ['GEOG','1300','Reading Landscapes','Park, Eden',[meeting(['saturday'],'0830','0950')]],
    ['MUS','1150','Listening Studio','Wells, Sage',[]],
    ['PHYS','1220','Light and Sound','Gray, Kit',[meeting(mw,'1300','1415')]],
    ['DES','2010','Form and Function','Finch, Arden',[meeting(tt,'0900','1015')]]
].map(([subject,courseNumber,courseTitle,displayName,meetingsFaculty],i)=>({
    subject,courseNumber,courseTitle,faculty:[{displayName}],meetingsFaculty,sequenceNumber:'001',
    courseReferenceNumber:String(81000+i),creditHours:i===0?'4':'3',maximumEnrollment:32,enrollment:12+i
}));
const directory = [
    ['Student Registration',['Add/Drop Classes, Plan Ahead and View Schedule','Course Catalog','Schedule of Classes','View Registration','Request a Seat in a Closed Course']],
    ['Student Records',['Academic Transcript','Advising Student Profile','Degree Evaluation','View Grades','Enrollment Verification']],
    ['Student Financial Aid',['My Financial Aid','Financial Aid Resources']],
    ['Student Account',['Tax Notification 1098T','Student Billing']]
];
const fixture = (title,body) => '<!doctype html><html><head><title>'+title+'</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:16px Arial,sans-serif}#title-panel{padding:12px 20px;background:#522d80;color:white}#title-panel h1{font-size:18px;margin:0}#content{margin:0 auto;max-width:1200px}.heading-txt{padding:12px 22px}.heading-txt li{margin:6px 0}</style></head><body><div id="title-panel"><h1>'+title+'</h1></div><main id="content">'+body+'</main></body></html>';
const nativeDirectory = fixture('Student Self-Service','<div class="heading-txt"><p>Hello, Student</p>'+directory.map(([s,links])=>'<h2>'+s+'</h2>'+links.map((l,i)=>'<li><a href="/example/'+i+'">'+l+'</a></li>').join('')).join('')+'</div>');
const termForm = fixture('Browse Classes','<label for="txt_term">Term: Spring 2027</label><input id="txt_term" type="hidden"><button>Search</button>');
const nativePlan = fixture('Plan Ahead','<table><tr><td data-property="instructor"><a href="mailto:instructor@example.invalid">Reed, Avery</a></td></tr></table>');
const hub = base+'registration';
const portal = 'https://iroar.app.clemson.edu/dashboard/index.php';
const emptyBannerMenu = fixture('Registration', `<div id="bannerMenuDiv">
    <a id="bannerMenu" href="#" role="menu" aria-label="Banner Menu">Menu</a>
    <div id="menuContainer" hidden><nav id="menu"><ul id="menuList" role="tree"></ul></nav></div></div>
    <script>bannerMenu.onclick=e=>{e.preventDefault();const open=menuContainer.classList.toggle('show');menuContainer.hidden=!open;}</script>`);
const campusTile = (title,url) => `<div class="col-md-6 tab-item sm-tab-item"><a href="${url}" target="_blank"><div class="row">
    <div class="col-2 brand-bg"><i></i></div><div class="col-10 white-bg"><span class="icon-text">${title}</span></div></div></a></div>`;
const campusSections = [
    ['Dashboard',[['Student Self-Service','/self-service'],['Campus Library','/library'],['Student Registration','/registration']]],
    ['Records',[['Student Self-Service','/self-service'],['Academic Records','/records']]]
];
const portalPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>iROAR portal</title><style>*{box-sizing:border-box}body{margin:0;font:16px Arial,sans-serif}</style></head><body><main><nav id="app-nav"><button aria-controls="navbarSupportedContent"
    aria-expanded="false" onclick="const open=this.getAttribute('aria-expanded')==='false';this.setAttribute('aria-expanded',open);this.nextElementSibling.hidden=!open">Toggle</button>
    <div id="navbarSupportedContent" hidden><ul class="navbar-nav"></ul></div></nav>
    <section id="page_body"><div id="portal_dashboard"><ul class="nav-tabs" role="tablist">
    ${campusSections.map(([name],i)=>`<li><button class="nav-link ${i?'':'active'}" role="tab" data-bs-toggle="tab" aria-controls="section-${i}">${name}</button></li>`).join('')}</ul>
    <div class="tab-content">${campusSections.map(([,links],i)=>`<div class="tab-pane" ${i?'hidden':''} id="section-${i}"><div class="row">
    <div class="col-lg-3"><div class="card">Campus notice</div><div><img alt="Campus" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="></div></div>
    <div class="col-lg-9"><div class="row pane-items">${links.map(([name,url])=>campusTile(name,url)).join('')}</div></div></div></div>`).join('')}</div></div></section>
    <script>for (const tab of document.querySelectorAll('[role=tab]')) tab.onclick=()=>{
        for (const other of document.querySelectorAll('[role=tab]')) {
            other.classList.toggle('active',other===tab);
            document.getElementById(other.getAttribute('aria-controls')).hidden=other!==tab;
        }
        tab.dispatchEvent(new Event('shown.bs.tab',{bubbles:true}));
    }</script></main></body></html>`;
const errors = [], unexpected = [];
const browser = await chromium.launch();
async function run(width) {
    const ctx = await browser.newContext({viewport:{width,height:width<500?844:820},deviceScaleFactor:capture ? 2 : 1});
    try {
        await ctx.addInitScript(() => {
            window.chrome ??= {};
            window.chrome.runtime = {connect({name}) {
                let receive;
                return {onMessage:{addListener(fn){ receive=fn; }},onDisconnect:{addListener(){}},disconnect(){},
                    postMessage(){ setTimeout(()=>receive(name==='grade-distribution'
                        ? {type:'gradeDistribution',data:[{semester:'Fall',year:'2023',data:['BIOL','1010','001','Life in Motion','46%','32%','15%','5%','2%']}]}
                        : {avgRating:4.3,avgDifficulty:2.6,numRatings:18,wouldTakeAgainPercent:84,legacyId:999999999}),10); }};
            }};
        });
        let bannerCache;
        await ctx.route('**/*',async route => {
            const url = new URL(route.request().url());
            if (route.request().method()==='POST' && url.pathname.endsWith('/classSearch/resetDataForm')) {
                bannerCache = undefined;
                return route.fulfill({json:{success:true}});
            }
            if (route.request().method()!=='GET') { unexpected.push(route.request().method()+' '+url.pathname); return route.abort(); }
            if (route.request().isNavigationRequest()) {
                const html = url.href===hub ? emptyBannerMenu : url.href===portal ? portalPage : url.href===dashboard ? nativeDirectory : url.pathname.includes('/plan/') ? nativePlan : termForm;
                return route.fulfill({contentType:'text/html',body:html});
            }
            if (url.pathname.endsWith('/searchResults/searchResults')) {
                const query = url.searchParams.get('txt_courseTitle')?.toLowerCase() || '';
                const data = bannerCache ??= courses.filter(c=>c.courseTitle.toLowerCase().includes(query));
                return route.fulfill({json:{success:true,totalCount:data.length,data:data.length ? data : null}});
            }
            if (url.pathname.endsWith('/get_subject')) return route.fulfill({json:[{code:'BIOL',description:'Biology'}]});
            if (/getFacultyMeetingTimes|fetchLinkedSections/.test(url.pathname)) return route.fulfill({json:{}});
            if (url.pathname.includes('/searchResults/')) return route.fulfill({contentType:'text/html',body:url.pathname.endsWith('/getCourseDescription')?'Explore how living systems adapt to movement, energy, and change.':''});
            unexpected.push(url.pathname); return route.abort();
        });
        const page = await ctx.newPage();
        page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
        async function open(url) {
            await page.goto(url);
            if (capture && width >= 1000 && url === dashboard) {
                await shot('directory-before', page.locator('.heading-txt'));
            }
            for (const group of manifest.content_scripts) {
                if (!group.matches.some(pattern=>new RegExp('^'+pattern.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(url))) continue;
                for (const css of group.css||[]) await page.addStyleTag({path:path('../../'+css)});
                for (const js of group.js||[]) await page.addScriptTag({path:path('../../'+js)});
            }
        }
        async function shot(name,locator=page) {
            if (capture) await locator.screenshot({path:shots+name+'.png',animations:'disabled'});
        }
        const narrow = width < 500;
        const noOverflow = async () => assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
        await open(hub);
        const bannerMenu = page.locator('#bannerMenu');
        await bannerMenu.press('ArrowDown');
        assert.equal(await bannerMenu.getAttribute('aria-expanded'),'true');
        assert(await page.getByRole('link',{name:'iROAR portal'}).evaluate(el=>el===document.activeElement));
        await page.keyboard.press('Escape');
        assert.equal(await bannerMenu.getAttribute('aria-expanded'),'false');
        await bannerMenu.press('Space');
        const planLink = page.getByRole('link',{name:'Plan ahead'});
        assert.equal(await planLink.getAttribute('href'),base+'term/termSelection?mode=plan');
        // A delayed, role-specific native menu must take precedence immediately.
        await page.locator('#menuList').evaluate(list=>{const a=document.createElement('a');a.href='/native';a.textContent='Native destination';list.append(a);});
        await planLink.waitFor({state:'hidden'});
        assert(await page.getByRole('link',{name:'Native destination'}).isVisible());
        await page.locator('#menuList').evaluate(list=>list.replaceChildren());
        await planLink.click();
        assert.equal(page.url(),base+'term/termSelection?mode=plan');

        await open(portal);
        const campusSearch = page.getByRole('searchbox',{name:'Find a campus service'});
        const campusTabs = page.getByRole('tablist');
        assert.equal(await campusTabs.getAttribute('aria-orientation'), narrow ? 'horizontal' : 'vertical');
        assert.equal(await page.locator('.iroar-portal-search').getByRole('heading',{level:1}).innerText(),'Dashboard');
        await noOverflow();
        if (!narrow) {
            const sidebar = await campusTabs.boundingBox();
            const services = await page.locator('#section-0 .pane-items').boundingBox();
            assert(sidebar.x+sidebar.width < services.x);
            assert.equal(await page.locator('#section-0 .pane-items').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),3);
        }
        await campusSearch.fill('Student');
        assert.equal(await page.locator('.iroar-portal-results a').count(),2);
        assert.equal(await page.locator('.iroar-portal-results a').first().getAttribute('target'),'_blank');
        await campusSearch.fill('missing');
        assert.match(await page.getByRole('status').innerText(),/No matching services/);
        if (narrow) {
            await page.getByRole('button',{name:'Portal navigation'}).click();
            await page.locator('.iroar-portal-sections').getByRole('button',{name:'Records'}).click();
            assert(await page.locator('.nav-tabs .active').evaluate(el=>el===document.activeElement));
            await page.getByRole('button',{name:'Portal navigation'}).click();
            await page.locator('#navbarSupportedContent .navbar-nav').evaluate(ul=>{const a=document.createElement('a');a.href='/native';a.textContent='Role menu';ul.append(a);});
            assert(await page.locator('.iroar-portal-sections').isHidden());
        } else {
            await page.getByRole('tab',{name:'Records',exact:true}).click();
        }
        assert.equal(await campusSearch.inputValue(),'');
        assert.equal(await page.locator('.iroar-portal-search').getByRole('heading',{level:1}).innerText(),'Records');
        assert(await page.locator('#section-1 .card').isVisible());
        assert.equal(await page.getByRole('link',{name:'Academic Records'}).getAttribute('href'),'/records');
        await open(dashboard);
        assert.equal(await page.locator('.iroar-service-card a').count(),14);
        await noOverflow();
        if (!narrow) await shot('directory',page.locator('.iroar-dashboard'));
        await page.locator('.iroar-tools select').selectOption({label:'Student Records'});
        assert.equal(await page.locator('.iroar-service-card:visible').count(),1);
        await page.locator('.iroar-tools select').selectOption('');
        await page.getByRole('searchbox').fill('grade');
        if (!narrow) await shot('directory-filter',page.locator('.iroar-dashboard'));
        assert.equal(await page.locator('.iroar-service-card li:visible').count(),1);
        await page.getByRole('searchbox').fill('no-such-service');
        assert.match(await page.getByRole('status').innerText(),/No services found/);
        await page.getByRole('button',{name:'Show original directory'}).click();
        assert(await page.locator('.heading-txt').isVisible());

        await open(base+'term/termSelection?mode=plan');
        assert.equal(await page.locator('.irp-app').count(),0);
        await open(base+'plan/selectPlan');
        await page.getByRole('button',{name:'Grade history'}).click();
        await page.waitForFunction(()=>document.querySelector('dialog')?.innerText.includes('2023') || document.querySelector('dialog')?.innerText.includes('could not'));
        assert.match(await page.locator('dialog').innerText(),/Fall 2023 · BIOL 1010 001/);
        await page.keyboard.press('Escape');
        await page.locator('dialog').waitFor({state:'detached'});

        await open(base+'classSearch/classSearch');
        const plannerMenu = page.locator('.irp-site-nav summary');
        await plannerMenu.click();
        const hubLink = page.getByRole('navigation',{name:'iROAR navigation'}).getByRole('link',{name:'Registration home'});
        assert.equal(await hubLink.getAttribute('href'),hub);
        await hubLink.focus(); await page.keyboard.press('Escape');
        assert(await plannerMenu.evaluate(el=>el===document.activeElement));
        assert(await hubLink.isHidden());
        await plannerMenu.press('Enter');
        const viewport = page.viewportSize();
        await page.mouse.click(viewport.width - 12, viewport.height - 15);
        assert(await hubLink.isHidden());
        await page.locator('#irp-query').fill('BIOL 1010');
        await page.getByRole('button',{name:'Find classes'}).click();
        await page.locator('tr[data-crn]').first().waitFor();
        assert.equal(await page.locator('#irp-txt_subject').inputValue(),'BIOL');
        assert.equal(await page.locator('#irp-txt_courseNumber').inputValue(),'1010');
        const filters = page.getByRole('button',{name:'Toggle filters'});
        async function showFilters(){if(narrow) await filters.click();}
        const search = page.getByRole('button',{name:'Search',exact:true});
        await showFilters();
        await page.locator('#irp-txt_subject').fill('bi');
        const choice = page.getByRole('button',{name:'Biology'});
        await choice.waitFor();
        await page.locator('#irp-txt_subject').press('ArrowDown');
        assert(await choice.evaluate(el=>el===document.activeElement));
        await page.keyboard.press('Escape');
        assert(await choice.isHidden());
        assert(await page.locator('#irp-txt_subject').evaluate(el=>el===document.activeElement));
        await page.locator('#irp-txt_subject').fill('bio');
        await choice.waitFor(); await page.locator('#irp-txt_subject').press('Enter');
        assert(await choice.isHidden());
        assert.match(await page.locator('.irp-active-filters').innerText(),/Biology/);
        await page.getByRole('button',{name:'Clear all'}).click();
        await page.locator('#irp-txt_courseTitle').fill('nothing');
        await search.click();
        await page.getByText('No results found').waitFor();
        await showFilters(); await page.getByRole('button',{name:'Clear all'}).click(); await search.click();
        await page.locator('[data-metric=rating]').first().getByText('4.3').waitFor();
        assert.equal(await page.locator('.irp-table tr[data-crn]').count(),8);
        await noOverflow();
        if (narrow) await shot('phone-search'); else await shot('classes');
        await page.getByRole('button',{name:'Life in Motion'}).click();
        await page.locator('.irp-grade-chart .irp-bar').first().waitFor();
        assert.equal(await page.locator('.irp-grade-chart .irp-bar').count(),5);
        assert.equal(await page.locator('.irp-rmp-link').getAttribute('href'),'https://www.ratemyprofessors.com/professor/999999999');
        if (!narrow) {
            await shot('detail',page.locator('.irp-detail-panel'));
            await shot('rating',page.locator('.irp-rmp-card'));
            await shot('grades',page.locator('.irp-detail-section').filter({has:page.locator('.irp-grade-chart')}));
        }
        await page.getByRole('button',{name:'Life in Motion'}).click();
        const close = page.getByRole('button',{name:'Close schedule'});
        async function add(index) {
            await page.locator('tr[data-crn="'+courses[index].courseReferenceNumber+'"] .irp-btn-add').click();
            assert(await close.evaluate(node=>node===document.activeElement));
        }
        for (const i of [0,1,3,4]) {
            await add(i);
            if (i === 0) {
                assert.match(await page.locator('.irp-cart-card').innerText(), /Mon, Wed · 9:00am–10:15am/);
                assert.match(await page.locator('.irp-cart-card').innerText(), /Fri · 10:30am–11:20am/);
            }
            if (!narrow && i !== 4) await shot('week-'+i,page.locator('.irp-drawer'));
            await close.click();
            assert(await page.locator('tr[data-crn="'+courses[i].courseReferenceNumber+'"] button[data-crn]').evaluate(el=>el===document.activeElement));
        }
        await page.getByRole('button',{name:'My schedule'}).click();
        assert.equal(await page.locator('.irp-block').count(),8);
        assert.match(await page.locator('.irp-cart-credits').innerText(),/13 credits/);
        assert.equal(await page.locator('.irp-conflict-warning').count(),0);
        if (narrow) await shot('phone-week'); else await shot('week',page.locator('.irp-drawer'));
        await close.click(); await add(2);
        assert.equal(await page.locator('.irp-conflict-warning').count(),1);
        if (!narrow) await shot('conflict',page.locator('.irp-drawer'));
        await page.getByRole('button',{name:'Remove MATH 1080'}).click();
        assert.equal(await page.locator('.irp-conflict-warning').count(),0);
        await page.keyboard.press('Escape'); await add(5);
        assert.match(await page.locator('.irp-tba').innerText(),/MUS 1150/);
        await close.click(); await page.getByRole('button',{name:'Use Banner view'}).click();
        await page.locator('#txt_term + button').waitFor({state:'visible'});
        await page.getByRole('button',{name:'Open course planner'}).click();
        assert(await page.locator('.irp-app').isVisible());
        assert(await page.getByRole('button',{name:'Use Banner view'}).evaluate(el=>el===document.activeElement));
        const edgeCases = await page.evaluate(() => {
            const section = (...meetings)=>({meetingsFaculty:meetings.map(m=>({meetingTime:m}))});
            const m = {sunday:true,beginTime:'0700',endTime:'0800',startDate:'01/01/2027',endDate:'02/01/2027'};
            const first=section(m,m);
            return [
                iroarSchedule.build([first]).events.length,
                iroarSchedule.build([first,section({...m,beginTime:'0800',endTime:'0900'})]).conflicts.length,
                iroarSchedule.build([first,section({...m,startDate:'02/02/2027',endDate:'03/02/2027'})]).conflicts.length,
                iroarSchedule.build([first,section({...m,beginTime:'0730'})]).conflicts.length,
                iroarSchedule.build([section({...m,beginTime:null})]).unscheduled.length
            ];
        });
        assert.deepEqual(edgeCases,[1,0,0,1,1]);
    } finally { await ctx.close(); }
}
try {
    for (const width of [1440,390]) await run(width);
    assert.deepEqual(errors,[]); assert.deepEqual(unexpected,[]);
    console.log('Passed desktop and phone directory, native pages, search, grade history, schedule, conflicts, and restore checks.');
} finally { await browser.close(); }
