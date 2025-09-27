import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import relativeTime from 'dayjs/plugin/relativeTime'
import duration from 'dayjs/plugin/duration'

dayjs.extend(relativeTime)
dayjs.extend(duration)
dayjs.locale('zh-tw')

export const formatDate = (date, format = 'YYYY-MM-DD') => {
  return dayjs(date).format(format)
}

export const formatDateTime = (date, format = 'YYYY-MM-DD HH:mm') => {
  return dayjs(date).format(format)
}

export const formatTime = (date, format = 'HH:mm') => {
  return dayjs(date).format(format)
}

export const formatRelativeTime = (date) => {
  return dayjs(date).fromNow()
}

export const isToday = (date) => {
  return dayjs(date).isSame(dayjs(), 'day')
}

export const isTomorrow = (date) => {
  return dayjs(date).isSame(dayjs().add(1, 'day'), 'day')
}

export const addMinutes = (date, minutes) => {
  return dayjs(date).add(minutes, 'minute').toDate()
}

export const formatDuration = (minutes) => {
  const duration = dayjs.duration(minutes, 'minutes')
  const hours = Math.floor(duration.asHours())
  const mins = duration.minutes()
  
  if (hours > 0) {
    return `${hours}小時${mins > 0 ? mins + '分鐘' : ''}`
  }
  return `${mins}分鐘`
}

export const getTimeSlots = (startHour = 7, endHour = 23.5, intervalMinutes = 30) => {
  const slots = []
  const start = dayjs().hour(startHour).minute(0).second(0)
  const end = dayjs().hour(endHour).minute(0).second(0)
  
  let current = start
  while (current.isBefore(end)) {
    slots.push({
      value: current.format('HH:mm'),
      label: current.format('HH:mm')
    })
    current = current.add(intervalMinutes, 'minute')
  }
  
  return slots
}

export const isValidBookingTime = (startTime, endTime) => {
  const start = dayjs(startTime)
  const end = dayjs(endTime)
  const now = dayjs()
  
  // 檢查是否為未來時間
  if (start.isBefore(now)) {
    return { valid: false, message: '不能預約過去的時間' }
  }
  
  // 檢查營業時間（6:00-23:00）
  if (start.hour() < 6 || end.hour() > 23) {
    return { valid: false, message: '營業時間為06:00-23:00' }
  }
  
  // 檢查時間長度（30分鐘到3小時）
  const durationMinutes = end.diff(start, 'minute')
  if (durationMinutes < 30) {
    return { valid: false, message: '使用時間至少30分鐘' }
  }
  if (durationMinutes > 180) {
    return { valid: false, message: '使用時間最多3小時' }
  }
  
  return { valid: true }
}
