// Returns the date string (yyyy-MM-dd) for the coming Friday (or today if it IS Friday)
export function nextFriday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun, 5=Fri
  const daysUntilFriday = day <= 5 ? 5 - day : 6  // if Sun(0) → 5 days
  d.setDate(d.getDate() + daysUntilFriday)
  return d.toISOString().split('T')[0]
}

export function fmt(d) {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  const diff = (dt - new Date()) / 86400000
  const day = dt.getDate()
  const mon = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'][dt.getMonth()]
  if (diff < 0)  return { lbl: `Forfalt ${day}. ${mon}`, overdue: true,  urgent: false }
  if (diff < 1)  return { lbl: 'I dag',                  overdue: false, urgent: true }
  if (diff < 2)  return { lbl: 'I morgon',               overdue: false, urgent: true }
  return           { lbl: `${day}. ${mon}`,               overdue: false, urgent: false }
}
