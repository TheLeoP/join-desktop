import { nativeImage } from 'electron'
import joinIcon from '../../resources/join.png?asset'
import batteryOkIcon from '../../resources/battery_ok.png?asset'
import batteryLowIcon from '../../resources/battery_low.png?asset'

import phoneIncomingIcon from '../../resources/phone_incoming.png?asset'
import phoneOngoingIcon from '../../resources/phone_ongoing.png?asset'
import phoneMissedIcon from '../../resources/phone_missed.png?asset'

export const notificationImage = nativeImage.createFromPath(joinIcon).resize({ width: 50 })
export const batteryOkImage = nativeImage.createFromPath(batteryOkIcon).resize({ width: 50 })
export const batteryLowImage = nativeImage.createFromPath(batteryLowIcon).resize({ width: 50 })

export const phoneIncomingImage = nativeImage
  .createFromPath(phoneIncomingIcon)
  .resize({ width: 50 })
export const phoneOngoingImage = nativeImage.createFromPath(phoneOngoingIcon).resize({ width: 50 })
export const phoneMissedImage = nativeImage.createFromPath(phoneMissedIcon).resize({ width: 50 })
