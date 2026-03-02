export const brl = (valueCents: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    valueCents / 100,
  )

export const shortDate = (isoDate: string): string => {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

export const dateInputFromNow = (daysDelta: number): string => {
  const now = new Date()
  now.setDate(now.getDate() + daysDelta)
  return now.toISOString().slice(0, 10)
}
