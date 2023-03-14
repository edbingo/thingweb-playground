"use strict";
exports.__esModule = true;
var child_process_1 = require("child_process");
/**
 * The testing processes stack object
 */
var processStack = {
    /**
     * Contains the stacked processes
     * @private Should not be accessed directly
     */
    stack: [],
    /**
     * Add a new test process
     * @param {string} command The command passed to `exec`
     * @param {string} comment Describe the test
     * @param {(sOut, sErr, lastErr?)=>boolean} cbTest Opt: Test executed after process execution
     */
    add: function (command, comment, cbTest) {
        this.stack.push(new Promise(function (res, rej) {
            var details = {
                sOut: "",
                sErr: ""
            };
            var spawnedProcess = (0, child_process_1.exec)(command, function (err, thisOut, thisErr) {
                if (err) {
                    details.lastErr = err;
                }
                details.sErr += thisErr;
                details.sOut += thisOut;
            });
            spawnedProcess.on("exit", function (statusCode) {
                res({ statusCode: statusCode, command: command, comment: comment, details: details, cbTest: cbTest, passed: false });
            });
        }));
    },
    /**
     * Wait for all process executions currently in the stack to be finished,
     * then evaluate their results
     */
    evaluate: function () {
        Promise.all(this.stack).then(function (results) {
            results.forEach(function (result) {
                result.passed = result.cbTest !== undefined ?
                    result.cbTest(result.details.sOut, result.details.sErr, result.details.lastErr) :
                    "no-test";
                if (result.details.sErr !== "" || result.details.lastErr !== undefined) {
                    result.passed = false;
                }
            });
            console.log(results.map(function (result) { return ({
                statusCodeOK: result.statusCode === 0 ? true : false,
                passed: result.passed,
                command: result.command,
                comment: result.comment
            }); }));
            // console.log(JSON.stringify(results, undefined, 4))
            var failed = [];
            failed.push.apply(failed, results.filter(function (result) { return (result.statusCode !== 0 || result.passed === false); }));
            if (failed.length > 0) {
                failed.forEach(function (fail) {
                    console.error(JSON.stringify(fail, undefined, 4));
                });
                process.exit(1);
            }
        });
    }
};
/**
 *
processStack.add("node tsc", "Compile TypeScript files")

processStack.add("node dist/index.js -i examples/tds/valid", "Validate all valid TDs",)
*/
processStack.add("node dist/index.js -i examples/tds/valid/MetadataThing.json", "Validate valid TD", function (sOut) {
    if (sOut.includes("schema: passed, defaults: passed, jsonld: passed")) {
        console.log("Valid TD validated successfully");
    }
});
