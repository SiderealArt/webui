# coding=utf-8
"""Core UI feature tests."""

import time
from function import (
    wait_on_element,
    is_element_present,
    wait_on_element_disappear,
    ssh_sudo
)
from pytest_bdd import (
    given,
    scenario,
    then,
    when,
)


@scenario('features/NAS-T988.feature', 'Enable user Permit Sudo')
def test_enable_user_permit_sudo(driver):
    """Enable user Permit Sudo."""


@given('the browser is open, the FreeNAS URL and logged in')
def the_browser_is_open_the_freenas_url_and_logged_in(driver, nas_ip, root_password):
    """the browser is open, the FreeNAS URL and logged in."""
    if nas_ip not in driver.current_url:
        driver.get(f"http://{nas_ip}")
        assert wait_on_element(driver, 0.5, 10, '//input[@placeholder="Username"]')
        time.sleep(1)
    if not is_element_present(driver, '//mat-list-item[@ix-auto="option__Dashboard"]'):
        assert wait_on_element(driver, 1, 10, '//input[@placeholder="Username"]')
        driver.find_element_by_xpath('//input[@placeholder="Username"]').clear()
        driver.find_element_by_xpath('//input[@placeholder="Username"]').send_keys('root')
        driver.find_element_by_xpath('//input[@placeholder="Password"]').clear()
        driver.find_element_by_xpath('//input[@placeholder="Password"]').send_keys(root_password)
        assert wait_on_element(driver, 0.5, 4, '//button[@name="signin_button"]')
        driver.find_element_by_xpath('//button[@name="signin_button"]').click()
    else:
        element = driver.find_element_by_xpath('//span[contains(.,"root")]')
        driver.execute_script("arguments[0].scrollIntoView();", element)
        time.sleep(0.5)
        driver.find_element_by_xpath('//mat-list-item[@ix-auto="option__Dashboard"]').click()


@when('you should be on the dashboard')
def you_should_be_on_the_dashboard(driver):
    """you should be on the dashboard."""
    assert wait_on_element(driver, 1, 7, '//a[contains(.,"Dashboard")]')
    assert wait_on_element(driver, 0.5, 7, '//span[contains(.,"System Information")]')


@then('click on the Accounts on the side menu, click on Users')
def click_on_the_accounts_on_the_side_menu_click_on_users(driver):
    """click on the Accounts on the side menu, click on Users."""
    driver.find_element_by_xpath('//mat-list-item[@ix-auto="option__Accounts"]').click()
    assert wait_on_element(driver, 0.5, 7, '//mat-list-item[@ix-auto="option__Users"]')
    element = driver.find_element_by_xpath('//mat-list-item[@ix-auto="option__Accounts"]')
    class_attribute = element.get_attribute('class')
    assert 'open' in class_attribute, class_attribute
    driver.find_element_by_xpath('//mat-list-item[@ix-auto="option__Users"]').click()


@then('the Users page should open')
def the_users_page_should_open(driver):
    """the Users page should open."""
    assert wait_on_element(driver, 1, 7, '//div[contains(.,"Users")]')


@then('click the Greater-Than-Sign right of the users')
def click_the_greaterthansign_right_of_the_users(driver):
    """click the Greater-Than-Sign right of the users."""
    driver.find_element_by_xpath('//a[@ix-auto="expander__ericbsd"]').click()


@then('the User Field should expand down, then click the Edit button')
def the_user_field_should_expand_down_then_click_the_edit_button(driver):
    """the User Field should expand down, then click the Edit button."""
    assert wait_on_element(driver, 0.5, 7, '//button[@ix-auto="button__EDIT_ericbsd"]')
    driver.find_element_by_xpath('//button[@ix-auto="button__EDIT_ericbsd"]').click()


@then('the User Edit Page should open')
def the_user_edit_page_should_open(driver):
    """the User Edit Page should open."""
    assert wait_on_element(driver, 1, 7, '//h4[contains(.,"Identification")]')


@then('click Enable Permit Sudo checkbox and click save')
def click_enable_permit_sudo_checkbox_and_click_save(driver):
    """click Enable Permit Sudo checkbox and click save."""
    element = driver.find_element_by_xpath('//button[@ix-auto="button__SAVE"]')
    driver.execute_script("arguments[0].scrollIntoView();", element)
    time.sleep(0.5)
    driver.find_element_by_xpath('//mat-checkbox[@ix-auto="checkbox__Permit Sudo"]').click()
    wait_on_element(driver, 0.5, 30, '//button[@ix-auto="button__SAVE"]')
    driver.find_element_by_xpath('//button[@ix-auto="button__SAVE"]').click()


@then('the changes should be saved')
def the_changes_should_be_saved(driver):
    """the changes should be saved."""
    wait_on_element_disappear(driver, 1, 30, '//h6[contains(.,"Please wait")]')
    wait_on_element(driver, 0.5, 7, '//div[contains(.,"Users")]')


@then('open the user dropdown')
def open_the_user_dropdown(driver):
    """open the user dropdown."""
    driver.find_element_by_xpath('//a[@ix-auto="expander__ericbsd"]').click()
    wait_on_element(driver, 0.5, 7, '//button[@ix-auto="button__EDIT_ericbsd"]')
    driver.find_element_by_xpath('//h4[contains(.,"Permit Sudo:")]')


@then('updated value should be visible')
def updated_value_should_be_visible(driver):
    """updated value should be visible."""
    assert wait_on_element(driver, 1, 5, '//h4[contains(.,"Permit Sudo:")]/../div/p')
    element_text = driver.find_element_by_xpath('//h4[contains(.,"Permit Sudo:")]/../div/p').text
    assert element_text == 'true'


@then('open a shell and run su user to become that user')
def open_a_shell_and_run_su_user_to_become_that_user(driver, nas_ip):
    """open a shell and run su user to become that user."""
    global sudo_results
    cmd = 'ls /var/db/sudo'
    sudo_results = ssh_sudo(cmd, nas_ip, 'ericbsd', 'testing')


@then('the user should be able to use Sudo')
def the_user_should_be_able_to_use_sudo(driver):
    """the user should be able to use Sudo."""
    assert "lectured" in sudo_results, str(sudo_results)