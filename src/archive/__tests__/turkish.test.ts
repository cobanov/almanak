/**
 * The normalizer decides what search can find. Turkish is where it earns its
 * keep: 77% of the reference archive is Turkish, and the two properties that
 * break naive matching are the dotted/dotless i pair and agglutination.
 */

import { describe, it, expect } from 'vitest'
import { fold, stem, tokenize, normalizeForSearch, STOPWORDS } from '../turkish.ts'

describe('fold', () => {
  it('collapses every i-variant onto one letter', () => {
    // JavaScript's own toLowerCase turns I into i and İ into i+combining dot,
    // which is wrong for Turkish in opposite directions. Both must land on 'i'.
    for (const variant of ['İ', 'I', 'ı', 'i']) {
      expect(fold(variant)).toBe('i')
    }
  })

  it('makes IŞIK and ışık the same string', () => {
    expect(fold('IŞIK')).toBe(fold('ışık'))
  })

  it('folds the rest of the Turkish set', () => {
    expect(fold('ŞĞÜÖÇ')).toBe('sguoc')
    expect(fold('şğüöç')).toBe('sguoc')
  })

  it('leaves ASCII alone apart from case', () => {
    expect(fold('Hello World')).toBe('hello world')
  })

  it('strips combining marks rather than leaving them in the output', () => {
    expect(fold('é')).toBe('e')
  })
})

describe('stem', () => {
  it('reduces an agglutinated family to one token', () => {
    const stems = ['model', 'modeli', 'modelin', 'modelleri'].map(stem)
    expect(new Set(stems).size).toBe(1)
  })

  it('refuses to stem a word into noise', () => {
    // Below MIN_STEM the remainder would carry no meaning, so nothing is cut.
    expect(stem('ev')).toBe('ev')
    expect(stem('kod')).toBe('kod')
  })

  it('is stable, so the same word always reduces to the same stem', () => {
    // The contract is consistency, not linguistic correctness. English words do
    // get over-stemmed by Turkish suffixes ("stable" loses -le), which is
    // tolerable precisely because a stem is never shown to a reader: callers
    // match on the stem and display the commonest spelling behind it.
    for (const word of ['stable', 'llama', 'inference', 'kubernetes']) {
      expect(stem(word)).toBe(stem(word.toUpperCase()))
    }
  })

  it('peels stacked suffixes rather than only the outermost one', () => {
    // model + ler + i. One pass left "modeller", which never met "model".
    expect(stem('modelleri')).toBe(stem('model'))
  })
})

describe('tokenize', () => {
  it('drops punctuation and single characters', () => {
    expect(tokenize('a, bb. ccc!')).toEqual(['bb', 'ccc'])
  })

  it('keeps emoji out of the token stream', () => {
    expect(tokenize('merhaba 👋 dünya')).toEqual(['merhaba', 'dunya'])
  })

  it('handles an empty string', () => {
    expect(tokenize('')).toEqual([])
  })
})

describe('normalizeForSearch', () => {
  it('lets a stem match its inflected form', () => {
    const haystack = normalizeForSearch('yeni modelini denedim')
    expect(haystack).toContain(stem('model'))
  })

  it('is case and diacritic insensitive across the i pair', () => {
    expect(normalizeForSearch('İSTANBUL')).toBe(normalizeForSearch('istanbul'))
  })
})

describe('STOPWORDS', () => {
  it('holds both languages, since archives mix them', () => {
    expect(STOPWORDS.has('bir')).toBe(true)
    expect(STOPWORDS.has('the')).toBe(true)
  })

  it('is stored folded, so lookups of folded tokens hit', () => {
    for (const word of STOPWORDS) expect(fold(word)).toBe(word)
  })
})
