import React from 'react'
import loaderGif from '../../assets/bitmap-justine25debug.gif'

type LoaderProps = {
  isFadingOut?: boolean
}

const Loader: React.FC<LoaderProps> = ({ isFadingOut = false }) => {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-white z-50 transition-opacity duration-500 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
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
