export function pagination(total: number, requested: number, size = 50) {
  const pages = Math.max(1, Math.ceil(total / size))
  const page = Math.max(1, Math.min(pages, requested))
  const start = (page - 1) * size
  const numbers = [...new Set([1, ...Array.from({ length: 5 }, (_, index) => page + index - 2).filter(value => value > 1 && value < pages), pages])].sort((first, second) => first - second)
  return { page, pages, start, end: Math.min(total, start + size), numbers }
}
