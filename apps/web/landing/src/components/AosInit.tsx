"use client";

import AOS from "aos";
import { useEffect } from "react";
import "aos/dist/aos.css";

export function AosInit() {
  useEffect(() => {
    AOS.init({
      duration: 700,
      easing: "ease-out-cubic",
      once: false,
      offset: 72,
      disable: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });

    return () => {
      document.querySelectorAll("[data-aos]").forEach((el) => {
        el.removeAttribute("data-aos");
        el.classList.remove("aos-animate");
      });
    };
  }, []);

  return null;
}
