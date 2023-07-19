import addFormats from 'ajv-formats';
import Ajv from 'ajv';
import fs from 'fs';
import jsonld, { JsonLdDocument } from "jsonld";

// @ts-ignore
import tdSchema from './td-schema.json' assert { type: "json" };
// @ts-ignore
import tdSchemaFull from './td-schema-full.json'assert { type: "json" };
// @ts-ignore
import tmSchema from './tm-schema.json'assert { type: "json" };

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
    Valid = "✔",
    Invalid = "✘",
    Warning = "⚠",
    Skipped = "Skipped"
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

export function validateSchema(thing: Thing): boolean {
    let time = Date.now();

    // Create AJV instance
    let ajv = new Ajv({ strict: false });
    ajv = addFormats(ajv);
    thing.isTM ? ajv.addSchema(tmSchema, "tm") : ajv.addSchema(tdSchema, "td");

    // Validate against schema
    const valid = ajv.validate(thing.isTM ? "tm" : "td", thing.json);
    if (!valid) {
        console.error(`Error validating Schema in ${thing.fileTitle}: ` + ajv.errorsText());
        thing.report.schema.result = Result.Invalid;
        thing.report.schema.message = ajv.errorsText();
        thing.report.schema.time = Date.now() - time;
        return false;
    } else {
        thing.report.schema.result = Result.Valid;
        thing.report.schema.time = Date.now() - time;
        if (!thing.isTM) {
            ajv.addSchema(tdSchemaFull, "fulltd");
            const fullValid = ajv.validate("fulltd", thing.json);
            if (fullValid) {
                thing.report.defaults.result = Result.Valid;
                thing.report.defaults.time = Date.now() - time;
            } else {
                thing.report.defaults.result = Result.Warning;
                console.error(`Warning: ${thing.fileTitle} does not conform to the TD Defaults schema: ` + ajv.errorsText());
                thing.report.defaults.message = ajv.errorsText();
                thing.report.defaults.time = Date.now() - time;
            }
        }
        return true;
    }
}

export function parseJSON(thing: Thing): boolean {
    const time = Date.now();
    try {
        thing.json = JSON.parse(thing.fileString);
        thing.report.json.result = Result.Valid;
        thing.report.json.time = Date.now() - time;
    } catch (e) {
        console.error(`Error parsing JSON file in ${thing.fileTitle}: ` + e);
        thing.report.json.result = Result.Invalid;
        thing.report.json.message = e;
        thing.report.json.time = Date.now() - time;
        return false;
    }
    return true;
}

export async function validateJsonLd(thing: Thing): Promise<boolean> {
    const time = Date.now();
    try {
        const jsonFile: JsonLdDocument = thing.json;
        await jsonld.toRDF(jsonFile, { format: "application/n-quads" });
        thing.report.jsonld.result = Result.Valid;
        thing.report.jsonld.time = Date.now() - time;
        return Promise.resolve(true);
    } catch (error) {
        console.error(`Error validating JSON-LD file in ${thing.fileTitle}: ` + error);
        thing.report.jsonld.result = Result.Invalid;
        thing.report.jsonld.time = Date.now() - time;
        thing.report.jsonld.message = error;
        return Promise.resolve(false);
    }
}

// Determine if TD or TM //
export function checkThingType(thing: Thing) {
    if (thing.json?.["@type"] === "tm:ThingModel") {
        thing.isTM = true;
    }
}
