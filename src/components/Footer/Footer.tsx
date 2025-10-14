type FooterProps = {
  isDark: boolean
  onToggle: () => void
}

const Footer = ({ isDark, onToggle }: FooterProps) => {

  return (
    <footer
      className={`fixed bottom-0 right-0 z-50 text-[11px] sm:text-sm md:text-base leading-tight select-none ${isDark ? ' text-white' : ' text-black'}`}
      aria-live="polite"
    >
      <button
        type="button"
        onClick={onToggle}
        className="cursor-pointer text-right m-0 p-2 bg-transparent border-0 no-underline hover:underline underline-offset-2 focus:outline-none"
        aria-pressed={isDark}
        title={isDark ? "switch to light mode" : "switch to dark mode"}
      >
        {isDark ? (
          <span>
            dark mode’s cozy, huh?
            <br className="sm:hidden" />
            {' '}bet you won’t switch back.
          </span>
        ) : (
          <span>
            white background hurts your eyes?
            <br className="sm:hidden" />
            {' '}click me, you coward!
          </span>
        )}
      </button>
    </footer>
  )
}

export default Footer
