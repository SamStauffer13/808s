// Players who ask their device for less motion get the screens without the animation.
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
