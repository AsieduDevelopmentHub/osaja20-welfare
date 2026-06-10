export type AosAnimation =
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "fade-in"
  | "zoom-in"
  | "zoom-out"
  | "flip-up";

export type AosAttrs = {
  "data-aos": AosAnimation;
  "data-aos-delay"?: string;
  "data-aos-duration"?: string;
  "data-aos-anchor-placement"?: string;
};

/** Spread onto elements for AOS scroll animations (requires `AosInit` in layout). */
export function aos(
  animation: AosAnimation,
  options?: { delay?: number; duration?: number; anchor?: string }
): AosAttrs {
  const attrs: AosAttrs = { "data-aos": animation };
  if (options?.delay !== undefined) attrs["data-aos-delay"] = String(options.delay);
  if (options?.duration !== undefined) attrs["data-aos-duration"] = String(options.duration);
  if (options?.anchor) attrs["data-aos-anchor-placement"] = options.anchor;
  return attrs;
}
