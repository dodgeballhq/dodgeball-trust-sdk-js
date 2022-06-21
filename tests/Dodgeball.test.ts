import { Dodgeball } from "../src/Dodgeball";
import { LogLevel } from "../src/logger";
import {
  DodgeballApiVersion,
  DodgeballInvalidConfigError,
  DodgeballMissingConfigError,
  IVerification,
  VerificationOutcome,
  VerificationStatus,
} from "../src/types";

describe("constructor", () => {
  test("should require an API key", () => {
    expect(() => {
      new Dodgeball("");
    }).toThrow(DodgeballMissingConfigError);
  });

  test("should only require an API key", () => {
    let dodgeball = new Dodgeball("test-public-key");
    expect(dodgeball).toBeInstanceOf(Dodgeball);
  });

  test("should accept a valid config object", () => {
    let dodgeball = new Dodgeball("test-public-key", {
      apiVersion: DodgeballApiVersion.v1,
      apiUrl: "https://api.dodgeballhq.com/",
      logLevel: LogLevel.ERROR,
    });

    expect(dodgeball).toBeInstanceOf(Dodgeball);
  });

  test("should fail with an invalid apiVersion in config object", () => {
    expect(() => {
      new Dodgeball("test-public-key", {
        apiVersion: "invalid" as any,
      });
    }).toThrow(DodgeballInvalidConfigError);
  });

  test("should fail with an invalid logLevel in the config object", () => {
    expect(() => {
      new Dodgeball("test-public-key", {
        apiVersion: DodgeballApiVersion.v1,
        logLevel: "invalid" as any,
      });
    }).toThrow(DodgeballInvalidConfigError);
  });
});

describe("isRunning", () => {
  let dodgeball: Dodgeball;
  let verification: IVerification;

  beforeAll(() => {
    dodgeball = new Dodgeball("test-public-key");
  });

  beforeEach(() => {
    verification = {
      id: "test-verification-id",
      status: VerificationStatus.PENDING,
      outcome: VerificationOutcome.PENDING,
      stepData: {},
      nextSteps: [],
    };
  });

  test("should return true for a pending verification", () => {
    verification.status = VerificationStatus.PENDING;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isRunning(verification)).toBe(true);
  });

  test("should return true for a blocked verification", () => {
    verification.status = VerificationStatus.BLOCKED;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isRunning(verification)).toBe(true);
  });

  test("should return false for an approved verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.APPROVED;

    expect(dodgeball.isRunning(verification)).toBe(false);
  });

  test("should return false for a denied verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.DENIED;

    expect(dodgeball.isRunning(verification)).toBe(false);
  });

  test("should return false for a failed verification", () => {
    verification.status = VerificationStatus.FAILED;
    verification.outcome = VerificationOutcome.ERROR;

    expect(dodgeball.isRunning(verification)).toBe(false);
  });

  test("should return false for an undecided complete verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isRunning(verification)).toBe(false);
  });
});

describe("isAllowed", () => {
  let dodgeball: Dodgeball;
  let verification: IVerification;

  beforeAll(() => {
    dodgeball = new Dodgeball("test-public-key");
  });

  beforeEach(() => {
    verification = {
      id: "test-verification-id",
      status: VerificationStatus.PENDING,
      outcome: VerificationOutcome.PENDING,
      stepData: {},
      nextSteps: [],
    };
  });

  test("should return false for a pending verification", () => {
    verification.status = VerificationStatus.PENDING;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isAllowed(verification)).toBe(false);
  });

  test("should return false for a blocked verification", () => {
    verification.status = VerificationStatus.BLOCKED;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isAllowed(verification)).toBe(false);
  });

  test("should return true for an approved verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.APPROVED;

    expect(dodgeball.isAllowed(verification)).toBe(true);
  });

  test("should return false for a denied verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.DENIED;

    expect(dodgeball.isAllowed(verification)).toBe(false);
  });

  test("should return false for a failed verification", () => {
    verification.status = VerificationStatus.FAILED;
    verification.outcome = VerificationOutcome.ERROR;

    expect(dodgeball.isAllowed(verification)).toBe(false);
  });

  test("should return false for an undecided complete verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isAllowed(verification)).toBe(false);
  });
});

