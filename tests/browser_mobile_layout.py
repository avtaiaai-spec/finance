"""Mobile navigation, shared search outline and persistent editor actions."""
import os
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('APP_URL', 'http://127.0.0.1:5173/finance/')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    for width in (320, 375, 390):
        page = browser.new_page(viewport={'width': width, 'height': 844}, is_mobile=True, has_touch=True)
        page.goto(URL)
        nav = page.locator('.bottom-nav')
        plus = nav.locator('.add-nav > span').bounding_box()
        bar = nav.bounding_box()
        assert plus['y'] >= bar['y'] + 1, (width, plus, bar)
        nav.get_by_role('button', name='Операции', exact=True).click()
        search = page.get_by_role('textbox', name='Поиск операций')
        search.fill('Продукты')
        assert search.evaluate("el => getComputedStyle(el).borderLeftWidth") == '0px'
        assert page.locator('.search').evaluate("el => getComputedStyle(el).outlineStyle") != 'none'
        icon = page.locator('.search > svg').bounding_box()
        field = search.bounding_box()
        assert field['x'] >= icon['x'] + icon['width']
        nav.get_by_role('button', name='Добавить', exact=True).click()
        dialog = page.get_by_role('dialog')
        save = dialog.get_by_role('button', name='Сохранить', exact=True)
        cancel = dialog.get_by_role('button', name='Отмена', exact=True)
        fields = dialog.locator('.editor-fields')

        def actions_visible():
            for action in (save, cancel):
                expect(action).to_be_in_viewport(ratio=1)
                box = action.bounding_box()
                assert box['y'] >= 0 and box['y'] + box['height'] <= page.viewport_size['height']
                assert action.evaluate('el => {const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')

        actions_visible()
        page.get_by_label('Сумма, ₽', exact=True).fill('123,45')
        save.click()
        expect(dialog.get_by_role('alert')).to_be_in_viewport(ratio=1)
        actions_visible()
        dialog.get_by_role('button', name='Продукты', exact=True).click()
        fields.evaluate('el => el.scrollTop = el.scrollHeight')
        actions_visible()
        comment = page.get_by_label('Комментарий · необязательно', exact=True)
        comment.fill('Проверка закреплённых кнопок')
        # A reduced viewport verifies layout at keyboard-like heights. It does
        # not emulate the native iOS keyboard or its accessory bar.
        page.set_viewport_size({'width': width, 'height': 400})
        actions_visible()
        fields.evaluate('el => el.scrollTop = 0')
        actions_visible()
        fields.evaluate('el => el.scrollTop = el.scrollHeight')
        actions_visible()
        save.click()
        expect(dialog).to_have_count(0)
        data = page.evaluate("JSON.parse(localStorage.getItem('calm-finance-v1'))")
        assert data['transactions'][-1]['amount'] == 12345
        assert data['transactions'][-1]['comment'] == 'Проверка закреплённых кнопок'
        nav.get_by_role('button', name='Добавить', exact=True).click()
        actions_visible()
        cancel.click()
        expect(dialog).to_have_count(0)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.close()
    browser.close()
print('PASS: mobile 320/375/390, Add inside navigation, single search border, Save/Cancel visible through scrolling and reduced viewport; save and cancel work.')
