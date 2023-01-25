"use strict";
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const builder = require('junit-report-builder');
const program = new Command();
program
    .version('0.0.1')
    .description('A command line tool to validate the Thing Descriptions and Models')
    .option('-i, --input <pathToInputs...>', 'Path to the input file or directory')
    .option('--offline', 'Run the validator in offline mode')
    .option('--junit', 'Generate a JUnit report');
const myArgs = program.opts();
//# sourceMappingURL=index.js.map