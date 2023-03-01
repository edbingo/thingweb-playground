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
        /**
        let suite = builder.testSuite().name(currentInput.split("/").slice(-1))
        let thingString = fs.readFileSync(currentInput, "utf-8")
        let fail = false
        try {
            JSON.parse(thingString)
            suite.testCase()
                .className("validator")
                .name("JSON Validation")
        }
        catch (err) {
            logFunc("JSON Validation failed:")
            logFunc(err)
            suite.testCase()
                .className("cli")
                .name("JSON Validation")
                .failure(err)
            fail = true
        }
        const thingJson = JSON.parse(thingString)
        if (!fail && thingJson['@type'] == "tm:ThingModel") {
            console.log("adding tm" + currentInput.split("/").slice(-1) + " to queue")
            return { thingString: thingString, suite: suite, isTm: false }
        } else if (!fail) {
            console.log("adding td " + currentInput.split("/").slice(-1) + " to queue")
            return { thingString: thingString, suite: suite, isTm: true}
        } else {
            console.log("Invalid JSON file")
            return "invalid json file"
        }
        */
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
        suite.testCase()
            .className("validator")
            .name("JSON Validation")
            .time(end - start)
        if (thingJson['@type'] == "tm:ThingModel") {
            // console.log("adding tm" + fileName + " to queue")
            return checkThing(fileName, thingString, suite, false)
        } else {
            // console.log("adding td " + fileName + " to queue")
            return checkThing(fileName, thingString, suite, true)
        }
    } catch (err) {
        logFunc("JSON Validation failed for " + pathString + ":")
        logFunc(err)
        let end = Date.now()
        suite.testCase()
            .className("cli")
            .name("JSON Validation")
            .time(end - start)
            .failure(err)
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
            suite.testCase()
                .className("validator")
                .name("Schema Validation")
                .time(end - start)

            if (isTD) {
                start = Date.now()
                ajv.addSchema(fullTdSchema, 'fulltd')
                const fullValid = ajv.validate('fulltd', thingJson)
                if (fullValid) {
                    report.defaults = "passed"
                    end = Date.now()
                    suite.testCase()
                        .className("validator")
                        .name("Defaults Validation")
                        .time(end - start)
                } else {
                    report.defaults = "warning"
                    end = Date.now()
                    suite.testCase()
                        .className("validator")
                        .name("Defaults Validation")
                        .time(end - start)
                        .error(ajv.errorsText())
                }
            }

        } else {
            report.schema = "failed"
            const end = Date.now()
            suite.testCase()
                .className("validator")
                .name("Schema Validation")
                .time(end - start)
                .failure(ajv.errorsText())
            report.defaults = "skipped"
            suite.testCase()
                .className("validator")
                .name("Defaults Validation")
                .skipped()
            logFunc("X JSON Schema validation failed:")
            logFunc(ajv.errorsText())
        }

        start = Date.now()
        validateJsonLd(thingJson).then((result) => {
            if (result.valid) {
                report.jsonld = "passed"
                suite.testCase()
                    .className("validator")
                    .name("JSON LD Validation")
                    .time(result.time)

                console.table(report)

                console.log(fileName + " - schema: " + report.schema + ", defaults: " + report.defaults + ", jsonld: " + report.jsonld)
                resolve()
            } else {
                report.jsonld = "failed"
                suite.testCase()
                    .className("validator")
                    .name("JSON LD Validation")
                    .time(result.time)
                    .failure("JSON-LD validation failed.")
                console.log("JSON-LD validation failed.")
                console.log(report)
                resolve()
            }
        })

        /**
        validateJsonLd(thingJson).then(() => {
            report.jsonld = "passed"
            const end = Date.now()
            suite.testCase()
                .className("validator")
                .name("JSON LD Validation")
                .time(end - start)
            console.log("JSON-LD validation passed.")
            console.log(report)
        }).catch((err) => {
            console.log("JSON-LD validation failed.")
            const end = Date.now()
            suite.testCase()
                .className("validator")
                .name("JSON LD Validation")
                .time(end - start)
                .failure(err)
            report.jsonld = "failed"
            console.log("Hint: Make sure you have internet connection and the JSON-LD context is valid.")
            console.log(report)
        })
    })
    */

        /**
        // json ld validation
        if (!myArgs.offline) {
            start = Date.now()
            jsonld.toRDF(thingJson, {
                format: 'application/nquads'
            }).then((nquads: any) => {
                report.jsonld = "passed"
                console.log("JSON-LD validation passed.")
                const end = Date.now()
                suite.testCase()
                    .className("validator")
                    .name("JSON LD Validation")
                    .time(end - start)
     
                console.log(report)
     
     
            }, (err: string) => {
                report.jsonld = "failed"
                const end = Date.now()
                suite.testCase()
                    .className("validator")
                    .name("JSON LD Validation")
                    .time(end - start)
                    .failure(err)
                logFunc("X JSON-LD validation failed:")
                logFunc("Hint: Make sure you have internet connection available.")
                logFunc('> ' + err)
                console.log(report)
     
            })
        }
        */

        /**
        function validateJsonLd(jsonLd: any) {
            return new Promise((resolve, reject) => {
                try {
                    let start = Date.now()
                    jsonld.toRDF(jsonLd, { format: 'application/nquads' })
                        .then()
                } catch (error) {
                    console.log("JSON-LD validation failed.");
                    reject(error)
                }
            })
        }
        */

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