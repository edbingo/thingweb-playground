# TD Validator

This script validates a JSON file against a JSON schema. It supports the following features:

* Validation of one or more input JSON files against a JSON schema
* Offline mode (no network access required)
* Generation of a JUnit report

## Usage

The project first has to be transpiled from TypeScript to JavaScript:

```npx tsc```

To validate a TD the schema, run the script with the -i option followed by the path to the input JSON file(s):

```node ./dist/index.js -i path/to/input.json```

You can specify multiple input files by separating them with spaces:

```node ./dist/index.js -i path/to/input1.json path/to/input2.json```

If the input file(s) are not found, the script will print an error message and exit with a non-zero exit code.

Offline mode
If you want to run the script in offline mode (i.e., without network access), use the --offline option:

```node ./dist/index.js -i path/to/input.json --offline```

JUnit report
If you want to generate a JUnit report, use the --junit option:

```node ./dist/index.js -i path/to/input.json --junit```

The report will be saved in the current directory.

## License
This script is licensed under the Eclipse Public License v 2.0. See https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document for details.