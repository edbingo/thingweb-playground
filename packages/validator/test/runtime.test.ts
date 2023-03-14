/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/import { exec } from "child_process";

interface TestDetails {
  sOut: string;
  sErr: string;
  lastErr?: Error;
}

interface TestResult {
  statusCode: number;
  command: string;
  comment: string;
  details: TestDetails;
  cbTest?: (sOut: string, sErr: string, lastErr?: Error) => boolean;
  passed: boolean | "no-test";
}

/**
 * The testing processes stack object
 */
const processStack = {
  /**
   * Contains the stacked processes
   * @private Should not be accessed directly
   */
  stack: [] as Promise<TestResult>[],
  /**
   * Add a new test process
   * @param {string} command The command passed to `exec`
   * @param {string} comment Describe the test
   * @param {(sOut, sErr, lastErr?)=>boolean} cbTest Opt: Test executed after process execution
   */
  add(command: string, comment: string, cbTest?: (sOut: string, sErr: string, lastErr?: Error) => void) {
    this.stack.push(new Promise<TestResult>((res, rej) => {
      const details: TestDetails = {
        sOut: "",
        sErr: ""
      };
      const spawnedProcess = exec(command, (err, thisOut, thisErr) => {
        if (err) {
          details.lastErr = err;
        }
        details.sErr += thisErr;
        details.sOut += thisOut;
      });
      spawnedProcess.on("exit", statusCode => {
        res({ statusCode, command, comment, details, cbTest, passed: false });
      });
    }));
  },
  /**
   * Wait for all process executions currently in the stack to be finished,
   * then evaluate their results
   */
  evaluate() {
    Promise.all(this.stack).then(results => {
      results.forEach(result => {
        if (result.details.sOut.search("schema: passed, defaults: passed, jsonld: passed") !== -1) {
          result.passed = true;
        }
      });
      console.log(results.map(result => ({
        statusCodeOK: result.statusCode === 0,
        passed: result.passed,
        command: result.command,
        comment: result.comment
      })));

      // console.log(JSON.stringify(results, undefined, 4))

      const failed: TestResult[] = [];
      failed.push(...results.filter(result => (result.statusCode !== 0 || result.passed === false)));
      if (failed.length > 0) {
        failed.forEach(fail => {
          console.error(JSON.stringify(fail, undefined, 4));
        });
        process.exit(1);
      }
    });
  }
};

/**
processStack.add("node dist/index.js -i examples/tds/valid", "Validate all valid TDs",)
*/

processStack.add("node dist/index.js -i examples/tds/valid/MetadataThing.json", "Validate valid TD")

processStack.evaluate();