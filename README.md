# join-desktop

A modern Desktop Join application that works on Linux, MacOS and Linux. It doesn't requires Google Chrome to work (It only needs any browser to be installed so you can login into your Google account the first time you open the app).

## Why?

I use Linux and recently stopped using Chrome. There was no Join extension for Firefox and the Desktop application required Chrome to work anyway. So, I wrote my own Desktop application.

## Common Join errors fixed by this app

- SMS, contacts and everything that uses a file on Google drive to send information while the remote device is not in the Local network only gets updated the first time the Join website/official Join Desktop is used. This app asks the remote device to always update those files before loading their content. This ensures that contacts/sms will always be up to date in join-desktop.

## Does it support all of Join features?

No, the app is supported in an best effort basis. Most of the features have been reversed engineered from the Join website, the Join Chrome extension and the official Join Desktop app.

If there's a Join feature that the app doesn't support and you would like to use, please open an Issue with a Feature Request describing it.

## Current features

- Listening on the background for Pushes from other devices:
  - Speak (only shows a notification, it doesn't actually speak, it requires a Google API_KEY)
  - Send and receive clipboard
  - Open URLs (links)
  - Location (doesn't respond to the request, it requires a Google API_KEY)
  - Receive and clean Notifications
  - Connect to other Join devices via Local network
  - Status notifications from Android devices (battery low, charging, charged)
- Media/contacts/calls/SMS/file access on remote Android devices.

## Non implemented features

- Background clipboard sync
- Speak and Location pushes are received but don't work as expected because of Electron limitations.
- MMS support for messages.
- Custom commands
- Using remote Join settings shared by all of the other apps
- EventGhost or Node-RED integration
- Menu with notifications from other devices
- Push history
