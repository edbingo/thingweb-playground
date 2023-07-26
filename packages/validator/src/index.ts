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

import { Thing, Result, createThingObject, validateSchema, validateJsonLd, parseJSON, checkThingType } from './validation';


import builder from "junit-report-builder";

// consts //

const program = new Command();

// Program Overview //
// 1. Verify that each input is a valid JSON file
// 2. Validate each input against the TD schema
// 3. Validate TD Defaults
// 4. Validate TD JSON-LD

program
    .version('2.0.0')
    .arguments('<files...>')
    .description('Validate JSON files against the Thing Description schema')
    .option('-o, --offline', 'Run in offline mode', false)
    .option('-j, --junit', 'Generate a JUnit report', false)
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

// Read files into Objects //
const things: Thing[] = [];
for (const file of files) {
    things.push(createThingObject(file));
}

const promises: Promise<boolean>[] = [];

// Validate each Thing //
for (const thing of things) {
    promises.push(validateTD(thing));
}

Promise.all(promises).then(() => {
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
        thing.valid ? valid = "✔" : valid = "✘";
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
    let time = Date.now();
    // Parse JSON
    if (!parseJSON(thing)) {
        thing.time = Date.now() - time;
        thing.valid = false;
        return Promise.resolve(false);
    }

    // Determine if TD or TM
    checkThingType(thing);

    
    // Validate against schema
    if (!validateSchema(thing)) {
        thing.time = Date.now() - time;
        thing.valid = false;
        return Promise.resolve(false);
    }

    // Validate JSON-LD
    if (!options.offline) {
        if (!(await validateJsonLd(thing))) {
            thing.time = Date.now() - time;
            thing.valid = false;
            return Promise.resolve(false);
        }
    }
    thing.time = Date.now() - time;
    thing.valid = true;
    return Promise.resolve(true);
}





