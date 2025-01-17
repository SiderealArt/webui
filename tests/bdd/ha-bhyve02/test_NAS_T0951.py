# coding=utf-8
"""High Availability (tn-bhyve01) feature tests."""

from selenium.webdriver.common.keys import Keys
import time
from function import (
    wait_on_element,
    is_element_present,
    wait_on_element_disappear
)
from pytest_bdd import (
    given,
    scenario,
    then,
    when,
    parsers
)


@scenario('features/NAS-T951.feature', 'Edit user auxiliary group')
def test_edit_user_auxiliary_group(driver):
    """Edit user auxiliary group."""
    pass


@given(parsers.parse('The browser is open navigate to "{nas_url}"'))
def the_browser_is_open_navigate_to_nas_url(driver, nas_url):
    """The browser is open navigate to "{nas_user}"."""
    if nas_url not in driver.current_url:
        driver.get(f"http://{nas_url}/ui/sessions/signin")
        time.sleep(3)


@when(parsers.parse('If login page appear enter "{user}" and "{password}"'))
def if_login_page_appear_enter_root_and_password(driver, user, password):
    """If login page appear enter "{user}" and "{password}"."""
    if not is_element_present(driver, '//mat-list-item[@ix-auto="option__Dashboard"]'):
        assert wait_on_element(driver, 0.5, 5, '//input[@data-placeholder="Username"]')
        driver.find_element_by_xpath('//input[@data-placeholder="Username"]').clear()
        driver.find_element_by_xpath('//input[@data-placeholder="Username"]').send_keys(user)
        driver.find_element_by_xpath('//input[@data-placeholder="Password"]').clear()
        driver.find_element_by_xpath('//input[@data-placeholder="Password"]').send_keys(password)
        assert wait_on_element(driver, 0.5, 7, '//button[@name="signin_button"]')
        driver.find_element_by_xpath('//button[@name="signin_button"]').click()
    else:
        driver.find_element_by_xpath('//mat-list-item[@ix-auto="option__Dashboard"]').click()


@then('You should see the dashboard')
def you_should_see_the_dashboard(driver):
    """You should see the dashboard."""
    assert wait_on_element(driver, 1, 10, '//h1[contains(.,"Dashboard")]')
    assert wait_on_element(driver, 1, 10, '//span[contains(.,"System Information")]')


@then('Click on the Credentials item in the left side menu')
def click_on_the_credentials_item_in_the_left_side_menu(driver):
    """Click on the Credentials item in the left side menu."""
    driver.find_element_by_xpath('//mat-list-item[@ix-auto="option__Credentials"]').click()


@then('The Credentials menu should expand to the right')
def the_credentials_menu_should_expand_to_the_right(driver):
    """The Credentials menu should expand to the right."""
    assert wait_on_element(driver, 1, 7, '//mat-list-item[@ix-auto="option__Local Users"]')


@then('Click on Local Users')
def click_on_localusers(driver):
    """Click on Local Users."""
    driver.find_element_by_xpath('//mat-list-item[@ix-auto="option__Local Users"]').click()


@then('The Users page should open')
def the_users_page_should_open(driver):
    """The Users page should open."""
    assert wait_on_element(driver, 1, 7, '//div[contains(.,"Users")]')


@then('On the right side of the table, click the expand arrow for one of the users')
def on_the_right_side_of_the_table_click_the_expand_arrow_for_one_of_the_users(driver):
    """On the right side of the table, click the expand arrow for one of the users."""
    assert wait_on_element(driver, 0.5, 7, '//tr[@ix-auto="expander__ericbsd"]/td')
    driver.find_element_by_xpath('//tr[@ix-auto="expander__ericbsd"]/td').click()


@then('The User Field should expand down to list further details')
def the_user_field_should_expand_down_to_list_further_details(driver):
    """The User Field should expand down to list further details."""
    assert wait_on_element(driver, 0.5, 7, '//button[@ix-auto="button__EDIT_ericbsd"]')


@then('Click the Edit button that appears')
def click_the_edit_button_that_appears(driver):
    """Click the Edit button that appears."""
    driver.find_element_by_xpath('//button[@ix-auto="button__EDIT_ericbsd"]').click()


@then('The User Edit Page should open')
def the_user_edit_page_should_open(driver):
    """The User Edit Page should open."""
    assert wait_on_element(driver, 1, 7, '//h3[contains(.,"Edit User")]')


@then('Add user to additional groups, like wheel and save change')
def add_user_to_additional_groups_like_wheel_and_save_change(driver):
    """Add user to additional groups, like wheel and save change."""
    assert wait_on_element(driver, 1, 7, '//mat-select[@ix-auto="select__Auxiliary Groups"]')
    driver.find_element_by_xpath('//mat-select[@ix-auto="select__Auxiliary Groups"]').click()
    assert wait_on_element(driver, 0.5, 7, '//mat-option[@ix-auto="option__Auxiliary Groups_root"]')
    driver.find_element_by_xpath('//mat-option[@ix-auto="option__Auxiliary Groups_root"]').click()
    driver.find_element_by_xpath('//mat-option[@ix-auto="option__Auxiliary Groups_root"]').send_keys(Keys.TAB)
    assert wait_on_element(driver, 0.5, 7, '//button[@ix-auto="button__SAVE"]')
    driver.find_element_by_xpath('//button[@ix-auto="button__SAVE"]').click()


@then('Change should be saved')
def change_should_be_saved(driver):
    """Change should be saved."""
    assert wait_on_element_disappear(driver, 1, 20, '//h6[contains(.,"Please wait")]')
    assert wait_on_element(driver, 1, 7, '//div[contains(.,"Users")]')


@then('reopen the user edit page and ensure that the additional group was saved')
def reopen_the_user_edit_page_and_ensure_that_the_additional_group_was_saved(driver):
    """reopen the user edit page and ensure that the additional group was saved."""
    driver.find_element_by_xpath('//tr[@ix-auto="expander__ericbsd"]/td').click()
    driver.find_element_by_xpath('//button[@ix-auto="button__EDIT_ericbsd"]').click()
    assert wait_on_element(driver, 1, 7, '//h3[contains(.,"Edit User")]')
    assert wait_on_element(driver, 0.5, 7, '//h4[contains(.,"Identification")]')


@then('Aux Group added should be visible')
def aux_group_added_should_be_visible(driver):
    """Aux Group added should be visible."""
    driver.find_element_by_xpath('//span[contains(.,"root,")]')
    driver.find_element_by_xpath('//mat-icon[contains(.,"cancel")]').click()
