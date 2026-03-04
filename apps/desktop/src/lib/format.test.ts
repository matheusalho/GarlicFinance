import { describe, expect, it } from 'vitest'

import { brl, dateInputFromNow, shortDate } from './format'

describe('format', () => {
  it('formats BRL cents into pt-BR currency string', () => {
    expect(brl(123456)).toContain('1.234,56')
  })

  it('returns original value when shortDate input is invalid', () => {
    expect(shortDate('invalid-date')).toBe('invalid-date')
  })

  it('produces ISO date input format for relative days', () => {
    expect(dateInputFromNow(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
