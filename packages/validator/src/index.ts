const fs = require('fs');
const path = require('path');
const {Command} = require('commander');
const builder = require('junit-report-builder');

const program = new Command();

program
  .version('0.0.1')
  .description(
    'A command line tool to validate the Thing Descriptions and Models'
  )
  .option(
    '-i, --input <pathToInputs...>',
    'Path to the input file or directory'
  )
  .option('--offline', 'Run the validator in offline mode')
  .option('--junit', 'Generate a JUnit report');

const myArgs = program.opts();

if (myArgs.input === undefined) {
  console.error('Please specify an input file or directory');
  throw new Error('Please specify an input file or directory');
}

for (const input of myArgs.input) {
  validateFile(input);
}

function validateFile(input: String) {
  const file = fs.readFileSync(input, 'utf8');
  const td = JSON.parse(file);
}
