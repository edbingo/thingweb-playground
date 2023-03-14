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
 ********************************************************************************/

import fs from "fs";
import commander from "commander";
import jsonld, { JsonLdDocument } from "jsonld";
import Ajv from "ajv";
import addFormats from "ajv-formats";
// import apply from 'ajv-formats-draft2019'
import builder from "junit-report-builder";

import tdSchema from "./td-schema.json";
import fullTdSchema from "./td-schema-full.json";
import tmSchema from "./tm-schema.json";

// cli config

const program = new commander.Command();
program
    .description("Validate a JSON file against a JSON schema")
    .option("-i, --input <pathToInputs...>", "Path to the input JSON file")
    .option("--offline", "Run in offline mode")
    .option("--junit", "Generate a JUnit report");

const myArgs = program.parse().opts();

const logFunc = console.log;

// main program

// if no input given, automatically add examples folder
let inputArray: string[] = myArgs.input;
if (inputArray === undefined) {
    inputArray = ["../examples/tds"];
}

// helper methods for junit report
function passTest(suite: builder.TestSuite, name: string, time: number) {
    suite.testCase().className("validator").name(name).time(time);
}

function failTest(suite: builder.TestSuite, name: string, time: number, error: string) {
    suite.testCase().className("validator").name(name).time(time).failure(error);
}

function errorTest(suite: builder.TestSuite, name: string, time: number, error: string) {
    suite.testCase().className("validator").name(name).time(time).error(error);
}

function skipTest(suite: builder.TestSuite, name: string) {
    suite.testCase().className("validator").name(name).skipped();
}

// scan folder for all json files
function scanFolder(currentInput: string, results: string[]) {
    if (fs.lstatSync(currentInput).isDirectory()) {
        if (!currentInput.endsWith("/")) {
            currentInput += "/";
        }
        for (const ls of fs.readdirSync(currentInput)) {
            scanFolder(currentInput + ls, results);
        }
    } else if (currentInput.endsWith(".json") || currentInput.endsWith(".jsonld")) {
        results.push(currentInput);
    } else {
        // do nothing
    }
}

// Main verification function
function checkThing(fileName: string, thingString: string, suite: builder.TestSuite, isTD: boolean): Promise<void> {
    return new Promise<void>((resolve) => {
        // JSON-LD validation
        async function validateJsonLd(jsonLd: JsonLdDocument) {
            try {
                const start = Date.now();
                jsonld.toRDF(jsonLd, { format: "application/n-quads" });
                const time = Date.now() - start;
                return { valid: true, time };
            } catch (error) {
                return { valid: false, time: 0 };
            }
        }

        // parse json
        const thingJson = JSON.parse(thingString);

        // init report
        const report = {
            schema: "null",
            defaults: "null",
            jsonld: "null",
        };

        // schema validation

        // init ajv
        let start = Date.now();
        let ajv = new Ajv({ strict: false });
        ajv = addFormats(ajv);
        //        ajv = apply(ajv)
        isTD ? ajv.addSchema(tdSchema, "td") : ajv.addSchema(tmSchema, "tm");

        // validate schema
        const valid = isTD ? ajv.validate("td", thingJson) : ajv.validate("tm", thingJson);
        if (valid) {
            report.schema = "passed";
            let end = Date.now();
            passTest(suite, "Schema Validation", end - start);

            // if td, perform full validation
            if (isTD) {
                start = Date.now();
                ajv.addSchema(fullTdSchema, "fulltd");
                const fullValid = ajv.validate("fulltd", thingJson);
                if (fullValid) {
                    report.defaults = "passed";
                    end = Date.now();
                    passTest(suite, "Defaults Validation", end - start);
                } else {
                    report.defaults = "warning";
                    end = Date.now();
                    errorTest(suite, "Defaults Validation", end - start, ajv.errorsText());
                }
            }
        } else {
            report.schema = "failed";
            const end = Date.now();
            failTest(suite, "Schema Validation", end - start, ajv.errorsText());
            report.defaults = "skipped";
            skipTest(suite, "Defaults Validation");
            logFunc("X JSON Schema validation failed:");
            logFunc(ajv.errorsText());
        }

        // JSON-LD validation (if not disabled)
        if (!myArgs.offline) {
            validateJsonLd(thingJson).then((result) => {
                if (result.valid) {
                    report.jsonld = "passed";
                    passTest(suite, "JSON LD Validation", result.time);
                    logFunc(
                        fileName +
                            " - schema: " +
                            report.schema +
                            ", defaults: " +
                            report.defaults +
                            ", jsonld: " +
                            report.jsonld
                    );
                    resolve();
                } else {
                    report.jsonld = "failed";
                    failTest(suite, "JSON LD Validation", result.time, "JSON-LD validation failed.");
                    logFunc("JSON-LD validation failed.");
                    logFunc(
                        fileName +
                            " - schema: " +
                            report.schema +
                            ", defaults: " +
                            report.defaults +
                            ", jsonld: " +
                            report.jsonld
                    );
                    resolve();
                }
            });
        } else {
            report.jsonld = "skipped";
            skipTest(suite, "JSON LD Validation");
            logFunc(fileName + " - schema: " + report.schema + ", defaults: " + report.defaults);
            resolve();
        }
    });
}

// check json validation, and return promises
function validate(pathString: string): Promise<void> {
    const fileName = pathString.split("/").slice(-1).toString();
    const suite = builder.testSuite().name(fileName);
    const thingString = fs.readFileSync(pathString, "utf-8");
    const start = Date.now();
    let thingJson;
    try {
        thingJson = JSON.parse(thingString);
        const end = Date.now();
        passTest(suite, "JSON Validation", end - start);
        if (thingJson["@type"] === "tm:ThingModel") {
            return checkThing(fileName, thingString, suite, false);
        } else {
            return checkThing(fileName, thingString, suite, true);
        }
    } catch (err) {
        logFunc("JSON Validation failed for " + pathString + ":");
        logFunc(err);
        const end = Date.now();
        failTest(suite, "JSON Validation", end - start, err);
        return Promise.resolve();
    }
}

// scan input folder for all json files
const thingPaths: string[] = [];
for (const input of inputArray) {
    logFunc("reading " + input);
    scanFolder(input, thingPaths);
}

// validate all json files
const promises = [];
for (const pathString of thingPaths) {
    promises.push(validate(pathString));
}

// write junit report
Promise.all(promises)
    .then(() => {
        if (myArgs.junit) {
            logFunc("Generating JUnit report...");
            builder.writeTo("report.xml");
        }
    })
    .catch((err) => {
        logFunc(err);
        if (myArgs.junit) {
            logFunc("Generating JUnit report...");
            builder.writeTo("report.xml");
        }
    });

module.exports = { jsonValidate: validate, folderScanner: scanFolder };
