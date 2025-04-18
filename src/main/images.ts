import { nativeImage } from 'electron'
import joinIcon from '../../resources/join.png?asset'
import batteryOkIcon from '../../resources/battery_ok.png?asset'
import batteryLowIcon from '../../resources/battery_low.png?asset'

export const notificationImage = nativeImage.createFromPath(joinIcon).resize({ width: 50 })
export const batteryOkImage = nativeImage.createFromPath(batteryOkIcon).resize({ width: 50 })
export const batteryLowImage = nativeImage.createFromPath(batteryLowIcon).resize({ width: 50 })
