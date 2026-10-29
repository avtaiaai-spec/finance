"""Run against npm run dev: python tests/browser_smoke.py (Playwright + Chromium)."""
import json
import os
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.goto(os.environ.get('APP_URL','http://127.0.0.1:5173/finance/'))
    page.evaluate('localStorage.clear()')
    page.reload()
    def state(): return page.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")
    def nav(name): page.locator('.sidebar nav').get_by_role('button',name=name,exact=True).click()
    def fill(label,value): page.get_by_label(label,exact=True).fill(value)
    def save(): page.get_by_role('dialog').get_by_role('button',name='Сохранить',exact=True).click(); expect(page.get_by_role('dialog')).to_have_count(0)
    def add(kind,amount,category,comment):
        page.locator('.heading-actions').get_by_role('button',name=kind,exact=True).click()
        fill('Сумма, ₽',amount)
        page.get_by_role('dialog').get_by_role('button',name=category,exact=True).click()
        fill('Комментарий · необязательно',comment)
        save()
    add('Доход','125000,50','Зарплата','Тест дохода')
    add('Расход','1350,25','Продукты','Покупки на ужин')
    assert len(state()['transactions'])==2
    assert state()['transactions'][1]['amount']==135025
    page.reload()
    assert len(state()['transactions'])==2
    page.locator('.transaction').filter(has_text='Покупки на ужин').click()
    fill('Сумма, ₽','1500,50');save()
    assert state()['transactions'][1]['amount']==150050
    nav('Категории')
    page.locator('.heading-actions').get_by_role('button',name='Категория',exact=True).click()
    fill('Название','Хобби')
    page.get_by_role('button',name='Music',exact=True).click()
    page.get_by_role('button',name='Цвет #B69DC0',exact=True).click()
    save()
    assert state()['categories'][-1]['name']=='Хобби'
    nav('Главная');add('Расход','600','Хобби','Кисти')
    nav('Категории');page.get_by_role('button',name='Редактировать Хобби',exact=True).click()
    page.get_by_role('button',name='Архивировать',exact=True).click()
    assert state()['categories'][-1]['archived'] is True
    nav('Бюджеты и лимиты')
    for period in ['Неделя','Месяц','Квартал','Год']:
        page.locator('.heading-actions').get_by_role('button',name='Новый лимит',exact=True).click()
        fill('Сумма, ₽','1000')
        page.get_by_role('dialog').get_by_role('button',name='Продукты',exact=True).click()
        page.get_by_label('Период',exact=True).select_option(label=period)
        save()
    assert len(state()['budgets'])==4
    expect(page.get_by_role('heading',name='Лимит превышен')).to_be_visible()
    nav('Финансовые цели')
    page.get_by_role('button',name='Новая цель',exact=True).click()
    page.get_by_role('dialog').get_by_role('button',name='Накопления',exact=True).click()
    fill('Название','Отпуск');fill('Сумма, ₽','120000');save()
    page.get_by_role('button',name='Пополнить цель',exact=True).click()
    fill('Сумма, ₽','10000');save()
    assert state()['goals'][0]['contributions'][0]['amount']==1000000
    page.get_by_text('История пополнений (1)',exact=True).click()
    page.locator('.contribution').click();fill('Сумма, ₽','11000');save()
    assert state()['goals'][0]['contributions'][0]['amount']==1100000
    nav('Аналитика')
    for period in ['Неделя','Месяц','Квартал','Год']:
        page.locator('.period-toolbar').get_by_role('button',name=period,exact=True).click()
        expect(page.locator('.area-chart svg')).to_be_visible()
    nav('Настройки')
    page.get_by_role('button',name='Тёмная',exact=True).click();page.reload()
    assert page.locator('html').get_attribute('data-theme')=='dark'
    nav('Настройки')
    original=state()
    with page.expect_download() as dl:page.get_by_role('button',name='Скачать резервную копию JSON',exact=True).click()
    page.get_by_role('button',name='Копия сохранена',exact=True).click()
    original=state()
    backup=json.load(open(dl.value.path()))
    assert backup['transactions']==original['transactions']
    with page.expect_download() as dl:page.get_by_role('button',name='Экспорт операций в CSV',exact=True).click()
    assert 'Покупки на ужин' in open(dl.value.path(),encoding='utf-8-sig').read()
    page.locator('input[type=file][accept=".json,application/json"]').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"wrong":true}'})
    assert state()==original
    copy=json.dumps(backup,ensure_ascii=False).encode()
    page.locator('input[type=file][accept=".json,application/json"]').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':copy})
    expect(page.get_by_role('dialog')).to_contain_text('3 операций')
    page.get_by_role('button',name='Заменить данные',exact=True).click()
    assert state()==original
    page.get_by_role('button',name='Посмотреть демо',exact=True).click()
    assert state()==original
    nav('Главная');expect(page.locator('.recharts-pie-sector').first).to_be_visible();page.get_by_role('button',name='Закрыть уведомление').click();page.screenshot(path='/tmp/finance-demo-desktop.png',full_page=True)
    page.get_by_role('button',name='Выйти из демо',exact=False).first.click()
    assert state()==original
    nav('Операции');page.locator('.period-toolbar').get_by_role('button',name='Месяц',exact=True).click()
    page.locator('.transaction').filter(has_text='Покупки на ужин').click()
    page.once('dialog',lambda d:d.accept())
    page.get_by_role('button',name='Удалить операцию',exact=True).click()
    assert len(state()['transactions'])==2
    for width in [390,375,320]:
        page.set_viewport_size({'width':width,'height':844})
        for name in ['Главная','Операции','Бюджеты','Аналитика']:
            page.locator('.bottom-nav').get_by_role('button',name=name,exact=True).click()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (width,name)
        page.locator('.bottom-nav').get_by_role('button',name='Добавить',exact=True).click()
        expect(page.get_by_role('dialog')).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.get_by_role('button',name='Закрыть',exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    page.locator('.bottom-nav').get_by_role('button',name='Главная',exact=True).click()
    page.wait_for_timeout(300);page.screenshot(path='/tmp/finance-mobile.png',full_page=True)
    assert errors==[], errors
    print('PASS: операции CRUD, категории и архив, 4 периода лимитов, цели и исправление пополнений, аналитика, тема, JSON/CSV, безопасный импорт, изоляция демо, сохранение после reload, мобильные 320/375/390px; ошибок React нет.')
    browser.close()
