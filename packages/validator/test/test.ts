const createThingObject = require('../src/refresh');

const minimalThing = "MinimalThing.json";

test('create a Thing Object'), () => {
  let thing = createThingObject(minimalThing);
  expect(thing.fileName).toBe(minimalThing);
}

test('full td verification'), () => {
  // do test
}

test('JSON verification'), () => {
  // do test
}

test('Schema verification'), () => {
  // do test
}

test('Defaults verification'), () => {
  // do test
}

test('JSON-LD verification'), () => {
  // do test
}