import { describe, it, expect } from 'vitest'
import { parseMessage, mentionedCodes, isJumboEmoji, firstLink, plain, safeHref } from './format'

describe('parseMessage', () => {
  it('bold, italic, strike, nested', () => {
    expect(parseMessage('a *bold* b')).toEqual([{ t: 'text', v: 'a ' }, { t: 'b', kids: [{ t: 'text', v: 'bold' }] }, { t: 'text', v: ' b' }])
    expect(parseMessage('_it_ ~gone~')).toEqual([{ t: 'i', kids: [{ t: 'text', v: 'it' }] }, { t: 'text', v: ' ' }, { t: 's', kids: [{ t: 'text', v: 'gone' }] }])
    expect(parseMessage('*_both_*')).toEqual([{ t: 'b', kids: [{ t: 'i', kids: [{ t: 'text', v: 'both' }] }] }])
  })
  it('does not format mid-word or unmatched marks', () => {
    expect(parseMessage('2*3*4')).toEqual([{ t: 'text', v: '2*3*4' }])
    expect(parseMessage('snake_case_name')).toEqual([{ t: 'text', v: 'snake_case_name' }])
    expect(parseMessage('* not bold')).toEqual([{ t: 'text', v: '* not bold' }])
  })
  it('code is verbatim, fences are blocks', () => {
    expect(parseMessage('run `*x*` now')).toEqual([{ t: 'text', v: 'run ' }, { t: 'code', v: '*x*' }, { t: 'text', v: ' now' }])
    expect(parseMessage('see\n```\nconst a = *b*\n```')).toEqual([{ t: 'text', v: 'see' }, { t: 'br' }, { t: 'pre', v: 'const a = *b*' }])
  })
  it('links get a safe href, trailing punctuation stays outside', () => {
    expect(parseMessage('go to https://built-in-saudi.com/en/apps.')).toEqual([{ t: 'text', v: 'go to ' }, { t: 'link', href: 'https://built-in-saudi.com/en/apps', v: 'https://built-in-saudi.com/en/apps' }, { t: 'text', v: '.' }])
    expect(parseMessage('www.example.com')[0]).toMatchObject({ t: 'link', href: 'https://www.example.com/' })
    expect(parseMessage('javascript:alert(1)')).toEqual([{ t: 'text', v: 'javascript:alert(1)' }])
    expect(safeHref('data:text/html,x')).toBeNull()
  })
  it('markup in a message is text, never HTML', () => {
    const t = parseMessage('<img src=x onerror=alert(1)>')
    expect(t).toEqual([{ t: 'text', v: '<img src=x onerror=alert(1)>' }])
  })
  it('mentions match known names, longest first, and give codes', () => {
    const names = new Map([['sara', 'c1'], ['sara ali', 'c2'], ['أحمد', 'c3']])
    expect(parseMessage('hi @Sara Ali!', names)).toEqual([{ t: 'text', v: 'hi ' }, { t: 'mention', v: '@Sara Ali', code: 'c2' }, { t: 'text', v: '!' }])
    expect(mentionedCodes('@sara and @أحمد، thanks', names)).toEqual(['c1', 'c3'])
    expect(mentionedCodes('email@sara.com', names)).toEqual([])
  })
  it('line breaks', () => {
    expect(parseMessage('a\nb')).toEqual([{ t: 'text', v: 'a' }, { t: 'br' }, { t: 'text', v: 'b' }])
  })
})

describe('helpers', () => {
  it('jumbo emoji', () => {
    expect(isJumboEmoji('😂')).toBe(true)
    expect(isJumboEmoji('👍🏽❤️🎉')).toBe(true)
    expect(isJumboEmoji('😂😂😂😂')).toBe(false)
    expect(isJumboEmoji('ok 👍')).toBe(false)
    expect(isJumboEmoji('')).toBe(false)
  })
  it('first link and plain text', () => {
    expect(firstLink('see https://a.com and https://b.com')).toBe('https://a.com/')
    expect(firstLink('nothing')).toBeNull()
    expect(plain('*hi* _there_\n`x`')).toBe('hi there x')
  })
})
