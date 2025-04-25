# join-desktop

A modern Desktop [Join](https://joaoapps.com/join/) application that works on Linux, MacOS and Linux. It doesn't requires Google Chrome to work (It only needs any browser to be installed so you can login into your Google account the first time you open the app).

## Why?

I use Linux and recently stopped using Chrome. There was no Join extension for Firefox and the Desktop application required Chrome to work anyway. So, I wrote my own Desktop application.

## Common Join errors fixed by this app

- SMS, contacts and everything that uses a file on Google drive to send information while the remote device is not in the Local network only gets updated the first time the [Join website](https://joinjoaomgcd.appspot.com/)/official [Join Desktop](https://github.com/joaomgcd/JoinDesktop) is used. This app asks the remote device to always update those files before loading their content. This ensures that contacts/sms will always be up to date in join-desktop.

## Does it support all of Join features?

No, the app is supported in an best effort basis. Most of the features have been reversed engineered from the [Join website](https://joinjoaomgcd.appspot.com/), the [Join Chrome](https://github.com/joaomgcd/JoinChrome) extension and the official [Join Desktop](https://github.com/joaomgcd/JoinDesktop) app.

If there's a Join feature that the app doesn't support and you would like to use, please open an Issue with a Feature Request describing it.

Note: there is no guarantee that any feature will be implemented in the future. This is a hobby project.

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
- Push history on all devices
- Rename/delete devices
- Global shortcuts
  - Includes a picker to dynamically choose which device should be used for an action.
- Execute custom Javascript functions as a response to a Join action. Check [Custom scripts](#custom-scripts) for in-depth information.

## Custom scripts

You can configure this app to execute custom Javascript functions in response to any Join command.

### How

1. Go to the `Settings` tab in the app
2. Click `New script`
3. Write a `Command` (a regular expression that should match the Join action that will execute this script, for example `^foo`) and `Script` (the name of the script that's gonna be executed, for example `foo.mjs`) for this new script
4. Click `Save`
5. Go to this app's configuration directory (`%APPDATA%/join-desktop/` on Windows, `~/.config/join-desktop/` on Linux and, `~/Library/Application Support/join-desktop/` on Mac)
6. Create a new directory named `scripts` if it doesn't exist already
7. Put/create your custom Javascript script inside of it using the same name you used in step 3 (for example, `foo.mjs`)
8. The default export of the module should be a function with the signature `(values: string, valuesArray: string[]) => void`

### Example script

The following script will print the value of both `values` and `valuesArray`:

```javascript
/**
 * @param {string} values
 * @param {string[]} valuesArray
 */
export default function action(values, valuesArray) {
  console.log('values: %s', values)
  console.log('valuesArray: %s', valuesArray)
}
```

## Remote device file system navigation

The remote file system interface doesn't work with the mouse. Instead it uses the following keyboard shortcuts:

- `Enter` if current selected item is a file, open it in your default browser
- `Down arrow key` go down the current directory files
- `Up arrow key` go up the current directory files
- `Left arrow key` go one directory up (e.g. go from `/foo/bar/baz` to `/foo/bar`)
- `Right arrow key` if the current selected item is a directory, go one directory down on it (e.g. with the cursor in the `baz` directory, go from `/foo/bar` to `/foo/bar/baz`)

Additionally, the UI previews the current selected item if it's an image and your remote Device is in reachable for this app through your local network.

## Autostart

This application can be configured to automatically start each time your PC is turned on (this is the default configuration). You can disable this behaviour in the `Settings` tab.

NOTE: you need to manually start the application at least one time in order for the autostart to be configured for the future.

## Join intrinsic limitations

While the goal of this app is to shatter some of the limitations the other Join implementations on PC had, there are limitations intrinsic to how Join works that cannot be fixed by this application. This is a non-exhaustive list of them:

- Media info is not properly refreshed by the Join Android App. Even after deleting the old media info file from Google Drive and requesting the Join Android App to create a new one, it doesn't update the media information. Connecting to the Join Android App via local network also gives outdated media information.
- The Join Google Chrome extension, the official Join Desktop app and the Join website register themselves as a Join device whenever they are opened. This means that, even after you have deleted them from within this application, they will be added again to your devices if you open the Join application that contained the deleted device.
- Other Join devices don't contact this app via Local Network even if it's available and we tell them to do so. This probably is because the current Join Desktop app and Chrome extension don't support being contacted via Local Network, so they Join apps are hardcoded to avoid doing it. The Join website sometimes does contact this app via Local Network after receiving a Push from this app instructing it to do so.
  - I tried registering this device with a different type, but it didn't work. My guess is that other device types (android_phone, for example) have a different registration workflow.

## Non implemented features

- Background clipboard sync
- Speak and Location pushes are received but don't work as expected because of Electron limitations.
- MMS support for messages.
- Send custom commands
- EventGhost or Node-RED integration
- Menu with notifications from other devices
- Other features not present in all of the non-Android Join applications (exposing PC file system remotely, sending status updates, sending notifications to other devices, etc)

## Special thanks

- [eneris/push-receiver](https://github.com/eneris/push-receiver) for creating/maintaining a library for subscribing to FCM notifications in Node.
