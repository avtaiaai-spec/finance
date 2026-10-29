"""Day totals exclude adjacent dates; mobile/desktop navigation and calendar."""
from playwright.sync_api import sync_playwright,expect
import browser_cloud as app
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [1440,390,320]:
  ctx=b.new_context(viewport={'width':width,'height':900});pg=ctx.new_page();errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(app.URL)
  app.add(pg,'Доход',1000);app.add(pg,'Расход',230)
  pg.evaluate("""() => {const d=JSON.parse(localStorage.getItem('calm-finance-v1'));
   d.transactions[0].date='2026-10-29';d.transactions[1].date='2026-10-29';
   d.transactions.push({...d.transactions[1],id:crypto.randomUUID(),date:'2026-10-28',amount:9900,comment:'Previous day'});
   d.transactions.push({...d.transactions[1],id:crypto.randomUUID(),date:'2026-10-30',amount:8800,comment:'Next day'});
   localStorage.setItem('calm-finance-v1',JSON.stringify(d));} """)
  pg.reload();bar=pg.locator('.period-toolbar');bar.get_by_role('button',name='День',exact=True).click()
  bar.get_by_role('button',name='Выбрать даты',exact=True).click();pg.get_by_label('Дата статистики',exact=True).fill('2026-10-29')
  expect(pg.locator('.hero-totals')).to_contain_text('230')
  if width>680:pg.locator('.sidebar nav').get_by_role('button',name='Операции',exact=True).click()
  else:pg.locator('.bottom-nav').get_by_role('button',name='Операции',exact=True).click()
  expect(pg.locator('.transaction')).to_have_count(2)
  bar.get_by_role('button',name='Предыдущий период',exact=True).click()
  expect(pg.locator('.transaction')).to_have_count(1);expect(pg.locator('.transaction')).to_contain_text('Previous day')
  bar.get_by_role('button',name='Следующий период',exact=True).click();bar.get_by_role('button',name='Следующий период',exact=True).click()
  expect(pg.locator('.transaction')).to_have_count(1);expect(pg.locator('.transaction')).to_contain_text('Next day')
  bar.get_by_role('button',name='Предыдущий период',exact=True).click()
  if width>680:pg.locator('.sidebar nav').get_by_role('button',name='Аналитика',exact=True).click()
  else:pg.locator('.bottom-nav').get_by_role('button',name='Аналитика',exact=True).click()
  stats=pg.locator('.analytics-stats');expect(stats).to_contain_text('230');expect(stats).to_contain_text('770')
  expect(pg.locator('.recharts-area-dot')).to_have_count(2)
  for name in ['День','Неделя','Месяц','Квартал','Год']:expect(bar.get_by_role('button',name=name,exact=True)).to_be_visible()
  assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
  bar.get_by_role('button',name='Сегодня',exact=True).click()
  expected=pg.evaluate("new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})")
  expect(pg.locator('.period-date')).to_contain_text(expected)
  assert not errors,errors
  ctx.close()
 b.close()
 print('PASS: day totals, adjacent-day exclusion, previous/next day, calendar, today, analytics dots, five periods at 1440/390/320px without horizontal overflow.')
