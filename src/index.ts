import { Dodgeball, useDodgeball } from "./Dodgeball";
import { DodgeballApiVersion } from "./types";

if (typeof window !== "undefined") {
  if (!window.hasOwnProperty("Dodgeball")) {
    window.Dodgeball = Dodgeball;
  }
}

export { Dodgeball, useDodgeball, DodgeballApiVersion };
