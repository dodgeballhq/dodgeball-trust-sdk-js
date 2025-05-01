import { Dodgeball, useDodgeball } from "./Dodgeball";
import { LogLevel } from "./logger";
import { DodgeballApiVersion, IVerification } from "./types";

if (typeof window !== "undefined") {
  if (!window.hasOwnProperty("Dodgeball")) {
    window.Dodgeball = Dodgeball;
  }
}

export {
  Dodgeball, DodgeballApiVersion, LogLevel, useDodgeball
};

  export type {
    IVerification
  };

