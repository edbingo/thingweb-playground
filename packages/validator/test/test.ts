import { checkThingType, createThingObject, parseJSON, validateSchema } from "../src/validation";

const minimalThing = "./test/MinimalThing.json";
const invalidThing = "./test/invalidThing.json";
const validThing = "./test/validThing.json";
const validTM = "./test/validTM.json";

describe('Thing Object Creation', () => {
  it('should create a Thing object', () => {
    const thing = createThingObject(minimalThing);
    expect(thing).toBeDefined();
  });
  it('should have correct properties', () => {
    const thing = createThingObject(minimalThing);
    expect(thing.fileName).toBe(minimalThing);
    expect(thing.fileString).toBe('{\n' +
      '    "id": "urn:minimal",\n' +
      '    "@context": "https://www.w3.org/2022/wot/td/v1.1",\n' +
      '    "title": "MyLampThing",\n' +
      '    "description": "Valid TD with minimum information possible",\n' +
      '    "securityDefinitions": {\n' +
      '        "basic_sc": {\n' +
      '            "scheme": "basic",\n' +
      '            "in": "header"\n' +
      '        }\n' +
      '    },\n' +
      '    "security": ["basic_sc"]\n' +
      '}\n')
    expect(thing.json).toBeUndefined();
    expect(thing.isTM).toBeFalsy();
    expect(thing.valid).toBeFalsy();
    expect(thing.report).toBeDefined();
    expect(thing.fileTitle).toBe("MinimalThing.json");
    expect(thing.time).toBe(0);
  })
})

describe("Parse a JSON File", () => {
  it("should parse a JSON file", () => {
    const thing = createThingObject(minimalThing);
    parseJSON(thing);
    expect(thing.json).toBeDefined();
  });
  it("should recognise invalid JSON", () => {
    const thing = createThingObject("./test/invalidJSON.json");
    expect(parseJSON(thing)).toBeFalsy();
  });
});

describe("Perform Schema Validation", () => {
  it ("should validate a valid TD", () => {
    const thing = createThingObject(validThing);
    parseJSON(thing);
    expect(validateSchema(thing)).toBeTruthy();
  });
  it ("should recognise an invalid TD", () => {
    const thing = createThingObject(invalidThing);
    parseJSON(thing);
    expect(validateSchema(thing)).toBeFalsy();
  });
})

describe("Recognise TM or TD", () => {
  it ("should recognise a TD", () => {
    const thing = createThingObject(validThing);
    parseJSON(thing);
    checkThingType(thing);
    expect(thing.isTM).toBeFalsy();
  });
  it ("should recognise a TM", () => {
    const thing = createThingObject(validTM);
    parseJSON(thing);
    expect(thing.isTM).toBeFalsy(); // isTM is set to false by default
    checkThingType(thing);
    expect(thing.isTM).toBeTruthy();
  });
});