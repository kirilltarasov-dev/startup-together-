export const CHARACTERS = [{ id: 'sergio', name: 'Sergio · prototype rig', url: '/assets/characters/sergio-player.glb', missingClips: ['run', 'jump', 'fall', 'land', 'turnLeft', 'turnRight'] }] as const
export type CharacterId = typeof CHARACTERS[number]['id']
export const characterAsset = (id: CharacterId) => CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0]
