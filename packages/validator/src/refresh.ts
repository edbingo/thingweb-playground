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

// Imports //

import fs from 'fs';
import Table from 'cli-table3'
import { Command } from 'commander';
import addFormats from 'ajv-formats';
import Ajv, {JSONSchemaType} from 'ajv';
import tdSchema from './td-schema.json';
import tdSchemaFull from './td-schema-full.json';
import tmSchema from './tm-schema.json';
import jsonld, { JsonLdDocument } from "jsonld";
import builder from "junit-report-builder";
import ProgressBar from 'progress';

// consts //

const program = new Command();

// Interfaces //

export interface Thing {
    fileName: string;
    fileTitle: string;
    fileString: string;
    json: any;
    isTM: boolean;
    valid: boolean;
    report: {
        json: TestResult;
        schema: TestResult;
        defaults: TestResult;
        jsonld: TestResult;
    }
    time: number;
}

export interface TestResult {
    result: Result;
    time: number;
    message?: string;
}

// Enums //

export enum Result {
    Valid = "✅",
    Invalid = "❌",
    Warning = "Warning",
    Skipped = "Skipped"
}

// Program Overview //
// 1. Verify that each input is a valid JSON file
// 2. Validate each input against the TD schema
// 3. Validate TD Defaults
// 4. Validate TD JSON-LD

program
    .version('2.0.1')
    .arguments('<files...>')
    .description('Validate JSON files against the Thing Description schema')
    .option('-o, --offline', 'Run in offline mode', false)
    .option('-j, --junit', 'Generate a JUnit report')
program.parse(process.argv);
const options = program.opts();

// Create array of files to validate //
const paths = program.args;
const files: string[] = [];

// Scan for subfolders and files //
for (const path of paths) {
    scanFiles(path, files);
}

files.length === 1 ? console.log("Found 1 file to validate.") : console.log("Found " + files.length + " files to validate.");

// Create progress bar //
const bar = new ProgressBar('[:bar] :percent ', {
    total: files.length,
    width: 50
});

// Read files into Objects //
const things: Thing[] = [];
for (const file of files) {
    things.push(createThingObject(file));
}

// Create Thing Object //
export function createThingObject(file: string): Thing {
    const thing: Thing = {
        fileName: file,
        fileString: fs.readFileSync(file, 'utf8'),
        json: undefined,
        isTM: false,
        valid: false,
        report: {
            json: { result: Result.Skipped, time: 0 },
            schema: { result: Result.Skipped, time: 0 },
            defaults: { result: Result.Skipped, time: 0 },
            jsonld: { result: Result.Skipped, time: 0 },
        },
        fileTitle: file.split("/").slice(-1).toString(),
        time: 0
    }
    return thing;
}

const promises: Promise<boolean>[] = [];

// Validate each Thing //
for (const thing of things) {
    promises.push(validateTD(thing));
}

Promise.all(promises).then(() => {
    console.log("Done!");
    if (options.junit) {
        createJunitReport(things);
    }
    printTable();
    if (things.some(thing => !thing.valid)) {
        process.exit(1);
    }
});


// Generate JUnit report //
function createJunitReport(things: Thing[]) {
    for (const thing of things) {
        const suite = builder.testSuite().name(thing.fileTitle);
        for (const [key, value] of Object.entries(thing.report)) {
            const testcase = suite.testCase()
                .name(key)
                .time(value.time);
            switch (value.result) {
                case Result.Valid:
                    break;
                case Result.Invalid:
                    testcase.failure(value.message);
                    break;
                case Result.Warning:
                    testcase.error(value.message);
                    break;
                case Result.Skipped:
                    testcase.skipped();
                    break;
            }
        }
    }
    builder.writeTo('report.xml');
}

