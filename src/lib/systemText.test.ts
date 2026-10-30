import { describe, expect, it, vi } from 'vitest'
import i18next from 'i18next'
import en from '@/locales/en.json'
import ru from '@/locales/ru.json'
import uz from '@/locales/uz.json'

vi.mock('@/i18n', () => ({ default: { resolvedLanguage: 'ru' } }))
const { matchSystemText, systemText } = await import('./systemText')

const i18n = i18next.createInstance()
await i18n.init({ resources: { en: { translation: en }, ru: { translation: ru }, uz: { translation: uz } }, lng: 'en', fallbackLng: false, interpolation: { escapeValue: false } })
const tFor = (lng: string) => i18n.getFixedT(lng)

/** Every text the database functions (and the e2e mock) write, with the key it maps to. */
const KNOWN: [string, string][] = [
  ['Request update on offer', 'sysText.requestUpdate'],
  ['Offer validity has passed', 'sysText.offerExpired'],
  ['Premium overdue', 'sysText.premiumOverdue'],
  ['Review the reserve', 'sysText.reviewReserve'],
  ['Large loss', 'sysText.largeLoss'],
  ['Submission registered', 'sysText.registered'],
  ['Claim payment offset against premium', 'sysText.offsetNote'],
  ['Closed automatically: installment paid', 'sysText.closedPaid'],
  ['Closed automatically: installment written off', 'sysText.closedWrittenOff'],
  ['Cash call paid', 'sysText.cashCallPaid'],
  ['Firm order received from MGA', 'sysText.firmOrder'],
  ['Quote sent', 'sysText.quoteSent'],
  ['Cash call paid on 05.10.2026', 'sysText.cashCallPaidOn'],
  ['Closed automatically: status changed to bound', 'sysText.closedStatus'],
  ['Closed automatically: status changed to no_response', 'sysText.closedStatus'],
  ['Automatically set: no answer 30 days after the offer', 'sysText.autoNoResponse'],
  ['Capacity 80 % used', 'sysText.capacityUsed'],
  ['Capacity 100 % used', 'sysText.capacityUsed'],
  ['Missing risk bordereau 09.2026', 'sysText.bordereauMissing'],
  ['Missing claims bordereau 07.2026', 'sysText.bordereauMissing'],
]

describe('systemText', () => {
  it.each(KNOWN)('maps %s to %s', (text, key) => {
    expect(matchSystemText(text, tFor('en'))?.key).toBe(key)
  })

  it.each(['en', 'ru', 'uz'])('has every entry in %s and never shows the raw key', (lng) => {
    const t = tFor(lng)
    for (const [text, key] of KNOWN) {
      expect(i18n.exists(key.replace(/^sysText\.autoNoResponse$/, 'sysText.autoNoResponse_other'), { lng })).toBe(true)
      const out = systemText(text, t)
      expect(out).not.toContain('sysText.')
      expect(out).not.toMatch(/\{\{/)
    }
  })

  it('renders in the user language with parameters', () => {
    expect(systemText('Request update on offer', tFor('ru'))).toBe('Запросить ответ по предложению')
    expect(systemText('Closed automatically: status changed to bound', tFor('ru'))).toBe('Закрыто автоматически: статус изменён на «Подтверждена»')
    expect(systemText('Automatically set: no answer 21 days after the offer', tFor('ru'))).toContain('21 день')
    expect(systemText('Missing premium bordereau 09.2026', tFor('ru'))).toBe('Нет бордеро: Премии, 09.2026')
    expect(systemText('Premium overdue', tFor('uz'))).toBe('Mukofot muddati oʻtgan')
    expect(systemText('Request update on offer', tFor('en'))).toBe('Request update on offer')
  })

  it('shows text a person typed as it is', () => {
    expect(matchSystemText('Called the broker, waiting for the slip', tFor('en'))).toBeNull()
    expect(systemText('Called the broker, waiting for the slip', tFor('ru'))).toBe('Called the broker, waiting for the slip')
    expect(systemText('Request update on offer — chased twice', tFor('ru'))).toBe('Request update on offer — chased twice')
    expect(systemText(null, tFor('ru'))).toBe('')
  })
})
