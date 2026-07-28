// The "we couldn't open that file" notice shared by the image tools (#225). One
// component so eight dropzones can't drift into eight different-looking warnings.
export function FileError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div
      className="flex items-start gap-2 border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] ps-3 pe-3 py-2.5 rounded-e-md"
      role="status"
      data-testid="file-error"
    >
      <span className="text-[0.88rem] text-ink leading-snug">{message}</span>
    </div>
  )
}
