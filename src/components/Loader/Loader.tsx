import React from 'react'
import loaderGif from '../../assets/fullbody-icon.gif'

type LoaderProps = {
  isFadingOut?: boolean
  isDark?: boolean
}

const Loader: React.FC<LoaderProps> = ({ isFadingOut = false, isDark = false }) => {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center overflow-hidden ${isDark ? 'bg-black' : 'bg-white'} z-50 transition-opacity duration-500 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <img
        src={loaderGif}
        alt="Loading Justine25-debug"
        className="max-w-[240px] w-full h-auto"
      />
    </div>
  )
}

export default Loader
