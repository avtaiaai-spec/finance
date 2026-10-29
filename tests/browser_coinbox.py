"""APP_URL=... [COINBOX_FIXTURE=/local/private.csv] python tests/browser_coinbox.py.
User exports must stay outside the repository; the default fixture is synthetic.
"""
import csv
import io
import os
from decimal import Decimal
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

fixture = os.environ.get('COINBOX_FIXTURE')
content = Path(fixture).read_bytes() if fixture else ('Date,Type,Category,Amount,Currency,Note\n2026-10-27 10:19:15,expense,Тестовая категория,934.25,RUB,"Ужин, чай"\n2026-10-28 09:15:00,income,Зарплата,5000.00,RUB,Премия\n').encode()
rows=list(csv.DictReader(io.StringIO(content.decode('utf-8-sig'))))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1440,'height':1000});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.environ.get('APP_URL','http://127.0.0.1:4175/finance/'))
    page.locator('.heading-actions').get_by_role('button',name='Доход',exact=True).click()
    page.get_by_label('Сумма, ₽',exact=True).fill('10')
    page.get_by_role('dialog').get_by_role('button',name='Зарплата',exact=True).click()
    page.get_by_role('dialog').get_by_role('button',name='Сохранить',exact=True).click()
    def state():return page.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")
    before=state()
    page.locator('.sidebar nav').get_by_role('button',name='Настройки',exact=True).click()
    def select_file(body=content):page.get_by_label('Файл CSV',exact=True).set_input_files({'name':'CoinBox.csv','mimeType':'text/csv','buffer':body})
    select_file()
    expect(page.get_by_role('dialog')).to_contain_text(f'Найдено: {len(rows)} операций')
    assert state()==before
    page.get_by_role('button',name='Закрыть',exact=True).click()
    assert state()==before
    select_file()
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert page.get_by_role('dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth')
    page.get_by_role('button',name=f'Добавить операции ({len(rows)})',exact=True).click()
    result=state();assert len(result['transactions'])==len(rows)+1
    imported=[t for t in result['transactions'] if t.get('importKey')]
    for kind in ['income','expense']:
        assert sum(t['amount'] for t in imported if t['type']==kind)==sum(int(Decimal(r['Amount'])*100) for r in rows if r['Type']==kind)
    assert result['budgets']==before['budgets'] and result['goals']==before['goals'] and result['settings']==before['settings']
    page.reload()
    page.get_by_role('button',name='Открыть меню',exact=True).click()
    page.locator('.more-menu').get_by_role('button',name='Настройки',exact=True).click()
    select_file();expect(page.get_by_role('dialog')).to_contain_text(f'Уже загружено: {len(rows)}')
    expect(page.get_by_role('button',name='Добавить операции (0)',exact=True)).to_be_disabled()
    page.get_by_role('button',name='Закрыть',exact=True).click()
    assert state()==result
    select_file(b'Date,Type,Category,Amount,Currency,Note\n2026-10-29,expense,Test,10,USD,\n')
    expect(page.get_by_role('dialog')).to_contain_text('поддерживается только валюта RUB')
    page.get_by_role('button',name='Понятно',exact=True).click();assert state()==result
    assert not errors,errors
    print(f'PASS: {len(rows)} CSV rows, exact totals, preview/cancel, additive import, reload, duplicate detection, invalid currency rejected, mobile modal.')
    b.close()
