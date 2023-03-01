// imports

const fs = require('fs')
const path = require('path')
const commander = require('commander')
const jsonld = require("jsonld")
const Ajv = require("ajv")
const addFormats = require("ajv-formats")
const apply = require('ajv-formats-draft2019')
const builder = require('junit-report-builder')

const tdSchema = require("./td-schema.json")
const fullTdSchema = require("./td-schema-full.json")
const tmSchema = require("./tm-schema.json")

// cli config

const program = new commander.Command()
program
    .description('Validate a JSON file against a JSON schema')
    .option('-i, --input <pathToInputs...>', 'Path to the input JSON file')
    .option('--offline', 'Run in offline mode')
    .option('--junit', 'Generate a JUnit report')

const myArgs = program.parse().opts()

const logFunc = console.log

// main program

let inputArray: string[] = myArgs.input
if (inputArray === undefined) {
    inputArray = ["default"]
}

let thingPaths: string[] = []
for (let input of inputArray) {
    console.log("reading " + input)
    folderScanner(input, thingPaths)
}

let promises = []
for (let pathString of thingPaths) {
    promises.push(jsonValidate(pathString))
}

Promise.all(promises).then(() => {
    if (myArgs.junit) {
        console.log("Generating JUnit report...");
        builder.writeTo('report.xml')
    }
}).catch((err) => {
    console.log(err)
    if (myArgs.junit) {
        console.log("Generating JUnit report...");
        builder.writeTo('report.xml')
    }
})



function folderScanner(currentInput: string, results: string[]) {
    if (fs.lstatSync(currentInput).isDirectory()) {
        if (!currentInput.endsWith("/")) { currentInput += "/" }
        for (let ls of fs.readdirSync(currentInput)) {
            folderScanner(currentInput + ls, results)
        }
    }
    else if (currentInput.endsWith(".json") || currentInput.endsWith(".jsonld")) {
        results.push(currentInput)
    }
    else {
        // do nothing
    }
}

function jsonValidate(pathString: string): Promise<void> {
    let fileName = pathString.split("/").slice(-1).toString()
    let suite = builder.testSuite().name(fileName)
    let thingString = fs.readFileSync(pathString, "utf-8")
    let start = Date.now()
    let thingJson
    try {
        thingJson = JSON.parse(thingString)
        let end = Date.now()
        passTest(suite, "JSON Validation", end - start)
        if (thingJson['@type'] == "tm:ThingModel") {
            return checkThing(fileName, thingString, suite, false)
        } else {
            return checkThing(fileName, thingString, suite, true)
        }
    } catch (err) {
        logFunc("JSON Validation failed for " + pathString + ":")
        logFunc(err)
        let end = Date.now()
        failTest(suite, "JSON Validation", end - start, err)
        return Promise.resolve()
    }
}

async function checkThing(fileName: string, thingString: string, suite: any, isTD: boolean) {
    return new Promise<void>(async (resolve) => {
        let thingJson = JSON.parse(thingString)
        const report = {
            schema: "null",
            defaults: "null",
            jsonld: "null",
        }

        // schema validation

        let start = Date.now()
        let ajv = new Ajv({ strict: false })
        ajv = addFormats(ajv)
        ajv = apply(ajv)

        isTD ? ajv.addSchema(tdSchema, 'td') : ajv.addSchema(tmSchema, 'tm')

        const valid = isTD ? ajv.validate('td', thingJson) : ajv.validate('tm', thingJson)
        if (valid) {
            report.schema = "passed"
            let end = Date.now()
            passTest(suite, "Schema Validation", end - start)
            if (isTD) {
                start = Date.now()
                ajv.addSchema(fullTdSchema, 'fulltd')
                const fullValid = ajv.validate('fulltd', thingJson)
                if (fullValid) {
                    report.defaults = "passed"
                    end = Date.now()
                    passTest(suite, "Defaults Validation", end - start)
                } else {
                    report.defaults = "warning"
                    end = Date.now()
                    errorTest(suite, "Defaults Validation", end - start, ajv.errorsText())
                }
            }

        } else {
            report.schema = "failed"
            const end = Date.now()
            failTest(suite, "Schema Validation", end - start, ajv.errorsText())
            report.defaults = "skipped"
            skipTest(suite, "Defaults Validation")
            logFunc("X JSON Schema validation failed:")
            logFunc(ajv.errorsText())
        }

        start = Date.now()
        validateJsonLd(thingJson).then((result) => {
            if (result.valid) {
                report.jsonld = "passed"
                passTest(suite, "JSON LD Validation", result.time)
                console.log(fileName + " - schema: " + report.schema + ", defaults: " + report.defaults + ", jsonld: " + report.jsonld)
                resolve()
            } else {
                report.jsonld = "failed"
                failTest(suite, "JSON LD Validation", result.time, "JSON-LD validation failed.")
                console.log("JSON-LD validation failed.")
                console.log(fileName + " - schema: " + report.schema + ", defaults: " + report.defaults + ", jsonld: " + report.jsonld)
                resolve()
            }
        })

        async function validateJsonLd(jsonLd: any) {
            try {
                let start = Date.now()
                await jsonld.toRDF(jsonLd, { format: 'application/nquads' })
                let time = Date.now() - start
                return {valid: true, time: time}
            } catch (error) {
                return {valid: false, time: 0}
            }
        }
    })
}

function passTest(suite: any, name: string, time: number) {
    suite.testCase()
        .className("validator")
        .name(name)
        .time(time)
}

function failTest(suite: any, name: string, time: number, error: string) {
    suite.testCase()
        .className("validator")
        .name(name)
        .time(time)
        .failure(error)
}

function errorTest(suite: any, name: string, time: number, error: string) {
    suite.testCase()
        .className("validator")
        .name(name)
        .time(time)
        .error(error)
}

function skipTest(suite: any, name: string) {
    suite.testCase()
        .className("validator")
        .name(name)
        .skipped()
}