export const voices = {
  sergio: { name: 'es-CO-GonzaloNeural', locale: 'es-CO' },
  kirill: { name: 'ru-RU-DmitryNeural', locale: 'ru-RU' },
}
export const format = 'riff-24khz-16bit-mono-pcm'
export const version = 'scripted-speech-1'

export function ssml(who, text) {
  const voice = voices[who]
  if (!voice || typeof text !== 'string' || !text.trim()) throw new Error('Invalid scripted line')
  const escaped = text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
  // Native voice locale, original English text, default style/rate/pitch as auditioned.
  // No translation, phonetic respelling or unsupported multilingual/style parameters.
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.locale}"><voice name="${voice.name}">${escaped}</voice></speak>`
}
