import type { LocalWordList } from './types'

const starterWords: Array<[string, string]> = [
  ['cat', 'The cat can run.'],
  ['dog', 'The dog can run.'],
  ['sun', 'The sun is up.'],
  ['run', 'I can run.'],
  ['ball', 'The ball can roll.'],
  ['tree', 'The tree is tall.'],
  ['jump', 'I can jump.'],
  ['play', 'We can play.'],
  ['bright', 'The sun is bright.'],
  ['train', 'The train is fast.'],
]

export const STARTER_LIST: LocalWordList = {
  version: 1,
  title: 'Starter list',
  words: starterWords.map(([word, sentence]) => ({
    id: word,
    word,
    sentence,
    ...(word === 'bright' ? { aliases: ['brite'] } : {}),
  })),
}
