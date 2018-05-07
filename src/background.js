/* src/background.js
 * Originally created 3/10/2017 by DaAwesomeP
 * This is the background task file of the extension
 * https://github.com/DaAwesomeP/tab-counter
 *
 * Copyright 2017-present DaAwesomeP
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* global _ */

const updateIcon = async function updateIcon () {
  // Get settings
  let settings = await browser.storage.local.get()

  // Get tab counter setting
  let counterPreference = settings.counter || 0

  // Stop tab badge update if badge disabled
  if (counterPreference === 3) return

  // Get current tab to update badge in
  let currentTab = (await browser.tabs.query({ currentWindow: true, active: true }))[0]

  // Get both tabs in current window and in all windows
  let currentWindow = (await browser.tabs.query({ currentWindow: true })).length.toString()
  let countAll = (await browser.tabs.query({})).length.toString()
  if (typeof currentTab !== 'undefined') {
    let text
    if (counterPreference === 0) text = currentWindow // Badge shows current window
    else if (counterPreference === 1) text = countAll // Badge shows total of all windows
    else if (counterPreference === 2) text = `${currentWindow}/${countAll}` // Badge shows both (Firefox limits to about 4 characters based on width)

    // Update the badge
    browser.browserAction.setBadgeText({
      text: text,
      tabId: currentTab.id
    })

    // Update the tooltip
    browser.browserAction.setTitle({
      title: `Tab Counter\nThis window:  ${currentWindow}\nAll windows: ${countAll}`,
      tabId: currentTab.id
    })
  }
}

// Prevent from firing too frequently or flooding at a window or restore
const lazyUpdateIcon = _.debounce(updateIcon, 250)

// Prioritize active leading edge of every 1 second on tab switch (fluid update for new tabs)
const lazyActivateUpdateIcon = _.debounce(updateIcon, 1000, { leading: true })

// Will be error if tab has been removed, so wait 150ms;
// onActivated fires slightly before onRemoved,
// but tab is gone during onActivated.
// Must be a function to avoid event parameter errors
const update = function update () { setTimeout(lazyUpdateIcon, 150) }

// Init badge for when addon starts and not yet loaded tabs
browser.browserAction.setBadgeText({text: 'wait'})
browser.browserAction.setBadgeBackgroundColor({color: '#000000'})

// Handler for when current tab changes
const tabOnActivatedHandler = function tabOnActivatedHandler () {
  // Run normal update for most events
  update()

  // Prioritize active (fluid update for new tabs)
  lazyActivateUpdateIcon()
}

// Load and apply icon and badge color settings
const checkSettings = async function checkSettings (settingsUpdate) {
  // Get settings object
  let settings = await browser.storage.local.get()

  // Perform settings upgrade
  if (settings.hasOwnProperty('version')) {
    if (settings.version !== browser.runtime.getManifest().version) {
      let versionSplit = settings.version.split('.').map((n) => parseInt(n))
      // Upgrade

      // since 0.3.0, icons now adapt to theme so reset icon setting
      if (versionSplit[0] === 0 && versionSplit[1] < 3) settings.icon = 'tabcounter.plain.min.svg'
    }
  }
  browser.storage.local.set(Object.assign(settings, {
    version: browser.runtime.getManifest().version
  }))

  // Apply badge color or use default
  if (settings.hasOwnProperty('badgeColor')) browser.browserAction.setBadgeBackgroundColor({color: settings.badgeColor})
  else browser.browserAction.setBadgeBackgroundColor({color: '#000000'})

  // Apply icon selection or use default
  if (settings.hasOwnProperty('icon')) browser.browserAction.setIcon({path: `icons/${settings.icon}`})
  else browser.browserAction.setIcon({path: 'icons/tabcounter.plain.min.svg'})

  // Get counter preference
  let counterPreference
  if (!settings.hasOwnProperty('counter')) counterPreference = 0
  else counterPreference = settings.counter

  // Either add badge update events or don't if not set to
  if (counterPreference !== 3) {
    // Watch for tab and window events five seconds after browser startup
    setTimeout(() => {
      browser.tabs.onActivated.addListener(tabOnActivatedHandler)
      browser.tabs.onAttached.addListener(update)
      browser.tabs.onCreated.addListener(update)
      browser.tabs.onDetached.addListener(update)
      browser.tabs.onMoved.addListener(update)
      browser.tabs.onReplaced.addListener(update)
      browser.tabs.onRemoved.addListener(update)
      browser.tabs.onUpdated.addListener(update)
      browser.windows.onFocusChanged.addListener(update)
    }, settingsUpdate ? 1 : 5000) // add listeners immeadietly if not browser startup
  } else {
    // remove the listeners that were added
    browser.tabs.onActivated.removeListener(tabOnActivatedHandler)
    browser.tabs.onAttached.removeListener(update)
    browser.tabs.onCreated.removeListener(update)
    browser.tabs.onDetached.removeListener(update)
    browser.tabs.onMoved.removeListener(update)
    browser.tabs.onReplaced.removeListener(update)
    browser.tabs.onRemoved.removeListener(update)
    browser.tabs.onUpdated.removeListener(update)
    browser.windows.onFocusChanged.removeListener(update)

    // hide the "wait" badge if set not to show a badge
    browser.browserAction.setBadgeText({ text: '' })
    browser.browserAction.setTitle({ title: 'Tab Counter' })

    // check each tab that was overriden with a counter badge
    let allTabs = await browser.tabs.query({})
    allTabs.forEach((tab) => {
      browser.browserAction.setBadgeText({
        text: '',
        tabId: tab.id
      })
      browser.browserAction.setTitle({
        title: 'Tab Counter',
        tabId: tab.id
      })
    })
  }
}

// Load settings and update badge at app start
const applyAll = async function applyAll (settingsUpdate) {
  await checkSettings(settingsUpdate)  // Icon and badge color
  await update()         // Badge text options
}
applyAll()

// Listen for settings changes and update color, icon, and badge text instantly
// Bug: this listener run nonstop
// browser.storage.onChanged.addListener(applyAll)

// Listen for internal addon messages
const messageHandler = async function messageHandler (request, sender, sendResponse) {
  // Check for a settings update
  if (request.hasOwnProperty('updateSettings')) if (request.updateSettings) applyAll(true)
}
browser.runtime.onMessage.addListener(messageHandler)
