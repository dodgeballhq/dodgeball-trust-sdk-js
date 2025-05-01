export enum LogLevel {
  TRACE = "TRACE",
  INFO = "INFO",
  ERROR = "ERROR",
  NONE = "NONE",
}

export enum Severity {
  TRACE = 0,
  INFO = 1,
  ERROR = 2,
  NONE = 3,
}

export type LogEntryParameters = { [key: string]: any };

export interface ILogEntry {
  severity: Severity;
  message: string;
  error?: any;
  parameters?: LogEntryParameters;
  date: Date;
}

export class LogEntry implements ILogEntry {
  severity: Severity = Severity.INFO;
  message: string = "";
  error?: any;
  parameters?: { [key: string]: any };
  date = new Date();

  constructor(
    message: string,
    severity: Severity = Severity.INFO,
    error: any = null
  ) {
    this.message = message;
    this.severity = severity;
    this.error = error;
  }

  public setParameters(parameters?: LogEntryParameters) {
    this.parameters = parameters;
    return this;
  }

  public setParameter(key: string, value: any) {
    this.parameters = this.parameters ?? {};
    this.parameters[key] = value;
    return this;
  }

  public setSeverity(severity: Severity) {
    this.severity = severity;
    return this;
  }

  public setError(error?: unknown) {
    this.error = error;
    return this;
  }

  public log() {
    try { 
        Logger.log(this);
    } catch (e) {
        // FAILED TO LOG - DO NOT BREAK EXECUTION OR WRITE TO CONSOLE
    }
  }
}

export class Logger {
  static filterLevel: Severity = Severity.TRACE;

  public static info(message: string, parameters?: LogEntryParameters) {
    return new LogEntry(message, Severity.INFO).setParameters(parameters);
  }

  public static trace(message: string, parameters?: LogEntryParameters) {
    return new LogEntry(message, Severity.TRACE).setParameters(parameters);
  }

  public static error(message: string, error?: unknown) {
    return new LogEntry(message, Severity.ERROR).setError(error);
  }

  public static log(logEvent: ILogEntry) {
    if (logEvent.severity.valueOf() >= Logger.filterLevel.valueOf()) {
      let logResults = `Dodgeball SDK:
        Severity: ${Severity[logEvent.severity]}
        Date: ${logEvent.date}
        Message: ${logEvent.message}`;

      let parametersString = "";
      try {
        if (logEvent.parameters) {
          parametersString = `
            ${JSON.stringify(logEvent.parameters, null, 2)}`;
        }
      } catch (e) {
        parametersString = `Unable to represent parameters as a string`;
      }

      logResults = `${logResults}
        Parameters: ${parametersString}`;

      if (logEvent.severity === Severity.ERROR) {
        console.log(logResults, logEvent.error);
      } else {
        console.log(logResults);
      }
    }
  }
}