function printTable() {
    // Table setup //
    const table = new Table({
        head: ['File', 'Type', 'JSON', 'Schema', 'Defaults', 'JSON-LD', 'Time'],
        colWidths: [30, 6, 10, 10, 10, 10, 6, 5]
    });

    // Format and print output //
    things.forEach(thing => {
        let type: string;
        let valid: string;
        if (thing.isTM) {
            type = "TM";
        } else {
            type = "TD";
        }
        thing.valid ? valid = "✅" : valid = "❌";
        table.push([thing.fileTitle, type, thing.report.json.result, thing.report.schema.result, thing.report.defaults.result, thing.report.jsonld.result, thing.time, valid]);
    });
    console.log(table.toString());
}
// Scan for subfolders and files //
function scanFiles(path: string, files: string[]) {
    if (!fs.existsSync(path)) {
        console.log("File or directory does not exist: " + path);
        return;
    }
    if (fs.lstatSync(path).isDirectory()) {
        if (!path.endsWith('/')) {
            path += '/';
        }
        for (const ls of fs.readdirSync(path)) {
            scanFiles(path + ls, files);
        }
    } else if (path.endsWith('.json') || path.endsWith('.jsonld')) {
        files.push(path);
    } else {
        // ignore irrelevant files
    }
}

// Validate TD //
export async function validateTD(thing: Thing): Promise<boolean> {
    const time = Date.now();
    // Parse JSON
    if (!parseJSON(thing)) {
        thing.time = Date.now() - time;
        thing.valid = false;
        Promise.resolve(false);
    }

    // Determine if TD or TM
    checkThingType(thing);

    // Validate against schema
    if (!validateSchema(thing)) {
        thing.time = Date.now() - time;
        thing.valid = false;
        Promise.resolve(false);
    }

    // Validate JSON-LD
    if (!options.offline) {
        if (!(await validateJsonLd(thing))) {
            thing.time = Date.now() - time;
            thing.valid = false;
            Promise.resolve(false);
        }
    }
    thing.time = Date.now() - time;
    thing.valid = true;
    bar.tick();
    Promise.resolve(true);
    return true;
}

function parseJSON(thing: Thing): boolean {
    const time = Date.now();
    try {
        thing.json = JSON.parse(thing.fileString);
        thing.report.json.result = Result.Valid;
        thing.report.json.time = Date.now() - time;
    } catch (e) {
        bar.interrupt(`Error parsing JSON file in ${thing.fileTitle}: ` + e);
        thing.report.json.result = Result.Invalid;
        thing.report.json.time = Date.now() - time;
        thing.report.json.message = e;
        return false;
    }
    return true;
}

function checkThingType(thing: Thing) {
    if (thing.json?.["@type"] === "tm:ThingModel") {
        thing.isTM = true;
    }
}

function validateSchema(thing: Thing): boolean {
    // Create AJV instance
    let ajv = new Ajv({ strict: false });
    ajv = addFormats(ajv);
    thing.isTM ? ajv.addSchema(tmSchema, "tm") : ajv.addSchema(tdSchema, "td");

    // Validate against schema
    const valid = ajv.validate(thing.isTM ? "tm" : "td", thing.json);
    if (!valid) {
        bar.interrupt(`Error validating Schema in ${thing.fileTitle}: ` + ajv.errorsText());
        thing.report.schema.result = Result.Invalid;
        thing.report.schema.message = ajv.errorsText();
        return false;
    } else {
        thing.report.schema.result = Result.Valid;
        if (!thing.isTM) {
            ajv.addSchema(tdSchemaFull, "fulltd");
            const fullValid = ajv.validate("fulltd", thing.json);
            if (fullValid) {
                thing.report.defaults.result = Result.Valid;
            } else {
                thing.report.defaults.result = Result.Warning;
                bar.interrupt(`Warning: ${thing.fileTitle} does not conform to the TD Defaults schema: ` + ajv.errorsText());
                thing.report.defaults.message = ajv.errorsText();
            }
        }
    }
    return true;
}

async function validateJsonLd(thing: Thing): Promise<boolean> {
    const time = Date.now();
    try {
        const jsonFile: JsonLdDocument = thing.json;
        await jsonld.toRDF(jsonFile, { format: "application/n-quads" });
        thing.report.jsonld.result = Result.Valid;
        thing.report.jsonld.time = Date.now() - time;
        return true;
    } catch (error) {
        bar.interrupt(`Error validating JSON-LD file in ${thing.fileTitle}: ` + error);
        thing.report.jsonld.result = Result.Invalid;
        thing.report.jsonld.time = Date.now() - time;
        thing.report.jsonld.message = error;
        return false;
    }
}
