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
    expect(thing.json).toBeUndefined();
    expect(thing.isTM).toBeFalsy();
    expect(thing.valid).toBeFalsy();
    expect(thing.report).toBeDefined();
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
    const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const thing = createThingObject("./test/invalidJSON.json");
    expect(parseJSON(thing)).toBeFalsy();
    expect(spy).toHaveBeenCalledWith('invalidJSON.json json fail: SyntaxError: Unexpected token \'d\', "dsifjaölkwfeölkja" is not valid JSON');
  });
});

describe("Perform Schema Validation", () => {
  it ("should validate a valid TD", () => {
    const thing = createThingObject(validThing);
    parseJSON(thing);
    expect(validateSchema(thing)).toBeTruthy();
  });
  it ("should recognise an invalid TD", () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const thing = createThingObject(invalidThing);
    parseJSON(thing);
    expect(validateSchema(thing)).toBeFalsy();
    expect(spy).toHaveBeenCalledWith("invalidThing.json schema fail: data/actions/toggle/forms/0/op must be string, data/actions/toggle/forms/0/op must be equal to one of the allowed values, data/actions/toggle/forms/0/op/0 must be equal to one of the allowed values, data/actions/toggle/forms/0/op must match exactly one schema in oneOf")
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