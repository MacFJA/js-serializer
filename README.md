# Javascript data serializer

Transform any object, class, array, primitive to a serialized string and vice-versa

![NPM bundle size](https://img.shields.io/bundlephobia/minzip/@macfja/serializer)
![Download per week](https://img.shields.io/npm/dw/@macfja/serializer)
![License](https://img.shields.io/npm/l/@macfja/serializer)
![NPM version](https://img.shields.io/npm/v/@macfja/serializer)
![Snyk Vulnerabilities for npm package](https://img.shields.io/snyk/vulnerabilities/npm/@macfja/serializer)

## Installation

```shell
npm install @macfja/serializer
# or
yarn add @macfja/serializer
# or
pnpm add @macfja/serializer
```

## Usage

```js
import { serialize, deserialize } from "@macfja/serializer";

const serialized = serialize({ any: "data", you: "want" });
// serialized is a string

const myData = deserialize(serialized);
// myData is now `{any: 'data', you: 'want'}`
```

```js
import {
  serialize,
  deserialize,
  addGlobalAllowedClass,
} from "@macfja/serializer";

function MyClass(data) {
  this.data = data;
}
MyClass.prototype.getData = function () {
  return this.data;
};
addGlobalAllowedClass(MyClass);

let myInstance = new MyData("john");

const serialized = serialize(myInstance);
// serialized is a string

const myData = deserialize(serialized);
console.log(myData.getData()); // "john"
```

### Utilities usage

```js
import { serialize, getCollectedClasses } from "@macfja/serializer";

const serialized = serialize(myComplexData);
// serialized is a string
const usedClasses = getCollectedClasses(true);
// usedClasses contains the list of classes found during the serialization
```

```js
import { addClassHandler } from "@macfja/serializer";

function MyClass() {
  this.name = "doe";
}
MyClass.prototype.setName = function (name) {
  this.name = name;
};
MyClass.prototype.getName = function () {
  return this.name;
};

addClassHandler(
  "MyClass",
  (data) => ({ name: data.getName() }),
  (plain) => {
    const value = new MyClass();
    value.setName(plain.name);
    return value;
  }
);

// Now  `serialize` and `deserialize` will use your custom serializer / deserializer
// for any instance of `MyClass`
```

## Feature

- Serialize any data, primitive, array, object, class, and any combination
- Handle Javascript native classes (`Date`, `BigInt`, `String`, `RegExp`, `Number`, `Map`, `Set`, `ArrayBuffer`, `DataView`, `Error`, `EvalError`, `RangeError`, `AggregateError`, `ReferenceError`, `SyntaxError`, `TypeError`, `URIError`, `Int8Array`, `Uint8Array`, `Uint8ClampedArray`, `Int16Array`, `Uint16Array`, `Int32Array`, `Uint32Array`, `Float32Array`, `Float64Array`, `BigInt64Array`, `BigUint64Array`)
- Handle data recursion

## Contributing

Contributions are welcome. Please open up an issue or create PR if you would like to help out.

Read more in the [Contributing file](CONTRIBUTING.md)

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.
