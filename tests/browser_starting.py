"""APP_URL=http://127.0.0.1:4175/finance/ python tests/browser_starting.py"""
import os,json
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 url=os.environ.get('APP_URL','http://127.0.0.1:4175/finance/')
 page.goto(url)
 page.get_by_role('button',name='Начальные деньги',exact=True).click()
 page.get_by_label('Начальная сумма, ₽',exact=True).fill('110000')
 page.get_by_role('button',name='Отмена',exact=True).click()
 assert page.evaluate("localStorage.getItem('calm-finance-v1')") is None
 page.goto(url+'#starting-money=110000')
 expect(page.get_by_label('Начальная сумма, ₽',exact=True)).to_have_value('110000')
 assert page.evaluate("localStorage.getItem('calm-finance-v1')") is None
 page.get_by_role('button',name='Сохранить и пересчитать',exact=True).click()
 def state():return page.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")
 assert state()['startingMoney']==11000000
 assert len(state()['transactions'])==0
 page.get_by_role('button',name='Начальные деньги',exact=True).click()
 page.get_by_role('button',name='Сохранить и пересчитать',exact=True).click()
 assert state()['startingMoney']==11000000
 page.reload();assert state()['startingMoney']==11000000
 page.get_by_role('button',name='Открыть меню',exact=True).click()
 page.locator('.more-menu').get_by_role('button',name='Настройки',exact=True).click()
 page.get_by_role('button',name='Тёмная',exact=True).click()
 assert state()['startingMoney']==11000000
 with page.expect_download() as dl:page.get_by_role('button',name='Скачать резервную копию JSON',exact=True).click()
 assert json.load(open(dl.value.path()))['startingMoney']==11000000
 content=b'Date,Type,Category,Amount,Currency,Note\n2026-07-01,expense,Test,100.25,RUB,\n'
 page.get_by_label('Файл CoinBox CSV',exact=True).set_input_files({'name':'test.csv','mimeType':'text/csv','buffer':content})
 page.get_by_role('button',name='Добавить операции (1)',exact=True).click()
 assert state()['startingMoney']==11000000
 page.locator('.bottom-nav').get_by_role('button',name='Главная',exact=True).click()
 expected=page.evaluate("new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:2,maximumFractionDigits:2}).format(109899.75)")
 expect(page.locator('.hero-number')).to_have_text(expected)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS: opening amount, prefilled link with explicit save, no double application, reload, theme, JSON backup, CoinBox preserving starting money and mobile.')
 b.close()
