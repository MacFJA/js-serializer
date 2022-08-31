import { test } from "uvu";
import * as assert from "uvu/assert";
import { serialize, deserialize } from "../dist/index.mjs";

function TestClass() {
  this.name = "John";
}
TestClass.prototype.setName = function (name) {
  this.name = name;
};

function testFromDataset(dataset, validator) {
  if (validator === undefined) {
    validator = (actual, expected) => assert.equal(actual, expected);
  }
  dataset.forEach((value) => {
    const serialized = serialize(value);
    const deserialized = deserialize(serialized, { TestClass });
    validator(deserialized, value);
  });
}

test("primitives", () => {
  const input = ["foo", 42, true, false, -1.23];
  testFromDataset(input);
});

test("simple array", () => {
  const input = [[1, 3, "bar"]];
  testFromDataset(input);
});

test("simple object", () => {
  const input = [{ a: 1, b: 2 }];
  testFromDataset(input);
});

test("class", () => {
  const input = [new TestClass()];
  testFromDataset(input);
});

test("recursive", () => {
  let recursiveClass = new TestClass();
  recursiveClass.setName(recursiveClass);

  const recursiveArray = [1, 2];
  recursiveArray.push(recursiveArray);

  const recursiveObject = { a: 1 };
  recursiveObject["b"] = recursiveObject;

  const input = [recursiveClass, recursiveArray, recursiveObject];
  testFromDataset(input, (actual, expected) => {
    assert.ok(actual.toString() === expected.toString());
  });
});

test("native handled classes", () => {
  const input = [
    new Date("2021-08-07 18:54:01"),
    BigInt("123456789012345678901234567890"),
    new RegExp("/hello/", "g"),
    new String("world"),
    new Number(123),
    NaN,
    Infinity,
    -Infinity,
  ];
  testFromDataset(input);
});

test("errors classes", () => {
  const input = [
    new Error("Foobar", { cause: new Error("source") }),
    new Error("Foobar"),
    new EvalError("Foobar"),
    new RangeError("Foobar"),
    new AggregateError("Foobar"),
    new ReferenceError("Foobar"),
    new SyntaxError("Foobar"),
    new TypeError("Foobar"),
    new URIError("Foobar"),
  ];
  testFromDataset(input, (actual, expected) =>
    assert.equal(actual.toString(), expected.toString())
  );
});
test("native array classes", () => {
  var int8 = new Int8Array(2);
  int8[0] = 42;
  var iterable = (function* () {
    yield* [1, 2, 3];
  })();
  var int8bis = new Int8Array(iterable);
  const input = [
    int8,
    new Int8Array([21, 31]),
    new Int8Array(new Int8Array([21, 31])),
    new Int8Array(new ArrayBuffer(8), 1, 4),
    int8bis,
    new Uint8Array([21, 31]),
    new Uint8ClampedArray([21, 31, 1024]),
    new Int16Array([21, 31]),
    new Uint16Array([21, 31]),
    new Int32Array([21, 31]),
    new Uint32Array([21, 31]),
    new Float32Array([21, 31]),
    new Float64Array([21, 31]),
    new BigInt64Array([21n, 31n]),
    new BigUint64Array([21n, 31n]),
  ];
  testFromDataset(input);
});
test("native map classes", () => {
  const map = new Map();
  map.set("a", 1);
  map.set("b", 2);
  const set = new Set();
  set.add(42);
  set.add(123);
  set.add(0);
  const input = [map, set];
  testFromDataset(input);
});

test("complex array/object", () => {
  const input = [
    [{ a: 1, b: new Date("2021-08-07 18:54:01") }, { e: { f: 2 } }],
  ];
  testFromDataset(input);
});

test("undefined", () => {
  const input = [undefined];
  testFromDataset(input);
});

test("deserialize unexpected value", () => {
  const input = [undefined, "hello world"];
  input.forEach((value) => {
    const parsed = deserialize(value);
    assert.equal(parsed, value);
  });
});

test("deserialize standard JSON value", () => {
  const input = [
    [0, 1, 2, 3],
    { john: "doe", jeanne: "doe", 10: 20, 30: 40 },
    "john",
    10,
  ];
  input.forEach((value) => {
    const serialized = JSON.stringify(value);
    const parsed = deserialize(serialized);
    assert.equal(parsed, value);
  });
});

test.run();
