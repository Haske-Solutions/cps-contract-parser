/**
 * Mask a secret for display — never send the full value to the renderer.
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••'
  const head = Math.min(6, Math.max(4, Math.floor(value.length * 0.12)))
  const tail = 4
  const hidden = value.length - head - tail
  return value.slice(0, head) + '•'.repeat(Math.max(6, hidden)) + value.slice(-tail)
}
