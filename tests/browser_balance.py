"""Check cumulative balance over all dates, independent of selected statistics period."""
import os,re,json
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('APP_URL','http://127.0.0.1:4175/finance/'))
 def balance(n):expect(page.locator('.hero-number')).to_have_text(re.compile(''.join(c+r'\s*' for c in str(n))+'₽'))
 def state():return page.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")
 now=page.evaluate("new Date().toLocaleDateString('sv-SE')")
 past=page.evaluate("(()=>{let d=new Date();d.setDate(1);d.setMonth(d.getMonth()-2);return d.toLocaleDateString('sv-SE')})()")
 future=page.evaluate("(()=>{let d=new Date();d.setDate(d.getDate()+10);return d.toLocaleDateString('sv-SE')})()")
 def add(kind,amount,cat,date):
  page.locator('.heading-actions').get_by_role('button',name=kind,exact=True).click()
  page.get_by_label('Сумма, ₽',exact=True).fill(amount)
  page.get_by_role('dialog').get_by_role('button',name=cat,exact=True).click()
  page.get_by_label('Дата',exact=True).fill(date)
  page.get_by_role('dialog').get_by_role('button',name='Сохранить',exact=True).click()
 balance(0);add('Доход','5000','Зарплата',past);balance(5000)
 add('Расход','1200','Продукты',now);balance(3800)
 add('Расход','10000','Продукты',future);balance(3800)
 page.get_by_role('button',name='Предыдущий период',exact=True).click();balance(3800)
 page.get_by_role('button',name='Сегодня',exact=True).click();page.reload();balance(3800)
 page.evaluate("(()=>{let d=JSON.parse(localStorage.getItem('calm-finance-v1'));d.cash={opening:9999999,date:'2020-01-01'};localStorage.setItem('calm-finance-v1',JSON.stringify(d));})()")
 page.reload();balance(3800)
 page.locator('.sidebar nav').get_by_role('button',name='Настройки',exact=True).click()
 page.get_by_role('button',name='Тёмная',exact=True).click()
 page.locator('.sidebar nav').get_by_role('button',name='Главная',exact=True).click();balance(3800)
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS: automatic all-history balance, past income, current expense, future excluded, period independence, reload, legacy manual setting ignored, theme and mobile.')
 b.close()