describe("isDenied", () => {
  let dodgeball: Dodgeball;
  let verification: IVerification;

  beforeAll(() => {
    dodgeball = new Dodgeball("test-public-key");
  });

  beforeEach(() => {
    verification = {
      id: "test-verification-id",
      status: VerificationStatus.PENDING,
      outcome: VerificationOutcome.PENDING,
      stepData: {},
      nextSteps: [],
    };
  });

  test("should return false for a pending verification", () => {
    verification.status = VerificationStatus.PENDING;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isDenied(verification)).toBe(false);
  });

  test("should return false for a blocked verification", () => {
    verification.status = VerificationStatus.BLOCKED;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isDenied(verification)).toBe(false);
  });

  test("should return false for an approved verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.APPROVED;

    expect(dodgeball.isDenied(verification)).toBe(false);
  });

  test("should return true for a denied verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.DENIED;

    expect(dodgeball.isDenied(verification)).toBe(true);
  });

  test("should return false for a failed verification", () => {
    verification.status = VerificationStatus.FAILED;
    verification.outcome = VerificationOutcome.ERROR;

    expect(dodgeball.isDenied(verification)).toBe(false);
  });

  test("should return false for an undecided complete verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isDenied(verification)).toBe(false);
  });
});

describe("isUndecided", () => {
  let dodgeball: Dodgeball;
  let verification: IVerification;

  beforeAll(() => {
    dodgeball = new Dodgeball("test-public-key");
  });

  beforeEach(() => {
    verification = {
      id: "test-verification-id",
      status: VerificationStatus.PENDING,
      outcome: VerificationOutcome.PENDING,
      stepData: {},
      nextSteps: [],
    };
  });

  test("should return false for a pending verification", () => {
    verification.status = VerificationStatus.PENDING;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isUndecided(verification)).toBe(false);
  });

  test("should return false for a blocked verification", () => {
    verification.status = VerificationStatus.BLOCKED;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isUndecided(verification)).toBe(false);
  });

  test("should return false for an approved verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.APPROVED;

    expect(dodgeball.isUndecided(verification)).toBe(false);
  });

  test("should return false for a denied verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.DENIED;

    expect(dodgeball.isUndecided(verification)).toBe(false);
  });

  test("should return false for a failed verification", () => {
    verification.status = VerificationStatus.FAILED;
    verification.outcome = VerificationOutcome.ERROR;

    expect(dodgeball.isUndecided(verification)).toBe(false);
  });

  test("should return true for an undecided complete verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.isUndecided(verification)).toBe(true);
  });
});

describe("hasError", () => {
  let dodgeball: Dodgeball;
  let verification: IVerification;

  beforeAll(() => {
    dodgeball = new Dodgeball("test-public-key");
  });

  beforeEach(() => {
    verification = {
      id: "test-verification-id",
      status: VerificationStatus.PENDING,
      outcome: VerificationOutcome.PENDING,
      stepData: {},
      nextSteps: [],
    };
  });

  test("should return false for a pending verification", () => {
    verification.status = VerificationStatus.PENDING;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.hasError(verification)).toBe(false);
  });

  test("should return false for a blocked verification", () => {
    verification.status = VerificationStatus.BLOCKED;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.hasError(verification)).toBe(false);
  });

  test("should return false for an approved verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.APPROVED;

    expect(dodgeball.hasError(verification)).toBe(false);
  });

  test("should return false for a denied verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.DENIED;

    expect(dodgeball.hasError(verification)).toBe(false);
  });

  test("should return true for a failed verification", () => {
    verification.status = VerificationStatus.FAILED;
    verification.outcome = VerificationOutcome.ERROR;

    expect(dodgeball.hasError(verification)).toBe(true);
  });

  test("should return false for an undecided complete verification", () => {
    verification.status = VerificationStatus.COMPLETE;
    verification.outcome = VerificationOutcome.PENDING;

    expect(dodgeball.hasError(verification)).toBe(false);
  });
});
